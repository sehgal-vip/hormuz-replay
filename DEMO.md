# What the Hormuz Demo script

## Elevator pitch (about 1 minute)

For when there's no screen, or before the demo starts.

"On the 9th of March 2026, the US President said the Strait of Hormuz was open. That day, two ships crossed. Before the war, it was about a hundred.

A fifth of the world's oil moves through that strait. Insurers, shipping desks and analysts had to act on claims like that one, every day, for three weeks. The evidence to check them was public the whole time: flight archives, ship tracking, radar and optical satellites.

In the fog of war, data exists, opinions exist, insights do not.

So we built a replay of the crisis. Three weeks on one hourly clock, with news, flights, ships and satellites moving together. Nothing appears before the hour it existed. Plain code does the counting and every one of 27 claims gets a grade against the data, from corroborated to contradicted. And a model running on this laptop answers questions from that evidence only, so nothing leaves the machine.

It cost nothing to run. Change the map and the dates, and it works for any crisis with public data."

---

**Runtime:** about 2 minutes 30 seconds. Optional inserts add a minute.
**Reading it:** lines in quotes are spoken. Lines in square brackets are what you do on screen. Times are a guide, not a stopwatch.
**Before you start:** the app is open at 24 Feb, 00:00, full screen, Dispatch panel open, "Pause on claims" ticked, chat warmed up. Checklist, keys and fallbacks are in DEMO-NOTES.md.

---

## 1. The problem (0:00 to 0:20)

[Screen: the app at 24 Feb, 00:00. Don't touch anything yet.]

"On the 2nd of March, Iran said the Strait of Hormuz was closed. The US military said it was open.

A week later, the US President said it was open again. That day, two ships crossed. Before the war, it was about a hundred.

Insurers, shipping desks and analysts had to act on claims like these. The evidence to check them was public the whole time. Nobody could see it in one place."

## 2. What we built (0:20 to 0:40)

[Press **]**. The screen shows claim 1 of 27.]

"So we built this. The crisis replayed hour by hour: three weeks, five hundred and four hours. News, official statements, aircraft, ships and satellites, all on one clock. And every claim gets a grade against the data.

Watch the ships. They were leaving before the first bomb. A hundred and sixteen crossings on the 25th of February. Sixty-four on the 27th."

[Point at the crossings figure in the strip at the top of the map.]

## 3. Day zero (0:40 to 1:05)

[Press **]** three times, to claim 4: 28 Feb, 07:00. Press **Space** and let it play to 11:00.]

"The 28th of February. Strikes begin around six in the morning.

Within an hour, the sky over Iran is empty.

The Gulf holds for two more hours. Then Iran fires back, and the Gulf empties too. A hundred and ninety-six aircraft at eight. Four by eleven."

[Press **Space** to pause.]

## 4. The satellites kept watching (1:05 to 1:20)

[Click a gold satellite trail. The Inspector panel shows the pass.]

"While the planes and ships went quiet, the satellites kept coming. Seven to ten passes over this theater every day.

This one is Sentinel-1A, a radar satellite, at 02:14. Four hours before the first strike."

## 5. Claims against counts (1:20 to 1:35)

[Click the timeline dot for claim 20: 9 March. Point at the grade stamp on the Dispatch card.]

"Here is how the grading works. On the 9th of March, the US President says the strait is open.

Two ships crossed that day.

Our grade: contradicted. Open in law, not in practice."

## 6. Ask the evidence (1:35 to 1:55)

[Click the chat icon at the bottom-right corner of the map. Type: "Was the strait open on 9 March?" and press Enter.]

"A judge can stop the clock at any hour and ask a question.

This answer comes from a model running on this laptop. It only uses the replay's evidence, and it names its sources. Nothing leaves the machine."

[When the answer appears, about three seconds, read its first sentence aloud. Close the chat.]

## 7. The ships went quiet (1:55 to 2:10)

[Click the timeline dot for claim 25: 16 March.]

"And the ships did not leave.

Radar still sees about three hundred and sixty of them in the Gulf of Oman. But the number broadcasting their position halved.

They went quiet."

## 8. How it works (2:10 to 2:25)

[Leave the map on screen.]

"How it works. Free, public data from ten kinds of source: flight archives, ship tracking, radar and optical satellites, NASA, official maritime advisories.

All of it on one hourly clock. Nothing appears before it existed, and old values show their age.

Plain code does the counting. Every grade points to the data that tests it. The model only explains, from that evidence."

## 9. Close (2:25 to 2:35)

[Press **]** twice, to claim 27: the last hour.]

"So, who closed the strait? No one declared it closed.

The data shows a cascade: threats, then attacks, then insurers, then fog.

Our grade: consistent, not proven.

Change the map and the dates, and it works for any crisis with public data. Thank you."

---

## Optional inserts

Use these if you have more time or a judge asks. Each one slots in after section 5.

### A. Airspace closes (about 20 seconds)

[Click the timeline dot for claim 6: 28 Feb, 09:00. Move the pointer over a darkened region; its status and source show in the line under the map.]

"Eight states close their airspace in a single day. Oman is contested: two sources disagree. Saudi Arabia stays open, under a European conflict-zone warning. Every region carries its source."

### B. Ships on dry land (about 20 seconds)

[Click the timeline dot for claim 12: 1 March. Point at the amber outlines in the ship-density grid.]

"From the first day of the war, ships start reporting positions on dry land. In the four days before, none did. Forty-eight such spots on the 28th of February, eighty-six on the 1st of March, mostly inland in the UAE.

The false positions are corroborated. Who caused them, we don't claim."

### C. The paperwork (about 20 seconds)

[Click the timeline dots for claims 11, 17 and 18 in turn.]

"On the 1st of March, insurers cancel war-risk cover. Washington offers twenty billion dollars of reinsurance. Crossings stay at zero to three a day.

The data can't tell fear of attack apart from loss of cover, and we say so."

### D. A claim we can't check (about 20 seconds)

[Click the timeline dot for claim 21: 10 March, 14:00.]

"On the 10th of March, a tracker reported eight large ships with no broadcast, seen by radar at 14:16. We have the radar image. We don't have the broadcast positions for that hour.

So the grade is: reported only. The tool says what it can't prove."

### E. When was zero? (about 15 seconds)

[Click the timeline dot for claim 23.]

"Even zero is disputed. Three data providers give three different dates for the first day no ship crossed. The grade: contested."

---

## If a judge asks

Short spoken answers. The full table is in DEMO-NOTES.md.

**"Is the AI doing the grading?"**
"No, on purpose. Plain code counts and detects. We set each grade from that evidence, and each claim names its data. The model explains. Automating the grading is the next step."

**"Where's the data from, and what did it cost?"**
"All free and public: flight archives, Global Fishing Watch, the IMF, the European and NASA satellite programmes, official maritime advisories. It cost nothing."

**"How do you avoid hindsight?"**
"Nothing appears before the hour it existed. Old values show their age. If a report only gives a date, we never invent an hour."

**"What can't it see?"**
"Individual ship tracks: there's no free source for this strait. Official airspace notices. Flights over Iraq. And a few exact times on the first day rest on a single source; the screen labels how precise every time is."

**"Why a local model?"**
"So the evidence never leaves the machine. That matters for analysts working with sensitive material."

**"Does it generalise?"**
"Yes. Every source is global. Change the box and the dates; only the story is written per event."
