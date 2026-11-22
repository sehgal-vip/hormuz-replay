# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///
"""Build the tick-aligned data bundle for the replay app.

Tick 0 = 2026-02-24 00:00 UTC, one tick per hour, 504 ticks (to 16 Mar 23:00).
Sources: SPINE.md (beats, scenes), events/*.csv, data/flights/*.jsonl.gz,
Global Fishing Watch (hourly presence, cached), FIRMS (cached), Sentinel
footprints, radar chips. Writes app/data/bundle.json, app/data/flights.json and
app/data/chips/*.png.

  uv run scripts/build_bundle.py            # uses caches; fetches what is missing
"""
import csv
import datetime as dt
import gzip
import io
import json
import pathlib
import re
import subprocess
import urllib.error
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "app" / "data"
CACHE = ROOT / "data" / "cache"
T0 = dt.datetime(2026, 2, 24, tzinfo=dt.timezone.utc)
NT = 504
REGIONS = {  # lat0, lat1, lon0, lon1
    "iran": (28, 38, 48, 60),
    "gulf": (23, 30, 47, 57),
    "dubai": (24.0, 26.5, 54.0, 56.5),
}
VIEW = (12.0, 40.0, 30.0, 70.0)  # map extent for aircraft paths (lat0, lat1, lon0, lon1)
HORMUZ = [[55.6, 25.8], [57.2, 25.8], [57.2, 27.2], [55.6, 27.2], [55.6, 25.8]]
GOO = [[56.3, 22.5], [60.5, 22.5], [60.5, 26.0], [56.3, 26.0], [56.3, 22.5]]

# Beat placement on the clock: anchor tick (where playback pauses), lane, scene.
# Date-only beats get an anchor inside their day for pacing; the UI labels them "date only".
BEATS = {
    "0.1": (72, "Claims", "SC01", "date only"), "0.2": (98, "Fog", "SC02", "minute"),
    "1.1": (102, "Attacks", "SC03", "time contested"), "1.2": (103, "Airspace", "SC03", "hour"),
    "1.3": (105, "Airspace", "SC04", "hour"), "1.5": (104, "Fog", "SC03", "minute"), "1.4": (168, "Airspace", "SC08", "date only"),
    "2.1": (108, "Attacks", "SC05", "date only"), "2.2": (122, "Attacks", "SC06", "date only"),
    "2.3": (128, "Attacks", "SC06", "hour"), "2.4": (132, "Attacks", "SC06", "date only"),
    "3.1": (136, "Insurance", "SC06", "date only"), "4.4": (140, "Fog", "SC06", "date only"), "5.1": (150, "Claims", "SC07", "date only"),
    "5.2": (196, "Claims", "SC08", "date only"), "5.3": (220, "Claims", "SC08", "date only"),
    "3.2": (240, "Insurance", "SC08", "date only"), "3.3": (252, "Insurance", "SC08", "date only"),
    "4.2": (270, "Fog", "SC09", "date only"), "5.4": (318, "Claims", "SC09", "date only"),
    "4.3": (350, "Fog", "SC10", "minute"), "5.5": (390, "Claims", "SC11", "date only"),
    "6.1": (440, "Claims", "SC12", "date only"), "5.6": (462, "Claims", "SC13", "date only"),
    "4.1": (482, "Fog", "SC13", "date only"), "6.2": (490, "Fog", "SC13", "date only"),
    "6.3": (503, "Claims", "SC13", "hour"),
}
SLOT_TIME = {"A": "02:15", "B": "02:05", "C": "14:16"}


def tick_of(date: str, hhmm: str | None = None) -> int:
    y, m, d = map(int, date[:10].split("-"))
    h = int(hhmm[:2]) if hhmm else 0
    return int((dt.datetime(y, m, d, h, tzinfo=dt.timezone.utc) - T0).total_seconds() // 3600)


def env():
    return dict(l.strip().split("=", 1) for l in (ROOT / ".env").read_text().splitlines() if "=" in l and not l.startswith("#"))


def cached(name, fetch):
    f = CACHE / name
    if not f.exists():
        f.write_bytes(fetch())
    return f.read_bytes()


def gfw_hourly(poly, name):
    def fetch():
        tok = env()["GFW_API_TOKEN"].strip()
        u = ("https://gateway.api.globalfishingwatch.org/v3/4wings/report?spatial-resolution=HIGH&temporal-resolution=HOURLY"
             "&group-by=FLAG&datasets[0]=public-global-presence:latest&date-range=2026-02-24,2026-03-17&format=JSON&spatial-aggregation=true")
        req = urllib.request.Request(u, data=json.dumps({"geojson": {"type": "Polygon", "coordinates": [poly]}}).encode(),
                                     headers={"Authorization": "Bearer " + tok, "Content-Type": "application/json", "User-Agent": "hormuz-replay/1.0"})
        return urllib.request.urlopen(req, timeout=300).read()
    rows = list(json.loads(cached(f"gfw_hourly_{name}.json", fetch))["entries"][0].values())[0] or []
    out = [None] * NT
    for r in rows:
        d, hh = r["date"].split(" ")
        t = tick_of(d, hh)
        if 0 <= t < NT:
            out[t] = (out[t] or 0) + r["vesselIDs"]
    return out


def firms():
    key = env().get("FIRMS_MAP_KEY", "").strip()
    pts = []
    for src in ("VIIRS_SNPP_SP", "VIIRS_NOAA20_SP"):
        for start in ("2026-02-24", "2026-03-01", "2026-03-06", "2026-03-11"):
            def fetch(src=src, start=start):
                u = f"https://firms.modaps.eosdis.nasa.gov/api/area/csv/{key}/{src}/44,20,62,40/5/{start}"
                return urllib.request.urlopen(u, timeout=120).read()
            try:
                txt = cached(f"firms_{src}_{start}.csv", fetch).decode()
            except Exception as e:
                print("firms failed", src, start, e)
                continue
            for r in csv.DictReader(io.StringIO(txt)):
                hhmm = r["acq_time"].zfill(4)
                t = tick_of(r["acq_date"], hhmm)
                if 0 <= t < NT and r.get("confidence", "") != "l":
                    pts.append([t, round(float(r["longitude"]), 3), round(float(r["latitude"]), 3), f"{r['acq_date']} {hhmm[:2]}:{hhmm[2:]}", src[:11],
                                r.get("confidence", ""), r.get("frp", ""), r.get("daynight", "")])
    return pts


def hull(points):
    pts = sorted(set(points))
    if len(pts) < 3:
        return pts
    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lower, upper = [], []
    for p in pts:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)
    for p in reversed(pts):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)
    return lower[:-1] + upper[:-1]


def drop_flares(pts):
    """Remove persistent heat sources (gas flares): cells of 0.05 deg seen on 5 or more days."""
    days = {}
    for t, lon, lat, *_ in pts:
        days.setdefault((round(lon / 0.05), round(lat / 0.05)), set()).add(t // 24)
    return [p for p in pts if len(days[(round(p[1] / 0.05), round(p[2] / 0.05))]) < 5]


def parse_spine():
    s = (ROOT / "SPINE.md").read_text()
    beats = {}
    for line in s.splitlines():
        m = re.match(r"^\| (\d\.\d) \| (.*?) \| (.*?) \| (.*?) \| (.*?) \| (.*?) \|$", line)
        if m:
            bid, when, narr, claim, ev, grade = m.groups()
            beats[bid] = {"id": bid, "when": when, "narrator": narr.strip('"'), "claim": claim, "evidence": ev, "grade": grade}
    scenes = []
    for line in s.splitlines():
        m = re.match(r"^\| (SC\d\d) \| (\d+) to (\d+) \| (.*?) \| (.*?) \| (.*?) \| (.*?) \|$", line)
        if m:
            sid, a, b, utc, ev, spt, bl = m.groups()
            sec = float(re.match(r"[\d.]+", spt).group())
            scenes.append({"id": sid, "start": int(a), "end": int(b), "utc": utc, "title": ev, "secPerTick": sec})
    ctx = []
    for line in s.splitlines():
        m = re.match(r"^\| (C\d) \| .*?\(tick (\d+)\) \| (.*?) \| (.*?) \| (.*?) \|$", line)
        if m:
            cid, t, note, src, prec = m.groups()
            ctx.append({"id": cid, "tick": int(t), "note": note, "source": src, "precision": prec})
    return beats, scenes, ctx


def grade_key(g):
    g = g.lower()
    for k in ("contradicted", "contested", "corroborated", "consistent", "reported only"):
        if g.startswith(k):
            return k
    return "consistent"


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    CACHE.mkdir(parents=True, exist_ok=True)
    beats, scenes, ctx = parse_spine()
    blist = []
    for bid, (t, lane, sc, prec) in BEATS.items():
        b = beats[bid]
        b.update({"tick": t, "lane": lane, "scene": sc, "precision": prec, "gradeKey": grade_key(b["grade"])})
        blist.append(b)
    blist.sort(key=lambda b: b["tick"])

    # Flights: regional airborne counts per tick + thinned points per tick.
    counts = {k: [None] * NT for k in REGIONS}
    points = {}
    days = sorted((ROOT / "data" / "flights").glob("*.jsonl.gz"))
    have_days = []
    for f in days:
        if not (f.parent / (f.name + ".done")).exists():
            continue
        have_days.append(f.name[:10])
        seen = {k: {} for k in REGIONS}
        paths = {}  # (tick, hex) -> {"alt", "track", "pts": {10-min bucket: (min, lon, lat)}, "end": (min, lon, lat)}
        for line in gzip.open(f, "rt"):
            d = json.loads(line)
            t = int((d["t"] - T0.timestamp()) // 3600)
            if not (0 <= t < NT) or d["alt"] == "ground":
                continue
            for k, (a, b2, c, e) in REGIONS.items():
                if a <= d["lat"] <= b2 and c <= d["lon"] <= e:
                    seen[k].setdefault(t, set()).add(d["hex"])
            if VIEW[0] <= d["lat"] <= VIEW[1] and VIEW[2] <= d["lon"] <= VIEW[3]:
                minute = int((d["t"] - T0.timestamp()) % 3600 // 60)
                s_ = (minute, round(d["lon"], 2), round(d["lat"], 2))
                rec = paths.setdefault((t, d["hex"]), {"pts": {}})
                rec["pts"].setdefault(minute // 10, s_)
                rec["end"] = s_
                rec["alt"] = d["alt"] if isinstance(d["alt"], (int, float)) else rec.get("alt", 0)
                rec["track"] = int(d.get("track") or rec.get("track", 0))
                rec["info"] = [d.get("flight") or "", d.get("r") or "", d.get("type") or "", int(round(d["gs"])) if isinstance(d.get("gs"), (int, float)) else None, d["hex"]]
        last = {}
        for key, rec in paths.items():
            seq = [rec["pts"][b] for b in sorted(rec["pts"])]
            if seq[-1] != rec["end"]:
                seq.append(rec["end"])
            flat = [v for s_ in seq for v in s_]
            last[key] = [int(round((rec.get("alt") or 0) / 100.0)) * 100, rec["track"], flat, rec.get("info", ["", "", "", None])]
        for k in REGIONS:
            day_t0 = tick_of(f.name[:10])
            for h in range(24):
                counts[k][day_t0 + h] = len(seen[k].get(day_t0 + h, ()))
        for (t, _), p in last.items():
            points.setdefault(t, []).append(p)
    (OUT / "flights.json").write_text(json.dumps({str(t): v for t, v in points.items()}, separators=(",", ":")))

    # Ships: hourly AIS presence (GFW) in two boxes.
    ships = {}
    for name, poly in (("hormuz", HORMUZ), ("goo", GOO)):
        try:
            ships[name] = gfw_hourly(poly, name)
        except Exception as e:
            print("gfw hourly failed", name, e)
            ships[name] = [None] * NT

    # Daily counts by provider.
    daily = {"IMF PortWatch": {}, "S&P (via JMIC)": {}, "Windward": {}}
    ww_total, ww_ais = {}, {}
    for r in csv.DictReader(open(ROOT / "events" / "hormuz_daily_counts.csv")):
        prov, metric, d = r["provider"], r["metric"], r["date_utc"]
        try:
            v = float(r["value"])
        except ValueError:
            continue
        if prov == "IMF PortWatch" and metric.startswith("n_total"):
            daily["IMF PortWatch"][d] = v
        elif prov.startswith("S&P (as published by JMIC)") and r["direction"] == "total":
            daily["S&P (via JMIC)"][d] = daily["S&P (via JMIC)"].get(d, 0) + v  # cargo + tanker
        elif prov == "Windward" and metric.startswith("crossings (total"):
            ww_total[d] = v
        elif prov == "Windward" and metric.startswith("crossings (AIS-confirmed)"):
            ww_ais[d] = v
    daily["Windward"] = {**ww_ais, **ww_total}

    # Radar passes and detections (Hormuz box chips).
    radar = []
    for r in csv.DictReader(open(ROOT / "events" / "radar_summary.csv")):
        t = tick_of(r["pass_date"], SLOT_TIME[r["slot"]])
        radar.append({"tick": t, "date": r["pass_date"], "slot": r["slot"], "time": SLOT_TIME[r["slot"]],
                      "ships": int(r["detections"]), "valid": float(r["valid_data_share"]), "sea": float(r["open_sea_share"]),
                      "perSea": round(int(r["detections"]) / max(float(r["open_sea_share"]), 0.01))})
    radar.sort(key=lambda x: x["tick"])
    dets = {}
    for r in csv.DictReader(open(ROOT / "events" / "radar_detections.csv")):
        dets.setdefault(f"{r['pass_date']}_{r['slot']}", []).append([float(r["lon"]), float(r["lat"]), int(r["size_px"]), r["det_id"]])
    chips_meta = json.loads((ROOT / "data" / "imagery" / "chips.json").read_text())
    (OUT / "chips").mkdir(exist_ok=True)
    chips = []
    for c in chips_meta:
        src = ROOT / "data" / "imagery" / c["file"]
        dst = OUT / "chips" / c["file"].replace(".png", ".jpg")
        if not dst.exists():
            subprocess.run(["sips", "-Z", "1000", "-s", "format", "jpeg", "-s", "formatOptions", "70", str(src), "--out", str(dst)], capture_output=True)
        chips.append({"key": f"{c['date']}_{c['slot']}", "file": "chips/" + dst.name, "bbox": c["bbox"],
                      "tick": tick_of(c["date"], SLOT_TIME[c["slot"]]), "slot": c["slot"], "date": c["date"]})

    # Gulf of Oman radar vs broadcasts (daily).
    goo_radar = {}
    try:
        rows = list(json.loads((ROOT / "data" / "ships" / "gfw_sar_gulf_of_oman_all.json").read_text())["entries"][0].values())[0]
        for r in rows:
            goo_radar[r["date"]] = goo_radar.get(r["date"], 0) + r.get("detections", r.get("vesselIDs", 0))
    except Exception as e:
        print("goo radar", e)

    # Satellite captures.
    # One footprint per pass: group products by satellite and start minute, take the convex hull.
    groups = {}
    gj = json.loads((ROOT / "data" / "satellites" / "acquisitions.geojson").read_text())
    for f in gj["features"]:
        p = f["properties"]
        st = p["start_utc"]
        t = tick_of(st[:10], st[11:16])
        if not (0 <= t < NT):
            continue
        g = f["geometry"]
        polys = [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"]
        key = (p["mission"], p["satellite"], st[:15])  # minute resolution (10-minute bucket)
        grp = groups.setdefault(key, {"tick": t, "time": st[11:16], "mission": p["mission"], "sat": p["satellite"], "pts": [], "n": 0})
        grp["n"] += 1
        for poly in polys:
            grp["pts"].extend((round(x, 2), round(y, 2)) for x, y in poly[0])
    sats = []
    for grp in groups.values():
        ring = hull(grp.pop("pts"))
        sats.append({**grp, "ring": [list(p) for p in ring]})
    sats.sort(key=lambda s: s["tick"])

    # Ship incidents.
    incidents = []
    for r in csv.DictReader(open(ROOT / "events" / "ship_incidents.csv")):
        if not r["date_utc"]:
            continue
        timed = bool(r["time_utc"])
        incidents.append({"tick": tick_of(r["date_utc"], r["time_utc"] or None), "dayOnly": not timed, "date": r["date_utc"],
                          "time": r["time_utc"], "vessel": r["vessel_name"], "what": r["what_happened"],
                          "lat": float(r["lat"]) if r["lat"] else None, "lon": float(r["lon"]) if r["lon"] else None,
                          "source": r["source_name"], "confidence": r["confidence"]})

    # Timeline events (news and statements).
    events = []
    for r in csv.DictReader(open(ROOT / "events" / "timeline.csv")):
        t = tick_of(r["date_utc"], r["time_utc"] or None)
        if t < -24 * 14:
            continue
        events.append({"id": r["event_id"], "tick": t, "dayOnly": not r["time_utc"], "date": r["date_utc"], "time": r["time_utc"],
                       "timeNote": r["time_note"], "category": r["category"], "place": r["place"], "event": r["event"],
                       "source": r["source_url"], "confidence": r["confidence"], "context": r["chapter"] == "C",
                       "lat": float(r["lat"]), "lon": float(r["lon"])})

    gnss = [{"date": r["date_utc"], "time": r["time_utc"], "provider": r["provider"], "metric": r["metric"], "value": r["value"]}
            for r in csv.DictReader(open(ROOT / "events" / "gnss_interference.csv"))]

    # Optical ship detections (Sentinel-2, Global Fishing Watch), placed at that day's Sentinel-2 pass time.
    s2_min = {}
    for sv in sats:
        if sv["mission"] == "SENTINEL-2":
            d = (T0 + dt.timedelta(hours=sv["tick"])).strftime("%Y-%m-%d")
            hh, mm = map(int, sv["time"].split(":"))
            s2_min.setdefault(d, []).append(hh * 60 + mm)
    optical, optical_daily = [], {}
    for flag, name in ((1, "matched"), (0, "unmatched")):
        f = CACHE / f"gfw_s2_{name}.json"
        if not f.exists():
            print("optical: missing", f.name)
            continue
        rows = list(json.loads(f.read_text())["entries"][0].values())[0] or []
        for r in rows:
            d = r["date"]
            mins = sorted(s2_min.get(d, [7 * 60]))
            m = mins[len(mins) // 2]
            t = tick_of(d, f"{m // 60:02d}:{m % 60:02d}")
            if 0 <= t < NT:
                optical.append([t, round(r["lon"], 3), round(r["lat"], 3), flag, r.get("detections", 1), f"{m // 60:02d}:{m % 60:02d}"])
                od = optical_daily.setdefault(d, [0, 0])
                od[0 if flag else 1] += r.get("detections", 1)
    optical.sort(key=lambda x: x[0])

    bundle = {
        "t0": T0.isoformat(), "nTicks": NT, "flightDays": have_days,
        "beats": blist, "scenes": scenes, "context": ctx,
        "flightCounts": counts, "ships": ships, "daily": daily,
        "radar": radar, "radarDets": dets, "chips": chips, "gooRadar": goo_radar,
        "satellites": sats, "incidents": incidents, "events": events, "gnss": gnss,
        "firms": drop_flares(firms()),
        "optical": optical, "opticalDaily": optical_daily,
        "boxes": {"hormuz": HORMUZ, "goo": GOO},
    }
    (OUT / "bundle.json").write_text(json.dumps(bundle, separators=(",", ":")))
    print(f"beats {len(blist)}, scenes {len(scenes)}, context {len(ctx)}, flight days {len(have_days)}, "
          f"flight point ticks {len(points)}, satellites {len(sats)}, incidents {len(incidents)}, events {len(events)}, "
          f"firms {len(bundle['firms'])}, chips {len(chips)}, providers {list(daily)}")
    print("ships hourly non-null:", {k: sum(v is not None for v in vals) for k, vals in ships.items()})
    for f in ("bundle.json", "flights.json"):
        print(f, round((OUT / f).stat().st_size / 1e6, 1), "MB")


if __name__ == "__main__":
    main()
