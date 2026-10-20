/**
 * Blind Side sound engine.
 *
 * Sound carries position: a soft tone tracks the ball between the ears
 * (HRTF, or a hard stereo pan in speakers mode), its pitch follows the
 * touchline and its timbre the team in possession. Short synthesised
 * one-shots mark passes, crosses, pressure, tackles, shots, the overhead
 * kick and the goal, over a synthesised crowd bed.
 *
 * Everything for a clip is scheduled up front against AudioContext time
 * (startAt = currentTime + 0.15). No setTimeout chains, no audio files.
 *
 * Graph:
 *   per-sound nodes -> [HRTF panner -> hrtfMix | StereoPanner -> stereoMix] -> duck
 *   crowd bed / crowd layers / chime (centred, wide)                         -> duck
 *   duck -> master -> DynamicsCompressor -> destination
 *
 * Layers: ball tone + crowd bed + at most one one-shot. A new one-shot
 * cuts the previous one (50 ms fade) if it is still ringing. The ball tone
 * stops at the goal and the crowd carries the end.
 */

import type { MatchClip, MatchEvent, TeamSide } from '@/demo/types'
import { ballKeyframes } from '@/demo/ball-path'
import { makeApplause, makeBrownNoise, makeClick, makeWhiteNoise } from './buffers'

export interface PlayOptions {
  favouritePlayer?: string // plays the personal chime when this player touches the ball
  /** Play the ball tone (default true). Used by auditionSound. */
  ball?: boolean
  /** Play the looping crowd bed (default true). Used by auditionSound. */
  crowdBed?: boolean
}

const LEAD = 0.15 // seconds between play() and the first scheduled sound
const MASTER_LEVEL = 0.8
const BALL_LEVEL = 0.16
const BED_LEVEL = 0.4
const DUCK_LEVEL = 0.25 // about -12 dB
const MODE_FADE = 0.25 // seconds, HRTF <-> stereo crossfade

/** Events where a player touches the ball (personal chime candidates). */
const TOUCHES = new Set(['possession', 'pass', 'carry', 'cross', 'shot', 'overhead_kick', 'tackle'])

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Stereo pan for pitch x: -1 at the left goal, +1 at the right goal. */
export const panFor = (x: number) => clamp((x - 50) / 50, -1, 1)
/** HRTF position: x -4..+4 left to right, slightly in front of the listener. */
const hrtfX = (x: number) => panFor(x) * 4
const hrtfY = (y: number) => ((50 - clamp(y, 0, 100)) / 100) * 0.6
const hrtfZ = (y: number) => -(0.8 + ((100 - clamp(y, 0, 100)) / 100) * 1.2) // near touchline = closer
/** Ball pitch: far touchline (y = 0) 520 Hz, near touchline (y = 100) 330 Hz. */
export const pitchFor = (y: number) => 520 - (clamp(y, 0, 100) / 100) * 190

type GroupKind = 'oneShot' | 'crowd'
interface Group {
  start: number
  end: number
  gains: GainNode[]
}
interface Point {
  t: number
  x: number
  y: number
}

export class SoundEngine {
  readonly ctx: AudioContext
  onEnded: (() => void) | null = null
  private startAt = 0
  private isPlaying = false

  private readonly master: GainNode
  private readonly compressor: DynamicsCompressorNode
  private readonly duck: GainNode
  private readonly hrtfMix: GainNode
  private readonly stereoMix: GainNode
  private speakers = false

  private readonly white: AudioBuffer
  private readonly click: AudioBuffer
  private brownBuf: AudioBuffer | null = null
  private applauseBuf: AudioBuffer | null = null

  private sources: AudioScheduledSourceNode[] = []
  private nodes: AudioNode[] = []
  private groups: Record<GroupKind, Group | null> = { oneShot: null, crowd: null }
  private bedLevel: GainNode | null = null
  private playId = 0

  /** Creates the AudioContext and the master graph. Call synchronously inside the user's tap. */
  constructor() {
    const Ctor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    this.ctx = new Ctor()
    const ctx = this.ctx

    this.compressor = ctx.createDynamicsCompressor()
    this.compressor.threshold.value = -12
    this.compressor.knee.value = 6
    this.compressor.ratio.value = 8
    this.compressor.attack.value = 0.003
    this.compressor.release.value = 0.25
    this.compressor.connect(ctx.destination)

    this.master = ctx.createGain()
    this.master.gain.value = MASTER_LEVEL
    this.master.connect(this.compressor)

    this.duck = ctx.createGain()
    this.duck.gain.value = 1
    this.duck.connect(this.master)

    this.hrtfMix = ctx.createGain()
    this.stereoMix = ctx.createGain()
    this.hrtfMix.gain.value = this.speakers ? 0 : 1
    this.stereoMix.gain.value = this.speakers ? 1 : 0
    this.hrtfMix.connect(this.duck)
    this.stereoMix.connect(this.duck)

    // Small buffers only here, so the constructor stays cheap inside a tap.
    this.white = makeWhiteNoise(ctx, 2)
    this.click = makeClick(ctx)
  }

  /**
   * Resumes the context and plays a one-sample silent buffer (iOS unlock).
   * Rejects with a plain Error if the context is not running within ~1.5 s.
   */
  async unlock(): Promise<void> {
    const ctx = this.ctx
    try {
      const b = ctx.createBuffer(1, 1, ctx.sampleRate)
      const s = ctx.createBufferSource()
      s.buffer = b
      s.connect(ctx.destination)
      s.start(0)
    } catch {
      // ignore, resume() below is what matters on most browsers
    }
    const resumed = ctx.resume().catch(() => undefined)
    const deadline = performance.now() + 1500
    await Promise.race([resumed, wait(1500)])
    while ((ctx.state as string) !== 'running' && performance.now() < deadline) await wait(50)
    if ((ctx.state as string) !== 'running') throw new Error('Audio is still suspended')
  }

  /** Stops anything playing, then schedules the whole clip from now. */
  play(clip: MatchClip, opts: PlayOptions = {}): void {
    this.stop()
    const id = this.playId
    const t0 = this.ctx.currentTime + LEAD
    this.startAt = t0
    this.isPlaying = true

    const events = [...clip.events].filter((e) => e.t <= clip.duration).sort((a, b) => a.t - b.t)
    const goal = events.find((e) => e.type === 'goal')
    const ballStop = t0 + (goal ? goal.t : Math.max(0, clip.duration - 0.2))

    if (opts.crowdBed !== false) this.scheduleCrowdBed(t0, clip.duration)
    if (opts.ball !== false) this.scheduleBall(clip, t0, ballStop)

    for (const ev of events) {
      this.scheduleEvent(ev, t0 + ev.t, events)
      this.scheduleChime(ev, t0 + ev.t, opts.favouritePlayer)
    }

    // End marker: a silent source whose onended fires at the clip end, on audio time.
    const marker = this.ctx.createOscillator()
    const silent = this.gain(0)
    marker.connect(silent).connect(this.master)
    marker.start(t0)
    marker.stop(t0 + clip.duration)
    marker.onended = () => {
      if (id !== this.playId || !this.isPlaying) return
      this.teardown()
      this.isPlaying = false
      this.onEnded?.()
    }
    this.sources.push(marker)
  }

  stop(): void {
    this.playId++
    this.teardown()
    this.isPlaying = false
  }

  get playing(): boolean {
    return this.isPlaying
  }

  /** Seconds since the clip started, from ctx.currentTime. 0 before play. */
  get clipTime(): number {
    return this.isPlaying ? Math.max(0, this.ctx.currentTime - this.startAt) : 0
  }

  /** Drop all sound about 12 dB while the voice speaks. */
  setDuck(on: boolean): void {
    const now = this.ctx.currentTime
    const g = this.duck.gain
    g.cancelScheduledValues(now)
    g.setValueAtTime(g.value, now)
    g.linearRampToValueAtTime(on ? DUCK_LEVEL : 1, now + (on ? 0.15 : 0.4))
  }

  /** Exaggerate left/right for laptop and venue speakers (stereo pan instead of HRTF). */
  setSpeakersMode(on: boolean): void {
    this.speakers = on
    const now = this.ctx.currentTime
    for (const [g, v] of [
      [this.hrtfMix.gain, on ? 0 : 1],
      [this.stereoMix.gain, on ? 1 : 0],
    ] as const) {
      g.cancelScheduledValues(now)
      g.setValueAtTime(g.value, now)
      g.linearRampToValueAtTime(v, now + MODE_FADE)
    }
  }

  get speakersMode(): boolean {
    return this.speakers
  }

  // ---------------------------------------------------------------- layers

  private scheduleBall(clip: MatchClip, t0: number, stopT: number): void {
    const frames = ballKeyframes(clip, 0.1)
    // Possession for timbre: a 'pressure' event carries the pressing team, not the team on the ball.
    const possession = ballKeyframes({ ...clip, events: clip.events.filter((e) => e.type !== 'pressure') }, 0.1)
    const warmTeam: TeamSide = clip.attacking
    const end = stopT + 0.3

    // Warm voice: sine plus a little triangle, low-passed.
    const sine = this.tone('sine', 440, t0, end)
    const tri = this.tone('triangle', 440, t0, end)
    const warmLP = this.filter('lowpass', 1200, 0.5)
    sine.connect(this.gain(1)).connect(warmLP)
    tri.connect(this.gain(0.2)).connect(warmLP)
    const warm = this.gain(0)
    warmLP.connect(warm)

    // Hollow voice: square + triangle through a resonant low-pass (odd harmonics, clarinet-like).
    const sq = this.tone('square', 440, t0, end)
    const tri2 = this.tone('triangle', 440, t0, end)
    const hollowLP = this.filter('lowpass', 1600, 4)
    sq.connect(this.gain(0.22)).connect(hollowLP)
    tri2.connect(this.gain(0.55)).connect(hollowLP)
    const hollow = this.gain(0)
    hollowLP.connect(hollow)

    // Gentle 3 Hz amplitude pulse (0.6..1.0).
    const pulse = this.gain(0.8)
    warm.connect(pulse)
    hollow.connect(pulse)
    const lfo = this.tone('sine', 3, t0, end)
    lfo.connect(this.gain(0.2)).connect(pulse.gain)

    const level = this.gain(0)
    level.gain.setValueAtTime(0, t0)
    level.gain.linearRampToValueAtTime(BALL_LEVEL, t0 + 0.4)
    level.gain.setValueAtTime(BALL_LEVEL, stopT)
    level.gain.linearRampToValueAtTime(0, stopT + 0.15)
    pulse.connect(level)

    const panner = this.makePanner()
    const sp = this.ctx.createStereoPanner()
    this.nodes.push(sp)
    level.connect(panner).connect(this.hrtfMix)
    level.connect(sp).connect(this.stereoMix)

    const freqs = [sine.frequency, tri.frequency, sq.frequency, tri2.frequency]
    let lastTeam: TeamSide | undefined
    frames.forEach((f, i) => {
      const tf = t0 + f.t
      if (tf > stopT + 0.2) return
      const first = i === 0
      const set = (p: AudioParam, v: number) => (first ? p.setValueAtTime(v, tf) : p.linearRampToValueAtTime(v, tf))
      const hz = pitchFor(f.y)
      for (const p of freqs) set(p, hz)
      set(sp.pan, panFor(f.x))
      this.setPos(panner, tf, f.x, f.y, !first)
      const team = possession[i]?.team ?? lastTeam ?? warmTeam
      if (team !== lastTeam) {
        const isWarm = team === warmTeam
        const tc = first ? 0.005 : 0.06
        warm.gain.setTargetAtTime(isWarm ? 1 : 0, tf, tc)
        hollow.gain.setTargetAtTime(isWarm ? 0 : 0.75, tf, tc)
        lastTeam = team
      }
    })
  }

  private scheduleCrowdBed(t0: number, dur: number): void {
    const end = t0 + dur
    const src = this.noise(t0, end + 0.05, this.brown())
    const low = this.filter('bandpass', 380, 0.6)
    const high = this.filter('bandpass', 1150, 1.1)
    const am = this.gain(1)
    src.connect(low).connect(am)
    src.connect(high).connect(this.gain(0.45)).connect(am)
    // Slow random amplitude modulation, pre-scheduled on audio time.
    for (let s = 0; s < dur; s += 0.5) am.gain.setTargetAtTime(0.7 + 0.6 * Math.random(), t0 + s, 0.35)
    const level = this.gain(0)
    level.gain.setValueAtTime(0, t0)
    level.gain.linearRampToValueAtTime(BED_LEVEL, t0 + 1.0)
    level.gain.setTargetAtTime(0, Math.max(t0 + 1, end - 1.5), 0.35)
    am.connect(level).connect(this.duck)
    this.bedLevel = level
  }

  // ---------------------------------------------------------------- events

  private scheduleEvent(ev: MatchEvent, t: number, events: MatchEvent[]): void {
    switch (ev.type) {
      case 'pass':
        return this.sPass(ev, t)
      case 'cross':
        return this.sCross(ev, t)
      case 'pressure':
        return this.sPressure(ev, t)
      case 'tackle':
        return this.sTackle(ev, t)
      case 'shot':
        return this.sShot(ev, t, isSaved(ev, events))
      case 'overhead_kick':
        return this.sOverhead(ev, t)
      case 'goal':
        return this.sGoal(ev, t)
      case 'crowd':
        return this.sCrowd(ev, t)
      default:
        return // possession, carry, end: the ball tone says it
    }
  }

  /** Short filtered noise click; longer and lower for longer passes. */
  private sPass(ev: MatchEvent, t: number): void {
    const dist = Math.hypot((ev.endX ?? ev.x) - ev.x, (ev.endY ?? ev.y) - ev.y)
    const k = clamp(dist / 60, 0, 1)
    const dur = 0.035 + 0.13 * k
    const end = t + dur + 0.15
    const slot = this.slot('oneShot', t, end)
    slot.connect(this.place(t, ev.x, ev.y))
    this.noise(t, end).connect(this.filter('bandpass', 3400 - 2300 * k, 1.4)).connect(this.env(t, 1.3, 0.003, dur)).connect(slot)
    const o = this.tone('sine', 1100 - 500 * k, t, t + 0.1)
    o.frequency.setValueAtTime(1100 - 500 * k, t)
    o.frequency.exponentialRampToValueAtTime(450 - 150 * k, t + 0.06)
    o.connect(this.env(t, 0.18, 0.002, 0.05)).connect(slot)
  }

  /** Longer swoosh that travels from the start to the end of the cross. */
  private sCross(ev: MatchEvent, t: number): void {
    const travel = ev.duration ?? 0.8
    const dur = travel + 0.15
    const end = t + dur + 0.1
    const slot = this.slot('oneShot', t, end)
    slot.connect(this.place(t, ev.x, ev.y, { t: t + travel, x: ev.endX ?? ev.x, y: ev.endY ?? ev.y }))
    const bp = this.filter('bandpass', 600, 2.2)
    bp.frequency.setValueAtTime(600, t)
    bp.frequency.exponentialRampToValueAtTime(2400, t + travel * 0.45)
    bp.frequency.exponentialRampToValueAtTime(900, t + dur)
    const g = this.gain(0)
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(1.6, t + travel * 0.4)
    g.gain.linearRampToValueAtTime(0.9, t + travel)
    g.gain.linearRampToValueAtTime(0, t + dur)
    this.noise(t, end).connect(bp).connect(g).connect(slot)
  }

  /** Pulse train speeding up over 1.5 s; harder pressure = faster pulses. */
  private sPressure(ev: MatchEvent, t: number): void {
    const p = clamp(ev.pressure ?? 0.5, 0, 1)
    const dur = 1.5
    const r0 = 2.5 + 2 * p
    const r1 = 5 + 10 * p
    const end = t + dur + 0.1
    const slot = this.slot('oneShot', t, end)
    slot.connect(this.place(t, ev.x, ev.y))
    const o = this.tone('triangle', 620, t, end)
    o.frequency.setValueAtTime(620, t)
    o.frequency.linearRampToValueAtTime(620 + 200 * p, t + dur)
    const g = this.gain(0)
    for (let s = 0; s < dur; s += 1 / (r0 + ((r1 - r0) * s) / dur)) {
      const tp = t + s
      g.gain.setValueAtTime(0, tp)
      g.gain.linearRampToValueAtTime(0.32, tp + 0.006)
      g.gain.setTargetAtTime(0, tp + 0.006, 0.018)
    }
    o.connect(g).connect(slot)
  }

  /** Low thud: sine dropping 120 -> 50 Hz plus a little low noise. */
  private sTackle(ev: MatchEvent, t: number): void {
    const end = t + 0.5
    const slot = this.slot('oneShot', t, end)
    slot.connect(this.place(t, ev.x, ev.y))
    this.thud(t, end, slot, 0.8)
  }

  /**
   * Rising sweep; faster and higher for harder shots. A saved shot (no
   * goal follows) stops on a dull glove/parry thump plus a crowd "ooh".
   */
  private sShot(ev: MatchEvent, t: number, saved: boolean): void {
    const power = clamp(ev.power ?? 0.6, 0, 1)
    const travel = ev.duration ?? 0.8
    const sweep = 0.6 - 0.35 * power
    const hit = t + Math.min(travel, sweep) // when the ball arrives (save) or the sweep peaks
    const end = (saved ? hit + 0.4 : t + sweep + 0.2)
    const ex = ev.endX ?? ev.x
    const ey = ev.endY ?? ev.y
    const slot = this.slot('oneShot', t, end)
    slot.connect(this.place(t, ev.x, ev.y, { t: hit, x: ex, y: ey }))
    const stopSweep = saved ? hit : t + sweep

    const o = this.tone('triangle', 260, t, stopSweep + 0.1)
    o.frequency.setValueAtTime(260, t)
    o.frequency.exponentialRampToValueAtTime(1100 + 700 * power, t + sweep)
    const og = this.gain(0)
    og.gain.setValueAtTime(0, t)
    og.gain.linearRampToValueAtTime(0.32, stopSweep - 0.01)
    og.gain.linearRampToValueAtTime(0, stopSweep + (saved ? 0.02 : 0.08))
    o.connect(og).connect(slot)

    const bp = this.filter('bandpass', 800, 1.5)
    bp.frequency.setValueAtTime(800, t)
    bp.frequency.exponentialRampToValueAtTime(3500, t + sweep)
    const ng = this.gain(0)
    ng.gain.setValueAtTime(0, t)
    ng.gain.linearRampToValueAtTime(1.0, stopSweep - 0.01)
    ng.gain.linearRampToValueAtTime(0, stopSweep + (saved ? 0.02 : 0.08))
    this.noise(t, stopSweep + 0.1).connect(bp).connect(ng).connect(slot)

    if (saved) {
      // Parry: a dull padded thump (muffled noise + low sine), at the ball's end point.
      this.thud(hit, end, slot, 0.7, 180)
      this.crowdOoh(hit + 0.1)
    }
  }

  /**
   * The bicycle kick: a fast high rising whoosh (noise band sweeping up,
   * 0.25 s) ending in a sharp crack (bright noise burst + click).
   */
  private sOverhead(ev: MatchEvent, t: number): void {
    const W = 0.25
    const tc = t + W
    const end = tc + 0.25
    const slot = this.slot('oneShot', t, end)
    slot.connect(this.place(t, ev.x, ev.y, { t: t + Math.max(W, ev.duration ?? 0.35), x: ev.endX ?? ev.x, y: ev.endY ?? ev.y }))

    const bp = this.filter('bandpass', 500, 3.5)
    bp.frequency.setValueAtTime(500, t)
    bp.frequency.exponentialRampToValueAtTime(6500, tc)
    const wg = this.gain(0)
    wg.gain.setValueAtTime(0.05, t)
    wg.gain.linearRampToValueAtTime(2.2, tc - 0.01)
    wg.gain.linearRampToValueAtTime(0, tc + 0.01)
    this.noise(t, tc + 0.05).connect(bp).connect(wg).connect(slot)

    const glide = this.tone('sine', 900, t, tc + 0.05)
    glide.frequency.setValueAtTime(900, t)
    glide.frequency.exponentialRampToValueAtTime(2800, tc)
    const gg = this.gain(0)
    gg.gain.setValueAtTime(0, t)
    gg.gain.linearRampToValueAtTime(0.12, tc - 0.01)
    gg.gain.linearRampToValueAtTime(0, tc + 0.01)
    glide.connect(gg).connect(slot)

    // Crack.
    this.noise(tc, end).connect(this.filter('highpass', 2200, 0.7)).connect(this.env(tc, 1.0, 0.0008, 0.07)).connect(slot)
    const c = this.ctx.createBufferSource()
    c.buffer = this.click
    c.start(tc)
    this.sources.push(c)
    c.connect(this.gain(0.7)).connect(slot)
  }

  /** Net swish with a decaying ripple, at the goal. */
  private sGoal(ev: MatchEvent, t: number): void {
    const end = t + 1.0
    const slot = this.slot('oneShot', t, end)
    slot.connect(this.place(t, ev.x, ev.y))
    const ripple = this.gain(0.6)
    const lfo = this.tone('sine', 17, t, end)
    const depth = this.gain(0.4)
    depth.gain.setValueAtTime(0.4, t)
    depth.gain.linearRampToValueAtTime(0, t + 0.9)
    lfo.connect(depth).connect(ripple.gain)
    this.noise(t, end)
      .connect(this.filter('bandpass', 2600, 0.7))
      .connect(this.filter('highpass', 900, 0.7))
      .connect(this.env(t, 1.6, 0.025, 0.75))
      .connect(ripple)
      .connect(slot)
  }

  private sCrowd(ev: MatchEvent, t: number): void {
    switch (ev.mood) {
      case 'surprise':
        return this.crowdSurprise(t)
      case 'applause':
        return this.crowdApplause(t)
      case 'roar':
        return this.crowdRoar(t)
      case 'murmur':
      default:
        return this.crowdMurmur(t)
    }
  }

  /** A beat of stunned near-silence, then a fast swell and a bright gasp/roar. */
  private crowdSurprise(t: number): void {
    const swell = t + 0.3
    this.bedTo(t, BED_LEVEL * 0.35, 0.05)
    this.bedTo(swell, BED_LEVEL * 3, 0.1)
    this.bedTo(swell + 1.2, BED_LEVEL * 1.6, 1.0)
    const end = swell + 4.5
    const slot = this.slot('crowd', t, end)
    slot.connect(this.duck)
    const bp = this.filter('bandpass', 700, 0.8)
    bp.frequency.setValueAtTime(700, swell)
    bp.frequency.exponentialRampToValueAtTime(1800, swell + 0.35)
    bp.frequency.setTargetAtTime(1100, swell + 0.6, 0.8)
    const g = this.gain(0)
    g.gain.setValueAtTime(0, swell)
    g.gain.linearRampToValueAtTime(1.4, swell + 0.18)
    g.gain.setTargetAtTime(0, swell + 0.5, 0.9)
    this.noise(swell, end, this.brown()).connect(bp).connect(g).connect(slot)
  }

  /** Dense clapping texture, 1-3 kHz, fading out over ~7.5 s. */
  private crowdApplause(t: number): void {
    const buf = this.applause()
    this.bedTo(t, BED_LEVEL * 1.3, 0.5)
    const end = t + buf.duration
    const slot = this.slot('crowd', t, end)
    slot.connect(this.duck)
    const s = this.ctx.createBufferSource()
    s.buffer = buf
    s.start(t)
    this.sources.push(s)
    s.connect(this.filter('bandpass', 1900, 0.55)).connect(this.gain(1.1)).connect(slot)
  }

  private crowdRoar(t: number): void {
    this.bedTo(t, BED_LEVEL * 2.5, 0.4)
    this.bedTo(t + 3, BED_LEVEL * 1.3, 1.2)
    const end = t + 7
    const slot = this.slot('crowd', t, end)
    slot.connect(this.duck)
    const src = this.noise(t, end, this.brown())
    const g = this.gain(0)
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(1.2, t + 0.8)
    g.gain.setTargetAtTime(0, t + 3, 1.2)
    src.connect(this.filter('bandpass', 600, 0.5)).connect(g)
    src.connect(this.filter('bandpass', 1400, 0.9)).connect(this.gain(0.5)).connect(g)
    g.connect(slot)
  }

  private crowdMurmur(t: number): void {
    this.bedTo(t, BED_LEVEL * 1.4, 0.8)
    this.bedTo(t + 4, BED_LEVEL, 1.0)
    const end = t + 7
    const slot = this.slot('crowd', t, end)
    slot.connect(this.duck)
    const g = this.gain(0)
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.8, t + 1)
    g.gain.setTargetAtTime(0, t + 3.5, 0.8)
    this.noise(t, end, this.brown()).connect(this.filter('bandpass', 320, 1)).connect(g).connect(slot)
  }

  /** Short crowd "ooh" after a save: a vowel-like band of crowd noise that rises and falls. */
  private crowdOoh(t: number): void {
    this.bedTo(t, BED_LEVEL * 1.8, 0.15)
    this.bedTo(t + 0.8, BED_LEVEL, 0.8)
    const end = t + 2.2
    const slot = this.slot('crowd', t, end)
    slot.connect(this.duck)
    const bp = this.filter('bandpass', 380, 2)
    bp.frequency.setValueAtTime(380, t)
    bp.frequency.linearRampToValueAtTime(650, t + 0.35)
    bp.frequency.linearRampToValueAtTime(420, t + 1.4)
    const g = this.gain(0)
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(1.6, t + 0.3)
    g.gain.setTargetAtTime(0, t + 0.6, 0.4)
    this.noise(t, end, this.brown()).connect(bp).connect(g).connect(slot)
  }

  /** Personal chime when the favourite player touches (or receives) the ball. */
  private scheduleChime(ev: MatchEvent, t: number, fav: string | undefined): void {
    if (!fav || !TOUCHES.has(ev.type)) return
    if (ev.player === fav) this.chime(t + 0.02, true)
    if (ev.receiver === fav) this.chime(t + (ev.duration ?? 0.8), false)
  }

  /** Two bell-ish notes, 1320 Hz then 1760 Hz, centred. */
  private chime(t: number, joinEvent: boolean): void {
    const end = t + 0.8
    const slot = this.slot('oneShot', joinEvent ? t - 0.02 : t, end, joinEvent)
    slot.connect(this.duck)
    for (const [f, dt] of [
      [1320, 0],
      [1760, 0.12],
    ] as const) {
      const s = t + dt
      const env = this.env(s, 0.22, 0.003, 0.45)
      this.tone('sine', f, s, end).connect(env)
      this.tone('sine', f * 2.76, s, end).connect(this.gain(0.25)).connect(env)
      env.connect(slot)
    }
  }

  // ---------------------------------------------------------------- helpers

  /**
   * Layer slot. A new group cuts the previous group of the same kind if it
   * is still ringing. `join` adds to the group that started at the same
   * time (the chime on the event that triggered it).
   */
  private slot(kind: GroupKind, t: number, end: number, join = false): GainNode {
    const g = this.gain(1)
    const cur = this.groups[kind]
    if (join && cur && Math.abs(cur.start - t) < 1e-3) {
      cur.gains.push(g)
      cur.end = Math.max(cur.end, end)
      return g
    }
    if (cur && cur.end > t) {
      for (const pg of cur.gains) {
        pg.gain.setValueAtTime(1, t)
        pg.gain.linearRampToValueAtTime(0, t + 0.05)
      }
    }
    this.groups[kind] = { start: t, end, gains: [g] }
    return g
  }

  /** Positions a sound (optionally moving) on both the HRTF and the stereo path. Returns its input. */
  private place(t: number, x: number, y: number, to?: Point): GainNode {
    const input = this.gain(1)
    const p = this.makePanner()
    const s = this.ctx.createStereoPanner()
    this.nodes.push(s)
    this.setPos(p, t, x, y, false)
    s.pan.setValueAtTime(panFor(x), t)
    if (to) {
      this.setPos(p, to.t, to.x, to.y, true)
      s.pan.linearRampToValueAtTime(panFor(to.x), to.t)
    }
    input.connect(p).connect(this.hrtfMix)
    input.connect(s).connect(this.stereoMix)
    return input
  }

  private makePanner(): PannerNode {
    const p = this.ctx.createPanner()
    p.panningModel = 'HRTF'
    p.distanceModel = 'linear'
    p.refDistance = 1
    p.maxDistance = 50
    p.rolloffFactor = 0.3
    this.nodes.push(p)
    return p
  }

  private setPos(p: PannerNode, t: number, x: number, y: number, ramp: boolean): void {
    const X = hrtfX(x)
    const Y = hrtfY(y)
    const Z = hrtfZ(y)
    if ('positionX' in p && p.positionX) {
      const pairs: Array<[AudioParam, number]> = [
        [p.positionX, X],
        [p.positionY, Y],
        [p.positionZ, Z],
      ]
      for (const [param, v] of pairs) {
        if (ramp) param.linearRampToValueAtTime(v, t)
        else param.setValueAtTime(v, t)
      }
    } else if (!ramp) {
      // Old Safari: no automatable position; the stereo path still moves.
      ;(p as PannerNode).setPosition(X, Y, Z)
    }
  }

  /** Dull thump: sine pitch drop plus a little low-passed noise. */
  private thud(t: number, end: number, out: AudioNode, peak: number, from = 120): void {
    const o = this.tone('sine', from, t, end)
    o.frequency.setValueAtTime(from, t)
    o.frequency.exponentialRampToValueAtTime(50, t + 0.22)
    o.connect(this.env(t, peak, 0.004, 0.3)).connect(out)
    this.noise(t, end).connect(this.filter('lowpass', 350, 0.7)).connect(this.env(t, peak * 0.9, 0.002, 0.06)).connect(out)
  }

  /** Moves the crowd bed level toward `v` from time t (no-op if the bed is off). */
  private bedTo(t: number, v: number, tc: number): void {
    this.bedLevel?.gain.setTargetAtTime(v, t, tc)
  }

  /** Gain node: 0 before t, linear attack to peak, exponential-ish decay. */
  private env(t: number, peak: number, attack: number, decay: number): GainNode {
    const g = this.gain(0)
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(peak, t + attack)
    g.gain.setTargetAtTime(0, t + attack, decay / 3)
    return g
  }

  private gain(v: number): GainNode {
    const g = this.ctx.createGain()
    g.gain.value = v
    this.nodes.push(g)
    return g
  }

  private filter(type: BiquadFilterType, freq: number, q: number): BiquadFilterNode {
    const f = this.ctx.createBiquadFilter()
    f.type = type
    f.frequency.value = freq
    f.Q.value = q
    this.nodes.push(f)
    return f
  }

  private tone(type: OscillatorType, freq: number, t: number, stopT: number): OscillatorNode {
    const o = this.ctx.createOscillator()
    o.type = type
    o.frequency.value = freq
    o.start(t)
    o.stop(stopT)
    this.sources.push(o)
    return o
  }

  private noise(t: number, stopT: number, buffer: AudioBuffer = this.white): AudioBufferSourceNode {
    const s = this.ctx.createBufferSource()
    s.buffer = buffer
    s.loop = true
    s.start(t, Math.random() * Math.max(0, buffer.duration - 0.1))
    s.stop(stopT)
    this.sources.push(s)
    return s
  }

  private brown(): AudioBuffer {
    if (!this.brownBuf) this.brownBuf = makeBrownNoise(this.ctx, 8)
    return this.brownBuf
  }

  private applause(): AudioBuffer {
    if (!this.applauseBuf) this.applauseBuf = makeApplause(this.ctx, 7.5)
    return this.applauseBuf
  }

  /** Stops and disconnects every scheduled node and cancels its automation. */
  private teardown(): void {
    for (const s of this.sources) {
      s.onended = null
      try {
        s.stop()
      } catch {
        // already stopped
      }
    }
    for (const n of [...this.sources, ...this.nodes]) {
      for (const p of paramsOf(n)) p.cancelScheduledValues(0)
      try {
        n.disconnect()
      } catch {
        // already disconnected
      }
    }
    this.sources = []
    this.nodes = []
    this.groups = { oneShot: null, crowd: null }
    this.bedLevel = null
  }
}

/** A shot is saved (not scored) when no goal follows within its flight plus a second. */
function isSaved(shot: MatchEvent, events: MatchEvent[]): boolean {
  const limit = shot.t + (shot.duration ?? 0.8) + 1
  return !events.some((e) => e.type === 'goal' && e.t >= shot.t && e.t <= limit)
}

function paramsOf(n: AudioNode): AudioParam[] {
  if (n instanceof GainNode) return [n.gain]
  if (n instanceof BiquadFilterNode) return [n.frequency, n.Q]
  if (n instanceof StereoPannerNode) return [n.pan]
  if (n instanceof OscillatorNode) return [n.frequency]
  if (n instanceof PannerNode && 'positionX' in n && n.positionX) return [n.positionX, n.positionY, n.positionZ]
  return []
}

function wait(ms: number): Promise<void> {
  return new Promise((r) => window.setTimeout(r, ms))
}
