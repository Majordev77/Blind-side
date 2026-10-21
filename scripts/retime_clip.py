"""Re-time the bicycle kick recreation to match the official video.

Korede taps three moments while the video plays (Buffon's save, Carvajal's
cross, Ronaldo's kick) and sends the video times. This script stretches the
clip's timeline piece by piece so those three events land on those moments,
then sets officialVideo.offset so the video starts in step.

    python scripts/retime_clip.py --save 41.2 --cross 49.8 --kick 50.9
    python scripts/commentary/pipeline.py      # re-place the voice lines

The save stays where it is in our clip when the video allows it, so the
opening build-up and its commentary are untouched. Everything after the
kick moves as one block. Players in the 2D pitch scene are re-timed with
the same mapping.
"""

import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CLIP = ROOT / "frontend" / "src" / "demo" / "bicycle-kick-2018.json"
SCENE = ROOT / "frontend" / "src" / "demo" / "bicycle-kick-2018.scene.json"

ANCHORS = {"save": "ev_004", "cross": "ev_008", "kick": "ev_009"}
MAX_TRAVEL_STRETCH = 1.5  # passes may slow down a little, not float for seconds


def build_mapping(old: list[float], new: list[float]):
    """Piecewise-linear map from old clip time to new clip time.

    `old` and `new` are matching anchor times, starting with 0. After the last
    anchor, times shift by the last anchor's move.
    """

    def f(t: float) -> float:
        if t >= old[-1]:
            return t + (new[-1] - old[-1])
        for i in range(len(old) - 1):
            a, b = old[i], old[i + 1]
            if a <= t <= b:
                k = (t - a) / (b - a)
                return new[i] + k * (new[i + 1] - new[i])
        return t

    def factor(t: float) -> float:
        for i in range(len(old) - 1):
            if old[i] <= t < old[i + 1]:
                return (new[i + 1] - new[i]) / (old[i + 1] - old[i])
        return 1.0

    return f, factor


def r1(x: float) -> float:
    return round(x, 2)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--save", type=float, required=True, help="video seconds when Buffon saves")
    ap.add_argument("--cross", type=float, required=True, help="video seconds when Carvajal crosses")
    ap.add_argument("--kick", type=float, required=True, help="video seconds when Ronaldo kicks")
    ap.add_argument("--dry-run", action="store_true", help="print the new timings, write nothing")
    args = ap.parse_args()

    video = {"save": args.save, "cross": args.cross, "kick": args.kick}
    if not video["save"] < video["cross"] < video["kick"]:
        raise SystemExit("Times must be in order: save < cross < kick. Check the code you were sent.")

    clip = json.loads(CLIP.read_text(encoding="utf-8"))
    events = {e["id"]: e for e in clip["events"]}
    old_t = {name: events[ev]["t"] for name, ev in ANCHORS.items()}

    # Keep the save at its current clip time if the video has enough lead-in; otherwise start the clip at 0:00.
    offset = max(0.0, video["save"] - old_t["save"])
    new_t = {name: video[name] - offset for name in ANCHORS}

    old = [0.0, old_t["save"], old_t["cross"], old_t["kick"]]
    new = [0.0, new_t["save"], new_t["cross"], new_t["kick"]]
    f, factor = build_mapping(old, new)

    print(f"offset (video seconds at clip t=0): {offset:.1f}")
    for name in ANCHORS:
        print(f"  {name:5}  clip {old_t[name]:5.2f} s -> {new_t[name]:5.2f} s   (video {video[name]:.1f} s)")
    gap = new_t["kick"] - new_t["save"]
    if gap > 25:
        print(f"  note: {gap:.0f} s between the save and the kick; the build-up will feel long. Check the taps.")

    for e in clip["events"]:
        old_start = e["t"]
        e["t"] = r1(f(old_start))
        if "duration" in e:
            stretch = min(factor(old_start), MAX_TRAVEL_STRETCH) if e["id"] != ANCHORS["cross"] else factor(old_start)
            e["duration"] = r1(e["duration"] * stretch)
    # The cross must arrive exactly as Ronaldo strikes.
    cross, kick = events[ANCHORS["cross"]], events[ANCHORS["kick"]]
    cross["duration"] = r1(kick["t"] - cross["t"])
    clip["duration"] = r1(f(clip["duration"]))
    if "officialVideo" in clip:
        clip["officialVideo"]["offset"] = round(offset, 1)

    scene = json.loads(SCENE.read_text(encoding="utf-8"))
    scene["keyTimes"] = [r1(f(t)) for t in scene["keyTimes"]]
    for touch in scene.get("touches", []):
        touch["from"], touch["to"] = r1(f(touch["from"])), r1(f(touch["to"]))

    if args.dry_run:
        for e in clip["events"]:
            print(f"  {e['id']}  t={e['t']:6.2f}  {e['type']}")
        print(f"  duration {clip['duration']}")
        return

    CLIP.write_text(json.dumps(clip, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    SCENE.write_text(json.dumps(scene, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"wrote {CLIP.relative_to(ROOT)} and {SCENE.relative_to(ROOT)}")
    print("next: python scripts/commentary/pipeline.py")


if __name__ == "__main__":
    main()
