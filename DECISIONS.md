# Decision register

| # | Date | Decision | Why | Alternatives rejected |
|---|---|---|---|---|
| D1 | 2026-11-22 | Theater is the Strait of Hormuz, 28 Feb to 14 Mar 2026 (opening of the US-Israeli war on Iran). | A real, contested event with free flight, ship and satellite coverage. | Singapore Strait (live, but no story); Hormuz live (no free ship feed). |
| D2 | 2026-11-22 | Format is a data documentary: narrated timeline where news, statements and data move on one clock, and an agent grades each claim. | Explanation with evidence; the agent does real work (alignment, grading, gaps). | Command-centre dashboard; plain map replay. |
| D3 | 2026-11-22 | Story is arc A, "Who closed the strait?", six chapters: Day zero, The warning, The paperwork, The fog, Claims versus counts, Zero. | Strongest conflict between claims and data. | Arc B (the sky went first), arc C (you could see it coming). |
| D4 | 2026-11-22 | Keep all 17 flight days, 26 Feb to 14 Mar, but optimise for time. | Full window for the replay. | Trim to 4 key days. |
| D5 | 2026-11-22 | Collect FIRMS heat detections. | Optional context for the Tehran depot fires. | Skip FIRMS. |
| D6 | 2026-11-22 | Ships are shown as density (Global Fishing Watch), radar detections and incident markers, not individual tracks. | No free per-vessel history exists for the strait; the story is the strait emptying, which density, counts and radar show. | Datalastic paid trial (unverified depth, cost and licence). |
| D7 | 2026-11-22 | Keep the cold open: the story starts 24 Feb, before the war, with crossings already falling and the pre-strike radar pass. | It is the strongest hook and the data carries it (IMF counts, track A radar). | Start on 28 Feb. |
| D8 | 2026-11-22 | Chapter 4 leads with the radar: ships stayed while broadcasts halved; GPS interference follows as the explanation. | Best-evidenced idea in the story; GPS beat is reported only. | Lead with GPS interference. |
| D9 | 2026-11-22 | Chapter 5 gives each official statement its own beat: statement, that day's crossing count, then the grade. | Clearer grading; each claim gets its moment. | One fast montage of all six statements. |
| D10 | 2026-11-22 | The story runs on a uniform 1-hour tick. Data coarser than an hour is held: a value stays on screen for every tick until the next value arrives (for example, a 2-hourly value shows in hours 1 and 2 and changes in hour 3). | Finest unit two continuous layers support (flights, hourly ship presence); keeps the 28 Feb two-wave collapse. | 30 minutes, 3 hours, 1 day. |
| D11 | 2026-11-22 | Date-only items (no clock time) are shown as a day band across all 24 ticks of their day, marked "date only". | Never implies a false hour. | Pin to 12:00 UTC; pin to day start. |
| D12 | 2026-11-22 | Playback speed varies by scene; the tick never changes. Dense scenes play one tick at a time, quiet stretches fast-forward. | 504 ticks at constant speed would drag. | Constant speed. |
| D13 | 2026-11-22 | Flights extended to 24 Feb to 16 Mar (21 days) so every layer covers every tick. | Cold open and last days need flights. | Keep 26 Feb to 14 Mar. |
| D14 | 2026-11-22 | One linear pass over the clock; former chapters become lanes (Airspace, Attacks, Insurance, Fog, Claims) that light up as their beats arrive. Scenes group consecutive ticks under one event. | Everything stays in time order; overlapping chapters would break a single clock. | Chapters that rewind; one linear pass with re-cut chapters. |
| D15 | 2026-11-22 | Always on, every tick: satellite captures, flights, ship presence, clock with day band. | The silent layers and the watching satellites are the story. | Scene-specific layers only. |
| D16 | 2026-11-22 | Held values show an age label and fade until the next value refreshes them. | Honest about stale data. | Age label only; no marking. |
| D17 | 2026-11-22 | The final line poses the through-line question and grades the thesis: "consistent, not proven". | The tool grades its own thesis the way it grades everyone else's; the data supports but cannot prove the cascade. | State the thesis outright. |
| D18 | 2026-11-22 | Casualty events (Minab school strike, Tehran fuel depots) appear as muted context markers in the Attacks lane, with source and precision, not narrated. | A tool built on not overclaiming should not drop the hardest facts; muted markers keep the tone sober. | Leave them out. |
| D19 | 2026-11-22 | Radar positions expire fast: a pass's image and ship blips show in the pass hour and fade out over the next 2 hours. The radar count gauge stays held until the next pass, with its age (refines D16). | A blip is a snapshot of seconds; a ship at 12 knots is 20 km away within an hour, so an old blip implies a present position we do not know. A count stays valid as a past fact. | Hold blips until the next pass (up to 6 days). |

## Open decisions

- [ ] Buildathon logistics: date, length, solo or team, pre-collected data allowed.
- [ ] Stack: web app with map, or narrated video plus live Q&A panel.
- [ ] Narration: text only, or text plus synthesised voice.
- [ ] Delivery: local only, or hosted for judges.
