/** Small hand-drawn icons for the sound language. Decorative only. */

import type { ReactNode } from 'react'

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 32 32"
      width="32"
      height="32"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

export const SoundIcons = {
  ears: (
    <Icon>
      <rect x="3" y="10" width="5" height="12" rx="2" />
      <rect x="24" y="10" width="5" height="12" rx="2" />
      <circle cx="16" cy="16" r="3" fill="currentColor" />
      <path d="M11 13l-2 3 2 3M21 13l2 3-2 3" />
    </Icon>
  ),
  height: (
    <Icon>
      <path d="M16 4v24M11 9l5-5 5 5M11 23l5 5 5-5" />
    </Icon>
  ),
  click: (
    <Icon>
      <path d="M6 16h6l2-6 4 12 2-6h6" />
    </Icon>
  ),
  sweep: (
    <Icon>
      <path d="M4 26c8 0 14-4 18-14" />
      <path d="M18 10l5 1 1-5" />
    </Icon>
  ),
  crack: (
    <Icon>
      <path d="M4 22c4-10 10-14 16-14" />
      <path d="M24 6l1.5 3.5L29 11l-3.5 1.5L24 16l-1.5-3.5L19 11l3.5-1.5z" />
    </Icon>
  ),
  crowd: (
    <Icon>
      <circle cx="8" cy="12" r="3" />
      <circle cx="16" cy="10" r="3" />
      <circle cx="24" cy="12" r="3" />
      <path d="M3 26c0-4 2-7 5-7s5 3 5 7M11 24c0-5 2-8 5-8s5 3 5 8M19 26c0-4 2-7 5-7s5 3 5 7" />
    </Icon>
  ),
  voice: (
    <Icon>
      <path d="M5 7h22v14H14l-6 5v-5H5z" />
      <path d="M10 12h12M10 16h8" />
    </Icon>
  ),
}

/** Hero motif: a ball tone travelling between two headphone cups. */
export function EarsMotif() {
  return (
    <svg className="hm-motif" viewBox="0 0 320 120" aria-hidden="true" focusable="false">
      <path className="hm-motif-band" d="M40 70V58a120 50 0 0 1 240 0v12" />
      <rect className="hm-motif-cup" x="22" y="62" width="30" height="46" rx="12" />
      <rect className="hm-motif-cup" x="268" y="62" width="30" height="46" rx="12" />
      <line className="hm-motif-track" x1="70" y1="85" x2="250" y2="85" />
      <circle className="hm-motif-ball" cx="160" cy="85" r="9" />
    </svg>
  )
}
