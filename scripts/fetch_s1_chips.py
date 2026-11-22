# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///
"""Fetch Sentinel-1 VV chips of the Strait of Hormuz via the Copernicus Process API.

Sentinel-1 repeats every 6 days on three tracks over the strait, so each SLOT
below is one fixed geometry seen five times (two pre-war baseline passes, the
pass nearest 28 Feb, and two passes in March). Comparing a slot with itself
removes footprint and incidence-angle effects that make cross-slot counts
unfair. Reads keys from .env; writes data/imagery/s1_<date>_<slot>.png and
data/imagery/chips.json. Skips chips already on disk.
"""
import json
import pathlib
import urllib.error
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
IMG = ROOT / "data" / "imagery"
SLOTS = {
    # slot: (window start HH:MM, window end HH:MM, bbox lon0,lat0,lon1,lat1, dates)
    "A": ("02:00", "02:30", [56.0, 26.2, 56.7, 26.9], ["2026-02-16", "2026-02-22", "2026-02-28", "2026-03-06", "2026-03-12"]),
    "B": ("01:55", "02:20", [56.5, 26.2, 57.2, 26.9], ["2026-02-17", "2026-02-23", "2026-03-01", "2026-03-07", "2026-03-13"]),
    "C": ("14:10", "14:25", [56.0, 26.2, 56.7, 26.9], ["2026-02-14", "2026-02-20", "2026-02-26", "2026-03-04", "2026-03-10"]),
}
EVAL = """//VERSION=3
function setup(){return {input:["VV"],output:{bands:1,sampleType:"UINT8"}};}
function evaluatePixel(s){let db=10*Math.log(Math.max(s.VV,1e-6))/Math.LN10;let v=Math.max(0,Math.min(1,(db+25)/30));return [Math.round(v*255)];}"""


def token():
    env = dict(l.strip().split("=", 1) for l in (ROOT / ".env").read_text().splitlines() if "=" in l and not l.startswith("#"))
    data = urllib.parse.urlencode({"grant_type": "client_credentials", "client_id": env["CDSE_CLIENT_ID"].strip(),
                                   "client_secret": env["CDSE_CLIENT_SECRET"].strip()}).encode()
    url = "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token"
    return json.load(urllib.request.urlopen(url, data, timeout=40))["access_token"]


def main():
    tok = token()
    meta = []
    for slot, (t0, t1, bbox, dates) in SLOTS.items():
        for day in dates:
            fn = f"s1_{day}_{slot}.png"
            entry = {"file": fn, "date": day, "slot": slot, "window_utc": f"{t0}-{t1}", "bbox": bbox}
            if not (IMG / fn).exists():
                body = {"input": {"bounds": {"bbox": bbox, "properties": {"crs": "http://www.opengis.net/def/crs/EPSG/0/4326"}},
                        "data": [{"type": "sentinel-1-grd",
                                  "dataFilter": {"timeRange": {"from": f"{day}T{t0}:00Z", "to": f"{day}T{t1}:00Z"},
                                                 "acquisitionMode": "IW", "resolution": "HIGH"},
                                  "processing": {"orthorectify": True, "demInstance": "COPERNICUS_30", "backCoeff": "GAMMA0_TERRAIN"}}]},
                        "output": {"width": 2400, "height": 2400, "responses": [{"identifier": "default", "format": {"type": "image/png"}}]},
                        "evalscript": EVAL}
                req = urllib.request.Request("https://sh.dataspace.copernicus.eu/api/v1/process", data=json.dumps(body).encode(),
                                             headers={"Authorization": "Bearer " + tok, "Content-Type": "application/json", "Accept": "image/png"})
                try:
                    (IMG / fn).write_bytes(urllib.request.urlopen(req, timeout=240).read())
                    print("fetched", fn, flush=True)
                except urllib.error.HTTPError as e:
                    print("FAILED", fn, e.code, e.read()[:200], flush=True)
                    continue
            meta.append(entry)
    (IMG / "chips.json").write_text(json.dumps(meta, indent=1))
    print(len(meta), "chips listed in chips.json")


if __name__ == "__main__":
    main()
