/**
 * Demo data contracts
 *
 * Shared by the sound engine, the Listen page, the 2D pitch and the
 * commentary pipeline. Change these only together with every user.
 *
 * Pitch coordinates: x runs 0..100 goal to goal, and the team in
 * `clip.attacking` attacks toward x = 100 (the listener's right ear).
 * y runs 0..100 across the pitch, 0 = far touchline, 100 = near touchline.
 */

export type TeamSide = 'home' | 'away'

export type EventType =
  | 'possession' // a team settles on the ball
  | 'pass'
  | 'carry' // a player runs with the ball
  | 'cross'
  | 'pressure' // defenders close in on the ball carrier
  | 'tackle'
  | 'shot'
  | 'overhead_kick'
  | 'goal'
  | 'crowd' // crowd reaction, see `mood`
  | 'end' // end of the clip

export interface MatchEvent {
  id: string // "ev_001", cited as evidence by commentary lines
  t: number // seconds from the start of the clip
  type: EventType
  team?: TeamSide
  player?: string // only when public reports agree on who it was
  receiver?: string
  x: number // where the event starts
  y: number
  endX?: number // where the ball ends up, for passes, crosses and shots
  endY?: number
  duration?: number // seconds the ball travels, defaults to 0.8
  pressure?: number // 0..1, for 'pressure' events
  power?: number // 0..1, for shots, drives the sweep speed
  mood?: 'surprise' | 'applause' | 'roar' | 'murmur'
  score?: [number, number] // home, away, after a goal
  label: string // plain-language description, shown in the evidence view
}

export interface Team {
  name: string
  short: string
}

export interface OfficialVideo {
  provider: 'youtube'
  id: string // YouTube video id
  channel: string // channel display name, e.g. "Real Madrid"
  title: string
  offset: number // video time in seconds that matches clip t = 0
}

export interface MatchClip {
  id: string
  title: string
  competition: string
  date: string // ISO date
  venue: string
  rightsNote: string
  teams: Record<TeamSide, Team>
  attacking: TeamSide // attacks toward x = 100 in this clip
  clockStart: number // match clock in seconds at t = 0 (approximate)
  scoreAtStart: [number, number]
  duration: number // seconds
  events: MatchEvent[]
  /** Optional official upload shown with the provider's own embedded player. Delete to switch off. */
  officialVideo?: OfficialVideo
}

export type Lang = 'en' | 'pcm' | 'yo'
export type Detail = 'essentials' | 'full' | 'analyst'

export interface CommentaryLine {
  id: string
  t: number // when to start speaking, seconds from clip start
  expires: number // latest start time; skip the line if it cannot start by then
  priority: 1 | 2 | 3 // 1 = must air
  lang: Lang
  detail: Detail
  text: string
  evidence: string[] // MatchEvent ids that prove every claim in the line
  favourite?: string // only aired when the listener's favourite player is this
  fallback?: boolean // true if the verifier replaced the drafted line with a template
}

export interface Commentary {
  clipId: string
  generatedBy: string
  verifiedAt: string
  lines: CommentaryLine[]
}
