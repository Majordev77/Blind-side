# Pitch plan: Blind Side at the Talent Nation AI Rebuild Challenge

Pitch: **Wednesday 21 October 2026, 10:00 WAT**. Everything done, deployed and tested by **08:00 WAT**.
Branch: `feat/pitch-demo-bicycle-kick` (OAH-008 work is on `feat/OAH-008-add-the-full-screen-start-button-and-audio-unlock`).

Status: `[ ]` to do · `[~]` in progress · `[x]` done · `[-]` cut

## P0, must work on stage

| | Item | Owner | Box (WAT) |
|---|---|---|---|
| [x] | OAH-008 groundwork committed and pushed (home route out of MainLayout, HTML prototype) | tech lead | 00:15–00:35 |
| [x] | Agent team, data contracts (`frontend/src/demo/types.ts`, `ball-path.ts`), draft timeline | tech lead | 00:15–00:45 |
| [ ] | Fact-check the bicycle kick, `docs/pitch/FACTS.md`, final timeline | product-manager | 00:45–01:30 |
| [ ] | Listen route, full-screen Start, audio unlock, no double start, failure message (OAH-008 1–5) | frontend-engineer | 00:45–02:00 |
| [ ] | Sound engine: HRTF ball, vocabulary, crowd bed, overhead-kick sound, ducking, speech wrapper | audio-engineer | 00:45–02:30 |
| [ ] | GitHub Pages workflow and first live deploy of a skeleton | frontend-engineer + Korede | 01:30–02:15 |
| [ ] | Captions (aria-live), match clock, 2D pitch toggle, replay | frontend-engineer | 02:00–03:30 |
| [ ] | End-to-end bicycle kick on a phone, live URL | tech lead | 03:30–04:00 |
| [ ] | Offline: standalone HTML (`docs/pitch/blind-side-standalone.html`) and `vite preview --host` steps | frontend-engineer | 05:00–05:45 |

## P1, the AI

| | Item | Owner | Box (WAT) |
|---|---|---|---|
| [ ] | Editor → Narrator → Verifier pipeline, `commentary.json` (en, pcm, 3 detail levels, favourite player) | ai-engineer | 01:30–03:30 |
| [ ] | Personalisation controls (language, detail, favourite player + chime) | frontend-engineer | 03:30–04:30 |
| [ ] | Evidence view: tap a caption, see the events behind it | frontend-engineer | 04:30–05:00 |
| [ ] | Yoruba (stretch, captions first) | ai-engineer | only if ahead |

## P2, only if P0 and P1 are deployed

| | Item | Owner | Box (WAT) |
|---|---|---|---|
| [ ] | Django read-only demo endpoint with CORS, frontend falls back to bundled JSON | backend-engineer | 06:00–06:45 |
| [ ] | Hold to ask: four fixed questions answered from match state | frontend-engineer | 06:00–06:45 |
| [ ] | Second, invented-teams match | product-manager | 06:00–06:45 |

## Pitch materials

| | Item | Owner | Box (WAT) |
|---|---|---|---|
| [ ] | `PITCH.md` (3-minute script, 5 judge questions) | product-manager | 03:30–05:00 |
| [ ] | `SLIDES.md` (6–8 slides) | product-manager | 05:00–05:45 |
| [ ] | `DEMO-RUNBOOK.md` (pre-stage checklist, failure plans, exact commands) | tech lead + product-manager | 05:45–06:30 |
| [ ] | README "Hackathon demo" section with the live link | tech lead | 06:30–06:45 |
| [ ] | PR for the demo branch, merge list for after the hackathon | tech lead | 06:45–07:00 |
| [ ] | Phone test of the live URL, airplane-mode test, screen recording backup | Korede | 07:00–08:00 |

## Cut order if late

1. P2 entirely
2. Evidence view
3. Pidgin
4. AI script (keep hand-written lines in the same format)

**Never cut:** the Start button, 3D sound, the voice, the captions, the hosted link.

## Decisions

- No `ANTHROPIC_API_KEY` tonight: lines are AI-drafted in-session; the verifier is deterministic and real. The pipeline has an optional `--live` mode.
- Hosting: GitHub Pages via a new Actions workflow (repo is public). Netlify Drop of `frontend/dist` is the backup.
