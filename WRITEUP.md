# Hormuz Claim Monitor (working title)

**Problem.** In a crisis, news, officials and data providers contradict each other, and nobody can quickly see which claims the evidence supports.

## Why it matters

In March 2026 Iran said Hormuz was closed, CENTCOM said it was open, and the US President later called it open again. Providers disagreed on daily crossings (for 10 March, 2 versus 8) and on which day traffic first hit zero. Insurers cancelled war-risk cover on these claims. The evidence to check them was public, but assembling it for one fortnight took us hours across five sources.

## What it does

A monitor reads claims about the Strait of Hormuz, finds the matching evidence in flight, ship and satellite data, and grades each claim: corroborated, contradicted or unverified. Every verdict shows its sources and what could not be checked yet.

## How it works

1. **Clock.** One switch: wall clock (live) or conflict clock (replay of 14 Feb to 15 Mar 2026 at 1x to 600x).
2. **Evidence store, by availability time.** At time T the agent may only use evidence that existed by T, including real delays: radar 3 to 10 hours after a pass, Global Fishing Watch 3 to 5 days, FIRMS about 3 hours. A claim starts "unverified, radar pass pending" and is re-graded when evidence lands. No look-ahead.
3. **Grader.** Plain code runs the detectors (counts, airspace, GPS accuracy, unmatched radar detections). The model extracts claims, picks which evidence tests them, and writes the verdict.

## Data in hand (as of this writeup)

| Layer | Source | State |
|---|---|---|
| Events | 50 timestamped, sourced, confidence-labelled | Done |
| Ship incidents | 25, from UKMTO and JMIC advisories | Done |
| Daily crossings | IMF PortWatch plus 4 other providers, conflicts kept | Done |
| Ship density | Global Fishing Watch, hourly presence and radar detections | Probed |
| Radar images | Sentinel-1 chips for 28 Feb, 1, 4, 10 and 13 Mar | Fetched, unreviewed |
| Heat | NASA FIRMS | Tested |
| Flights | adsb.lol daily archives, 26 Feb to 14 Mar | Not yet collected; a completeness check is being added |

## Demo (90 seconds)

Play conflict time from 28 Feb. Claims appear and get graded; one flips from "pending" to "contradicted" when radar arrives. Pause, open a verdict, show the evidence and the gap. Flip the clock to live.

## Honest limits

- No free live ship positions for Hormuz (aisstream returned zero vessels in my test).
- The 10 March "eight dark vessels" claim cannot be checked from Global Fishing Watch; it needs our own detection in the Sentinel-1 image.
- Several minute-level times rest on Wikipedia alone.
- One event built by hand; the method generalises, and we say so plainly.

## Decisions for you

- [ ] Name
- [ ] Include casualty events (Minab school) or stay on shipping and airspace
- [ ] Open with replay, or open live
- [ ] Build our own radar ship detector, or demo the 10 March claim as "unverifiable from free data"
