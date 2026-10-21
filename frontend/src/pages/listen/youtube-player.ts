/**
 * Minimal YouTube IFrame Player API wrapper.
 *
 * The API script is loaded when the Listen page mounts (skipped when
 * offline). Nothing is downloaded or copied: the video plays inside
 * YouTube's own embedded player.
 */

export const YT_API_URL = 'https://www.youtube.com/iframe_api'
const PLAYING = 1
const BUFFERING = 3

// Only the parts of the API we use.
export interface YTPlayer {
  playVideo(): void
  pauseVideo(): void
  seekTo(seconds: number, allowSeekAhead: boolean): void
  mute(): void
  getCurrentTime(): number
  getPlayerState(): number
  getIframe(): HTMLIFrameElement
  destroy(): void
}

interface YTPlayerOptions {
  host?: string
  videoId: string
  width?: string | number
  height?: string | number
  playerVars?: Record<string, string | number>
  events?: {
    onReady?: () => void
    onError?: (e: { data: number }) => void
  }
}

interface YTNamespace {
  Player: new (el: HTMLElement, opts: YTPlayerOptions) => YTPlayer
}

declare global {
  interface Window {
    YT?: YTNamespace
    onYouTubeIframeAPIReady?: () => void
  }
}

let loading: Promise<YTNamespace> | null = null

/** Loads the IFrame API once. Rejects if offline or not ready within timeoutMs. */
export function loadYouTubeApi(timeoutMs = 6000): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return Promise.reject(new Error('offline'))
  }
  if (loading) return loading

  loading = new Promise<YTNamespace>((resolve, reject) => {
    const script = document.createElement('script')
    const fail = (why: string) => {
      window.clearTimeout(timer)
      loading = null
      script.remove()
      reject(new Error(why))
    }
    const timer = window.setTimeout(() => fail('timeout'), timeoutMs)
    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previous?.()
      window.clearTimeout(timer)
      if (window.YT?.Player) resolve(window.YT)
      else fail('no api')
    }
    script.src = YT_API_URL
    script.async = true
    script.onerror = () => fail('load failed')
    document.head.appendChild(script)
  })
  return loading
}

/** The small interface the sync code needs, for both video sources. */
export interface SyncedVideo {
  readonly currentTime: number
  seek(seconds: number): void
  play(): void
  pause(): void
  /** Not playing and not trying to (paused, ended, not started). */
  readonly paused: boolean
  /** Actually playing frames, so currentTime is meaningful for drift checks. */
  readonly playing: boolean
  readonly driftThreshold: number // seconds of drift before we re-seek
}

export function fromVideoElement(v: HTMLVideoElement): SyncedVideo {
  return {
    get currentTime() {
      return v.currentTime
    },
    seek: (s) => {
      v.currentTime = s
    },
    play: () => {
      v.muted = true
      void v.play().catch(() => {})
    },
    pause: () => v.pause(),
    get paused() {
      return v.paused
    },
    get playing() {
      return !v.paused && !v.seeking && v.readyState >= 3
    },
    driftThreshold: 0.25,
  }
}

export function fromYouTube(p: YTPlayer): SyncedVideo {
  return {
    get currentTime() {
      return p.getCurrentTime()
    },
    seek: (s) => p.seekTo(s, true),
    play: () => {
      p.mute()
      p.playVideo()
    },
    pause: () => p.pauseVideo(),
    get paused() {
      const s = p.getPlayerState()
      return s !== PLAYING && s !== BUFFERING
    },
    get playing() {
      return p.getPlayerState() === PLAYING
    },
    driftThreshold: 0.4, // YouTube seeks are coarser
  }
}
