# What the Hormuz

A replay of the Strait of Hormuz crisis (24 Feb to 16 Mar 2026) on a one-hour clock. Flights, ship density, radar and optical ship detections, satellite passes, airspace and official incident reports appear only from the hour they existed. Each claim carries a grade (corroborated, consistent, reported only, contested, contradicted) and names its data file. Plain code counts and detects; the grades are set from that evidence, and a local model explains them and answers questions from the same evidence.

## Pitch

In the fog of war, data exists, opinions exist, insights do not.

When the Strait of Hormuz closed, everyone had a story. The data to test those stories was public, but nobody joined it up in time.

What the Hormuz replays the crisis hour by hour, 24 February to 16 March 2026. It grades 27 claims against flight, ship and satellite data, from corroborated to contradicted, and each grade shows its evidence. Nothing appears before the hour it existed.

Plain code counts and detects. The AI doesn't grade; it explains grades and answers questions, on a local model, so nothing leaves the machine. All of the data is free.

**Beyond Hormuz:** any contested, fast-moving event leaves traces in free global data. Change the map box and the dates, and the same tool grades claims about a port blockade, an airspace closure or a sanctions-evasion story. It's for newsrooms, insurers, traders and analysts who need to know what was actually known, and when.

## Run

```bash
uv run scripts/serve.py
```

Open http://localhost:8770. The built data the app needs is in `app/data/`, so nothing else is required.

Chat needs [LM Studio](https://lmstudio.ai) with a model loaded (it uses whichever chat model is loaded, default `qwen/qwen3.8-27b`; override with `LMSTUDIO_MODEL`, `LMSTUDIO_URL`). Without it the replay works and chat shows an error. Nothing leaves the machine.

## Rebuild the data

Raw downloads (about 350 MB) are not in the repo. Copy `.env.example` to `.env`, fill in the free keys (Global Fishing Watch, NASA FIRMS, Copernicus, Space-Track), then run the scripts in `scripts/`. `build_bundle.py` turns `events/` and `data/` into `app/data/bundle.json`.

## Layout

- `app/`: the front end (MapLibre and deck.gl) and built data
- `events/`: the hand-built event tables and the ship-incident notes
- `scripts/`: server, chat agent, fetchers and builders
- `SPINE.md`, `DECISIONS.md`: story spine and decision register
- `DEMO.md`, `DEMO-NOTES.md`: spoken demo script and backstage notes
- `HOW-I-BUILT-IT.md`: the detailed build log (data sources, method, what went wrong)
- `WRITEUP.md`: the early write-up, kept for the record; the plan changed after it

## Security notes

The server binds to 127.0.0.1 only, rejects other Host and Origin headers, caps request size, serves one model call at a time and returns short error messages. CDN scripts are pinned with integrity hashes. Keys live in `.env`, which is git-ignored.

## Limits

No individual ship tracks (no free source covers the strait); no flight coverage over Iraq; incident times are report times; airspace outlines are approximate; one event built by hand.

Data sources: adsb.lol, Global Fishing Watch, IMF PortWatch, ESA Copernicus, NASA FIRMS and GIBS, Space-Track, UKMTO and JMIC advisories. Check each provider's terms before reuse.
