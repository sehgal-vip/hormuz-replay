# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///
"""Download historical orbital elements (TLEs) for 17 Feb to 18 Mar 2026 from Space-Track.

Reads SPACETRACK_USER and SPACETRACK_PASS from .env (never printed). Writes
data/cache/spacetrack_history.json, which build_sat_tracks.py then uses instead of
today's orbits. One login, one query: well inside Space-Track's rate limits.

  uv run scripts/fetch_spacetrack.py
"""
import http.cookiejar
import json
import pathlib
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
NORAD = [39634, 62261, 40697, 42063, 60989, 41335, 43437, 39084, 49260, 37849, 43013, 54234,
         40115, 35946, 48268, 49070]  # Sentinels, Landsat, VIIRS carriers, WorldView-3/-2, Pleiades Neo 3/4
SENTINEL_1D_NAME = "SENTINEL-1D"


def main():
    env = dict(l.strip().split("=", 1) for l in (ROOT / ".env").read_text().splitlines() if "=" in l and not l.startswith("#"))
    user, pw = env.get("SPACETRACK_USER", "").strip(), env.get("SPACETRACK_PASS", "").strip()
    if not user or not pw:
        raise SystemExit("SPACETRACK_USER / SPACETRACK_PASS missing in .env")
    jar = http.cookiejar.CookieJar()
    op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
    op.addheaders = [("User-Agent", "hormuz-replay/1.0")]
    r = op.open("https://www.space-track.org/ajaxauth/login", urllib.parse.urlencode({"identity": user, "password": pw}).encode(), timeout=60)
    body = r.read().decode(errors="replace")
    if "Failed" in body or r.status != 200:
        raise SystemExit("Space-Track login failed (check the account is activated and the details in .env)")
    # Sentinel-1D's catalogue number, looked up by name
    q = "https://www.space-track.org/basicspacedata/query/class/satcat/OBJECT_NAME/" + urllib.parse.quote(SENTINEL_1D_NAME) + "/format/json"
    sat1d = json.load(op.open(q, timeout=60))
    ids = NORAD + [int(x["NORAD_CAT_ID"]) for x in sat1d]
    q = ("https://www.space-track.org/basicspacedata/query/class/gp_history/NORAD_CAT_ID/" + ",".join(map(str, ids)) +
         "/EPOCH/2026-02-17--2026-03-18/orderby/NORAD_CAT_ID,EPOCH%20asc/format/json")
    rows = json.load(op.open(q, timeout=300))
    keep = [{k: x[k] for k in ("NORAD_CAT_ID", "OBJECT_NAME", "EPOCH", "TLE_LINE1", "TLE_LINE2")} for x in rows]
    out = ROOT / "data" / "cache" / "spacetrack_history.json"
    out.write_text(json.dumps(keep))
    op.open("https://www.space-track.org/ajaxauth/logout", timeout=30)
    by = {}
    for x in keep:
        by.setdefault(x["OBJECT_NAME"], 0)
        by[x["OBJECT_NAME"]] += 1
    print(f"saved {len(keep)} element sets for {len(by)} satellites:", by)


if __name__ == "__main__":
    main()
