# Ships dataset: 28 Feb to 15 Mar 2026

Built 2026-11-22. Everything here is what a named source states; nothing is inferred except where a note says so.

## Files

| File | Rows | Content |
|---|---|---|
| `ship_incidents.csv` | 25 | 20 vessel rows for UKMTO incidents 004-26 to 022-26 (021-26 has two tankers), plus 5 non-UKMTO rows (Sea La Donna, Prima, Louis P, Athe Nova, IRIS Dena) |
| `hormuz_daily_counts.csv` | 326 | IMF PortWatch 177 (1 Feb to 31 Mar), S&P via JMIC tables 97, Windward 33, JMIC narrative 15, S&P direct 4 |
| `gnss_interference.csv` | 18 | JMIC 9, Windward 7, UKMTO 2 |

Raw material is in `data/ships/`: `jmic/` (16 PDFs), `ukmto/` (28 PDFs), `mscio/` (10 PDFs), `portwatch/` (raw JSON and a flat CSV), `windward/` (18 saved HTML pages).

## How it was obtained

- **JMIC, UKMTO, MSCIO PDFs**: all from the public folder listings linked on `https://mscio.eu/advisories/` (direct file URLs under `https://mscio.eu/media/documents/`). `ukmto.org` returned HTTP 403 for every request.
- **Text extraction**: these PDFs do have a text layer. Text was read with PyMuPDF (`page.get_text()`); **no OCR was used**, so there are no OCR-derived numbers. The remaining risk is table layout: the text layer emits table cells one per line, and a script reassembled the S&P transit tables by position. Maps and charts inside the PDFs are images and were not digitised.
- **Spot checks against rendered page images** (all matched): the full S&P cargo and tanker tables for 9 to 15 Mar in JMIC Update 016 p.3 (42 Hormuz cells); the 28 Feb to 5 Mar tables in Update 006 p.3, including the anomalous tanker total of 3 for 5 Mar; MSCIO Annex A coordinates for events 1 to 6; vessel names on the UKMTO sitrep maps in Update 016 pp.9-10.
- **IMF PortWatch**: public ArcGIS REST query on `Daily_Chokepoints_Data` (`services9.arcgis.com/weJ1QsnbMYJlCHdG`), `portname='Strait of Hormuz'`, 59 daily records, no login.
- **Windward**: blog pages fetched directly; slugs found through the site's post sitemap.

## Incident fields: where each comes from

- Date, time, position text, narrative: the UKMTO warning itself. `time_utc` is UKMTO's **"Report Time"**, which is not a stated time of impact.
- Vessel name and type: JMIC (UKMTO notices never name the vessel).
- `lat`/`lon`: MSCIO Advisory 01_2026 Update 09 (13 Mar) Annex A, given in degrees-minutes and converted to decimal. MSCIO does not cite UKMTO numbers, so each event was matched by date and description. That matching is mine.
- Flag, and IMO for incidents 009 onward: Windward's attack list (22 Apr 2026).

## JMIC coverage

| Date | Document | Status |
|---|---|---|
| 28 Feb | Advisory Note 001-26 (19:35 UTC) | obtained; no incidents, no counts |
| 1 Mar | Update 01 | obtained |
| 2 Mar | Update 002 | obtained (header date garbled in the PDF; body covers 2 Mar) |
| 3 Mar | Update 003 | obtained; incident section says "NTR" |
| 4 Mar | Update 004 | **missing**: not in the mscio.eu listing, guessed URLs 404, ukmto.org 403 |
| 5 to 16 Mar | Updates 005 to 016 | obtained, one per day |

## Gaps

- **JMIC Update 004 (4 Mar)**. Incidents 009 to 012 are therefore named only through later JMIC lists.
- **UKMTO**: no notice numbered 001 to 002 was sought; within the window the series 003-26 to 022-26 is complete on mscio.eu. 023-26 (16 Mar 2301 UTC, tanker off Fujairah) is downloaded but outside the window and not in the CSV.
- **Windward**: no daily post exists for 1, 6, 7, 13 or 14 Mar. So there is no stated Windward total for 1, 5, 6, 12 or 13 Mar. Figures implied by percentage changes (18 on 1 Mar, 4 on 6 Mar) are mentioned in notes only, not entered as rows.
- **S&P Global direct**: both articles returned HTTP 403. The four S&P direct rows (9 to 12 Mar) come from search-engine snippets and are marked UNVERIFIED.
- **Lloyd's List, Kpler**: no daily series found. Only aggregates via AFP (18 Mar): Kpler 105 commodity-carrier crossings for 1 to 18 Mar, 60 of them oil and gas tankers; Lloyd's List baseline of about 120 transits a day. Not entered as rows.
- **Talara**: every source found dates its seizure to mid-November 2025, outside the window. Not included.
- No source gives a time of impact, as opposed to a report time, for any incident.

## Main conflicts (all kept and flagged in `notes`)

- **Daily counts disagree by provider and definition.** For 1 Mar: PortWatch 20, S&P via JMIC 21 (18 cargo + 3 tanker), JMIC narrative ~28. For 10 Mar: PortWatch 2, Windward 2, S&P via JMIC 8. For 14 Mar: Windward 0, PortWatch 1, S&P via JMIC 3. Baselines also differ: JMIC ~138 a day, Lloyd's ~120, Windward 70 to 80.
- **S&P direct vs S&P as printed by JMIC**: 9 Mar 3 vs 1, 11 Mar 7 vs 1, 12 Mar 1 vs 5 (10 Mar agrees at 8). The direct figures are unverified.
- **JMIC internal**: tanker total for 5 Mar is 3 in Update 006 and 2 from Update 007 on. Narrative counts in Updates 014 and 015 do not match their own tables.
- **JMIC incident list reference numbers** for Skylight, Hercules Star, Ocean Electra and MKD Vyom are garbled ("004-36", "006-36 UKMTO 005-26"). The UKMTO notices were used for numbering.
- **IMO numbers**: Hercules Star 9295531 (JMIC) vs 9916135 (Windward); Ocean Electra 9591466 (JMIC) vs 9402782 (Windward).
- **UKMTO 016-26 (7 Mar, off Jubail)**: JMIC and MSCIO say the drilling rig Arabia III; the IRGC claimed a tanker, Louis P, at the same place and time.
- **Mussafah 2 casualties**: three missing (Windward 8 Mar), at least four dead (Windward 22 Apr), possibly eight (Maritime Executive, unconfirmed).
- **Sonangol Namibe**: oil leak (JMIC, Windward) vs ballast water (UKMTO update of 5 Mar).
- **ONE Majesty**: 10 Mar vs 11 Mar; "25NM NW of Ras al Khaymah" (UKMTO) vs "50nm northwest of Dubai" (JMIC Update 011).
- **Stena Imperative**: 1 Mar (JMIC list) vs 2 Mar 0257 UTC (UKMTO); direct strike vs interception debris.
- **Attribution**: UKMTO and JMIC never name an attacker. MSCIO says all 19 events are "HIGHLY LIKELY" Iranian. Windward states Iranian attribution for several.

## Not verified

- Prima, Louis P, Athe Nova and Sea La Donna have no UKMTO, MSCIO or (after 1 Mar) JMIC confirmation. Louis P's flag and IMO come from a search summary only.
- IRIS Dena rests on Windward alone here; primary statements were not checked.
- The MSCIO position for Star Gwyneth (26-00N 055-47E) does not look like "50NM northwest of Dubai"; recorded as printed.
- PortWatch values are as served on 2026-11-22 and may have been revised since March.
- `date_utc` for JMIC "past 24 hours" counts is set to the day before the update date; JMIC gives no cut-off time.
