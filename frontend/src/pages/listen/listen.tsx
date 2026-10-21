/**
 * Listen page (OAH-008)
 *
 * One full-screen Start button that unlocks audio inside the tap, then
 * plays the demo clip: 3D sound from the SoundEngine, spoken commentary
 * from speechSynthesis, a large live caption and an optional 2D pitch.
 * No sign-in and no network calls.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { SoundEngine, primeSpeech, speak, cancelSpeech, isSpeaking } from '@/audio'
import { demoClip, demoCommentary, clockText, eventAt, type CommentaryLine, type Detail, type Lang } from '@/demo'
import { PitchView } from './pitch-view'
import { WatchAlongPanel, WatchAlongVideo, useWatchAlong } from './watch-along'
import { DETAIL_LABELS, FAVOURITES, LANG_LABELS, selectLines, type Settings } from './commentary'
import './listen.css'

const UNLOCK_FAILED = 'No sound yet. Turn off silent mode, turn the volume up, then tap Start again.'

type Status = 'playing' | 'stopped' | 'finished'

interface Caption {
  line: CommentaryLine
  shownAt: number // clip time
  minUntil: number // clip time the caption stays up at least until
  spoken: boolean // false when there is no voice, so screen readers announce it instead
}

function scoreAt(t: number): [number, number] {
  let score = demoClip.scoreAtStart
  for (const ev of demoClip.events) {
    if (ev.t > t) break
    if (ev.score) score = ev.score
  }
  return score
}

function usePrefersReducedMotion(): boolean {
  const query = '(prefers-reduced-motion: reduce)'
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && window.matchMedia?.(query).matches)
  useEffect(() => {
    const mq = window.matchMedia?.(query)
    if (!mq) return
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

export default function ListenPage() {
  const engineRef = useRef<SoundEngine | null>(null)
  const mountedRef = useRef(false)
  const startingRef = useRef(false) // set synchronously in the tap, guards double starts
  const rafRef = useRef<number | null>(null)

  // Per-play state, read inside the animation frame loop.
  const linesRef = useRef<CommentaryLine[]>([])
  const handledRef = useRef<Set<string>>(new Set())
  const speakingIdRef = useRef<string | null>(null)
  const playStartedRef = useRef(0)
  const captionRef = useRef<Caption | null>(null)

  const [phase, setPhase] = useState<'start' | 'player'>('start')
  const [startError, setStartError] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>('stopped')
  const [t, setT] = useState(0)
  const [caption, setCaption] = useState<Caption | null>(null)
  const [aired, setAired] = useState<CommentaryLine[]>([])
  const [fallbackNote, setFallbackNote] = useState<string | null>(null)

  const [showPitch, setShowPitch] = useState(false)
  const [speakersMode, setSpeakersMode] = useState(false)
  const [settings, setSettings] = useState<Settings>({ lang: 'en', detail: 'full', favourite: '' })
  const settingsRef = useRef(settings)
  settingsRef.current = settings

  const [evidenceLine, setEvidenceLine] = useState<CommentaryLine | null>(null)
  const evidenceOpenerRef = useRef<HTMLElement | null>(null)
  const evidenceHeadingRef = useRef<HTMLHeadingElement>(null)
  const playerHeadingRef = useRef<HTMLHeadingElement>(null)
  const reducedMotion = usePrefersReducedMotion()

  // Watch along: the user's own video, muted, kept in sync with clipTime.
  const wa = useWatchAlong()
  const [watchAlong, setWatchAlong] = useState(false)
  const lastDriftCheckRef = useRef(0)

  const stopLoop = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
  }, [])

  const tick = useCallback(() => {
    const engine = engineRef.current
    if (!engine) return
    const now = engine.clipTime
    const sinceStart = performance.now() - playStartedRef.current
    const ended = now >= demoClip.duration || (!engine.playing && sinceStart > 1000)
    if (ended) {
      rafRef.current = null
      setT((prev) => Math.max(prev, Math.min(now || prev, demoClip.duration)))
      setStatus('finished')
      wa.videoRef.current?.pause()
      return
    }

    // Keep the user's video in step with our clock, checked about once a second.
    const video = wa.videoRef.current
    const nowMs = performance.now()
    if (video && !video.paused && now > 0 && nowMs - lastDriftCheckRef.current > 1000) {
      lastDriftCheckRef.current = nowMs
      const target = wa.offsetRef.current + now
      if (Math.abs(video.currentTime - target) > 0.25) video.currentTime = target
    }

    // Commentary: lines in time order, each handled at most once per play.
    for (const line of linesRef.current) {
      if (handledRef.current.has(line.id)) continue
      if (now < line.t) break
      if (now > line.expires) {
        handledRef.current.add(line.id) // skipped: too late to say it
        continue
      }
      if (isSpeaking()) break // wait for the current line; retry next frame
      handledRef.current.add(line.id)
      const spoken = speak(line.text, line.lang, {
        onStart: () => engineRef.current?.setDuck(true),
        onEnd: () => {
          engineRef.current?.setDuck(false)
          if (speakingIdRef.current === line.id) speakingIdRef.current = null
        },
      })
      // Caption it even when it could not be spoken.
      if (spoken) speakingIdRef.current = line.id
      const words = line.text.split(/\s+/).length
      const c: Caption = { line, shownAt: now, minUntil: now + Math.max(2.5, words * 0.4), spoken }
      captionRef.current = c
      setCaption(c)
      setAired((prev) => [...prev, line])
      break // one new line per frame
    }

    // Drop the caption once speech is over and it has been up long enough.
    const c = captionRef.current
    if (c && now >= c.minUntil && (speakingIdRef.current !== c.line.id || now >= c.minUntil + 15)) {
      captionRef.current = null
      setCaption(null)
    }

    setT(now)
    rafRef.current = requestAnimationFrame(tick)
  }, [wa.videoRef, wa.offsetRef])

  const startPlayback = useCallback(() => {
    const engine = engineRef.current
    if (!engine) return
    // Inside the Replay tap: wake the context if iOS suspended it (screen lock, a call).
    void engine.ctx.resume().catch(() => {})
    stopLoop()
    cancelSpeech()
    engine.setDuck(false)

    const selection = selectLines(demoCommentary.lines, settingsRef.current)
    linesRef.current = selection.lines
    handledRef.current = new Set()
    speakingIdRef.current = null
    captionRef.current = null
    setFallbackNote(selection.fallbackNote)
    setCaption(null)
    setAired([])
    setEvidenceLine(null)
    setT(0)

    try {
      engine.play(demoClip, { favouritePlayer: settingsRef.current.favourite || undefined })
    } catch {
      wa.videoRef.current?.pause()
      startingRef.current = false
      setStartError(UNLOCK_FAILED)
      setPhase('start')
      return
    }
    playStartedRef.current = performance.now()
    setStatus('playing')
    rafRef.current = requestAnimationFrame(tick)
  }, [stopLoop, tick, wa.videoRef])

  const handleStop = useCallback(() => {
    stopLoop()
    cancelSpeech()
    speakingIdRef.current = null
    engineRef.current?.stop()
    engineRef.current?.setDuck(false)
    wa.videoRef.current?.pause()
    setStatus('stopped')
  }, [stopLoop, wa.videoRef])

  // Same path as Replay, plus the video. All synchronous inside the tap:
  // the video is muted, so play() is allowed; startPlayback resumes the AudioContext.
  const handlePlayTogether = () => {
    const video = wa.videoRef.current
    if (video) {
      video.currentTime = wa.offsetRef.current
      void video.play().catch(() => {})
    }
    lastDriftCheckRef.current = performance.now()
    startPlayback()
  }

  const handleStart = async () => {
    if (startingRef.current) return // re-tap while starting or playing does nothing
    startingRef.current = true
    setStartError(null)

    // Everything up to unlock() runs synchronously inside the tap (iOS, Android).
    let engine: SoundEngine
    try {
      engine = engineRef.current ?? new SoundEngine()
      engineRef.current = engine
      primeSpeech()
    } catch {
      startingRef.current = false
      setStartError(UNLOCK_FAILED)
      return
    }

    try {
      await engine.unlock()
    } catch {
      startingRef.current = false
      setStartError(UNLOCK_FAILED)
      return
    }

    if (!mountedRef.current) return // left the page while audio was unlocking
    setPhase('player')
    startPlayback()
  }

  // Move focus to the player heading once it appears.
  useEffect(() => {
    if (phase === 'player') playerHeadingRef.current?.focus()
  }, [phase])

  useEffect(() => {
    if (evidenceLine) evidenceHeadingRef.current?.focus()
  }, [evidenceLine])

  // Stop everything when leaving the page, and close the AudioContext:
  // iOS allows only a handful of live contexts per page.
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      cancelSpeech()
      const engine = engineRef.current
      engineRef.current = null
      startingRef.current = false
      if (engine) {
        engine.stop()
        void engine.ctx.close().catch(() => {})
      }
    }
  }, [])

  const toggleSpeakers = () => {
    const next = !speakersMode
    setSpeakersMode(next)
    engineRef.current?.setSpeakersMode(next)
  }

  const openEvidence = (line: CommentaryLine, opener: HTMLElement) => {
    evidenceOpenerRef.current = opener
    setEvidenceLine(line)
  }

  const closeEvidence = () => {
    setEvidenceLine(null)
    const opener = evidenceOpenerRef.current
    if (opener && opener.isConnected) opener.focus()
    else playerHeadingRef.current?.focus()
  }

  if (phase === 'start') {
    return (
      <main className="ls-root ls-start">
        <div role="alert" className="ls-start-error">
          {startError}
        </div>
        <button type="button" className="ls-start-button" onClick={handleStart}>
          Start.
          <br />
          Put on headphones.
        </button>
      </main>
    )
  }

  const [home, away] = scoreAt(t)
  const currentEvent = eventAt(demoClip, t)
  const date = new Date(`${demoClip.date}T12:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })

  return (
    <main className="ls-root ls-player">
      <header className="ls-header">
        <h1 ref={playerHeadingRef} tabIndex={-1} className="ls-score">
          {demoClip.teams.home.name} {home} – {away} {demoClip.teams.away.name}
        </h1>
        <p className="ls-clock">
          <span className="ls-sr-only">Match clock </span>
          {clockText(demoClip, t)}
          <span className="ls-status">
            {status === 'playing' ? 'Playing' : status === 'finished' ? 'Finished' : 'Stopped'}
          </span>
        </p>
        <p className="ls-meta">
          {demoClip.competition} · {date}
        </p>
        <p className="ls-rights">{demoClip.rightsNote}</p>
      </header>

      {watchAlong && wa.src && (
        <div className={`ls-media${showPitch ? ' ls-media-two' : ''}`}>
          <WatchAlongVideo wa={wa} />
          {showPitch && <PitchView clip={demoClip} t={t} reducedMotion={reducedMotion} />}
        </div>
      )}

      <section className="ls-caption-area" aria-label="Commentary">
        {/* Announce only lines the voice could not speak, so screen readers don't repeat it. */}
        <div className="ls-sr-only" aria-live="polite" aria-atomic="true">
          {caption && !caption.spoken ? caption.line.text : ''}
        </div>
        {caption && (
          <button
            type="button"
            className="ls-caption"
            onClick={(e) => openEvidence(caption.line, e.currentTarget)}
          >
            {caption.line.text}
            <span className="ls-caption-hint">Tap to see why we can say this</span>
          </button>
        )}
        {!caption && currentEvent && <p className="ls-event-label">{currentEvent.label}</p>}
        {fallbackNote && <p className="ls-note">{fallbackNote}</p>}
      </section>

      {evidenceLine && (
        <section className="ls-panel ls-evidence" aria-labelledby="ls-evidence-title">
          <h2 id="ls-evidence-title" ref={evidenceHeadingRef} tabIndex={-1}>
            Why we can say this
          </h2>
          <p className="ls-evidence-line">“{evidenceLine.text}”</p>
          <ul>
            {evidenceLine.evidence.map((id) => {
              const ev = demoClip.events.find((e) => e.id === id)
              return (
                <li key={id}>
                  <span className="ls-ev-id">{id}</span> {ev ? ev.label : 'Event not found in the match data.'}
                </li>
              )
            })}
          </ul>
          <button type="button" className="ls-btn" onClick={closeEvidence}>
            Close
          </button>
        </section>
      )}

      <section className="ls-controls" aria-label="Playback">
        <div className="ls-row">
          <button
            type="button"
            className="ls-btn ls-btn-primary"
            onClick={() => (wa.videoRef.current ? handlePlayTogether() : startPlayback())}
          >
            Replay
          </button>
          <button type="button" className="ls-btn" onClick={handleStop}>
            Stop
          </button>
        </div>
        <div className="ls-row">
          <button
            type="button"
            className="ls-btn ls-toggle"
            aria-pressed={showPitch}
            onClick={() => setShowPitch((v) => !v)}
          >
            Show me what I heard
          </button>
        </div>
        <div className="ls-row">
          <button
            type="button"
            className="ls-btn ls-toggle"
            aria-pressed={watchAlong}
            onClick={() => setWatchAlong((v) => !v)}
          >
            Watch along
          </button>
        </div>
        <div className="ls-row ls-row-stack">
          <button
            type="button"
            className="ls-btn ls-toggle"
            aria-pressed={speakersMode}
            aria-describedby="ls-speakers-help"
            onClick={toggleSpeakers}
          >
            Speakers mode
          </button>
          <p id="ls-speakers-help" className="ls-help">
            Use this if you are not wearing headphones.
          </p>
        </div>
      </section>

      {watchAlong && <WatchAlongPanel wa={wa} onPlayTogether={handlePlayTogether} />}

      {showPitch && !(watchAlong && wa.src) && <PitchView clip={demoClip} t={t} reducedMotion={reducedMotion} />}

      <details className="ls-panel ls-personalise">
        <summary>Personalise</summary>
        <p id="ls-personalise-help" className="ls-help">
          Changes take effect when you press Replay.
        </p>
        <label className="ls-field">
          <span>Language</span>
          <select
            value={settings.lang}
            aria-describedby="ls-personalise-help"
            onChange={(e) => setSettings((s) => ({ ...s, lang: e.target.value as Lang }))}
          >
            {(Object.keys(LANG_LABELS) as Lang[]).map((l) => (
              <option key={l} value={l}>
                {LANG_LABELS[l]}
              </option>
            ))}
          </select>
        </label>
        <label className="ls-field">
          <span>Detail</span>
          <select
            value={settings.detail}
            aria-describedby="ls-personalise-help"
            onChange={(e) => setSettings((s) => ({ ...s, detail: e.target.value as Detail }))}
          >
            {(Object.keys(DETAIL_LABELS) as Detail[]).map((d) => (
              <option key={d} value={d}>
                {DETAIL_LABELS[d]}
              </option>
            ))}
          </select>
        </label>
        <label className="ls-field">
          <span>Favourite player</span>
          <select
            value={settings.favourite}
            aria-describedby="ls-personalise-help"
            onChange={(e) => setSettings((s) => ({ ...s, favourite: e.target.value }))}
          >
            <option value="">None</option>
            {FAVOURITES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
      </details>

      {aired.length > 0 && (
        <details className="ls-panel">
          <summary>Lines so far ({aired.length})</summary>
          <ul className="ls-aired">
            {aired.map((line) => (
              <li key={line.id}>
                <button type="button" className="ls-aired-btn" onClick={(e) => openEvidence(line, e.currentTarget)}>
                  {line.text}
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </main>
  )
}
