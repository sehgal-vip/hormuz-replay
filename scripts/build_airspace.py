# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///
"""Build app/data/airspace.json: flight information regions (FIRs) and their reported status by tick.

Boundaries: VATSpy data project (community FIR outlines, approximate, for display only).
Status changes come only from sourced events in events/timeline.csv and the research notes.
Each change has a start tick, a status, a precision label and a source. Statuses:
  closed      closed to civil traffic
  partial     partly open (corridors, prior-approved, evacuation or cargo only)
  contested   sources disagree on whether it closed
  advisory    open, but covered by EASA conflict-zone bulletin CZIB 2026-03
Date-only changes start at 00:00 of their day with precision "date only" (decision D11: never a false hour),
except closures reported only by date on 28 Feb, which start at the strike hour (06:00) and are labelled
"date only, after the strikes began", since every report ties them to the strikes.
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "cache" / "vatspy_boundaries.geojson"
OUT = ROOT / "app" / "data" / "airspace.json"

AJ = "https://aljazeera.com/news/2026/2/28/airspace-closed-airlines-halt-flights-as-us-israel-attack-iran-responds"
EN = "https://www.euronews.com/2026/02/28/us-and-israel-launch-strikes-on-iran-what-has-happened-so-far"
EASA = "https://www.easa.europa.eu/en/domains/air-operations/czibs/2026-03"
RTE = "https://www.rte.ie/news/primetime/2026/0302/1561251-satellite-images-tracking-data-show-disruption-in-middle-east"
CHA = "https://www.ch-aviation.com/news/164379-gulf-iran-iraq-syria-israel-close-to-all-traffic"
CHA2 = "https://www.ch-aviation.com/news/164439-el-al-resumes-limited-ops-as-tel-aviv-reopens"
CNBC = "https://www.cnbc.com/2026/03/02/middle-east-flights.html"
ALM = "https://www.al-monitor.com/originals/2026/03/gulf-air-corridors-reopen-cautiously-evacuations-take-shape"
AJQA = "https://www.aljazeera.com/news/2026/3/6/qatar-partially-reopens-airspace-as-iranian-strikes-continue-to-hit-gulf"
NAT = "https://www.thenationalnews.com/business/aviation/2026/02/28/airlines-suspend-flights-amid-us-israel-strikes-on-iran-and-gulf-airspace-closures/"

T28 = 96  # 28 Feb 00:00
STRIKE = 102  # 28 Feb 06:00


def day(d):  # tick of 00:00 on a day in the window (Feb 24 = 0)
    m, dd = d
    return ((dd - 24) if m == 2 else (5 + dd - 1)) * 24


# FIR id -> (name, [ (tick, status, precision, note, source) ... ])
FIRS = {
    "OIIX": ("Tehran FIR (Iran)", [
        (STRIKE, "advisory", "date only", "EASA conflict-zone bulletin CZIB 2026-03 covers this FIR.", EASA),
        (103, "closed", "hour (logged about 07:25 UTC)", "Iran announces a nationwide airspace closure.", EN)]),
    "LLLL": ("Tel Aviv FIR (Israel)", [
        (STRIKE, "advisory", "date only", "EASA CZIB 2026-03 covers this FIR.", EASA),
        (103, "closed", "hour (logged about 07:25 UTC)", "Israel closes its airspace to civilian flights.", EN),
        (day((3, 4)), "partial", "date only", "Ben Gurion reopens to prior-approved flights.", CHA2)]),
    "ORBB": ("Baghdad FIR (Iraq)", [
        (STRIKE, "advisory", "date only", "EASA CZIB 2026-03 covers this FIR.", EASA),
        (105, "closed", "hour (logged about 09:09 UTC)", "Iraq closes its airspace.", EN)]),
    "OMAE": ("Emirates FIR (UAE)", [
        (STRIKE, "advisory", "date only", "EASA CZIB 2026-03 covers this FIR.", EASA),
        (105, "closed", "hour (logged about 09:54 UTC); scope contested", "UAE airspace closes: 'temporarily and partially' per WAM, to all commercial traffic per ch-aviation.", AJ),
        (161, "partial", "hour (EK500 departs 17:12 UTC)", "First Emirates flight leaves Dubai; limited operations resume.", CNBC),
        (day((3, 3)), "partial", "date only", "The UAE opens 'safe corridors' at 48 flights per hour.", ALM)]),
    "OTDF": ("Doha FIR (Qatar)", [
        (STRIKE, "closed", "date only, after the strikes began", "Qatar is among at least eight states that close airspace on 28 Feb.", AJ),
        (258, "partial", "evening of 6 Mar (hour not reported)", "Qatar partially reopens for evacuation and cargo flights only.", AJQA)]),
    "OBBB": ("Bahrain FIR", [
        (STRIKE, "closed", "date only, after the strikes began", "Bahrain is among at least eight states that close airspace on 28 Feb.", AJ)]),
    "OKAC": ("Kuwait FIR", [
        (STRIKE, "closed", "date only, after the strikes began", "Kuwait is among at least eight states that close airspace on 28 Feb; reported fully closed on 6 Mar.", AJ)]),
    "OJAC": ("Amman FIR (Jordan)", [
        (STRIKE, "closed", "date only, after the strikes began", "Jordan is listed among states closing airspace on 28 Feb.", AJ),
        (day((3, 2)), "contested", "date only", "Flightradar24 (via RTE) calls Jordan's airspace 'technically open' on 2 Mar.", RTE)]),
    "OOMM": ("Muscat FIR (Oman)", [
        (STRIKE, "contested", "date only", "The National reports Oman closed its airspace; ch-aviation says Muscat stayed open. EASA CZIB 2026-03 covers this FIR.", NAT)]),
    "OSTT": ("Damascus FIR (Syria)", [
        (STRIKE, "partial", "date only, about 12 hours", "Syria closes its southern airspace for 12 hours.", AJ),
        (STRIKE + 12, "advisory", "approximate", "Southern closure reported for 12 hours only; shown as open after that.", AJ)]),
    "OEJD": ("Jeddah FIR (Saudi Arabia)", [
        (STRIKE, "advisory", "date only", "Open; traffic reroutes through Saudi airspace. EASA CZIB 2026-03 covers this FIR.", EASA)]),
    "OLBB": ("Beirut FIR (Lebanon)", [
        (STRIKE, "advisory", "date only", "Reported 'technically open'. EASA CZIB 2026-03 covers this FIR.", EASA)]),
}


def simplify(ring, step):
    out = ring[::step]
    if out[-1] != ring[-1]:
        out.append(ring[-1])
    return [[round(x, 2), round(y, 2)] for x, y in out]


def main():
    g = json.loads(SRC.read_text())
    feats = []
    for f in g["features"]:
        fid = f["properties"].get("id")
        if fid not in FIRS:
            continue
        geom = f["geometry"]
        polys = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
        rings = []
        for poly in polys:
            ring = poly[0]
            step = max(1, len(ring) // 160)
            rings.append([simplify(ring, step)])
        name, changes = FIRS[fid]
        feats.append({
            "id": fid, "name": name,
            "label": [float(f["properties"].get("label_lon") or 0), float(f["properties"].get("label_lat") or 0)],
            "polygons": rings,
            "changes": [{"tick": t, "status": s, "precision": p, "note": n, "source": src} for t, s, p, n, src in changes],
        })
    OUT.write_text(json.dumps({"source": "Boundaries: VATSpy data project (approximate). Status: sourced news and EASA CZIB 2026-03.",
                               "firs": feats}, separators=(",", ":")))
    print(len(feats), "FIRs", round(OUT.stat().st_size / 1024), "KB", sorted(x["id"] for x in feats))


if __name__ == "__main__":
    main()
