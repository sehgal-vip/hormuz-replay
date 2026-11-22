# Demo notes: backstage reference

The spoken script is in DEMO.md. This file holds everything else.

## Run it

- Start: `uv run ~/hormuz-replay/scripts/serve.py`, then open http://localhost:8770.
- After new data: `uv run ~/hormuz-replay/scripts/build_bundle.py` and reload. Airspace data: `uv run ~/hormuz-replay/scripts/build_airspace.py`.
- Chat uses whichever chat model LM Studio has loaded (default `qwen/qwen3.8-27b`). To force another: start the server with `LMSTUDIO_MODEL=<model id>`.

## Before going on stage

- [ ] Server running: http://localhost:8770 (preview "hormuz-replay").
- [ ] LM Studio: `qwen/qwen3.8-27b` loaded. The server pings it every 5 minutes, so it stays loaded while the server runs.
- [ ] **Chat takes about 25 seconds per answer on this model** (measured; up to a minute when cold). The server loads the model and caches the evidence at start and every 5 minutes; check the server log shows "chat model warm". Pre-ask the demo question and keep talking while it answers.
- [ ] Play the whole replay once on the presentation machine, so map tiles (imagery, terrain, NASA photo) are cached.
- [ ] Browser full screen, at least 1440 px wide. Dispatch open; Crossings and "That day" may open by default on tall screens.
- [ ] "Pause on claims" ticked, so the clock stops on each claim while you speak.
- [ ] Fallback: a screen recording of the 90-second run, ready to play if the network or the model fails.

Keys: **Space** play or pause · **]** next claim · **[** previous claim · **→ / ←** one hour (with Shift: one day). The **?** button lists them. The screen shows "claim N of 27" and "hour N of 504".

How the map responds: hovering an object (aircraft, satellite, ship detection, incident) shows a one-line label; **clicking** it pins full details in the Inspector panel. Area layers (airspace, ship density, satellite footprints) are not clickable; they read out in the fixed line under the map. Timeline dots are clickable and show their claim on hover.

## Likely judge questions

| Question | Answer |
|---|---|
| Where does the data come from, and what did it cost? | All free and public: adsb.lol, Global Fishing Watch, IMF PortWatch, ESA Copernicus, NASA FIRMS and GIBS, Space-Track, official UKMTO and JMIC advisories. Cost: nothing. |
| Is the AI doing the grading? | No, and on purpose. Plain code counts and detects. We set the grades from that evidence, and each claim names its data file. The model explains grades and answers questions from the same evidence. Automating claim extraction and grading is the next step. |
| Why a local model? | The evidence never leaves the machine, which matters for analysts working with sensitive material. |
| How do you avoid hindsight? | Every layer appears only from the hour it existed. Held values show their age. Date-only reports never get a made-up hour. |
| What can't it see? | Individual ship tracks (no free source for the strait). Official airspace notices. Flights over Iraq (no receiver coverage). Several exact times on 28 Feb rest on one source; the replay labels each time's precision. |
| Does it generalise? | Yes. Change the box and the dates; every source is global. Only the story spine is written per event. |
| Why is this hard? | Five kinds of data at different speeds (30 seconds to daily), conflicting providers, GPS spoofing that corrupts ship positions, and commercial imagery withdrawn mid-crisis. |

## If something fails

| Problem | What to do |
|---|---|
| Chat slow or silent | LM Studio is not running or the model is not loaded. Show the grade and evidence on the Dispatch card instead, and say the chat runs locally. |
| Map tiles blank (no internet) | Keep going: the clock, timeline, stats, claims and chat still work. Switch to the recording if the map matters for the point. |
| Wrong moment on screen | Drag the timeline, click a claim dot, or use **[** and **]**. |

## Honest limits

- No individual ship tracks: no free source covers the strait, so ships show as density, detections and incidents.
- No flight coverage over Iraq (no receivers in the archive).
- Ship incident times are report times, not times of impact.
- The 10 March "eight vessels without a broadcast" claim cannot be tested with the data held.
- Airspace outlines are approximate and official notices were not collected.
- One event built by hand; the sources are global, the story spine is per event.

## Things not to say

- Don't say the model graded the claims.
- Don't name a cause of the Minab school strike; it is shown as context only, with contested tolls.
- Don't say ships "turned off their transponders" as fact. Say "went quiet": switched off, spoofed elsewhere or unmatched.
- Don't use 11 to 13 March optical numbers. Zero ships matched to AIS on all three days looks like a data gap.
