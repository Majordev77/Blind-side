# Pitch: Blind Side (3 minutes)

Talent Nation AI Rebuild Challenge, Wednesday 21 October 2026, 10:00 WAT. Presenter: Korede.

Speak slowly. Lines in plain text are spoken; anything in [brackets] is a stage direction, not spoken.
Spoken text is about 400 words, plus the 36-second clip. That is brisk; if a rehearsal runs over, cut the "Monday morning" sentence first, then the "crowded bus" line.

**Before you walk on:** phone unlocked, page loaded, **Speakers mode ON**, Personalise set to English, Full, no favourite player. Venue audio connected and tested. See `DEMO-RUNBOOK.md`.

---

## 0:00–0:20 · The problem

Good morning. I'm Korede. When a goal goes in, a whole stadium knows at once. A blind fan hears the roar, and then waits for somebody to tell them what just happened. Here, football is what we talk about on Monday morning. Blind fans deserve to be in that conversation.

## 0:20–1:00 · The demo

[Hold the phone up. Speakers mode is already on.]

Close your eyes. This is the most famous goal of the decade. Now hear it the way a blind fan would with Blind Side.

[Tap **Start**. Say nothing for 36 seconds. Let the applause finish.]

## 1:00–1:20 · Show me what I heard

That was Ronaldo's overhead kick against Juventus, 2018. The tone moving across your ears was the ball; a higher tone means the far touchline. Clicks are passes, the rising sweep is a shot. Sound tells you where; the voice tells you what matters.

[Tap **Show me what I heard**. Point at the pitch on the screen. Tap **Replay** and talk over the first few seconds; if it is loud, lower the volume two steps.]

## 1:20–2:10 · Personalise, and the evidence

Not every fan wants the same commentary. So I'll switch to Nigerian Pidgin, analyst level, and make Ronaldo my favourite player.

[Tap **Personalise** → **Pidgin** → **Analyst** → **Ronaldo**. Tap **Replay**. Let it run to the goal, about 20 seconds.]

That chime? That's my player touching the ball.

[Volume back down. Tap a caption, ideally the goal line.]

Now tap any line, and it shows why we can say it: the match events behind it. The commentary was drafted by AI. Then a verifier checks every line against those events. If a line can't be traced, it's thrown out and replaced with a plain, safe template. It never makes things up. Tonight we had no API key, so the lines were drafted in advance and checked by that same verifier. And we built all of this overnight with AI coding tools: Claude Code working as a small team of agents.

## 2:10–2:50 · Who it's for, and what's next

About 43 million people in the world are blind, and many of them love football. Radio has served them for a century, but radio talks to everyone the same way. Blind Side also helps anyone whose eyes are busy: cooking, working, on a crowded bus. It runs on any phone browser, and even offline.

Fans told us they mostly want this at home, synced to live commentary, in 3D sound. Stadium use comes second. We think broadcasters, leagues and clubs who need accessible coverage will pay for it, and fans use it free.

To be honest: no blind user has tried this version yet. That is our next step, testing with blind fans and associations here in Nigeria. After that, live data feeds, and an Azure version for the Microsoft hackathon on 27 October.

## 2:50–3:00 · The ask

[Korede: adjust]

We're asking for two things: introductions to blind associations and football data partners, and the prize money to pay for our first user tests. Thank you.

---

## Judge questions

**Is this real match audio?**
No. Every sound is made in code in the browser, and the voice is the phone's own text-to-speech. We rebuilt the play from public match reports, used only details at least two reports agree on, and the app says so on screen. The video you saw is Real Madrid's own official upload, played muted through YouTube's embedded player, so we copy nothing. All the sound and commentary are ours.

**How does the AI avoid mistakes?**
Each event has an ID. The AI writes lines, and a separate verifier script, with no AI in it, rejects any line that names a player, score or action it can't trace to those event IDs. A rejected line falls back to a plain template. You can tap any caption to see the events behind it.

**Have blind users tried it?**
Not this version, no. It was built overnight. Earlier conversations with fans told us what they want: home use, synced to live commentary, 3D sound, with stadium use second. Testing with blind fans and Nigerian associations is the next step, and it's what the prize money is for.

**Where's the AI? What did AI actually do?**
Two places. First, the commentary: an Editor picks which moments deserve words, a Narrator writes them per language, detail level and favourite player, and the Verifier checks them. The script can call the Claude API live, but we had no key tonight, so the lines were AI-drafted in our session and checked by the verifier. Second, the build: we used Claude Code as a team of agents (product manager, frontend, audio, AI and reviewer) to build it overnight.

**How would this work live?**
A live data feed sends match events. A state engine tracks the ball and the score. Sound cues go straight to the phone, so position is near-instant; spoken lines go through the checked path and arrive a little later. The phone mixes both. Tonight's demo runs from a recorded event file; the live feed is the next build.

**Business model?**
Free for fans. Paid by broadcasters, leagues and clubs that need accessible coverage, as a licence or an add-on to their apps. This is our plan, not yet tested with buyers.

**Does it need data or a good network?**
No. Once loaded it runs on the phone, and we also have a single HTML file that works fully offline.
