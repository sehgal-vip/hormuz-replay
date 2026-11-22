# What the Hormuz

A replay of the Strait of Hormuz crisis (24 Feb to 16 Mar 2026) on a one-hour clock. Flights, ship density, radar and optical ship detections, satellite passes, airspace and official incident reports appear only from the hour they existed. Each claim carries a grade (corroborated, consistent, reported only, contested, contradicted) and names its data file. Plain code counts and detects; the grades are set from that evidence, and a local model explains them and answers questions from the same evidence.

## Run

```bash
uv run scripts/serve.py
```

Open http://localhost:8770. The built data the app needs is in `app/data/`, so nothing else is required.

Chat needs [LM Studio](https://lmstudio.ai) with a model loaded (default `qwen/qwen3.6-35b-a3b`; override with `LMSTUDIO_MODEL`, `LMSTUDIO_URL`). Without it the replay works and chat shows an error. Nothing leaves the machine.

## Rebuild the data

Raw downloads (about 350 MB) are not in the repo. Copy `.env.example` to `.env`, fill in the free keys (Global Fishing Watch, NASA FIRMS, Copernicus, Space-Track), then run the scripts in `scripts/`. `build_bundle.py` turns `events/` and `data/` into `app/data/bundle.json`.

## Layout

- `app/`: the front end (MapLibre and deck.gl) and built data
- `events/`: the hand-built event tables and the ship-incident notes
- `scripts/`: server, chat agent, fetchers and builders
- `SPINE.md`, `DECISIONS.md`: story spine and decision register
- `DEMO.md`, `DEMO-NOTES.md`: spoken demo script and backstage notes
- `WRITEUP.md`: short write-up

## Security notes

The server binds to 127.0.0.1 only, rejects other Host and Origin headers, caps request size, serves one model call at a time and returns short error messages. CDN scripts are pinned with integrity hashes. Keys live in `.env`, which is git-ignored.

## Limits

No individual ship tracks (no free source covers the strait); no flight coverage over Iraq; incident times are report times; airspace outlines are approximate; one event built by hand.

Data sources: adsb.lol, Global Fishing Watch, IMF PortWatch, ESA Copernicus, NASA FIRMS and GIBS, Space-Track, UKMTO and JMIC advisories. Check each provider's terms before reuse.
