# /// script
# requires-python = ">=3.10"
# dependencies = ["orjson"]
# ///
"""Trim one adsb.lol daily archive to the Middle East.

Reads the day's tar from stdin (the .tar.aa and .tar.ab parts concatenated),
keeps only positions inside REGION, thinned to one point per aircraft per
MIN_GAP seconds, and writes gzip JSONL. Nothing global is stored on disk.

  curl -sL <aa-url> <ab-url> | uv run extract_flights.py 2026-02-28 out.jsonl.gz

Row: t (epoch s, UTC), hex, lat, lon, alt (ft or "ground"), gs, track,
flight, r (registration), type, mil (0/1), nic, nac_p, rc.
"""
import gzip
import sys
import tarfile
import time

import orjson

REGION = dict(lat0=8.0, lat1=44.0, lon0=22.0, lon1=70.0)
MIN_GAP = 30


class Counting:
    """Wrap stdin and count bytes, so a truncated download is detectable."""

    def __init__(self, f):
        self.f, self.n = f, 0

    def read(self, size=-1):
        b = self.f.read(size)
        self.n += len(b)
        return b


def main(day: str, out_path: str, expected: int):
    t_start = time.time()
    files = kept_aircraft = rows = bad = 0
    src = Counting(sys.stdin.buffer)
    with gzip.open(out_path, "wb", compresslevel=6) as out:
        tar = tarfile.open(fileobj=src, mode="r|")
        for member in tar:
            if not member.isfile() or "trace_full_" not in member.name:
                continue
            files += 1
            try:
                raw = tar.extractfile(member).read()
                if raw[:2] == b"\x1f\x8b":
                    raw = gzip.decompress(raw)
                d = orjson.loads(raw)
            except Exception:
                bad += 1
                continue
            base = d.get("timestamp", 0)
            flight = None
            nic = nac_p = rc = None
            last_t = -1e18
            any_kept = False
            mil = 1 if (d.get("dbFlags", 0) & 1) else 0
            for p in d.get("trace", ()):
                det = p[8] if len(p) > 8 else None
                if det:
                    flight = (det.get("flight") or flight or "").strip() or flight
                    nic = det.get("nic", nic)
                    nac_p = det.get("nac_p", nac_p)
                    rc = det.get("rc", rc)
                lat, lon = p[1], p[2]
                if lat is None or lon is None:
                    continue
                if not (REGION["lat0"] <= lat <= REGION["lat1"] and REGION["lon0"] <= lon <= REGION["lon1"]):
                    continue
                t = base + p[0]
                if t - last_t < MIN_GAP:
                    continue
                last_t = t
                any_kept = True
                rows += 1
                out.write(orjson.dumps({
                    "t": round(t), "hex": d.get("icao"), "lat": lat, "lon": lon,
                    "alt": p[3], "gs": p[4], "track": p[5],
                    "flight": flight, "r": d.get("r"), "type": d.get("t"),
                    "mil": mil, "nic": nic, "nac_p": nac_p, "rc": rc,
                }) + b"\n")
            kept_aircraft += any_kept
            if files % 20000 == 0:
                print(f"[{day}] {files} files, {kept_aircraft} aircraft in region, {rows} rows, "
                      f"{time.time() - t_start:.0f}s", file=sys.stderr, flush=True)
    while src.read(1 << 20):  # drain tar padding so the byte count is final
        pass
    print(f"DONE {day}: files={files} bad={bad} aircraft_in_region={kept_aircraft} rows={rows} "
          f"bytes={src.n}/{expected} secs={time.time() - t_start:.0f}", flush=True)
    if src.n < expected:
        print(f"TRUNCATED {day}: got {src.n} of {expected} bytes", file=sys.stderr, flush=True)
        sys.exit(2)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], int(sys.argv[3]))
