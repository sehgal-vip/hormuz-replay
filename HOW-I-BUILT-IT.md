# How I built What the Hormuz

This is the build log: what I set out to make, what changed on the way, where every layer of data came from, and what did not work. I built it in a day for an AI buildathon, working with Claude Code as a pair programmer. The decisions were mine and are recorded one by one in `DECISIONS.md`.

## 1. The idea, and how it changed

I started with a different plan: a live "theater command" for the Singapore Strait that fused public flight, ship and satellite feeds, with a rewind control.

Three findings changed it.

- **Live ships were thin.** The free ship feed (aisstream) covered only a narrow band of the Singapore Strait and returned nothing at all for Hormuz.
- **Live had no story.** A normal day in a busy strait shows a lot of dots and no question worth answering.
- **History had a story, but no ship tracks.** The Hormuz crisis of February and March 2026 was real and contested, and flights and satellites for it were free. Per-ship track history for the strait was not free anywhere I looked.

So the product became a replay of one event instead of a live dashboard (decisions D1 and D2). And because the interesting part of that event was that officials, data providers and the news contradicted each other, the replay became a grading tool: put every claim on one clock and test it against the data.

The through-line question is: nobody formally closed the Strait of Hormuz, yet traffic fell from about 100 crossings a day to almost none. What closed it?

## 2. The clock

Everything hangs on one rule: a single clock with a uniform tick of one hour (D10).

- **Range.** Tick 0 is 24 February 2026 00:00 UTC. Tick 503 is 16 March 23:00 UTC. That is 21 days and 504 ticks.
- **Why an hour.** It is the finest unit that two continuous layers support: flights and hourly ship presence. A day would have hidden the two-wave collapse on 28 February.
- **Coarser data is held, not invented.** A daily number shows on all 24 ticks of its day. A radar count stays on screen until the next pass, with its age shown, and fades as it gets old (D16).
- **Date-only items never get a made-up hour.** They appear as a day band marked "date only" (D11).
- **Radar blips expire fast.** A ship seen by radar is shown in the pass hour and fades over the next two hours, because a ship at 12 knots is 20 km away within the hour (D19).
- **No hindsight.** A layer appears only from the hour it existed.
- **Speed varies, the tick does not.** Dense scenes play one tick at a time and quiet stretches run fast (D12).

Every item also carries a precision label: minute, hour, date only, or time contested. The narrator never states a time more precisely than its label.

## 3. The data, layer by layer

All of it is free and public. Raw downloads are about 350 MB and are not in the repo. The built files the app needs are in `app/data/`.

### Flights

- **Source.** adsb.lol daily archives, published as GitHub releases (`globe_history_2026`).
- **Method.** `scripts/fetch_flights.sh` downloads each day's archive parts with resume, and checks the byte count against GitHub's. `scripts/extract_flights.py` reads the archive as a stream, keeps only positions inside the Middle East box, and thins them to one point per aircraft per interval. Nothing global is stored on disk.
- **Result.** 21 days, 24 February to 16 March. About 111,000 hourly aircraft tracks in `app/data/flights.json`, plus hourly counts of distinct airborne aircraft for the Gulf states and for interior Iran.

### Ship presence (AIS)

- **Source.** Global Fishing Watch, non-commercial use.
- **Method.** Hourly counts of ships broadcasting their position, for a box over the strait and a box over the Gulf of Oman. `scripts/build_ship_density.py` adds a daily grid of 0.1 degree cells (about 11 km) for the map.
- **Why density and not tracks.** No free per-vessel history exists for the strait (D6). The story is the strait emptying, and counts and density show that.

### Daily crossings

- **Sources.** IMF PortWatch (a public ArcGIS query, no login), S&P figures as printed in the JMIC daily updates, and Windward's daily posts.
- **Method.** I kept every provider's number and did not average them. They disagree, and the disagreement is part of the story. For 10 March, PortWatch and Windward say 2 and S&P via JMIC says 8.
- **Result.** 326 rows in `events/hormuz_daily_counts.csv`.

### Ship incidents

- **Sources.** UKMTO warnings, JMIC updates and MSCIO advisories, all as PDFs from the public listing on mscio.eu. Windward's attack list supplied flags and some IMO numbers.
- **Method.** The PDFs have a text layer, so I read them with PyMuPDF and used no OCR. Tables were reassembled by position and spot-checked against rendered page images.
- **Result.** 25 incident rows. The times are report times, not times of impact, and the app says so.
- **Notes.** `events/SHIPS_README.md` lists every gap and conflict, including one missing JMIC update and two vessels whose IMO numbers differ between sources.

### Radar ship counts (Sentinel-1)

- **Source.** ESA Copernicus, through the Process API.
- **Method.** Sentinel-1 passes over the strait on three repeating tracks. `scripts/fetch_s1_chips.py` fetches the same geometry five times per track: two baseline passes before the war, the pass nearest 28 February, and two in March. That gives 15 radar images. Comparing a track only with itself removes the viewing-angle differences that make cross-track counts unfair.
- **Detector.** `scripts/detect_ships_s1.py` is a simple brightness detector: a pixel is a candidate if it is much brighter than the sea around it, land is masked, and blobs of the right size count as ships. It is a first pass for the demo, not a validated product. It misses small boats and flags some rocks and platforms.
- **Result.** 608 detections across the 15 images, reported per unit of open sea so that partial coverage does not distort the count.

### Radar and optical ships from Global Fishing Watch

- Radar detections in the Gulf of Oman, per pass (17 passes).
- Sentinel-2 optical detections, each marked as matched to an AIS broadcast or not. For 11 to 13 March every detection is unmatched, which looks like a data gap, so the app does not use those days.

### Satellite positions

- **Sources.** Historical orbital elements from Space-Track for the window, and capture footprints from the Copernicus catalogue.
- **Method.** `scripts/build_sat_tracks.py` computes where each satellite was at two-minute steps and checks the result against real captures.
- **Result.** 17 Earth-observation satellites on the map, including the Sentinels, Landsat 8 and 9, WorldView and Pléiades Neo, and 176 recorded passes or captures.

### Airspace

- **Source.** Outlines of 12 flight information regions from the VATSpy community project. They are approximate and for display only.
- **Method.** `scripts/build_airspace.py` sets each region's status (closed, partial, contested, advisory) only from sourced events. Official airspace notices were not collected.

### Events and statements

- 50 events in `events/timeline.csv`, each with a source, a time or date, and a confidence label. Only 15 have a clock time.
- 18 GPS-interference reports from JMIC, Windward and UKMTO.
- NASA FIRMS heat detections as optional context (D5).

### The bundle

`scripts/build_bundle.py` lines all of this up on the 504-tick clock and writes `app/data/bundle.json`. The app reads that one file plus four larger ones (flights, ship density, satellite tracks, airspace).

## 4. The story spine

`SPINE.md` is the script the replay follows.

- **One linear pass.** The clock runs once from start to end. Themes are lanes on the timeline (Airspace, Attacks, Insurance, Fog, Claims), not chapters that rewind (D14).
- **13 scenes and 27 claims.** Each claim has a narrator line, the claim as made, the evidence with its data file, a precision label and a grade.
- **A cold open.** The story starts on 24 February, four days before the strikes, because crossings were already falling and a radar pass from before the war shows it (D7).
- **The thesis is graded too.** The last line grades the project's own thesis as "consistent, not proven" (D17).
- **Hard facts are not dropped.** Casualty events appear as muted context markers with their source, and are not narrated (D18).

## 5. The grades

There are five grades.

| Grade | Meaning | Claims |
|---|---|---|
| Corroborated | Independent data shows it | 11 |
| Consistent | The data fits but cannot prove it | 8 |
| Contested | Sources disagree | 4 |
| Reported only | No data I hold can test it | 3 |
| Contradicted | The data shows otherwise | 1 |

**The AI does not grade.** Plain code counts and detects. I set each grade from that evidence, and each claim names the file it rests on. Automating claim extraction and grading is the next step, and I did not want to claim it before it exists.

## 6. The app

- **Stack.** Plain HTML, CSS and JavaScript with no build step. MapLibre draws the map and deck.gl draws aircraft, satellites and ship cells on top. The timeline and the small charts are drawn on canvas.
- **Layout.** A map with a stat row, a sidebar, and a lane timeline.
- **Sidebar.** A fixed claim card with the grade on top, and one tabbed pane below (That day, Numbers, Satellites). An earlier version stacked six equal panels and buried the grade, so I rebuilt it.
- **Interaction.** Play and pause, a "pause on claims" hold, click any timeline dot to jump, hover for a one-line label, click a map object to pin its details.
- **Pause means pause.** Aircraft and satellites both freeze when the clock stops, including during the hold on each claim.

## 7. The chat

- **Model.** A local model running in LM Studio, called through its OpenAI-style endpoint. The evidence never leaves the machine.
- **Evidence pack.** `scripts/agent.py` builds the prompt in two parts. The static part holds the daily series, radar counts, all 27 claims with grades, and the known gaps. The moment part holds the current hour, the current claim, and the flights, ships, incidents and events around it.
- **Why two parts.** The static part is identical on every request, so LM Studio's prompt cache can reuse it. The server also sends a one-token request at start and every 5 minutes to keep the model loaded.
- **Rules in the prompt.** Answer only from the pack. Name the source for every number. Use the grade scale exactly. Never state a time more precisely than its label. Never call an AIS count radar. Separate what the data shows from what caused it.
- **Model choice.** The chat uses whichever chat model LM Studio already has loaded, because loading a second large model can fail for lack of memory.

## 8. Hardening and sharing

- **Server.** `scripts/serve.py` binds to 127.0.0.1, rejects any other Host or Origin, caps requests at 64 KB, validates the JSON, runs one model call at a time, and returns short error messages while logging the detail.
- **Inputs.** The chat history is trimmed to the last 8 turns and 2,000 characters each.
- **Public link.** For judges I used an ngrok tunnel. The server accepts the tunnel's hostname through `PUBLIC_HOSTS` and limits each visitor to 6 questions a minute.
- **Loading over a slow link.** The map libraries are served from the app itself, text files are compressed, the small data files load in parallel, and the 11 MB flights file loads in the background so the page never waits on it.
- **Secrets.** Keys live in `.env`, which is git-ignored. `.env.example` lists the names.

## 9. What went wrong

- **No free ship tracks.** I checked the live feed, research datasets, Hugging Face, Zenodo and GitHub. Nothing free covers Hormuz per vessel for this window. A paid API was an option and I turned it down.
- **Blocked sources.** ukmto.org and two S&P articles returned HTTP 403. I got the UKMTO notices from the mscio.eu listing instead. The four S&P direct figures come from search snippets and are marked unverified.
- **Aircraft vanished after a speed fix.** Moving the flights file to a background load left the map caching "no aircraft" for hours it had drawn early. Clearing that cache when the file arrives fixed it.
- **The page looked dead on the public link.** It waited for every file before drawing anything. See "Loading over a slow link" above.
- **The chat failed in front of me.** LM Studio had a different model loaded than the one the app asked for. See "Model choice" above.
- **The chat failed again after four questions.** The server trimmed long chat history to a fixed number of turns, which could leave an assistant turn first. The Qwen chat template rejects that. The history now always opens with a user turn, and a failed request is retried with the latest question only.
- **The tunnel dropped.** The ngrok log showed repeated heartbeat timeouts from an unstable home connection. That is a network problem, not an app problem, and the fallback is a screen recording.

## 10. Honest limits

- No individual ship tracks. Ships show as density, detections and incidents.
- No flight coverage over Iraq, because the archive has no receivers there.
- Incident times are report times, not times of impact.
- Several exact times on 28 February rest on a single source.
- The 10 March "eight vessels without a broadcast" claim cannot be tested with the data held.
- Airspace outlines are approximate.
- The radar detector is a first pass and is not validated.
- One event, built by hand. The sources are global; the story spine is written per event.

## 11. Run it or rebuild it

Run the replay:

```bash
uv run scripts/serve.py
```

Then open http://localhost:8770. Chat needs LM Studio with a chat model loaded.

To rebuild the data, copy `.env.example` to `.env`, add the free keys (Global Fishing Watch, NASA FIRMS, Copernicus, Space-Track), run the fetch scripts in `scripts/`, then:

```bash
uv run scripts/build_bundle.py
```

Check each data provider's terms before reusing the data. Global Fishing Watch data is for non-commercial use.
