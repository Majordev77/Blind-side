# Commentary pipeline: Editor -> Narrator -> Verifier

Builds `frontend/src/demo/commentary.json` (the `Commentary` type in
`frontend/src/demo/types.ts`) from the clip `frontend/src/demo/bicycle-kick-2018.json`.
Python 3.12, standard library only.

| Stage | What it does |
|---|---|
| **Editor** | Scores every event by type (goal and overhead kick highest, then applause, shot and cross, then named-player passes, with ordinary passes lowest). It turns events into moments (opening, goal, goal recap, calls, an analyst "why" line, favourite-player moments) and picks the best ones under a budget per detail level: essentials 3 lines / 11 s, full 6 / 24 s, analyst 7 / 32 s. Speech time is words / 2.6 per second. Lines never overlap (0.3 s gap), never play over the quiet windows (the saved shot at 9.5-10.0 s and the overhead kick to the net at 19.0-20.6 s), and the goal line starts right after the net. Favourite-player lines and "why" lines go into the gaps. |
| **Narrator** | Offline (default): reads `drafts.json`. Those lines were drafted in-session by an AI (Claude) acting as the Narrator, and are keyed by moment, language, detail and favourite. `--live`: calls the Claude Messages API (`claude-opus-5-5`) once per language x detail x favourite, using the prompts in `prompts.py`, and falls back to the drafts for any moment the model leaves out. |
| **Verifier** | Deterministic. For every line it checks that each evidence id exists in the clip, that each capitalised name (and any known player) appears in a cited event or the clip's teams/metadata, that each score matches the score at the cited events (digits, English/Pidgin number words, Yoruba òdo/ọ̀kan/méjì/mẹ́ta), and that each minute matches the cited event's match minute (`clockStart + t`: "64th minute" or "63 minutes"). It also rejects the "do not say" items from `docs/pitch/FACTS.md` and checks the word limits (10 / 16 / 22). A line that fails is replaced by a template sentence built from its primary evidence event (`fallback: true`). After scheduling, it checks that no line speaks before its evidence happens (the opening line is exempt) or over a quiet window. A line that fails those timing checks is dropped. |

## Run (from the repo root, PowerShell or bash)

```
python scripts/commentary/pipeline.py              # offline, the demo path
python scripts/commentary/pipeline.py --selftest   # shows the verifier rejecting wrong lines
python scripts/commentary/pipeline.py --live       # needs ANTHROPIC_API_KEY
```

The default run writes `frontend/src/demo/commentary.json` and
`scripts/commentary/last-run.md`. The report lists every line: whether it aired,
fell back or was dropped, the reason, and the evidence. It ends with the Pidgin
and Yoruba checklist for a native speaker.

For `--live`, set the key in the shell only (PowerShell: `$env:ANTHROPIC_API_KEY = "..."`).
The script never writes the key anywhere, and `.env` is in `.gitignore`.
Without a key, `--live` exits with a message. The demo never depends on a live call.

## Editing lines

Edit `drafts.json` and re-run. If a line breaks a rule, the run prints `FALLBACK` or `DROPPED`
with the reason. Every `pcm` and `yo` line needs a native-speaker check. Yoruba is
essentials-only and is a stretch goal.

Favourite lines: the app should play lines
that have no `favourite`, plus lines whose `favourite` equals the listener's chosen player.
Lines for different favourites can share a time slot, because only one favourite is active at once.
