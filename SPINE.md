# Spine: Who closed the strait?

**Problem statement.** In a crisis, news, official statements and open data tell conflicting stories, so we built an agent that replays the Hormuz crisis on one timeline and grades every claim against flight, ship and satellite data.

**Through-line question.** Nobody formally closed the Strait of Hormuz, yet traffic went from about 100 crossings a day to almost none. What closed it?

**Working thesis (to be confirmed by the build, not asserted).** The strait closed as a cascade, not a decision: radio threats, then attacks on ships, then insurers withdrawing cover, then a fog of GPS interference. Traffic fell before any declaration and stayed near zero whatever officials said.

**Window.** 24 Feb to 16 Mar 2026, on a 1-hour tick. All times UTC.

## The clock

The whole story runs on one uniform tick of **1 hour** (decision D10).

- **Range:** tick 0 is 24 Feb 00:00 UTC; tick 503 is 16 Mar 23:00 UTC (21 days, 504 ticks).
- **Label:** each tick shows its UTC date and hour, for example "28 Feb, 09:00".
- **Playback:** speed varies by scene; the tick never does (D12).

How each layer maps onto the tick:

| Layer | Native resolution | Kind | Rule on the 1-hour clock |
|---|---|---|---|
| Flights | 30 seconds | State | Aggregated into each tick: distinct airborne aircraft per region; positions can animate inside the tick. |
| Ship presence (AIS, Global Fishing Watch) | 1 hour | State | One value per tick. |
| Radar ship counts | One pass every 1 to 6 days per track | State | Held for every tick until the next pass on the same track (D10), with the age of the value shown ("radar, 31 hours ago"). |
| Daily crossings (IMF and others), stopped ships per day | 1 day | State | Day band across all 24 ticks of that day (D11). |
| GPS-interference reports | Mostly date only | State | Day band. |
| Satellite captures | Minute | Event | Appears in the tick that contains it; footprint flashes, then fades. |
| Heat detections (FIRMS) | Overpass minute | Event | Appears in its tick, persists as a marker. |
| Ship incidents | Report time (20 of 25), else date | Event | Its tick when timed; day band when date only. |
| News and statements | Clock time (15 of 50), else date | Event | Its tick when timed; day band when date only. |

Every item carries a precision label: "minute", "hour", "date only" or "time contested". The narrator never states a time more precisely than its label allows.

A **scene** is a run of consecutive ticks grouped under one common event. Beats belong to scenes; scenes belong to chapters.

## Structure: one linear pass, themes as lanes

The clock runs once, from tick 0 to tick 503 (decision D14). Themes do not get their own chapters; they are **lanes** that light up when their beats arrive, so everything stays in time order.

| Lane | What it carries |
|---|---|
| Airspace | Flights: regional airborne counts, closures. |
| Attacks | Strikes, retaliation, attacks on ships, radio threats. |
| Insurance | War-risk cover, US insurance and reinsurance. |
| Fog | Radar ship counts, GPS interference, ships going quiet. |
| Claims | Official statements, each graded against the day's crossing count. |

**Always on, every tick (D15):** satellite captures, flights, ship presence, and the clock with its day band. Held values show their age and fade until refreshed (D16).

### Scenes

A scene groups consecutive ticks under one common event. Tick numbers count hours from 24 Feb 00:00 UTC. Seconds per tick is a first draft; the clock pauses on each beat while its line is read.

| Scene | Ticks | UTC | Common event | Seconds per tick | Beats (lane) |
|---|---|---|---|---|---|
| SC01 | 0 to 95 | 24 Feb 00:00 to 27 Feb 23:00 | Talks continue; ships already leaving | 0.05 | 0.1 (Claims) |
| SC02 | 96 to 101 | 28 Feb 00:00 to 05:00 | Last radar look before the war | 0.5, hold at tick 98 | 0.2 (Fog) |
| SC03 | 102 to 104 | 28 Feb 06:00 to 08:00 | Strikes begin; Iran goes dark; the satellites keep coming | 3 | 1.1 (Attacks), 1.2 (Airspace), 1.5 (Fog) |
| SC04 | 105 to 107 | 28 Feb 09:00 to 11:00 | Iran retaliates; the Gulf empties | 3 | 1.3 (Airspace, Attacks) |
| SC05 | 108 to 119 | 28 Feb 12:00 to 23:00 | "No ship may pass" | 0.3 | 2.1 (Attacks), GPS interference begins (Fog) |
| SC06 | 120 to 143 | 1 Mar | First tankers hit; insurers move; ships stop | 0.3 | 2.2, 2.3, 2.4 (Attacks), 3.1 (Insurance), 4.4 (Fog) |
| SC07 | 144 to 167 | 2 Mar | "The strait is closed" | 0.3 | 5.1 (Claims) |
| SC08 | 168 to 263 | 3 to 6 Mar | The paperwork | 0.1 | 1.4 (Airspace), 3.2, 3.3 (Insurance), 5.2, 5.3 (Claims) |
| SC09 | 264 to 335 | 7 to 9 Mar | The fog thickens | 0.1 | 4.2 (Fog), 5.4 (Claims) |
| SC10 | 336 to 359 | 10 Mar | Eight ships without a signal | 0.2, hold at tick 350 | 4.3 (Fog) |
| SC11 | 360 to 407 | 11 to 12 Mar | A new leader's vow | 0.1 | 5.5 (Claims), ship attacks (Attacks) |
| SC12 | 408 to 455 | 13 to 14 Mar | Kharg is bombed; the first "zero" | 0.15 | 6.1 (Claims) |
| SC13 | 456 to 503 | 15 to 16 Mar | The ships that stayed | 0.15, hold on the last tick | 5.6 (Claims), 4.1 (Fog), 6.2, 6.3 (final line) |

Clock time without pauses is about 100 seconds; with a pause on each of the 27 beats, the full replay runs about 3 minutes. A 90-second demo cut is a separate decision.

## How to read a beat

Each beat has five parts:

- **Time:** when it happens on the replay clock.
- **Narrator:** a draft line, sober and attributed.
- **Claim:** what someone asserted, if anything.
- **Evidence:** the data that tests it, with the file it lives in.
- **Grade:** how the claim stands against the evidence.

Grades:

| Grade | Meaning |
|---|---|
| Corroborated | Independent data shows it. |
| Consistent | Data fits it, but cannot prove it (for example, cause and effect). |
| Reported only | No data we hold can test it. |
| Contested | Sources disagree with each other. |
| Contradicted | Data shows otherwise. |

Visual is noted where the beat needs a specific map state.

## Beat catalogue, cold open: the strait empties before the first bomb (scenes SC01, SC02)

| # | Time | Narrator | Claim | Evidence | Grade |
|---|---|---|---|---|---|
| 0.1 | 24 to 27 Feb | "Talks in Geneva were still going. The ships were already leaving." | Oman reports "significant progress" in talks (26 Feb). | IMF daily crossings: 93, 116, 89, then 64 on 27 Feb (`hormuz_daily_counts.csv`). | Consistent with a pre-war exodus |
| 0.2 | 28 Feb, 02:15 | "Four hours before the first strike, a radar satellite passed overhead." | none | Track A radar ships per open-sea unit: 87 and 99 in mid-February, 54 on this pass (`radar_summary.csv`). | Corroborated (decline already under way) |

Visual: the strait at night, density fading across four days, then the radar chip.

## Beat catalogue, Airspace lane (scenes SC03, SC04, SC08)

| # | Time | Narrator | Claim | Evidence | Grade |
|---|---|---|---|---|---|
| 1.1 | about 06:00 | "Explosions are reported in Tehran." | Strikes begin; exact time contested (about 05:57 to 06:30). | `timeline.csv` E005 to E007. | Contested (time) |
| 1.2 | 06:00 to 08:00 | "Within an hour, the sky over Iran is empty." | Iran closes its airspace (logged about 07:25). | Airborne aircraft over interior Iran per hour: 17 at 06:00, 1 at 07:00, 0 from 08:00 (`flights/2026-02-28`). | Corroborated |
| 1.3 | 08:00 to 11:00 | "The Gulf holds for another two hours. Then Iran fires back, and the Gulf empties too." | Iran retaliates against Gulf bases about 09:00; eight states close airspace. | Airborne aircraft over Gulf states per hour: 196 at 08:00, 84 at 09:00, 17 at 10:00, 4 at 11:00, 0 at 12:00. | Corroborated |
| 1.4 | 26 Feb to 3 Mar | "Two days earlier, more than 1,600 aircraft crossed Gulf airspace in a day. By 3 March, fewer than 200." | none | Distinct airborne aircraft over Gulf states: 1,606 (26 Feb), 887 (28 Feb), 192 (3 Mar). | Corroborated |

Visual: two-wave collapse; Iran goes dark first, the Gulf second. This is the opening shot of the demo.

## Beat catalogue, Attacks lane (scenes SC05, SC06)

| # | Time | Narrator | Claim | Evidence | Grade |
|---|---|---|---|---|---|
| 2.1 | 28 Feb | "Ships hear a radio message: no vessel may pass. No formal closure is ever declared." | IRGC VHF broadcasts (Reuters, EU naval official). | `timeline.csv` E017. | Reported only |
| 2.2 | 28 Feb to 2 Mar | "Crossings fall from 57 to 20 to 4. Tankers fall from 36 to 1." | none | IMF daily crossings and tanker crossings. | Corroborated |
| 2.3 | 1 Mar | "The first tankers are hit." | Skylight, MKD Vyom, Hercules Star struck. | `ship_incidents.csv` (official advisories, with positions). | Corroborated (official reports) |
| 2.4 | 1 Mar | "Ships stop and wait." | At least 150 tankers at anchor in the Gulf (MarineTraffic via Reuters). | Vessels in the strait box fall from 477 (28 Feb) to 313 (1 Mar) and 278 (2 Mar) (`gfw_probe_presence.json`). | Consistent |

Visual: incident markers appear; density thins.

### Context markers (no narration)

Casualty events appear as muted markers in the Attacks lane, each with a one-line note, its source and its precision label (decision D18). The narrator does not voice them, and the clock does not pause for them.

| Marker | Tick | Note | Source | Precision |
|---|---|---|---|---|
| C1 | 28 Feb, 07:00 (tick 103) | Missile hits a girls' school in Minab, beside an IRGC base; reported tolls 153 to 182; a preliminary US inquiry reportedly pointed to a US targeting error. | `timeline.csv` E009 | Time single source (Wikipedia); toll contested |
| C2 | 7 Mar, 22:00 (tick 286) | Israel strikes Tehran-area fuel depots; FIRMS heat detections at about 22:00 UTC on 7, 8 and 9 Mar. | `timeline.csv` E037; FIRMS | Date contested (6, 7 or 8 Mar); detections to the minute |

## Beat catalogue, Insurance lane (scenes SC06, SC08)

| # | Time | Narrator | Claim | Evidence | Grade |
|---|---|---|---|---|---|
| 3.1 | 1 Mar | "Then the insurers move." | War-risk cover cancelled; effective 2 Mar (Windward) or 5 Mar (Al Jazeera). | `timeline.csv` E022, E030. | Contested (date) |
| 3.2 | 2 to 6 Mar | "Crossings: four, four, zero, three, two." | none | IMF daily crossings. | Corroborated |
| 3.3 | 3 and 6 Mar | "Washington offers insurance, then up to 20 billion dollars of reinsurance. Traffic does not come back." | US political-risk insurance (3 Mar), reinsurance (6 Mar). | Crossings after 6 Mar stay between 0 and 3 a day. | Consistent |

Narrator caution: the data cannot separate fear of attack from loss of cover. The agent must say so.

## Beat catalogue, Fog lane (scenes SC02, SC05, SC09, SC10, SC13)

The radar leads this lane (decision D8): its first beat in time is the pre-strike pass (0.2), and its climax is 4.1 in the last scene.

| # | Time | Narrator | Claim | Evidence | Grade |
|---|---|---|---|---|---|
| 1.5 | 28 Feb, 06:00 to 08:00 | "While the sky emptied, the satellites kept coming. In the first two hours of the strikes, seven passed over the Gulf. Two are on record taking pictures." | none | Recorded orbits (Space-Track) over the Gulf: Sentinel-3A 06:22, Landsat 8 06:46, Pléiades Neo 3 06:50, Sentinel-2B 06:52, Sentinel-2A 06:54, WorldView-2 07:02, WorldView-3 07:14 (`sat_tracks.json`). Captures on record (Copernicus catalogue): Sentinel-3A from 06:16, Sentinel-2B in a 41-tile strip from 06:37 (`satellite_passes.csv`). Whether the commercial satellites were tasked to image is not public. | Corroborated (passes and two captures; commercial imaging unknown) |
| 4.4 | 28 Feb to 16 Mar | "From the first day of the war, ships start reporting positions on dry land. In the four days before, none did." | Windward: ships shown at airports, on land and inside Iran during the interference (28 Feb to 2 Mar). | Ship-density cells wholly on land, beyond the 28 seen before the war (ports and rivers): 0 a day on 24 to 27 Feb; 48 on 28 Feb; 86 on 1 Mar; 84 on 2 Mar; 28 to 81 a day through 16 Mar. Most sit inland in the UAE, south of Abu Dhabi and Dubai (`ship_density.json`). The four-day baseline is short, and this does not test how many ships were affected or who caused it. | Corroborated (false positions on land; cause and ship count untested) |
| 4.1 | 15 Feb to 16 Mar | "The ships did not leave. They went quiet." | none | Gulf of Oman: ships broadcasting AIS fall from about 1,100 a day to 450 to 560; stopped ships (under 2 knots) from about 850 to 300 to 340 (`gfw_gulf_of_oman_*.json`). On full-coverage radar passes, ships physically present stay at 354 to 386 (`gfw_sar_gulf_of_oman_all.json`). | Corroborated (broadcasts halve while radar counts hold) |
| 4.2 | 28 Feb to 7 Mar | "Those still broadcasting are not where they say they are. Ships appear on land and move at impossible speeds." | GPS interference: about 1,100 vessels in the first 24 hours, more than 1,650 by 7 Mar (Windward); more than 600 disruption events in 24 hours on 10 Mar (JMIC). | `gnss_interference.csv`. Aircraft accuracy fields in flight data (not yet analysed). | Reported only (until aircraft data is analysed) |
| 4.3 | 10 Mar, 14:16 | "A radar pass finds eight large vessels with no broadcast." | Windward. | Our own chip of that pass shows 33 ships in the Hormuz box, but we hold no broadcast positions for that hour. | Reported only |

Visual: the broadcast picture thins while radar footprints keep flashing and the ships they see stay put. Then the radar chip with detections circled.

Caution: radar figures compare passes with similar coverage only; passes covering a small part of the gulf (1 to 100 ships) are excluded. The AIS-match share from Global Fishing Watch is noisy (97% unmatched on 23 Feb, before the war), so the chapter rests on counts, not on the match share. "Went quiet" covers AIS switched off, spoofed positions and matching failures; the narrator does not pick one.

## Always-on layer: the satellites kept watching

When planes and ships went silent, satellites did not. Across the whole window, Sentinel-1, Sentinel-2 and Sentinel-3 captured the theater 7 to 10 times a day (1,432 image products, 24 Feb to 15 Mar; `events/satellite_passes.csv`, `data/satellites/acquisitions.geojson`).

- **On the map:** each capture appears as its footprint at its exact time, then fades. Radar passes are where ships can be counted regardless of broadcasts.
- **In the narration:** the satellite layer is the witness that does not switch off. Lines such as "At 14:16, a radar satellite passed overhead" introduce each radar-based beat.
- **Evidence it carries:** radar ship counts (Hormuz box, Gulf of Oman), heat detections (FIRMS, Sentinel-3), and image chips.

## Beat catalogue, Claims lane (scenes SC07 to SC13)

One statement per beat (decision D9), each in its own tick or day band. Each beat follows the same rhythm: the statement appears with its speaker and date, the day's crossing count lands beside it, then the grade.

| # | Date | Narrator | Claim | Evidence | Grade |
|---|---|---|---|---|---|
| 5.1 | 2 Mar | "Tehran says the strait is closed. The US military says it is open. Four ships crossed that day." | IRGC adviser Jabari: "The strait is closed." CENTCOM reportedly: still open. | IMF crossings: 4. | Contested (the two statements contradict each other; the count fits neither cleanly) |
| 5.2 | 4 Mar | "The Revolutionary Guard claims full control. That day, no ship crossed at all." | IRGC claims full control of the strait. | IMF crossings: 0. | Consistent |
| 5.3 | 5 Mar | "Iran narrows the claim: closed only to American, Israeli and allied ships. Three ships crossed." | IRGC: closed only to US, Israeli and allied ships. | IMF crossings: 3. Windward on 8 Mar: both crossings Iranian-flagged. | Consistent |
| 5.4 | 9 Mar | "The US President says the strait is open. Two ships crossed." | Trump: the strait is "open". | IMF crossings: 2, against about 100 a day before the war. | Contradicted (open in law, not in practice) |
| 5.5 | 12 Mar | "Iran's new supreme leader vows to keep it closed. One ship crossed." | Mojtaba Khamenei's first statement. | IMF crossings: 1. | Consistent |
| 5.6 | 15 Mar | "Iran's foreign minister: open, except to the US and Israel. Seven ships crossed." | Araghchi. | IMF crossings: 7. | Consistent |

Closing line of the chapter: "Each side described a different strait. The counts describe one."

Narrator caution: "consistent" means the count fits the statement, not that the statement caused the count.

## Beat catalogue, ending (scenes SC12, SC13)

| # | Time | Narrator | Claim | Evidence | Grade |
|---|---|---|---|---|---|
| 6.1 | 13 to 14 Mar | "The US bombs Kharg Island. The next day, a tracker reports the first day with no crossings at all." | Windward: zero AIS-confirmed transits on 14 Mar. | IMF: zero on 4 and 13 Mar, one on 14 Mar. S&P (via JMIC): three on 14 Mar. | Contested |
| 6.2 | 15 to 16 Mar | "Even 'zero' depends on who is counting. And the ships did not leave: radar still sees about 360 of them in the Gulf of Oman." | About 400 ships wait in the Gulf of Oman (Windward, CNBC). | Radar ships on full-coverage passes over the Gulf of Oman: 372 (20 Feb), 386 (4 Mar), 354 (7 Mar), 364 (16 Mar) (`gfw_sar_gulf_of_oman_all.json`). | Corroborated (order of magnitude) |

| 6.3 | 16 Mar, 23:00 (last tick) | "Who closed the strait? No one declared it closed. The data shows a cascade: threats, then attacks, then insurers, then fog. Grade: consistent, not proven." | Working thesis (see top). | The beats above, by lane: radio threats (2.1), attacks (2.3), insurance (3.1 to 3.3), fog (4.1, 4.2), and the claims lane. | Consistent, not proven |

The final line is a graded question, not an assertion (decision D17): the tool grades its own thesis the way it grades everyone else's. A closing card follows with one line on what came next (ceasefire in April, fighting resumed in July), framed as a chapter, not an ending.

## Decisions needed on the spine

- [x] Keep the cold open (24 to 28 Feb), which starts the story before the war. Decided 2026-11-22 (D7).
- [x] Chapter 4 leads with the radar. Decided 2026-11-22 (D8).
- [x] Chapter 5 is one statement per beat. Decided 2026-11-22 (D9).
- [x] Final line is a graded question. Decided 2026-11-22 (D17).
- [ ] Seconds per tick and beat pauses for each scene (draft above).
- [ ] A 90-second demo cut: which scenes it keeps.
- [x] Casualty events appear as muted context markers, not narrated. Decided 2026-11-22 (D18).

## Evidence gaps that affect the spine

- No individual ship tracks; ships are shown as density, radar detections and incidents (decision D6).
- Aircraft GPS-accuracy analysis not yet done; beat 4.1 is "reported only" until it is.
- Flight data has no coverage over Iraq.
- Ship incident times are report times, not times of impact.
- Several exact times on 28 Feb rest on Wikipedia alone.
- Dubai's daily flight counts (1,257 to 20) are reported by Flightradar24 and not yet checked against our data.
