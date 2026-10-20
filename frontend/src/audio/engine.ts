/**
 * Blind Side sound engine (CONTRACT STUB, the audio engineer fills it in).
 *
 * Keep these public signatures: the Listen page depends on them.
 */

import type { MatchClip } from '@/demo/types'

export interface PlayOptions {
  favouritePlayer?: string // plays the personal chime when this player touches the ball
}

export class SoundEngine {
  readonly ctx: AudioContext
  onEnded: (() => void) | null = null
  private startAt = 0
  private isPlaying = false

  /** Creates the AudioContext. Call synchronously inside the user's tap. */
  constructor() {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    this.ctx = new Ctor()
  }

  /** Resumes the context. Rejects with a plain Error if sound cannot start. */
  async unlock(): Promise<void> {
    await this.ctx.resume()
    if (this.ctx.state !== 'running') throw new Error('Audio is still suspended')
  }

  /** Stops anything playing, then schedules the whole clip from now. */
  play(clip: MatchClip, _opts: PlayOptions = {}): void {
    this.stop()
    this.startAt = this.ctx.currentTime + 0.15
    this.isPlaying = true
    const osc = this.ctx.createOscillator()
    osc.frequency.value = 440
    osc.connect(this.ctx.destination)
    osc.start(this.startAt)
    osc.stop(this.startAt + 0.3)
    window.setTimeout(() => {
      this.isPlaying = false
      this.onEnded?.()
    }, clip.duration * 1000)
  }

  stop(): void {
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
  setDuck(_on: boolean): void {}

  /** Exaggerate left/right for laptop and venue speakers. */
  setSpeakersMode(_on: boolean): void {}
}
