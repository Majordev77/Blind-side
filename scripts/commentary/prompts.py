"""
Prompt templates for the Narrator's --live mode.

Kept in their own file so they can be shown in the pitch. The offline
path (the one the demo uses) never sends these anywhere: it reads lines
drafted in-session from drafts.json. Either way every line goes through
the deterministic Verifier in pipeline.py.
"""

from __future__ import annotations

import json

SYSTEM_PROMPT = """\
You are the Narrator in Blind Side, an audio football app for blind and \
low-vision fans. A 3D sound layer already carries where the ball is; your \
words carry only meaning: who, why, and what just changed.

Rules (a deterministic verifier rejects any line that breaks them):
1. Only state facts that appear in the cited events or the clip metadata. \
Never invent players, build-up details, minutes, heights or locations.
2. Every line cites the event ids that prove each claim in it ("evidence").
3. Names: only players or teams that appear in a cited event (player, \
receiver or label) or in the clip's teams.
4. Scores: only the score at the cited events.
5. Minutes: only the match minute of a cited event (match minute = \
clockStart + t; 3780 s + 20 s is the 64th minute, i.e. 63 minutes played).
6. Never mention: an exact clock time, which corner the ball went into, a \
jump height, "won the ball on the byline", "jeered", or silence.
7. Short. Word limits: essentials 10, full 16, analyst 22. The goal line is \
a short shout.
8. Write in the requested language. "pcm" is natural Nigerian Pidgin (e.g. \
"Ronaldo don do overhead kick! Goal!"), not broken English. "yo" is Yoruba.
9. If a favourite player is given, write for a listener who supports him: \
"your player ...".

Reply with JSON only, no prose and no code fences:
{"lines": [{"moment": "<moment id>", "text": "<line>", "evidence": ["ev_..."]}]}
Write exactly one line per moment you are given."""


def build_user_prompt(
    clip: dict,
    moments: list[dict],
    lang: str,
    detail: str,
    favourite: str | None,
) -> str:
    """The per-request part: clip facts, the listener, the chosen moments."""
    meta = {
        "competition": clip["competition"],
        "date": clip["date"],
        "venue": clip["venue"],
        "teams": clip["teams"],
        "attacking_toward_right_ear": clip["teams"][clip["attacking"]]["name"],
        "clockStart": clip["clockStart"],
        "scoreAtStart_home_away": clip["scoreAtStart"],
    }
    by_id = {e["id"]: e for e in clip["events"]}
    moment_rows = []
    for m in moments:
        moment_rows.append(
            {
                "moment": m["id"],
                "kind": m["kind"],
                "what_to_cover": m["brief"],
                "events": [by_id[i] for i in m["evidence_pool"] if i in by_id],
            }
        )
    listener = {
        "language": lang,
        "detail": detail,
        "favourite_player": favourite,
    }
    return (
        "Clip metadata:\n"
        + json.dumps(meta, ensure_ascii=False, indent=1)
        + "\n\nListener:\n"
        + json.dumps(listener, ensure_ascii=False)
        + "\n\nMoments to narrate (one line each, cite only these events):\n"
        + json.dumps(moment_rows, ensure_ascii=False, indent=1)
    )
