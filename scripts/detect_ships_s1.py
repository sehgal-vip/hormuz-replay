# /// script
# requires-python = ">=3.10"
# dependencies = ["pillow", "numpy", "scipy"]
# ///
"""Detect ship-like bright targets in the Sentinel-1 chips (VV, scaled dB).

Simple CFAR: a pixel is a candidate if it exceeds the local sea background
(mean + K * std, measured in a ring that excludes the pixel's neighbourhood).
Land is masked from a heavily smoothed image. Targets are connected blobs of
MIN_PX to MAX_PX pixels. This is a first-pass detector for the demo, not a
validated product: it will miss small boats and will flag some rocks, wakes
and platforms. Counts are only comparable across dates over the same valid area.

  uv run scripts/detect_ships_s1.py
Writes events/radar_detections.csv and data/imagery/annotated/*.png
"""
import csv
import pathlib

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

ROOT = pathlib.Path(__file__).resolve().parent.parent
IMG = ROOT / "data" / "imagery"
BBOX = (56.0, 26.2, 56.7, 26.9)  # lon0, lat0, lon1, lat1
PASSES = {  # date -> approximate acquisition time (UTC) from the catalogue
    "2026-02-28": "02:15", "2026-03-01": "02:05", "2026-03-04": "14:17",
    "2026-03-10": "14:16", "2026-03-13": "02:05",
}
K, MIN_PX, MAX_PX = 6.0, 2, 120
PEAK_FLOOR = 140  # scaled value; 140 is about -8.5 dB VV. Rejects speckle in calm, dark water.


def detect(a: np.ndarray):
    valid = a > 0
    f = a.astype(np.float32)
    # Land: bright and textured after heavy smoothing.
    smooth = ndi.uniform_filter(f, 41)
    land = ndi.binary_dilation(smooth > np.percentile(f[valid], 75) + 10, iterations=25)
    sea = valid & ~land
    # Local background from a wide window, ignoring the immediate neighbourhood.
    big, small = 61, 9
    n_big, n_small = big * big, small * small
    s1 = ndi.uniform_filter(f, big) * n_big - ndi.uniform_filter(f, small) * n_small
    s2 = ndi.uniform_filter(f * f, big) * n_big - ndi.uniform_filter(f * f, small) * n_small
    n = n_big - n_small
    mu = s1 / n
    sd = np.sqrt(np.maximum(s2 / n - mu * mu, 1.0))
    cand = (f > mu + K * sd) & sea
    lab, k = ndi.label(cand, structure=np.ones((3, 3)))
    out = []
    if k:
        idx = np.arange(1, k + 1)
        sizes = ndi.sum(cand, lab, idx)
        coms = ndi.center_of_mass(cand, lab, idx)
        peaks = ndi.maximum(f, lab, idx)
        for sz, (cy, cx), pk in zip(sizes, coms, peaks):
            if MIN_PX <= sz <= MAX_PX and pk >= PEAK_FLOOR:
                out.append((cx, cy, int(sz), float(pk)))
    return out, int(valid.sum()), int(sea.sum())


def main():
    import json
    chips = json.loads((IMG / "chips.json").read_text())
    (IMG / "annotated").mkdir(exist_ok=True)
    rows, summary = [], []
    for c in chips:
        tag = f"{c['date']}_{c['slot']}"
        im = Image.open(IMG / c["file"]).convert("L")
        a = np.array(im)
        h, w = a.shape
        dets, n_valid, n_sea = detect(a)
        lon0, lat0, lon1, lat1 = c["bbox"]
        for i, (x, y, sz, pk) in enumerate(dets, 1):
            rows.append({
                "pass_date": c["date"], "slot": c["slot"], "window_utc": c["window_utc"], "det_id": f"{tag}-{i:03d}",
                "lon": round(lon0 + (x + 0.5) / w * (lon1 - lon0), 5),
                "lat": round(lat1 - (y + 0.5) / h * (lat1 - lat0), 5),
                "px_x": round(x, 1), "px_y": round(y, 1), "size_px": sz, "peak_scaled_db": round(pk, 1),
            })
        summary.append((c["date"], c["slot"], len(dets), n_valid / (w * h), n_sea / (w * h)))
        rgb = Image.open(IMG / c["file"]).convert("RGB")
        dr = ImageDraw.Draw(rgb)
        for x, y, *_ in dets:
            dr.ellipse([x - 14, y - 14, x + 14, y + 14], outline=(255, 190, 0), width=3)
        rgb.resize((1200, 1200)).save(IMG / "annotated" / f"{tag}.png")
    with open(ROOT / "events" / "radar_detections.csv", "w", newline="") as f:
        wr = csv.DictWriter(f, fieldnames=list(rows[0]))
        wr.writeheader()
        wr.writerows(rows)
    with open(ROOT / "events" / "radar_summary.csv", "w", newline="") as f:
        wr = csv.writer(f)
        wr.writerow(["pass_date", "slot", "detections", "valid_data_share", "open_sea_share"])
        for r in sorted(summary):
            wr.writerow([r[0], r[1], r[2], round(r[3], 3), round(r[4], 3)])
    print("slot date        ships  valid  open_sea")
    for d, sl, n, v, s_ in sorted(summary, key=lambda r: (r[1], r[0])):
        print(f"{sl}    {d}  {n:5d}  {v:5.0%}  {s_:7.0%}")


if __name__ == "__main__":
    main()
