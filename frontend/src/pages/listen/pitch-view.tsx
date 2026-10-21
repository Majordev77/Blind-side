import { memo } from 'react'
import { ballPosition, clockText, eventAt, type MatchClip, type MatchEvent, type TeamSide } from '@/demo'
import {
  BOARDS_PATH,
  GRASS_PATH,
  H,
  MARKINGS_PATH,
  PITCH_OUTLINE,
  SPOTS_PATH,
  STAND_PATH,
  STRIPES_PATH,
  TAG,
  VB_H,
  VB_W,
  WIDE_CAMERA,
  ballHeight,
  cameraAt,
  cameraTransform,
  clamp,
  depthScale,
  firstEvent,
  goalFramePath,
  lastName,
  minuteOf,
  netPath,
  playersAt,
  project,
  ramp,
  sceneFor,
  scoreAt,
  toScreen,
  toWorld,
  wrap,
} from './pitch/scene'
import './pitch/pitch.css'

interface Props {
  clip: MatchClip
  t: number
  reducedMotion: boolean
}

/** Readable without colour vision: white with a dark ring vs black with a light ring. */
const DOT: Record<TeamSide | 'none', { fill: string; stroke: string }> = {
  away: { fill: '#ffffff', stroke: '#111111' },
  home: { fill: '#111111', stroke: '#ffffff' },
  none: { fill: '#ffffff', stroke: '#111111' },
}

const GOLD = '#ffd400'
const NAVY = '#0b1a2e'
const TRAIL_SAMPLES = 7
const TRAIL_STEP = 0.035

function describe(clip: MatchClip, t: number): string {
  const b = ballPosition(clip, t)
  const attackers = clip.teams[clip.attacking].name
  const defenders = clip.teams[clip.attacking === 'away' ? 'home' : 'away'].name
  const along =
    b.x < 33 ? `in ${attackers}'s own third` : b.x < 67 ? 'in midfield' : `near the ${defenders} goal`
  const across = b.y < 33 ? 'on the far side' : b.y > 67 ? 'on the near side' : 'in the centre'
  const team = b.team ? `${clip.teams[b.team].name} have the ball` : 'Ball loose'
  return `${team}, ${along}, ${across}.`
}

const fmt = (n: number) => Math.round(n * 100) / 100

// ---------------------------------------------------------------------------
// Static layers (memoised: they never change between frames)

const StaticPitch = memo(function StaticPitch() {
  return (
    <g>
      <defs>
        <linearGradient id="pv-stand" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#05080c" />
          <stop offset="1" stopColor="#1b2632" />
        </linearGradient>
        <linearGradient id="pv-grass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#23692f" />
          <stop offset="1" stopColor="#2f8a3d" />
        </linearGradient>
        <pattern id="pv-crowd" width="2.2" height="1.6" patternUnits="userSpaceOnUse">
          <circle cx="0.5" cy="0.5" r="0.32" fill="#8fa3b8" fillOpacity="0.22" />
          <circle cx="1.6" cy="1.2" r="0.32" fill="#c9d4df" fillOpacity="0.16" />
        </pattern>
      </defs>
      <path d={STAND_PATH} fill="url(#pv-stand)" />
      <path d={STAND_PATH} fill="url(#pv-crowd)" />
      <path d={GRASS_PATH} fill="url(#pv-grass)" />
      <path d={STRIPES_PATH} fill="#ffffff" fillOpacity={0.07} />
      <path d={BOARDS_PATH} fill="#162433" stroke="#3b5068" strokeWidth={0.15} />
      <path d={MARKINGS_PATH} fill="none" stroke="#ffffff" strokeOpacity={0.9} strokeWidth={0.28} strokeLinejoin="round" />
      <path d={SPOTS_PATH} fill="#ffffff" />
      <path d={netPath(0)} fill="none" stroke="#ffffff" strokeOpacity={0.45} strokeWidth={0.1} />
      <path d={goalFramePath(0)} fill="none" stroke="#ffffff" strokeWidth={0.4} strokeLinejoin="round" />
    </g>
  )
})

const Goal = memo(function Goal({ side, bulge, bulgeY }: { side: 0 | 1; bulge: number; bulgeY: number }) {
  return (
    <g>
      <path d={netPath(side, bulge, bulgeY, 0.9)} fill="none" stroke="#ffffff" strokeOpacity={0.5} strokeWidth={0.1} />
      <path d={goalFramePath(side)} fill="none" stroke="#ffffff" strokeWidth={0.4} strokeLinejoin="round" />
    </g>
  )
})

// ---------------------------------------------------------------------------

function crowdGlow(clip: MatchClip, t: number): number {
  let ev: MatchEvent | undefined
  for (const e of clip.events) {
    if (e.t > t) break
    if (e.type === 'crowd') ev = e
  }
  if (!ev) return 0
  const dt = t - ev.t
  if (ev.mood === 'applause') {
    return ramp(dt, 0, 1) * (0.25 + 0.2 * Math.sin(dt * 7.3) * Math.sin(dt * 2.1 + 1))
  }
  if (ev.mood === 'roar') return 0.6 * Math.exp(-dt * 0.8)
  // surprise / murmur: one soft pulse
  return 0.35 * Math.sin(Math.PI * clamp(dt / 1.4, 0, 1))
}

export function PitchView({ clip, t, reducedMotion }: Props) {
  const scene = sceneFor(clip)
  const ev = eventAt(clip, t)
  const goalEv = firstEvent(clip, 'goal')
  const kickEv = firstEvent(clip, 'overhead_kick')
  const saveEv = scene?.save ? clip.events.find((e) => e.id === scene.save?.eventId) : undefined
  const motion = !reducedMotion

  const cam = motion ? cameraAt(clip, t, goalEv?.t) : WIDE_CAMERA
  const z = cam.zoom
  const unit = 1 / z // one screen unit in projected units

  // Ball
  const b = ballPosition(clip, t)
  const [bX, bY] = toWorld(b.x, b.y)
  const bZ = ballHeight(clip, scene, t)
  const bs = depthScale(bY)
  const ballR = 1.5 * unit * bs
  const ballP = project(bX, bY, bZ + ballR / 0.95)
  const ballShadow = project(bX, bY)

  const trail: Array<[number, number]> = []
  if (motion) {
    for (let i = 0; i <= TRAIL_SAMPLES; i++) {
      const tt = Math.max(0, t - i * TRAIL_STEP)
      const p = ballPosition(clip, tt)
      const [X, Y] = toWorld(p.x, p.y)
      trail.push(project(X, Y, ballHeight(clip, scene, tt) + ballR / 0.95))
    }
  }
  const trailLen = trail.reduce(
    (sum, p, i) => (i ? sum + Math.hypot(p[0] - (trail[i - 1]?.[0] ?? 0), p[1] - (trail[i - 1]?.[1] ?? 0)) : 0),
    0,
  )

  // Players
  const players = scene ? playersAt(clip, scene, t, reducedMotion) : []
  players.sort((a, c) => a.Y - c.Y)
  const active = lastName(ev?.player ?? ev?.receiver)

  // Goal net ripple
  const goalSide: 0 | 1 = goalEv && goalEv.x < 50 ? 0 : 1
  let bulge = 0
  if (motion && goalEv && t >= goalEv.t) {
    const dt = t - goalEv.t
    if (dt < 2) bulge = Math.round(1.4 * Math.exp(-dt * 2.4) * Math.cos(dt * 11) * 50) / 50
  }
  const bulgeY = goalEv ? toWorld(goalEv.x, goalEv.y)[1] : H / 2

  // Strike burst and line
  let burst: { p: [number, number]; k: number } | undefined
  let strikeLine: { from: [number, number]; o: number } | undefined
  if (motion && kickEv && t >= kickEv.t) {
    const [kX, kY] = toWorld(kickEv.x, kickEv.y)
    const from = project(kX, kY, ballHeight(clip, scene, kickEv.t) + ballR / 0.95)
    const k = (t - kickEv.t) / 0.4
    if (k < 1) burst = { p: from, k }
    const o = 1 - (t - kickEv.t) / 0.7
    if (o > 0) strikeLine = { from, o }
  }

  const glow = motion ? crowdGlow(clip, t) : 0

  // Score bug
  const score = scoreAt(clip, t)
  const justScored = goalEv !== undefined && t >= goalEv.t && t < goalEv.t + 4

  // Goal graphic
  let goalCard: { o: number; s: number } | undefined
  // Shown after a short beat, so the net ripple is seen first.
  if (goalEv && t >= goalEv.t + 0.5 && t < goalEv.t + 5.5) {
    const k = motion ? ramp(t, goalEv.t + 0.5, goalEv.t + 0.8) : 1
    const fade = motion ? 1 - ramp(t, goalEv.t + 5, goalEv.t + 5.5) : 1
    goalCard = { o: k * fade, s: 1.3 - 0.3 * k }
  }

  // Save flash
  let saveFlash: { p: [number, number]; o: number; s: number } | undefined
  if (saveEv && scene?.save) {
    const start = saveEv.t + (saveEv.duration ?? 0.8)
    if (t >= start && t < start + 1.4) {
      const keeper = players.find((p) => p.id === scene.save?.player)
      if (keeper) {
        const sp = toScreen(cam, project(keeper.X, keeper.Y, 6))
        const k = motion ? ramp(t, start, start + 0.2) : 1
        const fade = motion ? 1 - ramp(t, start + 1.1, start + 1.4) : 1
        saveFlash = { p: sp, o: k * fade, s: motion ? 1.25 - 0.25 * k : 1 }
      }
    }
  }

  // Lower third
  const tag = ev ? TAG[ev.type] : ''
  const tagW = tag.length * 2.5 + 5
  const LT_X = 4
  const LT_Y = 95.5
  const LT_H = 12.5
  const labelChars = Math.floor((VB_W - 8 - tagW - 5) / 2.15)
  const lines = ev ? wrap(ev.label, labelChars, 2) : []
  const ltK = motion && ev ? ramp(t, ev.t, ev.t + 0.3) : 1

  return (
    <div className="ls-pitch pv-root">
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="pv-svg" aria-hidden="true" focusable="false">
        <g transform={cameraTransform(cam)}>
          <StaticPitch />
          {glow > 0.01 && (
            <>
              <path d={STAND_PATH} fill="#ffffff" fillOpacity={fmt(glow * 0.18)} />
              <path d={PITCH_OUTLINE} fill="none" stroke="#ffffff" strokeOpacity={fmt(glow * 0.8)} strokeWidth={0.9} />
            </>
          )}
          <Goal side={goalSide} bulge={bulge} bulgeY={bulgeY} />

          {/* Shadows on the ground */}
          {players.map((p) => {
            const s = depthScale(p.Y)
            const r = 2.4 * unit * s
            const [sx, sy] = project(p.X, p.Y)
            return (
              <ellipse key={`s-${p.id}`} cx={fmt(sx)} cy={fmt(sy)} rx={fmt(r * 1.05)} ry={fmt(r * 0.45)} fill="#000" fillOpacity={0.35} />
            )
          })}
          <ellipse
            cx={fmt(ballShadow[0])}
            cy={fmt(ballShadow[1])}
            rx={fmt(ballR * Math.max(0.5, 1 - bZ * 0.06))}
            ry={fmt(ballR * 0.45 * Math.max(0.5, 1 - bZ * 0.06))}
            fill="#000"
            fillOpacity={fmt(0.45 - Math.min(0.25, bZ * 0.03))}
          />

          {/* Players */}
          {players.map((p) => {
            const s = depthScale(p.Y)
            const r = 2.4 * unit * s
            const [cx, cy] = project(p.X, p.Y, Math.max(0, p.Z) + r / 0.95)
            const dyDive = p.Z < 0 ? -p.Z * s * 0.95 : 0
            const dot = DOT[p.team]
            const isActive = p.name !== undefined && p.name === active
            return (
              <g key={p.id}>
                {isActive && (
                  <ellipse
                    cx={fmt(project(p.X, p.Y)[0])}
                    cy={fmt(project(p.X, p.Y)[1])}
                    rx={fmt(r * 1.9)}
                    ry={fmt(r * 0.8)}
                    fill="none"
                    stroke={GOLD}
                    strokeWidth={fmt(0.6 * unit)}
                  />
                )}
                <ellipse
                  cx={fmt(cx)}
                  cy={fmt(cy + dyDive)}
                  rx={fmt(r * (1 + 0.4 * p.stretch))}
                  ry={fmt(r * (1 - 0.25 * p.stretch))}
                  transform={p.tilt ? `rotate(${fmt(p.tilt)} ${fmt(cx)} ${fmt(cy + dyDive)})` : undefined}
                  fill={dot.fill}
                  stroke={dot.stroke}
                  strokeWidth={fmt(0.7 * unit)}
                />
                {p.name && (
                  <text
                    x={fmt(cx)}
                    y={fmt(p.team === clip.attacking ? cy - r - 1.2 * unit : cy + r + 3.6 * unit)}
                    textAnchor="middle"
                    fontSize={fmt(3.4 * unit)}
                    fontWeight={700}
                    fill={isActive ? GOLD : '#ffffff'}
                    className="pv-halo"
                    strokeWidth={fmt(0.9 * unit)}
                  >
                    {p.name}
                  </text>
                )}
              </g>
            )
          })}

          {/* Strike */}
          {strikeLine && (
            <line
              x1={fmt(strikeLine.from[0])}
              y1={fmt(strikeLine.from[1])}
              x2={fmt(ballP[0])}
              y2={fmt(ballP[1])}
              stroke={GOLD}
              strokeOpacity={fmt(strikeLine.o)}
              strokeWidth={fmt(1.1 * unit)}
              strokeLinecap="round"
            />
          )}
          {burst && (
            <path
              d={Array.from({ length: 10 }, (_, i) => {
                const a = (i / 10) * Math.PI * 2
                const r0 = (1.5 + 4 * burst.k) * unit
                const r1 = (3.5 + 9 * burst.k) * unit
                const [x, y] = burst.p
                return `M${fmt(x + r0 * Math.cos(a))} ${fmt(y + r0 * Math.sin(a))}L${fmt(x + r1 * Math.cos(a))} ${fmt(y + r1 * Math.sin(a))}`
              }).join('')}
              stroke="#ffffff"
              strokeOpacity={fmt(1 - burst.k)}
              strokeWidth={fmt(0.7 * unit)}
              strokeLinecap="round"
            />
          )}

          {/* Ball trail and ball */}
          {trailLen > 0.6 &&
            trail.slice(1).map((p, i) => {
              const q = trail[i] ?? p
              return (
                <line
                  key={`tr-${i}`}
                  x1={fmt(q[0])}
                  y1={fmt(q[1])}
                  x2={fmt(p[0])}
                  y2={fmt(p[1])}
                  stroke="#ffffff"
                  strokeOpacity={fmt(0.55 * (1 - i / TRAIL_SAMPLES))}
                  strokeWidth={fmt(ballR * 1.6 * (1 - i / (TRAIL_SAMPLES + 1)))}
                  strokeLinecap="round"
                />
              )
            })}
          <circle
            cx={fmt(ballP[0])}
            cy={fmt(ballP[1])}
            r={fmt(ballR)}
            fill="#ffffff"
            stroke="#111111"
            strokeWidth={fmt(0.5 * unit)}
          />
        </g>

        {/* Broadcast graphics, in screen space */}
        {motion && goalEv && t >= goalEv.t && t < goalEv.t + 0.3 && (
          <rect x={0} y={0} width={VB_W} height={VB_H} fill="#ffffff" fillOpacity={fmt(0.22 * (1 - (t - goalEv.t) / 0.3))} />
        )}

        <g>
          <rect x={4} y={3} width={40} height={8.5} rx={1} fill={NAVY} stroke="#ffffff" strokeOpacity={0.25} strokeWidth={0.2} />
          <text x={6} y={8.9} fontSize={4.4} fontWeight={800} fill="#ffffff">
            {clip.teams.home.short}
          </text>
          <rect x={16.5} y={3.8} width={16} height={6.9} rx={0.6} fill={justScored ? GOLD : '#f5f7fa'} />
          <text x={24.5} y={8.9} fontSize={4.6} fontWeight={800} fill="#0b0f14" textAnchor="middle">
            {`${score[0]}–${score[1]}`}
          </text>
          <text x={34.5} y={8.9} fontSize={4.4} fontWeight={800} fill="#ffffff">
            {clip.teams.away.short}
          </text>
          <rect x={44.5} y={3} width={15.5} height={8.5} rx={1} fill="#1d2b3d" />
          <text x={52.25} y={8.9} fontSize={4.4} fontWeight={700} fill={GOLD} textAnchor="middle">
            {clockText(clip, t)}
          </text>
        </g>

        <g>
          <rect x={127} y={4} width={29} height={6} rx={1} fill="#000000" fillOpacity={0.55} stroke="#ffffff" strokeOpacity={0.5} strokeWidth={0.2} />
          <text x={141.5} y={8.15} fontSize={3} fontWeight={700} fill="#ffffff" textAnchor="middle" letterSpacing={0.3}>
            RECREATION
          </text>
        </g>

        {saveFlash && (
          <text
            x={fmt(saveFlash.p[0])}
            y={fmt(saveFlash.p[1])}
            textAnchor="middle"
            fontSize={7}
            fontWeight={900}
            fontStyle="italic"
            fill={GOLD}
            fillOpacity={fmt(saveFlash.o)}
            className="pv-halo"
            strokeWidth={1.2}
            strokeOpacity={fmt(saveFlash.o)}
            transform={`translate(${fmt(saveFlash.p[0])} ${fmt(saveFlash.p[1])}) scale(${fmt(saveFlash.s)}) translate(${fmt(-saveFlash.p[0])} ${fmt(-saveFlash.p[1])})`}
          >
            SAVE
          </text>
        )}

        {goalCard && goalEv && (
          <g
            opacity={fmt(goalCard.o)}
            transform={`translate(80 26) scale(${fmt(goalCard.s)}) translate(-80 -26)`}
          >
            <polygon points="38,13.5 126,13.5 121,39 33,39" fill={NAVY} fillOpacity={0.92} />
            <polygon points="38,13.5 126,13.5 125.4,16.3 37.4,16.3" fill={GOLD} />
            <text x={79.5} y={31} textAnchor="middle" fontSize={14} fontWeight={900} fontStyle="italic" fill="#ffffff" letterSpacing={1.2}>
              GOAL
            </text>
            <text x={79.5} y={37} textAnchor="middle" fontSize={4.6} fontWeight={700} fill={GOLD}>
              {lastName(goalEv.player)} {minuteOf(clip, goalEv.t)}&apos;
            </text>
          </g>
        )}

        {ev && (
          <g opacity={fmt(0.3 + 0.7 * ltK)} transform={ltK < 1 ? `translate(${fmt((ltK - 1) * 6)} 0)` : undefined}>
            <rect x={LT_X} y={LT_Y} width={VB_W - 8} height={LT_H} rx={0.8} fill="#0a1018" fillOpacity={0.9} />
            <rect x={LT_X} y={LT_Y} width={fmt(tagW)} height={LT_H} rx={0.8} fill={ev.type === 'goal' ? GOLD : '#f5f7fa'} />
            <text x={fmt(LT_X + tagW / 2)} y={LT_Y + LT_H / 2 + 1.2} textAnchor="middle" fontSize={3.4} fontWeight={800} fill="#0b0f14">
              {tag}
            </text>
            <text x={fmt(LT_X + tagW + 3)} y={lines.length > 1 ? LT_Y + 5.3 : LT_Y + LT_H / 2 + 1.5} fontSize={4.2} fontWeight={600} fill="#ffffff">
              {lines.map((line, i) => (
                <tspan key={i} x={fmt(LT_X + tagW + 3)} dy={i ? 5 : 0}>
                  {line}
                </tspan>
              ))}
            </text>
          </g>
        )}
      </svg>
      <p className="pv-legend">
        <span className="pv-legend-item">
          <span className="pv-swatch pv-swatch-away" aria-hidden="true" /> {clip.teams.away.name} (white)
        </span>
        <span className="pv-legend-item">
          <span className="pv-swatch pv-swatch-home" aria-hidden="true" /> {clip.teams.home.name} (black)
        </span>
        <span className="pv-legend-item">{clip.teams[clip.attacking].name} attack →</span>
      </p>
      <p className="pv-note">Illustrative recreation. Player positions are approximate.</p>
      <p className="pv-sr-only">
        {describe(clip, t)} {ev?.label ?? ''}
      </p>
    </div>
  )
}
