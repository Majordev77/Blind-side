/**
 * Watch along: a muted video in sync with the Blind Side sound.
 *
 * Default source: the official upload (clip.officialVideo), shown with
 * YouTube's own embedded player. The player is created as soon as the
 * Listen page mounts (skipped when offline), so it is ready by the Start tap.
 *
 * Optional source: a video already on the user's device, referenced only
 * through an in-memory object URL: never uploaded, fetched or stored.
 */

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { demoClip } from '@/demo'
import { fromVideoElement, fromYouTube, loadYouTubeApi, type SyncedVideo, type YTPlayer } from './youtube-player'
import './watch-along.css'

export type VideoSource = 'official' | 'file'
type YtState = 'loading' | 'ready' | 'failed'

const official = demoClip.officialVideo
const OFFSET_KEYS: Record<VideoSource, string> = {
  file: 'blind-side:watch-along-offset',
  official: 'blind-side:watch-along-offset:official',
}
const DEFAULT_OFFSET: Record<VideoSource, number> = { file: 0, official: official?.offset ?? 0 }
const OFFLINE_MESSAGE = "The official video needs an internet connection. Blind Side's sound works without it."
const IFRAME_TITLE = "Official video: Ronaldo's overhead kick, muted"

function loadOffset(source: VideoSource): number | null {
  try {
    const raw = window.localStorage.getItem(OFFSET_KEYS[source])
    if (raw === null) return null
    const v = Number(raw)
    return Number.isFinite(v) && v >= 0 ? v : null
  } catch {
    return null
  }
}

function saveOffset(source: VideoSource, v: number | null) {
  try {
    if (v === null) window.localStorage.removeItem(OFFSET_KEYS[source])
    else window.localStorage.setItem(OFFSET_KEYS[source], String(v))
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
  source: VideoSource
  useOfficial: () => void
  hidden: boolean
  setHidden: (v: boolean) => void
  /** A video (or its offline message) is available to show. */
  available: boolean
  /** The video area is on screen in the player view. */
  visible: boolean
  /** The active, visible video behind the small sync interface; null if hidden or not ready. */
  getPlayer: () => SyncedVideo | null
  /** Pause whichever video exists, visible or not. */
  pauseAll: () => void
  videoRef: RefObject<HTMLVideoElement | null>
  ytRef: RefObject<YTPlayer | null>
  ytState: YtState
  setYtState: (s: YtState) => void
  offsetRef: RefObject<number>
  src: string | null
  offset: number
  offsetIsOverride: boolean
  setOffset: (v: number) => void
  resetOffset: () => void
  showControls: boolean
  setShowControls: (v: boolean) => void
  chooseFile: (file: File | null) => void
}

/** State for watch-along. The offset is the video time that matches clip t = 0. */
export function useWatchAlong(): WatchAlong {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const ytRef = useRef<YTPlayer | null>(null)
  const [source, setSourceState] = useState<VideoSource>('official')
  const [hidden, setHiddenState] = useState(false)
  const [ytState, setYtState] = useState<YtState>('loading')
  const [src, setSrc] = useState<string | null>(null)
  const [overrides, setOverrides] = useState<Record<VideoSource, number | null>>(() => ({
    file: loadOffset('file'),
    official: loadOffset('official'),
  }))
  const [showControls, setShowControls] = useState(false)

  const offset = overrides[source] ?? DEFAULT_OFFSET[source]
  const offsetRef = useRef(offset)
  offsetRef.current = offset
  const sourceRef = useRef(source)
  sourceRef.current = source
  const hiddenRef = useRef(hidden)
  hiddenRef.current = hidden

  const pauseAll = useCallback(() => {
    try {
      ytRef.current?.pauseVideo()
    } catch {
      // player gone
    }
    videoRef.current?.pause()
  }, [])

  const setSource = useCallback(
    (s: VideoSource) => {
      if (s === sourceRef.current) return
      pauseAll()
      sourceRef.current = s
      setSourceState(s)
    },
    [pauseAll],
  )

  const setHidden = useCallback(
    (v: boolean) => {
      if (v) pauseAll() // eyes-closed run: never play a hidden video
      hiddenRef.current = v
      setHiddenState(v)
    },
    [pauseAll],
  )

  const setOffset = useCallback((v: number) => {
    const next = round1(v)
    const s = sourceRef.current
    offsetRef.current = next
    setOverrides((o) => ({ ...o, [s]: next }))
    saveOffset(s, next)
  }, [])

  const resetOffset = useCallback(() => {
    const s = sourceRef.current
    offsetRef.current = DEFAULT_OFFSET[s]
    setOverrides((o) => ({ ...o, [s]: null }))
    saveOffset(s, null)
  }, [])

  const getPlayer = useCallback((): SyncedVideo | null => {
    if (hiddenRef.current) return null
    if (sourceRef.current === 'official') return ytRef.current ? fromYouTube(ytRef.current) : null
    return videoRef.current ? fromVideoElement(videoRef.current) : null
  }, [])

  const srcRef = useRef<string | null>(null)
  const chooseFile = useCallback(
    (file: File | null) => {
      if (srcRef.current) URL.revokeObjectURL(srcRef.current)
      const next = file ? URL.createObjectURL(file) : null
      srcRef.current = next
      setSrc(next)
      if (next) setSource('file')
      else if (official) setSource('official')
    },
    [setSource],
  )

  // Revoke the object URL when leaving the page.
  useEffect(
    () => () => {
      if (srcRef.current) URL.revokeObjectURL(srcRef.current)
      srcRef.current = null
    },
    [],
  )

  const available = source === 'official' ? !!official : !!src
  return {
    source,
    useOfficial: () => setSource('official'),
    hidden,
    setHidden,
    available,
    visible: available && !hidden,
    getPlayer,
    pauseAll,
    videoRef,
    ytRef,
    ytState,
    setYtState,
    offsetRef,
    src,
    offset,
    offsetIsOverride: overrides[source] !== null,
    setOffset,
    resetOffset,
    showControls,
    setShowControls,
    chooseFile,
  }
}

/**
 * The official upload in YouTube's embedded player (privacy-enhanced host), muted.
 * Mounted for the whole life of the page so the player is ready before the Start tap.
 */
function OfficialVideoPlayer({ wa, onScreen }: { wa: WatchAlong; onScreen: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const { ytRef, setYtState, ytState } = wa

  useEffect(() => {
    if (!official) return
    let cancelled = false
    let player: YTPlayer | null = null
    let el: HTMLElement | null = null
    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !hostRef.current) return
        // YouTube replaces this element with its iframe; React only owns the wrapper.
        el = document.createElement('div')
        hostRef.current.appendChild(el)
        player = new YT.Player(el, {
          host: 'https://www.youtube-nocookie.com',
          videoId: official.id,
          width: '100%',
          height: '100%',
          playerVars: { playsinline: 1, controls: 1, rel: 0, modestbranding: 1, mute: 1 },
          events: {
            onReady: () => {
              if (cancelled || !player) return
              player.mute()
              try {
                player.getIframe().setAttribute('title', IFRAME_TITLE)
              } catch {
                // ignore
              }
              ytRef.current = player
              setYtState('ready')
            },
            onError: () => {
              if (!cancelled) setYtState('failed')
            },
          },
        })
        try {
          player.getIframe().setAttribute('title', IFRAME_TITLE)
        } catch {
          // set again on ready
        }
      })
      .catch(() => {
        if (!cancelled) setYtState('failed')
      })
    return () => {
      cancelled = true
      ytRef.current = null
      // Remove only what we added; React owns the rest of the wrapper.
      try {
        const iframe = player?.getIframe()
        player?.destroy()
        if (iframe?.isConnected) iframe.remove()
      } catch {
        // already gone
      }
      if (el?.isConnected) el.remove()
    }
  }, [ytRef, setYtState])

  if (!official) return null

  return (
    <figure className={`wa-official${onScreen ? '' : ' wa-offscreen'}`} inert={!onScreen} aria-hidden={!onScreen}>
      {ytState === 'failed' && (
        <p className="wa-offline" role="status">
          {OFFLINE_MESSAGE}
        </p>
      )}
      <div className="wa-yt" ref={hostRef} hidden={ytState === 'failed'}>
        {ytState === 'loading' && <p className="wa-yt-loading">Loading the official video…</p>}
      </div>
      <figcaption className="wa-attribution">
        Video: official upload by{' '}
        <a href={`https://www.youtube.com/watch?v=${official.id}`} target="_blank" rel="noopener noreferrer">
          {official.channel}
          <span className="ls-sr-only"> (opens YouTube)</span>
        </a>{' '}
        on YouTube, shown with YouTube's embedded player and muted. Sound and commentary: Blind Side's own
        recreation.
      </figcaption>
    </figure>
  )
}

/** The video area. `active` is false on the Start screen, where it loads off screen. */
export function WatchAlongVideo({ wa, active }: { wa: WatchAlong; active: boolean }) {
  const showOfficial = active && !wa.hidden && wa.source === 'official'
  return (
    <>
      {official && <OfficialVideoPlayer wa={wa} onScreen={showOfficial} />}
      {active && !wa.hidden && wa.source === 'file' && wa.src && (
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
      )}
    </>
  )
}

/** "Adjust video sync" disclosure: the offset in use and ways to change it. */
export function WatchAlongSync({ wa }: { wa: WatchAlong }) {
  const kick = demoClip.events.find((e) => e.type === 'overhead_kick')
  const nudge = (d: number) => wa.setOffset(wa.offset + d)
  if (!wa.available) return null

  return (
    <details className="ls-panel wa-panel">
      <summary>Adjust video sync</summary>
      <p className="wa-saved" aria-live="polite">
        Video time at kick-off of our clip: <strong>{wa.offset.toFixed(1)} s</strong>
        {wa.offsetIsOverride ? ' (saved on this device)' : ' (default)'}
      </p>
      <label className="ls-field wa-offset">
        <span>Seconds into the video</span>
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
          const p = wa.getPlayer()
          if (p) wa.setOffset(p.currentTime)
        }}
      >
        Use current video position
      </button>
      {wa.offsetIsOverride && (
        <button type="button" className="ls-btn wa-wide" onClick={wa.resetOffset}>
          Reset to default ({DEFAULT_OFFSET[wa.source].toFixed(1)} s)
        </button>
      )}
      <p id="wa-sync-help" className="ls-help">
        Press Stop, pause the video where Real Madrid start the move, then tap "Use current video position".
        Changes apply on Replay.
        {kick && (
          <>
            {' '}
            Tip: our clip's overhead kick is at {timeText(kick.t)}. Line it up with the kick in the video.
          </>
        )}
      </p>
    </details>
  )
}

/** For the Personalise area: use a video from this device instead of the official one. */
export function WatchAlongFilePicker({ wa }: { wa: WatchAlong }) {
  return (
    <div className="wa-file-area">
      <label className="ls-field wa-file">
        <span>Use a video from this device instead</span>
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
      {wa.source === 'file' && wa.src && (
        <label className="wa-check">
          <input type="checkbox" checked={wa.showControls} onChange={(e) => wa.setShowControls(e.target.checked)} />
          <span>Show video controls</span>
        </label>
      )}
      {official && wa.source === 'file' && (
        <button type="button" className="ls-btn wa-wide" onClick={wa.useOfficial}>
          Use the official video again
        </button>
      )}
    </div>
  )
}
