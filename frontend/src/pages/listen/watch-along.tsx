/**
 * Watch along: play a video the user already has on this device, muted,
 * in sync with the Blind Side sound.
 *
 * The app ships no video. The chosen file is only ever referenced through
 * an in-memory object URL: never uploaded, fetched or stored.
 */

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { demoClip } from '@/demo'
import './watch-along.css'

const OFFSET_KEY = 'blind-side:watch-along-offset'

function loadOffset(): number {
  try {
    const v = Number(window.localStorage.getItem(OFFSET_KEY))
    return Number.isFinite(v) && v >= 0 ? v : 0
  } catch {
    return 0
  }
}

function saveOffset(v: number) {
  try {
    window.localStorage.setItem(OFFSET_KEY, String(v))
  } catch {
    // storage blocked (private mode, file://): the offset just isn't remembered
  }
}

const round1 = (v: number) => Math.max(0, Math.round(v * 10) / 10)

function timeText(s: number): string {
  const m = Math.floor(s / 60)
  const rest = (s - m * 60).toFixed(1).padStart(4, '0')
  return `${m}:${rest}`
}

export interface WatchAlong {
  videoRef: RefObject<HTMLVideoElement | null>
  offsetRef: RefObject<number>
  src: string | null
  fileName: string | null
  offset: number
  setOffset: (v: number) => void
  showControls: boolean
  setShowControls: (v: boolean) => void
  chooseFile: (file: File | null) => void
}

/** State for watch-along. The offset is the video time that matches clip t = 0. */
export function useWatchAlong(): WatchAlong {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [src, setSrc] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [offset, setOffsetState] = useState(loadOffset)
  const [showControls, setShowControls] = useState(false)
  const offsetRef = useRef(offset)
  offsetRef.current = offset

  const setOffset = useCallback((v: number) => {
    const next = round1(v)
    offsetRef.current = next
    setOffsetState(next)
    saveOffset(next)
  }, [])

  const srcRef = useRef<string | null>(null)
  const chooseFile = useCallback((file: File | null) => {
    if (srcRef.current) URL.revokeObjectURL(srcRef.current)
    const next = file ? URL.createObjectURL(file) : null
    srcRef.current = next
    setSrc(next)
    setFileName(file ? file.name : null)
  }, [])

  // Revoke the object URL when leaving the page.
  useEffect(
    () => () => {
      if (srcRef.current) URL.revokeObjectURL(srcRef.current)
      srcRef.current = null
    },
    [],
  )

  return { videoRef, offsetRef, src, fileName, offset, setOffset, showControls, setShowControls, chooseFile }
}

/** The video itself. Rendered above the caption. */
export function WatchAlongVideo({ wa }: { wa: WatchAlong }) {
  if (!wa.src) return null
  return (
    <div className="wa-video-wrap">
      <video
        ref={wa.videoRef}
        className="wa-video"
        src={wa.src}
        muted
        playsInline
        preload="auto"
        controls={wa.showControls}
        aria-hidden={false}
        aria-label="Your video, muted, playing with Blind Side sound"
      />
    </div>
  )
}

/** File picker, sync controls and Play together. */
export function WatchAlongPanel({ wa, onPlayTogether }: { wa: WatchAlong; onPlayTogether: () => void }) {
  const kick = demoClip.events.find((e) => e.type === 'overhead_kick')
  const nudge = (d: number) => wa.setOffset(wa.offset + d)

  return (
    <section className="ls-panel wa-panel" aria-labelledby="wa-title">
      <h2 id="wa-title" className="wa-title">
        Watch along
      </h2>

      <label className="ls-field wa-file">
        <span>Load a video from this device</span>
        <input
          type="file"
          accept="video/*"
          aria-describedby="wa-file-help"
          onChange={(e) => wa.chooseFile(e.target.files?.[0] ?? null)}
        />
      </label>
      <p id="wa-file-help" className="ls-help">
        Your video stays on this device. Nothing is uploaded.
      </p>

      {wa.src && (
        <>
          <label className="wa-check">
            <input
              type="checkbox"
              checked={wa.showControls}
              onChange={(e) => wa.setShowControls(e.target.checked)}
            />
            <span>Show video controls</span>
          </label>

          <fieldset className="wa-sync">
            <legend>Video time at kick-off of our clip</legend>
            <label className="ls-field wa-offset">
              <span>Seconds into your video</span>
              <input
                type="number"
                min={0}
                step={0.1}
                inputMode="decimal"
                value={wa.offset}
                aria-describedby="wa-sync-help"
                onChange={(e) => {
                  const v = parseFloat(e.target.value)
                  if (Number.isFinite(v)) wa.setOffset(v)
                }}
              />
            </label>
            <div className="ls-row wa-nudges">
              <button type="button" className="ls-btn" onClick={() => nudge(-1)} aria-label="Minus 1 second">
                −1 s
              </button>
              <button type="button" className="ls-btn" onClick={() => nudge(-0.1)} aria-label="Minus 0.1 seconds">
                −0.1 s
              </button>
              <button type="button" className="ls-btn" onClick={() => nudge(0.1)} aria-label="Plus 0.1 seconds">
                +0.1 s
              </button>
              <button type="button" className="ls-btn" onClick={() => nudge(1)} aria-label="Plus 1 second">
                +1 s
              </button>
            </div>
            <button
              type="button"
              className="ls-btn wa-wide"
              onClick={() => {
                const v = wa.videoRef.current
                if (v) wa.setOffset(v.currentTime)
              }}
            >
              Use current video position
            </button>
            <p id="wa-sync-help" className="ls-help">
              Tick "Show video controls", pause your video where Real Madrid start the move, then tap "Use
              current video position".
              {kick && (
                <>
                  {' '}
                  Tip: our clip's overhead kick is at {timeText(kick.t)}. Line it up with the kick in your video.
                </>
              )}
            </p>
          </fieldset>

          <button type="button" className="ls-btn ls-btn-primary wa-wide" onClick={onPlayTogether}>
            Play together
          </button>
        </>
      )}
    </section>
  )
}
