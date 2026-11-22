# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///
"""Write netlify/functions/evidence.json: the chat's evidence pack, precomputed for every hour.

Netlify Functions run JavaScript, not Python, so the hosted chat cannot call agent.py.
Instead this script runs agent.py's own pack builders once and saves the output:
the system prompt, the static pack, the current-moment pack for each of the 504 ticks,
and the current-claim line for each beat. The function joins them exactly as agent.pack() does.

Run after any data rebuild, before deploying:  uv run scripts/build_netlify.py
"""
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import agent  # noqa: E402

OUT = ROOT / "netlify" / "functions" / "evidence.json"


def main():
    B = agent.bundle()
    beats = {}
    for b in B["beats"]:
        with_beat = agent.moment_pack(b["tick"], b["id"]).split("\n")
        beats[b["id"]] = next(l for l in with_beat if l.startswith("CURRENT CLAIM"))
    out = {
        "system": agent.SYSTEM,
        "static": agent.static_pack(),
        "moments": [agent.moment_pack(t, None) for t in range(B["nTicks"])],
        "beats": beats,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, separators=(",", ":")))
    print(f"{OUT.relative_to(ROOT)}: {len(out['moments'])} hours, {len(beats)} claims, {OUT.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
