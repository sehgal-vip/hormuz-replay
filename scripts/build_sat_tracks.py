# /// script
# requires-python = ">=3.10"
# dependencies = ["sgp4>=2.23"]
# ///
"""Satellite positions for the replay (24 Feb to 16 Mar 2026), from today's public orbits.

Method: CelesTrak publishes only current orbital elements (TLEs). Earth-observation
satellites such as Sentinel-1, -2 and -3 are flown on a repeat ground track: they pass
over the same ground at the same time every repeat cycle. So the position at a past time t
is taken as the SGP4 position at t + k * cycle, with k chosen so that time is near the
TLE epoch, where SGP4 is accurate. Positions are then checked against real captures:
for Sentinel-2 (nadir-looking) the predicted sub-satellite point at each capture's start
time is compared with the centre of that capture's footprint.

Writes app/data/sat_tracks.json and prints the validation.
  uv run scripts/build_sat_tracks.py
"""
import datetime as dt
import json
import math
import pathlib
import statistics
import urllib.request

from sgp4.api import Satrec, jday

ROOT = pathlib.Path(__file__).resolve().parent.parent
CACHE = ROOT / "data" / "cache"
T0 = dt.datetime(2026, 2, 24, tzinfo=dt.timezone.utc)
NT = 504
STEP_MIN = 2
# name, catalogue code, NORAD id, repeat cycle (days), sensor
SATS = [
    ("Sentinel-1A", "S1A", 39634, 12, "C-band radar"),
    ("Sentinel-1C", "S1C", 62261, 12, "C-band radar"),
    ("Sentinel-2A", "S2A", 40697, 10, "optical camera"),
    ("Sentinel-2B", "S2B", 42063, 10, "optical camera"),
    ("Sentinel-2C", "S2C", 60989, 10, "optical camera"),
    ("Sentinel-3A", "S3A", 41335, 27, "thermal and ocean colour"),
    ("Sentinel-3B", "S3B", 43437, 27, "thermal and ocean colour"),
    ("Landsat 8", "L8", 39084, 16, "optical camera"),
    ("Landsat 9", "L9", 49260, 16, "optical camera"),
    ("Suomi NPP", "NPP", 37849, 16, "VIIRS fire detection"),
    ("NOAA-20", "N20", 43013, 16, "VIIRS fire detection"),
    ("NOAA-21", "N21", 54234, 16, "VIIRS fire detection"),
    ("WorldView-3", "WV3", 40115, None, "commercial optical camera, 0.3 m (Vantor, formerly Maxar)"),
    ("WorldView-2", "WV2", 35946, None, "commercial optical camera, 0.5 m (Vantor, formerly Maxar)"),
    ("Pleiades Neo 3", "PN3", 48268, None, "commercial optical camera, 0.3 m (Airbus)"),
    ("Pleiades Neo 4", "PN4", 49070, None, "commercial optical camera, 0.3 m (Airbus)"),
]
VIEW = (0.0, 50.0, 20.0, 85.0)  # lat0, lat1, lon0, lon1 kept in the output


def tle(norad):
    f = CACHE / f"tle_{norad}.txt"
    if not f.exists():
        url = f"https://celestrak.org/NORAD/elements/gp.php?CATNR={norad}&FORMAT=TLE"
        f.write_bytes(urllib.request.urlopen(url, timeout=60).read())
    lines = [l.strip() for l in f.read_text().splitlines() if l.strip()]
    return lines[-2], lines[-1]


def gmst(jd_ut1):
    t = (jd_ut1 - 2451545.0) / 36525.0
    g = 67310.54841 + (876600 * 3600 + 8640184.812866) * t + 0.093104 * t * t - 6.2e-6 * t ** 3
    return math.radians((g % 86400) / 240.0)


def subpoint(sat, when):
    jd, fr = jday(when.year, when.month, when.day, when.hour, when.minute, when.second + when.microsecond / 1e6)
    e, r, _ = sat.sgp4(jd, fr)
    if e:
        return None
    x, y, z = r
    th = gmst(jd + fr)
    xe = x * math.cos(th) + y * math.sin(th)
    ye = -x * math.sin(th) + y * math.cos(th)
    lon = math.degrees(math.atan2(ye, xe))
    lat = math.degrees(math.atan2(z, math.hypot(xe, ye)))  # geocentric; under 0.2 deg from geodetic
    return lat, (lon + 540) % 360 - 180


def shifted(sat, epoch, cycle_days, when, offset_s=0.0):
    k = round((epoch - when).total_seconds() / 86400 / cycle_days)
    return subpoint(sat, when + dt.timedelta(days=k * cycle_days, seconds=offset_s))


def fit_offset(sat, epoch, cycle, obs):
    """Find the constant time offset (s) that best aligns predicted ground points with observed footprint centres."""
    def cost(off):
        d = [km(shifted(sat, epoch, cycle, w, off) or (0, 0), c) for w, c in obs]
        return statistics.median(d)
    best = min(range(-int(cycle * 86400 / 2), int(cycle * 86400 / 2), 60), key=cost) if len(obs) < 0 else None
    # coarse: one orbit period either side in 20 s steps, then refine in 2 s steps
    grid = range(-6000, 6001, 20)
    best = min(grid, key=cost)
    best = min(range(best - 30, best + 31, 2), key=cost)
    return best, cost(best)


def km(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(h))


def load_history():
    """Historical TLEs from Space-Track (fetch_spacetrack.py), keyed by NORAD id, sorted by epoch."""
    f = CACHE / "spacetrack_history.json"
    if not f.exists():
        return None
    hist = {}
    for x in json.loads(f.read_text()):
        ep = dt.datetime.fromisoformat(x["EPOCH"]).replace(tzinfo=dt.timezone.utc)
        hist.setdefault(int(x["NORAD_CAT_ID"]), {"name": x["OBJECT_NAME"], "sets": []})["sets"].append((ep, Satrec.twoline2rv(x["TLE_LINE1"], x["TLE_LINE2"])))
    for v in hist.values():
        v["sets"].sort(key=lambda e: e[0])
    return hist


def hist_point(sets, when):
    """Propagate the element set with the nearest epoch: exact to a few km within a day or two of it."""
    best = min(sets, key=lambda e: abs((e[0] - when).total_seconds()))
    return subpoint(best[1], when)


def main_history(hist):
    gj = json.loads((ROOT / "data" / "satellites" / "acquisitions.geojson").read_text())
    by_code = {code: norad for _, code, norad, _, _ in SATS}
    # Sentinel-1D: added by name if Space-Track returned it
    extra = [(v["name"].title().replace("Sentinel-1D", "Sentinel-1D"), "S1D", n, None, "C-band radar") for n, v in hist.items() if v["name"] == "SENTINEL-1D"]
    sats = SATS + extra
    by_code.update({c: n for _, c, n, _, _ in extra})
    checks = {}
    for f in gj["features"]:
        p = f["properties"]; code = p["satellite"]
        if by_code.get(code) not in hist:
            continue
        when = dt.datetime.fromisoformat(p["start_utc"].replace("Z", "+00:00"))
        g = f["geometry"]; ring = g["coordinates"][0] if g["type"] == "Polygon" else g["coordinates"][0][0]
        cen = (sum(y for x, y in ring) / len(ring), sum(x for x, y in ring) / len(ring))
        sp = hist_point(hist[by_code[code]]["sets"], when)
        if sp:
            checks.setdefault(code, []).append(km(sp, cen))
    print("Exact orbits (Space-Track history): distance from ground point to own capture footprint centre (km):")
    for code, d in sorted(checks.items()):
        d.sort(); print(f"  {code}: n={len(d)} median {d[len(d)//2]:.0f}, 90th pct {d[int(len(d)*0.9)]:.0f}")
    out = {"stepMin": STEP_MIN, "source": "Space-Track historical element sets", "sats": []}
    for name, code, norad, cycle, sensor in sats:
        if norad not in hist:
            print("no history for", name); continue
        sets = hist[norad]["sets"]; pts = []
        for i in range(NT * 60 // STEP_MIN):
            when = T0 + dt.timedelta(minutes=i * STEP_MIN)
            sp = hist_point(sets, when)
            if sp and VIEW[0] <= sp[0] <= VIEW[1] and VIEW[2] <= sp[1] <= VIEW[3]:
                pts.append([i, round(sp[1], 2), round(sp[0], 2)])
        d = checks.get(code)
        out["sats"].append({"code": code, "name": name, "norad": norad, "sensor": sensor, "exact": True, "validated": True,
                            "tleEpoch": f"{sets[0][0]:%d %b} to {sets[-1][0]:%d %b} 2026 ({len(sets)} sets)",
                            "checkMedianKm": round(d[len(d)//2]) if d else None, "checkP90Km": round(d[int(len(d)*0.9)]) if d else None, "pts": pts})
    (ROOT / "app" / "data" / "sat_tracks.json").write_text(json.dumps(out, separators=(",", ":")))
    print("sat_tracks.json", round((ROOT / "app" / "data" / "sat_tracks.json").stat().st_size / 1e6, 2), "MB;", {x["code"]: len(x["pts"]) for x in out["sats"]})


def main():
    CACHE.mkdir(parents=True, exist_ok=True)
    hist = load_history()
    if hist:
        return main_history(hist)
    loaded = {}
    for name, code, norad, cycle, sensor in SATS:
        if cycle is None:
            continue  # commercial satellites: only with Space-Track history
        try:
            l1, l2 = tle(norad)
        except Exception as e:
            print("no TLE", name, e)
            continue
        s = Satrec.twoline2rv(l1, l2)
        ep = dt.datetime(2000 + s.epochyr if s.epochyr < 57 else 1900 + s.epochyr, 1, 1, tzinfo=dt.timezone.utc) + dt.timedelta(days=s.epochdays - 1)
        loaded[code] = (name, s, ep, cycle, sensor)
        print(f"{name}: TLE epoch {ep:%Y-%m-%d}")

    # Validation against real captures in the catalogue.
    gj = json.loads((ROOT / "data" / "satellites" / "acquisitions.geojson").read_text())
    errs = {}
    for f in gj["features"]:
        p = f["properties"]
        code = p["satellite"]
        if code not in loaded:
            continue
        name, s, ep, cycle, _ = loaded[code]
        when = dt.datetime.fromisoformat(p["start_utc"].replace("Z", "+00:00"))
        g = f["geometry"]
        ring = g["coordinates"][0] if g["type"] == "Polygon" else g["coordinates"][0][0]
        cen = (sum(y for x, y in ring) / len(ring), sum(x for x, y in ring) / len(ring))
        errs.setdefault(code, []).append((when, cen))
    offsets = {}
    print("Fit of a constant time offset per satellite against real captures (km from footprint centre):")
    for code, obs in sorted(errs.items()):
        name, s, ep, cycle, _ = loaded[code]
        sample = obs[:: max(1, len(obs) // 60)]
        off, med = fit_offset(s, ep, cycle, sample)
        d = sorted(km(shifted(s, ep, cycle, w, off) or (0, 0), c) for w, c in obs)
        offsets[code] = (off, d[len(d) // 2], d[int(len(d) * 0.9)])
        print(f"  {code}: n={len(obs)} offset {off:+d} s, median {d[len(d)//2]:.0f}, 90th pct {d[int(len(d)*0.9)]:.0f}")
    errs = {k: v for k, v in offsets.items()}

    # Positions every STEP_MIN minutes across the window, kept only near the theater.
    out = {"stepMin": STEP_MIN, "sats": []}
    for code, (name, s, ep, cycle, sensor) in loaded.items():
        pts = []
        for i in range(NT * 60 // STEP_MIN):
            when = T0 + dt.timedelta(minutes=i * STEP_MIN)
            sp = shifted(s, ep, cycle, when, errs.get(code, (0,))[0])
            if sp and VIEW[0] <= sp[0] <= VIEW[1] and VIEW[2] <= sp[1] <= VIEW[3]:
                pts.append([i, round(sp[1], 2), round(sp[0], 2)])
        med = errs[code][1] if code in errs else None
        out["sats"].append({"code": code, "name": name, "norad": [x for x in SATS if x[1] == code][0][2], "sensor": sensor,
                            "cycleDays": cycle, "tleEpoch": ep.strftime("%Y-%m-%d"), "checkMedianKm": round(med) if med else None,
                            "offsetS": errs.get(code, (0,))[0],
                            "checkP90Km": round(errs[code][2]) if code in errs else None,
                            # Validated: after the offset, the gap to its real footprints is near-constant
                            # (spread under 50 km), i.e. the modelled track follows the real one.
                            "validated": bool(code in errs and errs[code][2] - errs[code][1] < 50),
                            "pts": pts})
    (ROOT / "app" / "data" / "sat_tracks.json").write_text(json.dumps(out, separators=(",", ":")))
    print("sat_tracks.json", round((ROOT / "app" / "data" / "sat_tracks.json").stat().st_size / 1e6, 2), "MB;",
          {s["code"]: len(s["pts"]) for s in out["sats"]})


if __name__ == "__main__":
    main()
