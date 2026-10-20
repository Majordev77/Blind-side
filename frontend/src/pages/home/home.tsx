/**
 * Landing page
 *
 * Dark, high contrast and offline-friendly (system fonts, no images).
 * Shares its colours and focus ring with the Listen page.
 */

import { Link } from 'react-router-dom'
import { Path } from '@/router/paths'
import { demoClip, demoCommentary, type CommentaryLine } from '@/demo'
import { EarsMotif, SoundIcons } from './components/sound-icons'
import './home.css'

// No direct UEFA upload could be confirmed as being on UEFA's own channel,
// so link to a search of the official @UEFA channel instead.
const UEFA_VIDEO_URL = 'https://www.youtube.com/@UEFA/search?query=Ronaldo%20bicycle%20kick%20Juventus%202018'

const SOUNDS: Array<{ icon: keyof typeof SoundIcons; sound: string; meaning: string }> = [
  { icon: 'ears', sound: 'A tone moving between your ears', meaning: 'Where the ball is, goal to goal' },
  { icon: 'height', sound: 'The tone rising or falling', meaning: 'Which touchline: higher is the far side' },
  { icon: 'click', sound: 'A short click', meaning: 'A pass. Longer pass, longer click' },
  { icon: 'sweep', sound: 'A rising sweep', meaning: 'A shot. Faster sweep, harder shot' },
  { icon: 'crack', sound: 'A whoosh, then a crack', meaning: 'The overhead kick' },
  { icon: 'crowd', sound: 'The crowd', meaning: 'How the stadium reacts' },
  { icon: 'voice', sound: 'The voice', meaning: 'Names, key moments, and why they matter' },
]

/** The English "full" line about the goal with the most evidence, from the real commentary data. */
function pickExampleLine(): CommentaryLine | undefined {
  const goalIds = new Set(demoClip.events.filter((e) => e.type === 'goal').map((e) => e.id))
  const candidates = demoCommentary.lines.filter(
    (l) => l.lang === 'en' && l.detail === 'full' && !l.favourite && l.evidence.some((id) => goalIds.has(id)),
  )
  candidates.sort((a, b) => b.evidence.length - a.evidence.length)
  return candidates[0] ?? demoCommentary.lines[0]
}

export default function HomePage() {
  const example = pickExampleLine()

  return (
    <div className="hm-root">
      <header className="hm-header">
        <span className="hm-wordmark">Blind Side</span>
      </header>

      <main>
        <section className="hm-hero hm-wrap" aria-labelledby="hm-title">
          <EarsMotif />
          <h1 id="hm-title" className="hm-title">
            Hear the match.
          </h1>
          <p className="hm-tagline">Sound carries position. Speech carries meaning.</p>
          <p className="hm-lead">
            Blind Side lets blind and low-vision fans follow football through headphones, on any phone, in their own
            language.
          </p>
          <Link to={Path.Listen} className="hm-cta">
            <span className="hm-cta-label">Try the demo</span>
            <span className="hm-cta-sub">
              Ronaldo's overhead kick, Juventus v Real Madrid, 2018 · 36 seconds · headphones on
            </span>
          </Link>
          <p className="hm-secondary">
            <a href={UEFA_VIDEO_URL} target="_blank" rel="noopener noreferrer">
              Find the real goal on UEFA's YouTube channel
              <span className="hm-sr-only"> (opens YouTube in a new tab)</span>
            </a>
          </p>
        </section>

        <section className="hm-section hm-wrap" aria-labelledby="hm-sound">
          <h2 id="hm-sound">How it sounds</h2>
          <p className="hm-intro">At most three sounds at once. Everything gets quieter when the voice speaks.</p>
          <ul className="hm-sounds">
            {SOUNDS.map((s) => (
              <li key={s.icon} className="hm-sound">
                <span className="hm-sound-icon">{SoundIcons[s.icon]}</span>
                <span className="hm-sound-text">
                  <strong>{s.sound}</strong>
                  <span>{s.meaning}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="hm-section hm-wrap" aria-labelledby="hm-ai">
          <h2 id="hm-ai">AI that shows its working</h2>
          <ol className="hm-steps">
            <li>
              <h3>Editor</h3>
              <p>Picks the moments that deserve words. Everything else is left to sound.</p>
            </li>
            <li>
              <h3>Narrator</h3>
              <p>Writes the lines for you: your language, your level of detail, your favourite player.</p>
            </li>
            <li>
              <h3>Verifier</h3>
              <p>Checks every line against the match events. A line that can't be proved is not spoken.</p>
            </li>
          </ol>

          {example && (
            <figure className="hm-example">
              <figcaption>A real line from the demo, with its evidence</figcaption>
              <blockquote>“{example.text}”</blockquote>
              <ul className="hm-chips" aria-label="Evidence">
                {example.evidence.map((id) => {
                  const ev = demoClip.events.find((e) => e.id === id)
                  return (
                    <li key={id} className="hm-chip">
                      <span className="hm-chip-id">{id}</span>
                      <span>{ev ? ev.label : 'Unknown event'}</span>
                    </li>
                  )
                })}
              </ul>
            </figure>
          )}
        </section>

        <section className="hm-section hm-wrap" aria-labelledby="hm-you">
          <h2 id="hm-you">Made for you</h2>
          <ul className="hm-cards">
            <li>
              <h3>Your language</h3>
              <p>English, Nigerian Pidgin or Yoruba, with captions.</p>
            </li>
            <li>
              <h3>Your level of detail</h3>
              <p>Essentials, full, or analyst.</p>
            </li>
            <li>
              <h3>Your player</h3>
              <p>A personal chime whenever your favourite player touches the ball.</p>
            </li>
          </ul>
        </section>

        <section className="hm-section hm-wrap" aria-labelledby="hm-who">
          <h2 id="hm-who">Who it's for</h2>
          <p>
            About 43 million people worldwide are blind. Blind Side is for them, and for low-vision fans, first. It
            also helps anyone whose eyes are busy.
          </p>
          <p className="hm-honest">
            Not yet tested with blind users. That's our next step, with blind fans and associations in Nigeria.
          </p>
        </section>
      </main>

      <footer className="hm-footer">
        <div className="hm-wrap">
          <p>
            A recreation from public match reports. No broadcast audio or footage used. Real names describe a historical
            match.
          </p>
          <p>Built for the Talent Nation AI Rebuild Challenge, October 2026.</p>
          {/* The hosted demo has no backend, so sign-in only shows when running locally. */}
          {import.meta.env.BASE_URL === '/' && (
            <p>
              <Link to={Path.Login}>Sign in</Link>
            </p>
          )}
        </div>
      </footer>
    </div>
  )
}
