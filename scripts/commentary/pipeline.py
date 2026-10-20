"""
Blind Side commentary pipeline: Editor -> Narrator -> Verifier.

    python scripts/commentary/pipeline.py            # offline (drafts.json)
    python scripts/commentary/pipeline.py --live     # Claude API, needs ANTHROPIC_API_KEY
    python scripts/commentary/pipeline.py --selftest # verifier rejects bad lines

Writes frontend/src/demo/commentary.json and scripts/commentary/last-run.md.
Python 3.12, standard library only. No key is ever written to disk.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import re
import sys
import unicodedata
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
CLIP_PATH = ROOT / "frontend" / "src" / "demo" / "bicycle-kick-2018.json"
OUT_PATH = ROOT / "frontend" / "src" / "demo" / "commentary.json"
DRAFTS_PATH = HERE / "drafts.json"
REPORT_PATH = HERE / "last-run.md"

LANGS = ["en", "pcm", "yo"]
DETAILS = ["essentials", "full", "analyst"]
FAVOURITES = ["Cristiano Ronaldo", "Dani Carvajal"]
LANG_DETAILS = {"en": DETAILS, "pcm": DETAILS, "yo": ["essentials"]}
NATIVE_CHECK = {"pcm", "yo"}

WORDS_PER_SECOND = 2.6
GAP = 0.3  # silence between two lines
# Editor budget per detail level: max generic lines, max seconds of speech.
BUDGET = {
    "essentials": {"lines": 3, "seconds": 11.0},
    "full": {"lines": 6, "seconds": 24.0},
    "analyst": {"lines": 7, "seconds": 32.0},
}
MAX_FAV_LINES = 2  # per favourite player, per lang x detail
WORD_LIMIT = {"essentials": 10, "full": 16, "analyst": 22}
WORD_LIMIT_EXTRA = {"yo": 3}  # Yoruba uses more short particles
EXPIRES_SLACK = {"goal": 1.5, "recap": 2.5, "call": 2.5, "opening": 2.0, "why": 3.0, "fav": 2.5}
MAX_DELAY = {"goal": 1.0, "recap": 6.0, "call": 5.0, "opening": 1.0, "why": 14.0, "fav": 14.0}
PRIORITY = {"opening": 1, "goal": 1, "recap": 1, "why": 3, "fav": 2}

MODEL = "claude-opus-5-5"
API_URL = "https://api.anthropic.com/v1/messages"


# --------------------------------------------------------------------------
# helpers


def fold(s: str) -> str:
    """Lowercase and strip accents/tone marks: 'Vázquez' -> 'vazquez', 'Ọ̀kan' -> 'okan'."""
    nfd = unicodedata.normalize("NFD", s)
    return "".join(c for c in nfd if unicodedata.category(c) != "Mn").lower()


def word_count(text: str) -> int:
    return len(text.split())


def speech_seconds(text: str) -> float:
    return word_count(text) / WORDS_PER_SECOND


def ceil2(x: float) -> float:
    return math.ceil(round(x * 100, 6)) / 100


def load_clip() -> dict:
    with CLIP_PATH.open(encoding="utf-8") as f:
        return json.load(f)


def match_minute_elapsed(clip: dict, t: float) -> int:
    """Same arithmetic as clockText() in ball-path.ts: floor(clockStart + t)."""
    return int(math.floor(clip["clockStart"] + t)) // 60


def quiet_windows(clip: dict) -> list[tuple[float, float]]:
    """Spans where no speech may play, so the key sounds are heard clean.

    - a shot: from the strike until just after it lands (t .. t + travel + 0.1);
    - an overhead kick that scores: from 0.6 s before the kick until the net
      has rippled (goal t + 0.65).
    """
    events = clip["events"]
    out: list[tuple[float, float]] = []
    for i, e in enumerate(events):
        if e["type"] == "shot":
            out.append((e["t"], round(e["t"] + e.get("duration", 0.8) + 0.1, 1)))
        elif e["type"] == "overhead_kick":
            goal = next((g for g in events[i:] if g["type"] == "goal"), None)
            end = goal["t"] + 0.65 if goal else e["t"] + e.get("duration", 0.8) + 0.1
            out.append((round(e["t"] - 0.6, 1), round(end, 1)))
    return out


def in_window(t: float, windows: list[tuple[float, float]]) -> tuple[float, float] | None:
    for w in windows:
        if w[0] <= t < w[1]:
            return w
    return None


# --------------------------------------------------------------------------
# Editor: score events, propose moments, spend the speaking budget

TYPE_SCORE = {
    "goal": 10, "overhead_kick": 9, "shot": 6, "cross": 6, "tackle": 4,
    "pressure": 3, "carry": 3, "pass": 1, "possession": 1, "end": 0,
}
CROWD_SCORE = {"applause": 7, "roar": 5, "surprise": 2, "murmur": 1}


def event_score(e: dict) -> int:
    if e["type"] == "crowd":
        return CROWD_SCORE.get(e.get("mood", ""), 1)
    s = TYPE_SCORE.get(e["type"], 0)
    if e["type"] == "pass" and e.get("receiver"):
        s += 3  # the ball reaches a named player
    if e["type"] == "pass" and e.get("endX", 0) >= 83:
        s += 1  # into the box
    return s


@dataclass
class Moment:
    id: str
    kind: str  # opening | goal | recap | call | why | fav
    anchor: str  # event id
    earliest: float
    score: float
    priority: int
    evidence_pool: list[str]
    brief: str
    details: tuple[str, ...] = tuple(DETAILS)
    favourite: str | None = None


def editor_moments(clip: dict) -> tuple[list[Moment], list[str]]:
    """All candidate moments, plus notes on events merged or skipped."""
    events = clip["events"]
    windows = quiet_windows(clip)
    notes: list[str] = []
    moments: list[Moment] = []
    first = events[0]
    moments.append(Moment(
        "opening", "opening", first["id"], 0.3, 100, 1, [first["id"]],
        "Orient the listener: who attacks toward the right ear, the score now. "
        "Competition and venue allowed at full/analyst.",
    ))
    goal_windows: list[tuple[float, float]] = []
    for e in events:
        if e["type"] == "goal":
            w = in_window(e["t"], windows)
            start = w[1] if w else e["t"]
            if w:
                goal_windows.append(w)
            pool = [x["id"] for x in events if w and w[0] - 0.6 <= x["t"] < w[1]] or [e["id"]]
            if e["id"] not in pool:
                pool.append(e["id"])
            moments.append(Moment(f"goal:{e['id']}", "goal", e["id"], start, 10, 1, pool,
                                  "The goal, a short shout, right after the net."))
            moments.append(Moment(f"recap:{e['id']}", "recap", e["id"], start, 9, 1, pool,
                                  "Who made it and the new score."))
            moments.append(Moment(f"why:{e['id']}", "why", e["id"], start, 6, 3, pool,
                                  "Why it matters, from the score and the clip metadata.",
                                  details=("analyst",)))
    for e in events:
        if e["type"] in ("goal", "end"):
            continue
        if e is first:
            notes.append(f"{e['id']} ({e['type']}) is covered by the opening line")
            continue
        if any(w[0] - 0.6 <= e["t"] < w[1] for w in goal_windows):
            notes.append(f"{e['id']} ({e['type']}, t={e['t']}) falls in the goal's quiet "
                         "window: merged into the goal recap")
            continue
        w = in_window(e["t"], windows)
        start = w[1] if w else e["t"]
        score = event_score(e)
        kind = "call"
        moments.append(Moment(
            f"call:{e['id']}", kind, e["id"], start, score, 2 if score >= 5 else 3,
            [e["id"]], e["label"],
            details=("essentials", "full", "analyst") if score >= 7 else ("full", "analyst"),
        ))
    # favourite-player moments: every event where the player is on the ball
    # or named in the label (e.g. the applause for him)
    for fav in FAVOURITES:
        surname = fav.split()[-1]
        for e in events:
            named = fav in (e.get("player"), e.get("receiver")) or surname in e["label"]
            if not named or e["type"] == "end":
                continue
            w = in_window(e["t"], windows)
            start = w[1] if w else e["t"]
            moments.append(Moment(
                f"fav:{e['id']}", "fav", e["id"], start, event_score(e), 2, [e["id"]],
                f"Tell a {fav} fan that their player is involved: {e['label']}",
                favourite=fav,
            ))
    return moments, notes


def editor_select(moments: list[Moment], detail: str, available: set[str] | None,
                  texts: dict[str, str]) -> tuple[list[Moment], list[str]]:
    """Generic moments for one detail level, best first, under the budget.

    `available` limits the choice to moments the Narrator can write (offline
    drafts); `texts` gives the drafted text so speech time can be counted.
    """
    budget = BUDGET[detail]
    chosen: list[Moment] = []
    seconds = 0.0
    log: list[str] = []
    pool = [m for m in moments if m.favourite is None and detail in m.details]
    pool.sort(key=lambda m: (-m.score, m.earliest))
    for m in pool:
        if available is not None and m.id not in available:
            continue
        if len(chosen) >= budget["lines"]:
            log.append(f"{m.id} (score {m.score}): over the {budget['lines']}-line budget")
            continue
        s = speech_seconds(texts.get(m.id, "")) if texts else 0
        if seconds + s > budget["seconds"]:
            log.append(f"{m.id} (score {m.score}): over the {budget['seconds']} s speech budget")
            continue
        chosen.append(m)
        seconds += s
    return chosen, log


def editor_select_fav(moments: list[Moment], fav: str, available: set[str] | None) -> list[Moment]:
    pool = [m for m in moments if m.favourite == fav and (available is None or m.id in available)]
    pool.sort(key=lambda m: (-m.score, m.earliest))
    return pool[:MAX_FAV_LINES]


# --------------------------------------------------------------------------
# Narrator: offline drafts, or the Claude API with --live


@dataclass
class Draft:
    moment: str
    text: str
    evidence: list[str]
    source: str  # "drafts.json" | "live"


class OfflineNarrator:
    def __init__(self, path: Path = DRAFTS_PATH):
        with path.open(encoding="utf-8") as f:
            self.rows = json.load(f)["lines"]

    def available(self, lang: str, detail: str, favourite: str | None) -> set[str]:
        return {r["moment"] for r in self.rows if self._match(r, lang, detail, favourite)}

    @staticmethod
    def _match(r: dict, lang: str, detail: str, favourite: str | None) -> bool:
        return (r["lang"] == lang and r["detail"] in (detail, "*")
                and r.get("favourite") == favourite)

    def write(self, clip: dict, moments: list[Moment], lang: str, detail: str,
              favourite: str | None) -> dict[str, Draft]:
        out: dict[str, Draft] = {}
        for m in moments:
            rows = [r for r in self.rows if r["moment"] == m.id and self._match(r, lang, detail, favourite)]
            rows.sort(key=lambda r: r["detail"] == "*")  # exact detail wins over "*"
            if rows:
                out[m.id] = Draft(m.id, rows[0]["text"], list(rows[0]["evidence"]), "drafts.json")
        return out


class LiveNarrator:
    """Calls the Claude Messages API with urllib. Falls back to drafts per moment."""

    def __init__(self, key: str, offline: OfflineNarrator):
        self._key = key  # held in memory only, never written anywhere
        self.offline = offline

    def available(self, lang: str, detail: str, favourite: str | None) -> set[str] | None:
        return None  # the model can write any moment

    def _call(self, system: str, user: str) -> str:
        body = {
            "model": MODEL,
            "max_tokens": 4000,
            "system": system,
            "output_config": {"effort": "low"},
            "messages": [{"role": "user", "content": user}],
        }
        req = urllib.request.Request(
            API_URL,
            data=json.dumps(body).encode("utf-8"),
            headers={
                "x-api-key": self._key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        if data.get("stop_reason") == "refusal":
            raise RuntimeError("the model declined this request")
        return "".join(b.get("text", "") for b in data.get("content", []) if b.get("type") == "text")

    def write(self, clip: dict, moments: list[Moment], lang: str, detail: str,
              favourite: str | None) -> dict[str, Draft]:
        from prompts import SYSTEM_PROMPT, build_user_prompt

        if not moments:
            return {}
        rows = [{"id": m.id, "kind": m.kind, "brief": m.brief, "evidence_pool": m.evidence_pool}
                for m in moments]
        try:
            raw = self._call(SYSTEM_PROMPT, build_user_prompt(clip, rows, lang, detail, favourite))
            parsed = parse_model_json(raw)
        except (urllib.error.URLError, RuntimeError, ValueError, TimeoutError) as err:
            print(f"  live call failed for {lang}/{detail}/{favourite or '-'}: {err}; using drafts")
            return self.offline.write(clip, moments, lang, detail, favourite)
        out: dict[str, Draft] = {}
        wanted = {m.id for m in moments}
        for r in parsed.get("lines", []):
            if r.get("moment") in wanted and isinstance(r.get("text"), str):
                ev = r.get("evidence") if isinstance(r.get("evidence"), list) else []
                out[r["moment"]] = Draft(r["moment"], r["text"].strip(), [str(x) for x in ev], "live")
        missing = [m for m in moments if m.id not in out]
        out.update(self.offline.write(clip, missing, lang, detail, favourite))
        return out


def parse_model_json(raw: str) -> dict:
    raw = raw.strip()
    raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw)
    start, end = raw.find("{"), raw.rfind("}")
    if start < 0 or end < 0:
        raise ValueError("no JSON object in the reply")
    return json.loads(raw[start : end + 1])


# --------------------------------------------------------------------------
# Verifier: deterministic checks, template fallback

NUMBER_WORDS = {
    "nil": 0, "zero": 0, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
    # Yoruba, tone marks folded away
    "odo": 0, "ookan": 1, "okan": 1, "meji": 2, "meta": 3, "merin": 4, "marun": 5,
}
PAIR_CONNECTORS = {"to", "si"}  # "two to nil", Yoruba "okan si odo"

# Capitalised words that are not names (folded). Sentence starts, interjections.
COMMON_WORDS = set("""
a an and the but so now then still even what that this it its he his him your you
goal goal goal listen hear rare from in on at for of home away overhead kick first
leg two one nil three back cross floated what's there here into out past ball
na e dem dey don una wetin dat abeg chai o
won wo ati ni si ti ninu goolu
""".split())

# From docs/pitch/FACTS.md: things the commentary must not say.
BANNED = [
    (re.compile(r"\b\d{1,3}:\d{2}\b"), "exact clock time (FACTS #4: DON'T USE)"),
    (re.compile(r"corner", re.I), "which corner the ball went in (FACTS #11: DON'T USE)"),
    (re.compile(r"byline", re.I), "won the ball on the byline (FACTS #7: DON'T USE)"),
    (re.compile(r"jeer", re.I), "jeered his every touch (FACTS #10: one source only)"),
    (re.compile(r"metre|meter|\b\d+(?:\.\d+)?\s?m\b", re.I), "jump height (FACTS #12: estimates only)"),
    (re.compile(r"silen", re.I), "the silence (FACTS #13: one source, sound design only)"),
]

WORD_RE = re.compile(r"[^\W\d_]+(?:['’][^\W\d_]+)?", re.UNICODE)


@dataclass
class Verdict:
    ok: bool
    reasons: list[str] = field(default_factory=list)
    checks: list[str] = field(default_factory=list)


class Verifier:
    def __init__(self, clip: dict):
        self.clip = clip
        self.by_id = {e["id"]: e for e in clip["events"]}
        self.windows = quiet_windows(clip)
        self.team_names = [clip["teams"][s]["name"] for s in ("home", "away")]
        self.meta_text = " ".join([
            clip["competition"], clip["venue"], clip["date"],
            *(clip["teams"][s][k] for s in ("home", "away") for k in ("name", "short")),
        ])
        # every person named anywhere in the clip, for the "known name" check
        self.known_people: set[str] = set()
        for e in clip["events"]:
            for k in ("player", "receiver"):
                if e.get(k):
                    self.known_people.update(fold(w) for w in e[k].split())

    # -- scores -----------------------------------------------------------
    def score_at(self, t: float) -> tuple[int, int]:
        score = tuple(self.clip["scoreAtStart"])
        for e in self.clip["events"]:
            if e["type"] == "goal" and e["t"] <= t and e.get("score"):
                score = tuple(e["score"])
        return score  # type: ignore[return-value]

    def allowed_scores(self, evidence: list[str]) -> set[tuple[int, int]]:
        out: set[tuple[int, int]] = set()
        for i in evidence:
            e = self.by_id[i]
            out.add(self.score_at(e["t"]))
            if e["type"] == "goal":
                out.add(self.score_at(e["t"] - 1e-6))  # "they led 1-0, now 2-0"
        return out

    def score_claims(self, text: str) -> list[tuple[str, tuple[int, ...]]]:
        """('pair', (a, b)) unordered, or ('teams', (home, away)) ordered."""
        toks = re.findall(r"\d+|[a-z]+", fold(text))
        claims: list[tuple[str, tuple[int, ...]]] = []
        nums = [(i, int(t) if t.isdigit() else NUMBER_WORDS.get(t)) for i, t in enumerate(toks)]
        val = {i: v for i, v in nums if v is not None}
        # "Juventus 0, Real Madrid 2"
        team_tokens = [fold(n).split()[-1] for n in self.team_names]  # juventus, madrid
        per_team: dict[int, int] = {}
        for i, t in enumerate(toks):
            for side, last in enumerate(team_tokens):
                if t == last and i + 1 in val:
                    per_team[side] = val[i + 1]
        used: set[int] = set()
        if len(per_team) == 2:
            claims.append(("teams", (per_team[0], per_team[1])))
            for i, t in enumerate(toks):
                if t in team_tokens and i + 1 in val:
                    used.add(i + 1)
        elif len(per_team) == 1:
            side, v = next(iter(per_team.items()))
            claims.append((f"team{side}", (v,)))
            for i, t in enumerate(toks):
                if t in team_tokens and i + 1 in val:
                    used.add(i + 1)
        i = 0
        while i < len(toks):
            if i in val and i not in used:
                j = i + 1
                if j < len(toks) and toks[j] in PAIR_CONNECTORS:
                    j += 1
                if j in val and j not in used:
                    claims.append(("pair", (val[i], val[j])))
                    i = j + 1
                    continue
            i += 1
        return claims

    # -- the checks -------------------------------------------------------
    def check_claims(self, text: str, evidence: list[str], lang: str, detail: str,
                     favourite: str | None = None) -> Verdict:
        v = Verdict(True)
        if not evidence:
            v.reasons.append("no evidence cited")
        missing = [i for i in evidence if i not in self.by_id]
        if missing:
            v.reasons.append(f"evidence id(s) not in the clip: {', '.join(missing)}")
        cited = [self.by_id[i] for i in evidence if i in self.by_id]
        if not v.reasons:
            v.checks.append(f"evidence ids exist ({', '.join(evidence)})")

        # names
        corpus_parts = [self.meta_text]
        for e in cited:
            corpus_parts += [e.get("player", ""), e.get("receiver", ""), e["label"]]
        corpus = {fold(w) for w in WORD_RE.findall(" ".join(corpus_parts))}
        corpus |= {fold(w)[:-2] for w in corpus if fold(w).endswith("'s")}
        bad_names = []
        for w in WORD_RE.findall(text):
            base = re.sub(r"['’]s$", "", w)
            f = fold(base)
            is_cap = base[:1].isupper()
            is_known_person = f in self.known_people
            if (is_cap or is_known_person) and f not in corpus and f not in COMMON_WORDS:
                bad_names.append(base)
        if bad_names:
            v.reasons.append("name(s) not in the cited events or clip teams: " + ", ".join(sorted(set(bad_names))))
        else:
            v.checks.append("names traceable")

        # scores
        allowed = self.allowed_scores([e["id"] for e in cited]) if cited else set()
        for kind, nums in self.score_claims(text):
            if kind == "teams":
                ok = nums in allowed
            elif kind == "pair":
                ok = tuple(sorted(nums)) in {tuple(sorted(s)) for s in allowed}
            else:  # one team's goals
                side = int(kind[-1])
                ok = any(s[side] == nums[0] for s in allowed)
            label = "-".join(str(n) for n in nums)
            if not ok:
                v.reasons.append(f"score {label} does not match the score at the cited events "
                                 f"({', '.join('-'.join(map(str, s)) for s in sorted(allowed)) or 'none'})")
            else:
                v.checks.append(f"score {label} matches")

        # minutes
        mins = [m for m in cited]
        for m in re.finditer(r"(\d+)\s*(st|nd|rd|th)\s+minute|(\d+)\s+minutes?", text.lower()):
            ok_set = set()
            for e in mins:
                el = match_minute_elapsed(self.clip, e["t"])
                ok_set.add(("ord", el + 1))
                ok_set.add(("card", el))
            claim = ("ord", int(m.group(1))) if m.group(1) else ("card", int(m.group(3)))
            if claim not in ok_set:
                v.reasons.append(f"minute '{m.group(0)}' does not match the cited events")
            else:
                v.checks.append(f"minute '{m.group(0)}' matches")

        # FACTS.md "do not say"
        for rx, why in BANNED:
            if rx.search(text):
                v.reasons.append(f"banned claim: {why}")

        # length
        limit = WORD_LIMIT[detail] + WORD_LIMIT_EXTRA.get(lang, 0)
        if word_count(text) > limit:
            v.reasons.append(f"too long: {word_count(text)} words, {detail} limit {limit}")

        v.ok = not v.reasons
        return v

    def check_timing(self, t: float, text: str, evidence: list[str], is_opening: bool) -> list[str]:
        reasons = []
        ts = [self.by_id[i]["t"] for i in evidence if i in self.by_id]
        if ts and t < max(ts) and not is_opening:
            reasons.append(f"speaks at {t} s, before its evidence happens ({max(ts)} s)")
        end = t + speech_seconds(text)
        for w in self.windows:
            if t < w[1] and w[0] < end:
                reasons.append(f"speech {t}-{end:.2f} s overlaps the quiet window {w[0]}-{w[1]} s")
        return reasons

    def template(self, evidence: list[str], lang: str) -> tuple[str, list[str]] | None:
        """Plain sentence from the primary evidence event."""
        ids = [i for i in evidence if i in self.by_id]
        if not ids:
            return None
        e = self.by_id[ids[0]]
        home, away = self.team_names
        if lang == "pcm" and e["type"] == "goal" and e.get("score"):
            h, a = e["score"]
            return f"Goal! {home} {h}, {away} {a}.", [e["id"]]
        if lang == "pcm" and e["type"] == "crowd" and e.get("mood") == "applause" and e.get("team"):
            return f"{self.clip['teams'][e['team']]['name']} fans dey clap.", [e["id"]]
        return e["label"], [e["id"]]  # English label for everything else


# --------------------------------------------------------------------------
# scheduling


def place(earliest: float, dur: float, occupied: list[tuple[float, float]],
          windows: list[tuple[float, float]], latest: float, clip_end: float) -> float | None:
    t = ceil2(earliest)
    for _ in range(100):
        moved = False
        for s, e in occupied:
            if t < e + GAP and s < t + dur + GAP:
                t = ceil2(e + GAP)
                moved = True
        for ws, we in windows:
            if t < we and ws < t + dur:
                t = we
                moved = True
        if not moved:
            break
    if t > latest + 1e-9 or t + dur > clip_end + 1e-9:
        return None
    return t


@dataclass
class Line:
    moment: Moment
    lang: str
    detail: str
    text: str
    evidence: list[str]
    drafted_text: str
    source: str
    favourite: str | None = None
    t: float = 0.0
    fallback: bool = False
    status: str = "aired"  # aired | fallback | dropped
    reasons: list[str] = field(default_factory=list)
    checks: list[str] = field(default_factory=list)

    @property
    def dur(self) -> float:
        return speech_seconds(self.text)


def schedule(lines: list[Line], clip: dict) -> list[str]:
    """Calls first in time order, then favourite lines, then 'why' lines in the gaps."""
    windows = quiet_windows(clip)
    end = clip["duration"]
    log: list[str] = []
    occupied: list[tuple[float, float]] = []

    def put(ln: Line, occ: list[tuple[float, float]]) -> bool:
        m = ln.moment
        t = place(m.earliest, ln.dur, occ, windows, m.earliest + MAX_DELAY[m.kind], end)
        if t is None:
            ln.status = "dropped"
            ln.reasons.append(f"no room: could not start between {m.earliest} and "
                              f"{m.earliest + MAX_DELAY[m.kind]:.1f} s and finish by {end} s")
            log.append(f"{ln.lang}/{ln.detail}: dropped {m.id} (no room)")
            return False
        ln.t = t
        occ.append((t, t + ln.dur))
        occ.sort()
        return True

    order = {"opening": 0, "goal": 1, "recap": 2, "call": 3}
    calls = sorted([l for l in lines if l.moment.kind in order],
                   key=lambda l: (l.moment.earliest, order[l.moment.kind]))
    for ln in calls:
        put(ln, occupied)
    fav_lines = [l for l in lines if l.moment.kind == "fav"]
    fav_occ: list[tuple[float, float]] = []
    for fav in FAVOURITES:
        occ = list(occupied)
        for ln in sorted([l for l in fav_lines if l.favourite == fav], key=lambda l: l.moment.earliest):
            if put(ln, occ):
                fav_occ.append((ln.t, ln.t + ln.dur))
    occ_all = sorted(occupied + fav_occ)
    for ln in sorted([l for l in lines if l.moment.kind == "why"], key=lambda l: l.moment.earliest):
        put(ln, occ_all)
    return log


# --------------------------------------------------------------------------
# pipeline


def run(clip: dict, narrator) -> tuple[list[Line], dict]:
    verifier = Verifier(clip)
    moments, editor_notes = editor_moments(clip)
    all_lines: list[Line] = []
    info: dict = {"editor_notes": editor_notes, "selection": {}, "windows": quiet_windows(clip),
                  "moments": moments}
    for lang in LANGS:
        for detail in LANG_DETAILS[lang]:
            # Narrator first (offline we need the text to count speech time)
            avail = narrator.available(lang, detail, None)
            generic_pool = [m for m in moments if m.favourite is None and detail in m.details]
            if avail is None:
                chosen, sel_log = editor_select(moments, detail, None, {})
                drafts = narrator.write(clip, chosen, lang, detail, None)
            else:
                drafts = narrator.write(clip, generic_pool, lang, detail, None)
                chosen, sel_log = editor_select(moments, detail, set(drafts),
                                                {k: d.text for k, d in drafts.items()})
            lines = [Line(m, lang, detail, drafts[m.id].text, drafts[m.id].evidence,
                          drafts[m.id].text, drafts[m.id].source) for m in chosen if m.id in drafts]
            for m in chosen:
                if m.id not in drafts:
                    sel_log.append(f"{m.id}: the Narrator returned no line")
            if lang != "yo":
                for fav in FAVOURITES:
                    favail = narrator.available(lang, detail, fav)
                    fchosen = editor_select_fav(moments, fav, favail)
                    fdrafts = narrator.write(clip, fchosen, lang, detail, fav)
                    for m in fchosen:
                        if m.id in fdrafts:
                            d = fdrafts[m.id]
                            lines.append(Line(m, lang, detail, d.text, d.evidence, d.text,
                                              d.source, favourite=fav))
            info["selection"][(lang, detail)] = sel_log

            # Verifier, part 1: claims. Failed lines become a template sentence.
            for ln in lines:
                v = verifier.check_claims(ln.text, ln.evidence, lang, detail, ln.favourite)
                ln.checks = v.checks
                if not v.ok:
                    ln.reasons = v.reasons
                    tpl = verifier.template(ln.evidence, lang)
                    if tpl is None:
                        ln.status = "dropped"
                        continue
                    ln.text, ln.evidence = tpl
                    ln.fallback = True
                    ln.status = "fallback"
                    v2 = verifier.check_claims(ln.text, ln.evidence, "en", "analyst")
                    if not v2.ok:
                        ln.status = "dropped"
                        ln.reasons += ["template also failed: " + "; ".join(v2.reasons)]
            live = [l for l in lines if l.status != "dropped"]
            schedule(live, clip)
            # Verifier, part 2: timing, after scheduling
            for ln in live:
                if ln.status == "dropped":
                    continue
                r = verifier.check_timing(ln.t, ln.text, ln.evidence, ln.moment.kind == "opening")
                if r:
                    ln.status = "dropped"
                    ln.reasons += r
                else:
                    ln.checks.append(f"timing ok (t={ln.t} s >= evidence, clear of quiet windows)")
            all_lines += lines
    return all_lines, info


def to_commentary(clip: dict, lines: list[Line], mode: str) -> dict:
    out = []
    for lang in LANGS:
        for detail in LANG_DETAILS[lang]:
            group = sorted([l for l in lines if l.lang == lang and l.detail == detail
                            and l.status != "dropped"], key=lambda l: (l.t, l.favourite or ""))
            n = 0
            for ln in group:
                n += 1
                slug = "" if not ln.favourite else "-fav-" + fold(ln.favourite.split()[-1])
                row = {
                    "id": f"{lang}-{detail}{slug}-{n:03d}",
                    "t": round(ln.t, 2),
                    "expires": round(ln.t + EXPIRES_SLACK[ln.moment.kind], 2),
                    "priority": PRIORITY.get(ln.moment.kind, ln.moment.priority),
                    "lang": lang,
                    "detail": detail,
                    "text": ln.text,
                    "evidence": ln.evidence,
                }
                if ln.favourite:
                    row["favourite"] = ln.favourite
                if ln.fallback:
                    row["fallback"] = True
                out.append(row)
                ln.out_id = row["id"]  # type: ignore[attr-defined]
    return {
        "clipId": clip["id"],
        "generatedBy": (
            "scripts/commentary/pipeline.py: Editor -> Narrator -> Verifier. "
            + ("Lines written live by claude-opus-5-5" if mode == "live"
               else "Lines AI-drafted in-session (drafts.json), not generated live")
            + "; every line checked by the deterministic verifier against event ids."
        ),
        "verifiedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "lines": out,
    }


def write_commentary(doc: dict) -> None:
    head = {k: doc[k] for k in ("clipId", "generatedBy", "verifiedAt")}
    parts = ["{"]
    for k, v in head.items():
        parts.append(f"  {json.dumps(k)}: {json.dumps(v, ensure_ascii=False)},")
    parts.append('  "lines": [')
    rows = [json.dumps(r, ensure_ascii=False) for r in doc["lines"]]
    parts.append(",\n".join("    " + r for r in rows))
    parts.append("  ]")
    parts.append("}")
    OUT_PATH.write_text("\n".join(parts) + "\n", encoding="utf-8", newline="\n")


def write_report(clip: dict, lines: list[Line], info: dict, mode: str) -> None:
    by_id = {e["id"]: e for e in clip["events"]}
    md: list[str] = []
    md.append("# Commentary pipeline: last run\n")
    md.append(f"- Run: {datetime.now(timezone.utc).replace(microsecond=0).isoformat()} "
              f"({'live, claude-opus-5-5' if mode == 'live' else 'offline, drafts.json'})")
    md.append(f"- Clip: `{clip['id']}` ({clip['title']}), clockStart {clip['clockStart']} s "
              f"(minute {match_minute_elapsed(clip, 0)}:00), score at start "
              f"{clip['scoreAtStart'][0]}-{clip['scoreAtStart'][1]}")
    md.append("- Quiet windows (no speech): " + ", ".join(f"{a}-{b} s" for a, b in info["windows"]))
    md.append(f"- Speech time estimate: words / {WORDS_PER_SECOND} per second, {GAP} s gap between lines")
    aired = [l for l in lines if l.status == "aired"]
    fb = [l for l in lines if l.status == "fallback"]
    dr = [l for l in lines if l.status == "dropped"]
    md.append(f"- Result: {len(aired)} aired as drafted, {len(fb)} replaced by a template, {len(dr)} dropped")
    md.append("- **needs native check**: every `pcm` (Nigerian Pidgin) and `yo` (Yoruba) line is "
              "AI-drafted and must be read by a native speaker (Korede) before the pitch.\n")

    md.append("## Editor\n")
    md.append("Event scores: " + ", ".join(f"{e['id']} {e['type']}={event_score(e)}"
                                          for e in clip["events"]) + "\n")
    for n in info["editor_notes"]:
        md.append(f"- {n}")
    md.append("")
    md.append("| moment | kind | earliest (s) | score | details |")
    md.append("|---|---|---|---|---|")
    for m in info["moments"]:
        if m.favourite:
            continue
        md.append(f"| {m.id} | {m.kind} | {m.earliest} | {m.score} | {', '.join(m.details)} |")
    md.append("")
    md.append("Budgets: " + "; ".join(f"{d}: {b['lines']} lines / {b['seconds']} s" for d, b in BUDGET.items())
              + f"; favourites: up to {MAX_FAV_LINES} extra lines each, in the gaps.\n")

    for lang in LANGS:
        for detail in LANG_DETAILS[lang]:
            group = sorted([l for l in lines if l.lang == lang and l.detail == detail],
                           key=lambda l: (l.t, l.favourite or ""))
            generic = [l for l in group if not l.favourite and l.status != "dropped"]
            secs = sum(l.dur for l in generic)
            flag = " (needs native check)" if lang in NATIVE_CHECK else ""
            md.append(f"## {lang} / {detail}{flag}\n")
            md.append(f"{len(generic)} lines for everyone, {secs:.1f} s of speech; "
                      f"{len([l for l in group if l.favourite and l.status != 'dropped'])} favourite-player lines.\n")
            for s in info["selection"].get((lang, detail), []):
                md.append(f"- Editor skipped {s}")
            md.append("")
            md.append("| t | until | status | line | favourite | evidence | verifier |")
            md.append("|---|---|---|---|---|---|---|")
            for l in group:
                end = f"{l.t + l.dur:.1f}" if l.status != "dropped" else "-"
                ev = "<br>".join(f"`{i}` {by_id[i]['label'] if i in by_id else '(missing)'}" for i in l.evidence)
                status = {"aired": "aired", "fallback": "**fallback**", "dropped": "**dropped**"}[l.status]
                text = l.text.replace("|", "\\|")
                if l.status != "aired":
                    text += f"<br>_drafted:_ {l.drafted_text}"
                why = "; ".join(l.reasons) if l.reasons else "; ".join(l.checks)
                md.append(f"| {l.t:.2f} | {end} | {status} | {text} | {l.favourite or ''} | {ev} | {why} |")
            md.append("")

    md.append("## For Korede: Pidgin and Yoruba lines to check\n")
    for l in sorted([l for l in lines if l.lang in NATIVE_CHECK and l.status != "dropped"],
                    key=lambda l: (l.lang, DETAILS.index(l.detail), l.t)):
        fav = f" (favourite: {l.favourite})" if l.favourite else ""
        md.append(f"- [ ] `{l.lang}/{l.detail}` {l.t:.1f} s{fav}: {l.text}")
    md.append("")
    REPORT_PATH.write_text("\n".join(md) + "\n", encoding="utf-8", newline="\n")


# --------------------------------------------------------------------------
# selftest


def selftest() -> int:
    clip = load_clip()
    v = Verifier(clip)
    cases = [
        ("wrong score", "Juventus nil, Real Madrid three.", ["ev_010"], 22.0, False),
        ("unknown name", "Messi scores with an overhead kick!", ["ev_009", "ev_010"], 21.0, False),
        ("missing evidence id", "Ronaldo! Overhead kick! Goal!", ["ev_099"], 21.0, False),
        ("speaking before the event", "Ronaldo! Overhead kick! Goal!", ["ev_009", "ev_010"], 15.0, False),
        ("wrong minute", "Ronaldo scores in the 70th minute.", ["ev_010"], 22.0, False),
        ("name not in the cited event", "Ronaldo has the ball on the right.", ["ev_006"], 15.0, False),
        ("banned claim (FACTS.md)", "Into the top corner! Goal!", ["ev_010"], 21.0, False),
        ("speaking over the overhead kick", "Carvajal floats a cross in.", ["ev_008"], 18.6, False),
        ("control: a true line", "Juventus nil, Real Madrid two, in the 64th minute.", ["ev_010"], 21.0, True),
        ("control: Pidgin", "Ronaldo don do overhead kick! Goal!", ["ev_009", "ev_010"], 20.6, True),
        ("control: Yoruba score", "Juventus òdo, Real Madrid méjì.", ["ev_010"], 22.0, True),
    ]
    failures = 0
    print("Verifier selftest")
    for name, text, ev, t, expect_ok in cases:
        verdict = v.check_claims(text, ev, "en", "analyst")
        reasons = list(verdict.reasons)
        timing = False
        if not reasons:
            reasons = v.check_timing(t, text, ev, False)
            timing = bool(reasons)
        ok = not reasons
        good = ok == expect_ok
        failures += not good
        tag = "PASS" if good else "FAIL"
        outcome = "accepted" if ok else "REJECTED"
        print(f"  [{tag}] {name}: \"{text}\" {ev} @ {t}s -> {outcome}")
        for r in reasons:
            print(f"         reason: {r}")
        if timing:
            print("         action: line dropped (a template cannot fix the timing)")
        elif not ok:
            tpl = v.template(ev, "en")
            print(f"         fallback: {tpl[0] if tpl else '(no valid evidence: line dropped)'}")
    print(f"{len(cases) - failures}/{len(cases)} cases behaved as expected")
    return 1 if failures else 0


# --------------------------------------------------------------------------


def main(argv: list[str] | None = None) -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    except AttributeError:
        pass
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--live", action="store_true", help="write lines with the Claude API (needs ANTHROPIC_API_KEY)")
    ap.add_argument("--selftest", action="store_true", help="show the verifier rejecting deliberately wrong lines")
    args = ap.parse_args(argv)
    if args.selftest:
        return selftest()

    clip = load_clip()
    offline = OfflineNarrator()
    mode = "offline"
    narrator = offline
    if args.live:
        key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
        if not key:
            print("--live needs ANTHROPIC_API_KEY in the environment (never put it in a file "
                  "that is committed). Run without --live to use the drafted lines.")
            return 2
        sys.path.insert(0, str(HERE))
        narrator = LiveNarrator(key, offline)
        mode = "live"

    lines, info = run(clip, narrator)
    doc = to_commentary(clip, lines, mode)
    write_commentary(doc)
    write_report(clip, lines, info, mode)

    print(f"Wrote {OUT_PATH.relative_to(ROOT)} ({len(doc['lines'])} lines) and {REPORT_PATH.relative_to(ROOT)}")
    for lang in LANGS:
        for detail in LANG_DETAILS[lang]:
            rows = [r for r in doc["lines"] if r["lang"] == lang and r["detail"] == detail]
            gen = [r for r in rows if "favourite" not in r]
            print(f"  {lang:3} {detail:10} {len(gen)} lines + {len(rows) - len(gen)} favourite")
    bad = [l for l in lines if l.status != "aired"]
    for l in bad:
        print(f"  {l.status.upper()}: {l.lang}/{l.detail} {l.moment.id}: {'; '.join(l.reasons)}")
    if not bad:
        print("  every drafted line passed the verifier")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
