import { useRef } from 'react'
import { ballPosition, type MatchClip, type TeamSide } from '@/demo'

// Pitch is 105 x 68 m. Clip coordinates are 0..100 on both axes.
const W = 105
const H = 68
const TRAIL_POINTS = 12
const TRAIL_STEP = 0.08 // seconds between trail samples

interface Props {
  clip: MatchClip
  t: number
  reducedMotion: boolean
}

/** Colours readable without colour vision: white with dark ring vs black with light ring. */
const DOT: Record<TeamSide | 'none', { fill: string; stroke: string }> = {
  away: { fill: '#ffffff', stroke: '#111111' },
  home: { fill: '#111111', stroke: '#ffffff' },
  none: { fill: '#9aa4ae', stroke: '#111111' },
}

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

export function PitchView({ clip, t, reducedMotion }: Props) {
  const trail = useRef<Array<{ x: number; y: number; t: number }>>([])

  const b = ballPosition(clip, t)
  const bx = (b.x / 100) * W
  const by = (b.y / 100) * H

  // Short trail of recent positions (skipped for reduced motion).
  const pts = trail.current
  const last = pts[pts.length - 1]
  if (last && t < last.t) pts.length = 0 // replayed
  if (!last || t - last.t >= TRAIL_STEP) {
    pts.push({ x: bx, y: by, t })
    if (pts.length > TRAIL_POINTS) pts.shift()
  }

  const dot = DOT[b.team ?? 'none']
  const lineProps = { fill: 'none', stroke: '#ffffff', strokeWidth: 0.4 }

  return (
    <div className="ls-pitch">
      <div className="ls-pitch-labels" aria-hidden="true">
        <span>{clip.teams[clip.attacking].name} attack →</span>
        <span>{clip.teams[clip.attacking === 'away' ? 'home' : 'away'].name} goal</span>
      </div>
      <svg
        viewBox={`-3 -2 ${W + 6} ${H + 4}`}
        className="ls-pitch-svg"
        aria-hidden="true"
        focusable="false"
      >
        <rect x={-3} y={-2} width={W + 6} height={H + 4} fill="#1f6b33" />
        <rect x={0} y={0} width={W} height={H} {...lineProps} />
        <line x1={W / 2} y1={0} x2={W / 2} y2={H} {...lineProps} />
        <circle cx={W / 2} cy={H / 2} r={9.15} {...lineProps} />
        <circle cx={W / 2} cy={H / 2} r={0.5} fill="#ffffff" />
        {/* Penalty areas and six-yard boxes */}
        <rect x={0} y={(H - 40.32) / 2} width={16.5} height={40.32} {...lineProps} />
        <rect x={W - 16.5} y={(H - 40.32) / 2} width={16.5} height={40.32} {...lineProps} />
        <rect x={0} y={(H - 18.32) / 2} width={5.5} height={18.32} {...lineProps} />
        <rect x={W - 5.5} y={(H - 18.32) / 2} width={5.5} height={18.32} {...lineProps} />
        <circle cx={11} cy={H / 2} r={0.4} fill="#ffffff" />
        <circle cx={W - 11} cy={H / 2} r={0.4} fill="#ffffff" />
        {/* Goals */}
        <rect x={-2} y={(H - 7.32) / 2} width={2} height={7.32} fill="#dddddd" stroke="#ffffff" strokeWidth={0.4} />
        <rect x={W} y={(H - 7.32) / 2} width={2} height={7.32} fill="#dddddd" stroke="#ffffff" strokeWidth={0.4} />

        {!reducedMotion && pts.length > 1 && (
          <polyline
            points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke={dot.fill}
            strokeOpacity={0.5}
            strokeWidth={0.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        <circle cx={bx} cy={by} r={1.6} fill={dot.fill} stroke={dot.stroke} strokeWidth={0.6} />
      </svg>
      <p className="ls-legend">
        <span className="ls-swatch ls-swatch-away" aria-hidden="true" /> {clip.teams.away.name} ball
        <span className="ls-swatch ls-swatch-home" aria-hidden="true" /> {clip.teams.home.name} ball
      </p>
      <p className="ls-sr-only">{describe(clip, t)}</p>
    </div>
  )
}
