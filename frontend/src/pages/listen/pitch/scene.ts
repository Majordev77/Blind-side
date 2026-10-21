/**
 * Broadcast-style pitch scene: pure functions of the clip and time t.
 *
 * World space is metres: X 0..105 goal to goal, Y 0..68 far to near
 * touchline, Z height. `project` maps it to a flat "camera in the main
 * stand" picture; the camera then pans and zooms that picture.
 * Nothing here keeps state, so any frame can be drawn from t alone.
 */

import { ballPosition, type MatchClip, type MatchEvent, type TeamSide } from '@/demo'
import sceneData from '@/demo/bicycle-kick-2018.scene.json'

export const W = 105
export const H = 68
export const VB_W = 160
export const VB_H = 110
/** Screen point the camera centre maps to. */
const SCREEN_CX = VB_W / 2
const SCREEN_CY = 55
/** Projected height of the pitch (far to near touchline). */
const PH = 42

// ---------------------------------------------------------------------------
// Scene data

interface ScenePlayer {
  id: string
  team: string
  name?: string
  path: number[][]
}

interface SceneData {
  clipId: string
  keyTimes: number[]
  players: ScenePlayer[]
  touches: Array<{ player: string; from: number; to: number }>
  ballArcs: Record<string, { start?: number; end?: number; peak?: number }>
  leap?: { player: string; eventId: string; lead: number; duration: number; height: number }
  save?: { player: string; eventId: string; dy: number }
}

const SCENES: Record<string, SceneData> = {
  [sceneData.clipId]: sceneData as SceneData,
}

export function sceneFor(clip: MatchClip): SceneData | undefined {
  return SCENES[clip.id]
}

// ---------------------------------------------------------------------------
// Maths

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k
export const smooth = (k: number) => {
  const c = clamp(k, 0, 1)
  return c * c * (3 - 2 * c)
}
/** 0 before a, 1 after b, smooth in between. */
export const ramp = (t: number, a: number, b: number) => smooth((t - a) / (b - a))

export const toWorld = (x: number, y: number): [number, number] => [(x / 100) * W, (y / 100) * H]

/** Horizontal scale at depth Y (far side is smaller). */
export const depthScale = (Y: number) => 0.8 + 0.2 * (Y / H)

/** World metres to the flat projected picture. */
export function project(X: number, Y: number, Z = 0): [number, number] {
  const d = Y / H
  const s = 0.8 + 0.2 * d
  return [W / 2 + (X - W / 2) * s, PH * d * (0.8 + 0.2 * d) - Z * s * 0.95]
}

const r2 = (n: number) => Math.round(n * 100) / 100
const pt = (p: [number, number]) => `${r2(p[0])} ${r2(p[1])}`

/** SVG path through world points (Z = 0 unless given). */
function polyPath(points: Array<[number, number, number?]>, close = false): string {
  return (
    points.map((p, i) => `${i ? 'L' : 'M'}${pt(project(p[0], p[1], p[2] ?? 0))}`).join('') +
    (close ? 'Z' : '')
  )
}

function arcPoints(cx: number, cy: number, r: number, a0: number, a1: number, n: number) {
  const out: Array<[number, number]> = []
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n
    out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)])
  }
  return out
}

// ---------------------------------------------------------------------------
// Static geometry (computed once at module load)

const rect = (x0: number, y0: number, x1: number, y1: number) =>
  polyPath(
    [
      [x0, y0],
      [x1, y0],
      [x1, y1],
      [x0, y1],
    ],
    true,
  )

export const GRASS_PATH = rect(-40, -4, W + 40, H + 12)

/** Light mowing stripes: every other 7.5 m band across the length. */
export const STRIPES_PATH = Array.from({ length: 7 }, (_, i) => rect(i * 15, 0, i * 15 + 7.5, H)).join('')

export const PITCH_OUTLINE = rect(0, 0, W, H)

export const MARKINGS_PATH = (() => {
  const parts: string[] = [PITCH_OUTLINE, polyPath([[W / 2, 0], [W / 2, H]])]
  parts.push(polyPath(arcPoints(W / 2, H / 2, 9.15, 0, Math.PI * 2, 40), true))
  for (const side of [0, 1]) {
    const gx = side ? W : 0
    const dir = side ? -1 : 1
    parts.push(polyPath([[gx, (H - 40.32) / 2], [gx + dir * 16.5, (H - 40.32) / 2], [gx + dir * 16.5, (H + 40.32) / 2], [gx, (H + 40.32) / 2]]))
    parts.push(polyPath([[gx, (H - 18.32) / 2], [gx + dir * 5.5, (H - 18.32) / 2], [gx + dir * 5.5, (H + 18.32) / 2], [gx, (H + 18.32) / 2]]))
    // Penalty arc: the part of the 9.15 m circle outside the box.
    const spot = gx + dir * 11
    const a = Math.acos(5.5 / 9.15)
    const mid = side ? Math.PI : 0
    parts.push(polyPath(arcPoints(spot, H / 2, 9.15, mid - a, mid + a, 14)))
    // Corner arcs
    for (const cy of [0, H]) {
      const start = cy === 0 ? (side ? Math.PI / 2 : 0) : side ? Math.PI : -Math.PI / 2
      parts.push(polyPath(arcPoints(gx, cy, 1, start, start + Math.PI / 2, 4)))
    }
  }
  return parts.join('')
})()

export const SPOTS_PATH = [
  [W / 2, H / 2],
  [11, H / 2],
  [W - 11, H / 2],
]
  .map(([x, y]) => polyPath(arcPoints(x ?? 0, y ?? 0, 0.35, 0, Math.PI * 2, 8), true))
  .join('')

/** Advertising boards along the far touchline (plain, no brands). */
export const BOARDS_PATH = polyPath(
  [
    [-40, -3.5, 0],
    [W + 40, -3.5, 0],
    [W + 40, -3.5, 1.1],
    [-40, -3.5, 1.1],
  ],
  true,
)

export const STAND_PATH = polyPath(
  [
    [-40, -3.5, 1.1],
    [W + 40, -3.5, 1.1],
    [W + 40, -3.5, 30],
    [-40, -3.5, 30],
  ],
  true,
)

// ---------------------------------------------------------------------------
// Goals and nets

const GOAL_HALF = 7.32 / 2
const BAR = 2.44
const NET_DEPTH = 2
const NET_BACK_TOP = 1.8

/** Goal frame (posts and bar) for the goal at X = 0 (side 0) or X = W (side 1). */
export function goalFramePath(side: 0 | 1): string {
  const gx = side ? W : 0
  const y0 = H / 2 - GOAL_HALF
  const y1 = H / 2 + GOAL_HALF
  return polyPath([[gx, y0, 0], [gx, y0, BAR], [gx, y1, BAR], [gx, y1, 0]])
}

/**
 * Net mesh as one path. `bulge` (metres) pushes the back of the net
 * outward around (bulgeY, bulgeZ), for the goal ripple.
 */
export function netPath(side: 0 | 1, bulge = 0, bulgeY = H / 2, bulgeZ = 1): string {
  const gx = side ? W : 0
  const dir = side ? 1 : -1
  const y0 = H / 2 - GOAL_HALF
  const y1 = H / 2 + GOAL_HALF
  const push = (Y: number, Z: number) =>
    bulge ? bulge * Math.exp(-((Y - bulgeY) ** 2) / 5 - ((Z - bulgeZ) ** 2) / 0.9) : 0
  const back = (Y: number, Z: number): [number, number, number] => [gx + dir * (NET_DEPTH + push(Y, Z)), Y, Z]
  const parts: string[] = []
  const COLS = 12
  const ROWS = 4
  for (let i = 0; i <= COLS; i++) {
    const Y = y0 + ((y1 - y0) * i) / COLS
    const top = NET_BACK_TOP
    // Back vertical, then the roof line to the crossbar.
    const col: Array<[number, number, number]> = []
    for (let j = 0; j <= ROWS; j++) col.push(back(Y, (top * j) / ROWS))
    col.push([gx, Y, BAR])
    parts.push(polyPath(col))
  }
  for (let j = 1; j <= ROWS; j++) {
    const row: Array<[number, number, number]> = []
    for (let i = 0; i <= COLS; i++) {
      const Y = y0 + ((y1 - y0) * i) / COLS
      row.push(back(Y, (NET_BACK_TOP * j) / ROWS))
    }
    parts.push(polyPath(row))
  }
  // Side panels
  for (const Y of [y0, y1]) {
    for (let j = 0; j < ROWS; j++) {
      const Z = (NET_BACK_TOP * j) / ROWS
      parts.push(polyPath([[gx, Y, (BAR * j) / ROWS], back(Y, Z)]))
    }
  }
  return parts.join('')
}

// ---------------------------------------------------------------------------
// Camera

export interface Camera {
  cx: number
  cy: number
  zoom: number
}

/** Wide, fixed camera: the whole pitch, for reduced motion. */
export const WIDE_CAMERA: Camera = { cx: W / 2, cy: PH / 2, zoom: 1.43 }

/** Broadcast camera: follows the ball with a lag, pushes in for the climax. */
export function cameraAt(clip: MatchClip, t: number, goalT: number | undefined): Camera {
  const push = goalT === undefined ? 0 : ramp(t, goalT - 3.5, goalT - 1) - ramp(t, goalT + 6, goalT + 10)
  const zoom = 2.1 + 0.65 * push
  let sum = 0
  const N = 7
  for (let i = 0; i < N; i++) {
    const b = ballPosition(clip, Math.max(0, t - (i * 1.4) / (N - 1)))
    sum += project((b.x / 100) * W, H / 2)[0]
  }
  const target = sum / N + 10
  const half = VB_W / 2 / zoom
  return { cx: clamp(target, -12 + half, W + 12 - half), cy: PH / 2 + 3.5 * push, zoom }
}

export const cameraTransform = (c: Camera) =>
  `translate(${SCREEN_CX} ${SCREEN_CY}) scale(${r2(c.zoom * 1000) / 1000}) translate(${r2(-c.cx)} ${r2(-c.cy)})`

export const toScreen = (c: Camera, p: [number, number]): [number, number] => [
  (p[0] - c.cx) * c.zoom + SCREEN_CX,
  (p[1] - c.cy) * c.zoom + SCREEN_CY,
]

// ---------------------------------------------------------------------------
// Ball height

/** Ball height in metres at t, from the scene's arc for the current flight. */
export function ballHeight(clip: MatchClip, scene: SceneData | undefined, t: number): number {
  let z = 0
  let landT = 0
  let landZ = 0
  for (const ev of clip.events) {
    if (ev.t > t) break
    if (ev.type === 'crowd' || ev.type === 'end') continue
    const arc = scene?.ballArcs[ev.id]
    const dur = ev.duration ?? 0.8
    if (ev.endX !== undefined && t < ev.t + dur) {
      const k = clamp((t - ev.t) / dur, 0, 1)
      const s = arc?.start ?? 0
      const e = arc?.end ?? 0
      const p = arc?.peak ?? 0
      z = lerp(s, e, k) + 4 * p * k * (1 - k)
      landZ = 0
    } else if (ev.endX !== undefined) {
      landT = ev.t + dur
      landZ = arc?.end ?? 0
      z = 0
    } else {
      z = 0
    }
  }
  if (landZ > 0) {
    const k = (t - landT) / 0.45
    z = landZ * Math.max(0, 1 - k * k)
  }
  return z
}

// ---------------------------------------------------------------------------
// Players

export interface PlayerState {
  id: string
  team: TeamSide
  name?: string
  X: number
  Y: number
  Z: number // body lift (leap), metres
  tilt: number // degrees, for leap and dive
  stretch: number // 0..1, body elongates when horizontal
}

function pathAt(scene: SceneData, path: number[][], t: number): [number, number] {
  const kt = scene.keyTimes
  const first = path[0] ?? [50, 50]
  if (t <= (kt[0] ?? 0)) return [first[0] ?? 50, first[1] ?? 50]
  for (let i = 0; i < kt.length - 1; i++) {
    const a = kt[i] ?? 0
    const b = kt[i + 1] ?? a
    if (t <= b) {
      const p = path[i] ?? first
      const q = path[i + 1] ?? p
      const k = smooth((t - a) / Math.max(0.001, b - a))
      return [lerp(p[0] ?? 50, q[0] ?? 50, k), lerp(p[1] ?? 50, q[1] ?? 50, k)]
    }
  }
  const last = path[path.length - 1] ?? first
  return [last[0] ?? 50, last[1] ?? 50]
}

const TOUCH_RAMP = 0.7
const CARRIER_OFFSET = 1.6 // clip units behind the ball

export function playersAt(
  clip: MatchClip,
  scene: SceneData,
  t: number,
  reducedMotion: boolean,
): PlayerState[] {
  const evById = new Map(clip.events.map((e) => [e.id, e]))
  return scene.players.map((pl) => {
    let [x, y] = pathAt(scene, pl.path, t)
    const team: TeamSide = pl.team === 'home' ? 'home' : 'away'
    const dir = team === clip.attacking ? -1 : 1

    // Players on the ball are drawn to it, so the ball always has a carrier.
    for (const touch of scene.touches) {
      if (touch.player !== pl.id) continue
      let w = 0
      let at = t
      if (t < touch.from) {
        w = ramp(t, touch.from - TOUCH_RAMP, touch.from)
        at = touch.from
      } else if (t <= touch.to) {
        w = 1
      } else {
        w = 1 - ramp(t, touch.to, touch.to + TOUCH_RAMP)
        at = touch.to
      }
      if (w > 0) {
        const b = ballPosition(clip, at)
        x = lerp(x, b.x + dir * CARRIER_OFFSET, w)
        y = lerp(y, b.y, w)
      }
    }

    let Z = 0
    let tilt = 0
    let stretch = 0
    const leap = scene.leap
    if (leap && leap.player === pl.id && !reducedMotion) {
      const ev = evById.get(leap.eventId)
      if (ev) {
        const k = (t - (ev.t - leap.lead)) / leap.duration
        if (k > 0 && k < 1) {
          const s = Math.sin(Math.PI * k)
          Z = leap.height * s
          tilt = -85 * s
          stretch = s
        }
      }
    }
    const save = scene.save
    if (save && save.player === pl.id) {
      const ev = evById.get(save.eventId)
      if (ev) {
        const dive = ramp(t, ev.t + 0.05, ev.t + 0.35) * (1 - ramp(t, ev.t + 0.9, ev.t + 1.5))
        y += save.dy * dive // positions move in reduced motion too
        if (!reducedMotion) {
          tilt = -75 * dive
          stretch = dive
          Z = -0.5 * dive
        }
      }
    }
    const [X, Y] = toWorld(x, y)
    return { id: pl.id, team, name: pl.name, X, Y, Z, tilt, stretch }
  })
}

// ---------------------------------------------------------------------------
// Events

export function firstEvent(clip: MatchClip, type: MatchEvent['type']): MatchEvent | undefined {
  return clip.events.find((e) => e.type === type)
}

/** Score after every goal event at or before t. */
export function scoreAt(clip: MatchClip, t: number): [number, number] {
  let score = clip.scoreAtStart
  for (const ev of clip.events) {
    if (ev.t > t) break
    if (ev.score) score = ev.score
  }
  return score
}

/** Match minute as football counts it: 63:19 is the 64th minute. */
export function minuteOf(clip: MatchClip, t: number): number {
  return Math.floor((clip.clockStart + t) / 60) + 1
}

export const lastName = (full: string | undefined) => (full ? (full.split(' ').pop() ?? full) : '')

export const TAG: Record<MatchEvent['type'], string> = {
  possession: 'POSSESSION',
  pass: 'PASS',
  carry: 'ON THE BALL',
  cross: 'CROSS',
  pressure: 'PRESSURE',
  tackle: 'TACKLE',
  shot: 'SHOT',
  overhead_kick: 'OVERHEAD KICK',
  goal: 'GOAL',
  crowd: 'CROWD',
  end: 'END',
}

/** Greedy word wrap into at most `maxLines` lines. */
export function wrap(text: string, maxChars: number, maxLines: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word
    if (next.length > maxChars && line) {
      lines.push(line)
      line = word
    } else {
      line = next
    }
  }
  if (line) lines.push(line)
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines)
    kept[maxLines - 1] = `${kept[maxLines - 1] ?? ''}…`
    return kept
  }
  return lines
}
