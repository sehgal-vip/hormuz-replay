"""Evidence-grounded chat for the replay, powered by a local model in LM Studio.

The browser sends the conversation, the current tick and the current beat. This
module builds an evidence pack from app/data/bundle.json (what the data shows at
that tick, plus the full graded beat list) and asks the local model to answer
only from it. Nothing leaves the machine.

Config (environment): LMSTUDIO_URL (default http://localhost:1234/v1),
LMSTUDIO_MODEL (default qwen/qwen3.6-35b-a3b).
"""
import datetime as dt
import json
import os
import pathlib
import re
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = os.environ.get("LMSTUDIO_URL", "http://localhost:1234/v1")
MODEL = os.environ.get("LMSTUDIO_MODEL", "qwen/qwen3.6-35b-a3b")
_B = None
_STATIC = None

SYSTEM = """You are the evidence analyst inside "What the Hormuz", a replay of the Strait of Hormuz crisis (24 Feb to 16 Mar 2026) on a 1-hour clock. A judge is asking you questions.

Rules:
- Answer only from the EVIDENCE PACK. If the pack cannot answer, say so plainly and say what data would be needed.
- Name the source for every number (for example "IMF PortWatch", "Global Fishing Watch radar", "adsb.lol flights", "UKMTO").
- Use the grade scale exactly: corroborated, consistent, reported only, contested, contradicted. Explain a grade by pointing at the evidence.
- Never state a time more precisely than its precision label. Date-only items have no hour.
- AIS counts are ships broadcasting their own position; radar and optical counts are ships seen by satellite. Never call an AIS count radar.
- Separate what the data shows from what caused it. "Consistent" means the data fits, not that it proves cause.
- Be brief: at most 6 sentences unless asked for detail. Plain sentences, no headings, no em dashes.
"""


def bundle():
    global _B
    if _B is None:
        _B = json.loads((ROOT / "app" / "data" / "bundle.json").read_text())
    return _B


def label(t):
    d = dt.datetime.fromisoformat(bundle()["t0"]) + dt.timedelta(hours=t)
    return d.strftime("%d %b %H:00 UTC")


def static_pack():
    """Evidence that does not depend on the clock. Sent first and identical on every request,
    so LM Studio's prompt cache can reuse it and only the short current-moment part is new."""
    global _STATIC
    if _STATIC is not None:
        return _STATIC
    B = bundle()
    fc, sh = B["flightCounts"], B["ships"]
    lines = []
    noon = [(t, fc["gulf"][t]) for t in range(12, B["nTicks"], 24)]
    lines.append("FLIGHTS at 12:00 each day, Gulf states (adsb.lol, distinct airborne aircraft): " + ", ".join(f"{label(t)[:6]} {v if v is not None else 'none'}" for t, v in noon))
    lines.append("SHIPS BROADCASTING AIS at 12:00 each day, strait box / Gulf of Oman (Global Fishing Watch, hourly): " + ", ".join(
        f"{label(t)[:6]} {sh['hormuz'][t]}/{sh['goo'][t]}" for t in range(12, B["nTicks"], 24)))
    for prov, series in B["daily"].items():
        lines.append(f"DAILY CROSSINGS, {prov} (date only): " + ", ".join(f"{d[5:]} {int(v)}" for d, v in sorted(series.items()) if "2026-02-20" <= d <= "2026-03-17"))
    lines.append("RADAR SHIP COUNTS, strait box, our Sentinel-1 detector, per open-sea unit (pass time; comparable only within a track): " + "; ".join(
        f"track {r['slot']} {r['date'][5:]} {r['time']}: {r['perSea']}{' (partial coverage)' if r['valid'] < 0.8 else ''}" for r in B["radar"]))
    lines.append("RADAR SHIPS, Gulf of Oman (Global Fishing Watch, per pass; only full-coverage passes comparable, roughly 350 to 390): " + ", ".join(
        f"{d[5:]} {int(v)}" for d, v in sorted(B["gooRadar"].items())))
    od = B.get("opticalDaily") or {}
    if od:
        lines.append("OPTICAL SHIPS, Sentinel-2 via Global Fishing Watch, per day (broadcasting / no AIS match; 11 to 13 Mar show zero matched, likely a data gap): " + ", ".join(
            f"{d[5:]} {m}/{u}" for d, (m, u) in sorted(od.items())))
    gn = [g for g in B["gnss"] if g["value"]]
    lines.append("GPS INTERFERENCE REPORTS: " + " | ".join(f"{g['date']} {g['provider']}: {g['metric']} {g['value']}" for g in gn))
    lines.append("ALL CLAIMS AND GRADES (in time order, claim N of " + str(len(B["beats"])) + "): " + " | ".join(
        f"claim {i} ({b['id']}) {label(b['tick'])[:6]} {b['lane']}: {b['narrator']} => {b['grade']}" for i, b in enumerate(B["beats"], 1)))
    lines.append("CONTEXT MARKERS (not narrated): " + " | ".join(f"{c['id']} {c['note']} ({c['precision']})" for c in B["context"]))
    lines.append("KNOWN GAPS: no individual ship tracks (density only); no flight coverage over Iraq; incident times are report times; several 28 Feb times rest on Wikipedia alone; aircraft GPS-accuracy analysis not done; the 10 Mar 'eight dark vessels' claim cannot be tested (no broadcast positions for that hour).")
    _STATIC = "\n".join(lines)
    return _STATIC


def moment_pack(tick, beat_id):
    """Evidence for the current hour: placed last so it is the only part that changes."""
    B = bundle()
    tick = max(0, min(B["nTicks"] - 1, int(tick)))
    day = (dt.datetime.fromisoformat(B["t0"]) + dt.timedelta(hours=tick)).strftime("%Y-%m-%d")
    lines = [f"CURRENT TIME: hour {tick} of {B['nTicks']} = {label(tick)} (story day {day})."]
    beat = next((b for b in B["beats"] if b["id"] == beat_id), None)
    if beat:
        lines.append(f"CURRENT CLAIM ({beat['id']}, lane {beat['lane']}, precision {beat['precision']}): narrator: {beat['narrator']} | claim: {beat['claim']} | evidence: {beat['evidence']} | grade: {beat['grade']}")
    fc, sh = B["flightCounts"], B["ships"]
    lo, hi = max(0, tick - 6), min(B["nTicks"] - 1, tick + 6)
    lines.append("FLIGHTS around now (distinct airborne aircraft per hour; 'none' = no data): " + "; ".join(
        f"{label(t)}: Gulf states {fc['gulf'][t] if fc['gulf'][t] is not None else 'none'}, interior Iran {fc['iran'][t] if fc['iran'][t] is not None else 'none'}"
        for t in range(lo, hi + 1)))
    lines.append(f"SHIPS BROADCASTING AIS this hour (Global Fishing Watch AIS presence; self-reported broadcasts, NOT radar): strait box {sh['hormuz'][tick]}, Gulf of Oman {sh['goo'][tick]}.")
    inc = [i for i in B["incidents"] if i["tick"] <= tick][-12:]
    if inc:
        lines.append("SHIP INCIDENTS so far (official advisories unless noted; times are report times): " + " | ".join(
            f"{i['date']} {i['time'] or '(date only)'} {i['vessel']}: {i['what']} [{i['confidence']}]" for i in inc))
    ev = [e for e in B["events"] if e["date"] == day]
    if ev:
        lines.append("EVENTS THAT DAY: " + " | ".join(
            f"{e['time'] or '(date only)'} {e['event']} [{e['confidence']}; {e['timeNote']}]" for e in ev))
    return "\n".join(lines)


def pack(tick, beat_id):
    return static_pack() + "\n" + moment_pack(tick, beat_id)


def pick_model():
    """Use the configured model if LM Studio has it loaded; otherwise whichever chat model is loaded.
    Loading a second large model can fail for lack of memory, so prefer what is already in memory."""
    try:
        base = URL.rsplit("/v1", 1)[0]
        data = json.load(urllib.request.urlopen(base + "/api/v0/models", timeout=5)).get("data", [])
        loaded = [m["id"] for m in data if m.get("state") == "loaded" and m.get("type") != "embeddings" and "embed" not in m["id"]]
        if loaded and MODEL not in loaded:
            return loaded[0]
    except Exception:
        pass
    return MODEL


def _post(payload, timeout=300):
    payload["model"] = pick_model()
    req = urllib.request.Request(URL + "/chat/completions", data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=timeout))


def warm():
    """Keep the model loaded and the static evidence in LM Studio's prompt cache.
    A one-token request with the same system prefix as real questions; called at server start
    and every 15 minutes, so the model's idle timeout never unloads it before a demo question."""
    payload = {"model": MODEL, "temperature": 0, "max_tokens": 1, "reasoning_effort": "none",
               "messages": [{"role": "system", "content": SYSTEM + "\nEVIDENCE PACK:\n" + static_pack()}, {"role": "user", "content": "ok"}]}
    _post(payload, timeout=600)


def answer(body):
    msgs = body.get("messages")
    if not isinstance(msgs, list) or not msgs:
        msgs = [{"role": "user", "content": "Why do you say that?"}]
    # Keep only well-formed turns, cap their number and length (the model sees nothing else from the client).
    msgs = [{"role": m["role"], "content": m["content"][:2000]} for m in msgs
            if isinstance(m, dict) and m.get("role") in ("user", "assistant") and isinstance(m.get("content"), str)][-8:]
    if not msgs:
        msgs = [{"role": "user", "content": "Why do you say that?"}]
    try:
        tick = int(body.get("tick", 0))
    except (TypeError, ValueError):
        tick = 0
    beat_id = body.get("beatId") if isinstance(body.get("beatId"), str) else None
    payload = {
        "model": MODEL,
        "temperature": 0.2,
        "max_tokens": 450,
        "messages": [{"role": "system", "content": SYSTEM + "\nEVIDENCE PACK:\n" + pack(tick, beat_id)}] + msgs,
    }
    # Turn off Qwen's reasoning trace (LM Studio honours reasoning_effort "none"); keeps answers fast.
    payload["reasoning_effort"] = "none"
    out = _post(payload)
    text = out["choices"][0]["message"].get("content") or ""
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.S).strip()
    return text.replace("—", ", ")
