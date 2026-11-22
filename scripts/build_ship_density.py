# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///
"""Daily gridded ship presence (AIS) for the map: Global Fishing Watch, 0.1 degree cells.

Each cell carries vessel-hours and distinct vessels for one UTC day. Daily data on an hourly
clock is a day band (D11): the app shows a day's grid on every tick of that day.
Non-commercial use; attribute Global Fishing Watch. Writes app/data/ship_density.json.

  uv run scripts/build_ship_density.py
"""
import datetime as dt
import json
import pathlib
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
CACHE = ROOT / "data" / "cache"
POLY = [[47.5, 22.0], [61.5, 22.0], [61.5, 30.6], [47.5, 30.6], [47.5, 22.0]]
CHUNKS = [("2026-02-24", "2026-03-03"), ("2026-03-03", "2026-03-10"), ("2026-03-10", "2026-03-17")]


def fetch(a, b):
    f = CACHE / f"gfw_grid_{a}_{b}.json"
    if not f.exists():
        env = dict(l.strip().split("=", 1) for l in (ROOT / ".env").read_text().splitlines() if "=" in l and not l.startswith("#"))
        u = ("https://gateway.api.globalfishingwatch.org/v3/4wings/report?spatial-resolution=LOW&temporal-resolution=DAILY"
             f"&datasets[0]=public-global-presence:latest&date-range={a},{b}&format=JSON&spatial-aggregation=false")
        req = urllib.request.Request(u, data=json.dumps({"geojson": {"type": "Polygon", "coordinates": [POLY]}}).encode(),
                                     headers={"Authorization": "Bearer " + env["GFW_API_TOKEN"].strip(), "Content-Type": "application/json",
                                              "User-Agent": "hormuz-replay/1.0"})
        f.write_bytes(urllib.request.urlopen(req, timeout=600).read())
    return list(json.loads(f.read_text())["entries"][0].values())[0] or []


def land_tester():
    """Point-on-land test from Natural Earth 10m land (public domain), clipped to the region."""
    f = CACHE / "ne" / "ne_10m_land.geojson"
    if not f.exists():
        return None
    rings = []
    for feat in json.loads(f.read_text())["features"]:
        g = feat["geometry"]
        polys = [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"]
        for poly in polys:
            xs = [x for x, y in poly[0]]; ys = [y for x, y in poly[0]]
            if max(xs) < 46 or min(xs) > 63 or max(ys) < 21 or min(ys) > 32:
                continue
            rings.append((min(xs), max(xs), min(ys), max(ys), poly[0], poly[1:]))

    def inside(ring, x, y):
        c = False
        j = len(ring) - 1
        for i in range(len(ring)):
            xi, yi = ring[i]; xj, yj = ring[j]
            if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
                c = not c
            j = i
        return c

    def on_land(x, y):
        for x0, x1, y0, y1, outer, holes in rings:
            if x0 <= x <= x1 and y0 <= y <= y1 and inside(outer, x, y) and not any(inside(h, x, y) for h in holes):
                return True
        return False
    return on_land


def main():
    CACHE.mkdir(parents=True, exist_ok=True)
    days = {}
    for a, b in CHUNKS:
        for r in fetch(a, b):
            if not ("2026-02-24" <= r["date"] <= "2026-03-16"):
                continue
            key = (round(r["lon"], 1), round(r["lat"], 1))
            cell = days.setdefault(r["date"], {}).setdefault(key, [0, 0])
            cell[0] += r["hours"]
            cell[1] += r["vesselIDs"]
    out = {"cellDeg": 0.1, "source": "Global Fishing Watch, AIS vessel presence (public-global-presence), daily, 0.1 degree",
           "days": {}}
    on_land = land_tester()
    land_cache = {}

    def fully_inland(lon, lat):
        # A cell counts as "on land" only when its centre and all four corners are on land (the whole 0.1 degree cell).
        if on_land is None:
            return 0
        k = (lon, lat)
        if k not in land_cache:
            land_cache[k] = int(all(on_land(lon + dx, lat + dy) for dx, dy in ((0, 0), (-0.05, -0.05), (0.05, -0.05), (0.05, 0.05), (-0.05, 0.05))))
        return land_cache[k]
    for d, cells in sorted(days.items()):
        out["days"][d] = [[lon, lat, round(h), v, fully_inland(lon, lat)] for (lon, lat), (h, v) in sorted(cells.items()) if h >= 1]
    (ROOT / "app" / "data" / "ship_density.json").write_text(json.dumps(out, separators=(",", ":")))
    for d, cells in out["days"].items():
        land = [c for c in cells if c[4]]
        print(d, len(cells), "cells", sum(c[2] for c in cells), "vessel-hours | wholly on land:", len(land), "cells", sum(c[2] for c in land), "vessel-hours")


if __name__ == "__main__":
    main()
