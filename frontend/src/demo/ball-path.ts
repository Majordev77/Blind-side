import type { MatchClip, MatchEvent, TeamSide } from './types'

export interface BallState {
  x: number
  y: number
  team: TeamSide | undefined
  inFlight: boolean // the ball is travelling (pass, cross, shot)
}

const TRAVELLING = new Set(['pass', 'cross', 'shot', 'overhead_kick', 'carry'])

const lerp = (a: number, b: number, k: number) => a + (b - a) * k

/**
 * Where the ball is at time t (seconds from clip start).
 *
 * Between events the ball sits at the end point of the last travelling
 * event, or at the last event's position. During a travelling event it
 * moves in a straight line from (x, y) to (endX, endY).
 */
export function ballPosition(clip: MatchClip, t: number): BallState {
  let state: BallState = { x: 50, y: 50, team: undefined, inFlight: false }
  for (const ev of clip.events) {
    if (ev.t > t) break
    if (ev.type === 'crowd' || ev.type === 'end') continue
    const team = ev.team ?? state.team
    if (TRAVELLING.has(ev.type) && ev.endX !== undefined && ev.endY !== undefined) {
      const dur = ev.duration ?? 0.8
      const k = Math.min(1, (t - ev.t) / dur)
      state = { x: lerp(ev.x, ev.endX, k), y: lerp(ev.y, ev.endY, k), team, inFlight: k < 1 }
    } else {
      state = { x: ev.x, y: ev.y, team, inFlight: false }
    }
  }
  return state
}

/**
 * Sample points for scheduling audio automation: one keyframe at every
 * event start and end, plus intermediate points every `step` seconds.
 */
export function ballKeyframes(clip: MatchClip, step = 0.1): Array<BallState & { t: number }> {
  const frames: Array<BallState & { t: number }> = []
  for (let t = 0; t <= clip.duration; t += step) {
    frames.push({ t: Math.round(t * 1000) / 1000, ...ballPosition(clip, t) })
  }
  return frames
}

/** The last event at or before t, for captions and the evidence view. */
export function eventAt(clip: MatchClip, t: number): MatchEvent | undefined {
  let found: MatchEvent | undefined
  for (const ev of clip.events) {
    if (ev.t > t) break
    found = ev
  }
  return found
}

/** Match clock text, e.g. "63:12". */
export function clockText(clip: MatchClip, t: number): string {
  const total = Math.max(0, Math.floor(clip.clockStart + t))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
