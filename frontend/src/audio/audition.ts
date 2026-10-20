/**
 * Audition single sounds of the vocabulary (for testing and the sound
 * tutorial). Each name plays a tiny synthetic clip through the real engine,
 * so what you hear is exactly what the match uses.
 *
 * Dev console: window.__bsAudition('overhead_kick')  (click the page once first)
 *              window.__bsAudition('ball-left-right', { speakers: true })
 *              window.__bsAuditionNames
 */

import type { MatchClip, MatchEvent } from '@/demo/types'
import { SoundEngine } from './engine'

export const AUDITION_NAMES = [
  'ball-left-right',
  'ball-touchline',
  'ball-teams',
  'pass-short',
  'pass-long',
  'cross',
  'pressure',
  'tackle',
  'shot-soft',
  'shot-hard',
  'shot-saved',
  'overhead_kick',
  'goal',
  'chime',
  'crowd-bed',
  'surprise',
  'applause',
  'roar',
  'murmur',
  'bicycle-kick',
] as const
export type AuditionName = (typeof AUDITION_NAMES)[number]

const CHIME_PLAYER = 'Audition Player'

type Ev = Omit<MatchEvent, 'id' | 'label'>

function clip(duration: number, evs: Ev[]): MatchClip {
  return {
    id: 'audition',
    title: 'Audition',
    competition: '',
    date: '',
    venue: '',
    rightsNote: '',
    teams: { home: { name: 'Home', short: 'HOM' }, away: { name: 'Away', short: 'AWY' } },
    attacking: 'away',
    clockStart: 0,
    scoreAtStart: [0, 0],
    duration,
    events: evs.map((e, i) => ({ ...e, id: `au_${i}`, label: e.type })),
  }
}

function recipe(name: AuditionName): { clip: MatchClip; ball: boolean; crowdBed: boolean; fav?: string } {
  const oneShot = (duration: number, evs: Ev[]) => ({ clip: clip(duration, evs), ball: false, crowdBed: false })
  switch (name) {
    case 'ball-left-right':
      return { clip: clip(7, [{ t: 0, type: 'carry', team: 'away', x: 2, y: 50, endX: 98, endY: 50, duration: 6 }]), ball: true, crowdBed: false }
    case 'ball-touchline':
      return { clip: clip(6, [{ t: 0, type: 'carry', team: 'away', x: 50, y: 0, endX: 50, endY: 100, duration: 5 }]), ball: true, crowdBed: false }
    case 'ball-teams':
      return {
        clip: clip(6, [
          { t: 0, type: 'possession', team: 'away', x: 50, y: 50 },
          { t: 3, type: 'possession', team: 'home', x: 50, y: 50 },
        ]),
        ball: true,
        crowdBed: false,
      }
    case 'pass-short':
      return oneShot(1.5, [{ t: 0.2, type: 'pass', x: 40, y: 50, endX: 48, endY: 50, duration: 0.6 }])
    case 'pass-long':
      return oneShot(1.5, [{ t: 0.2, type: 'pass', x: 30, y: 80, endX: 80, endY: 20, duration: 1.2 }])
    case 'cross':
      return oneShot(2, [{ t: 0.2, type: 'cross', x: 84, y: 91, endX: 92, endY: 50, duration: 1.1 }])
    case 'pressure':
      return oneShot(2.2, [{ t: 0.2, type: 'pressure', x: 60, y: 58, pressure: 0.8 }])
    case 'tackle':
      return oneShot(1.2, [{ t: 0.2, type: 'tackle', x: 50, y: 50 }])
    case 'shot-soft':
      return oneShot(1.5, [{ t: 0.2, type: 'shot', x: 80, y: 50, endX: 100, endY: 50, duration: 0.6, power: 0.2 }, { t: 1.0, type: 'goal', x: 100, y: 50 }])
    case 'shot-hard':
      return oneShot(1.5, [{ t: 0.2, type: 'shot', x: 80, y: 50, endX: 100, endY: 50, duration: 0.3, power: 0.95 }, { t: 1.0, type: 'goal', x: 100, y: 50 }])
    case 'shot-saved':
      return { clip: clip(3.5, [{ t: 0.2, type: 'shot', x: 86, y: 56, endX: 99, endY: 50, duration: 0.4, power: 0.6 }]), ball: false, crowdBed: true }
    case 'overhead_kick':
      return oneShot(1.2, [{ t: 0.2, type: 'overhead_kick', x: 92, y: 50, endX: 100, endY: 46, duration: 0.35, power: 0.9 }])
    case 'goal':
      return oneShot(1.5, [{ t: 0.2, type: 'goal', x: 100, y: 46 }])
    case 'chime':
      return { ...oneShot(1.2, [{ t: 0.2, type: 'possession', player: CHIME_PLAYER, x: 50, y: 50 }]), fav: CHIME_PLAYER }
    case 'crowd-bed':
      return { clip: clip(8, []), ball: false, crowdBed: true }
    case 'surprise':
    case 'applause':
    case 'roar':
    case 'murmur':
      return { clip: clip(name === 'applause' ? 10 : 7, [{ t: 0.8, type: 'crowd', mood: name, x: 50, y: 50 }]), ball: false, crowdBed: true }
    case 'bicycle-kick':
      return {
        clip: clip(12, [
          { t: 0, type: 'possession', team: 'away', x: 84, y: 91 },
          { t: 0.5, type: 'cross', team: 'away', x: 84, y: 91, endX: 92, endY: 50, duration: 1.1 },
          { t: 1.6, type: 'overhead_kick', team: 'away', x: 92, y: 50, endX: 100, endY: 46, duration: 0.35, power: 0.9 },
          { t: 1.95, type: 'goal', team: 'away', x: 100, y: 46 },
          { t: 2.2, type: 'crowd', mood: 'surprise', x: 50, y: 50 },
          { t: 5, type: 'crowd', mood: 'applause', x: 50, y: 50 },
        ]),
        ball: true,
        crowdBed: true,
      }
  }
}

/** Plays one named sound through `engine` (stops whatever it was playing). */
export function auditionSound(engine: SoundEngine, name: AuditionName, opts: { speakers?: boolean } = {}): void {
  const r = recipe(name)
  if (opts.speakers !== undefined) engine.setSpeakersMode(opts.speakers)
  void engine.ctx.resume()
  engine.play(r.clip, { ball: r.ball, crowdBed: r.crowdBed, favouritePlayer: r.fav })
}

// Dev-only console hook, with its own engine so it never disturbs the Listen page.
if (import.meta.env.DEV && typeof window !== 'undefined') {
  let own: SoundEngine | null = null
  const w = window as unknown as Record<string, unknown>
  w.__bsAuditionNames = AUDITION_NAMES
  w.__bsAudition = (name: AuditionName, opts?: { speakers?: boolean }) => {
    if (!AUDITION_NAMES.includes(name)) return `Unknown sound. Try one of: ${AUDITION_NAMES.join(', ')}`
    own ??= new SoundEngine()
    auditionSound(own, name, opts)
    return `playing ${name}`
  }
  w.__bsAuditionStop = () => own?.stop()
}
