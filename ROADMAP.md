# Synergym roadmap: Alpha to Beta

**Roadmap version 1.1** · 27 October 2026 · app at 0.0.8-alpha

This roadmap covers the rest of the Alpha, up to the start of the Beta. It's split into phases. Phase 1 is
set out below; later phases are added as they're planned. The Beta starts once every phase on this roadmap
has shipped.

It's also the record of what was planned and when it shipped: items stay here after they ship, marked with
the app version they shipped in.

The goal behind every item: help people keep progressing, not just keep a log. Nothing here should cost an
extra tap for anyone who doesn't use it. The core loop (open, log a set, done) stays fast.

## Overview

| Phase | Theme | Items | Status |
|---|---|---|---|
| [Phase 1](#phase-1-coaching-and-better-logging) | Coaching progression, logging any workout, balance and recovery, guidance, the coach | 17 | In progress |
| Phase 2 | To be planned | – | Not started |
| Beta | Starts when every phase above has shipped | – | – |

## How this roadmap is versioned

- **The roadmap's own version** (above) goes up when its plan changes:
  - minor (1.0 → 1.1): a phase is added, or items are added, removed or reordered;
  - major (1.x → 2.0): the plan is restructured, or the road to Beta changes.
  Every change gets a line in the [revision history](#revision-history).
- **Status changes** (an item moving from Planned to In progress to Shipped) don't change the roadmap's
  version.
- **Items** have fixed ids: phase, then group, then item. For example, 1.2.3 is Phase 1, group 2, item 3.
  An id is never reused, even if its item is dropped.
- **Status key:** Planned · In progress · Shipped in vX.Y.Z · Dropped (with the reason)

## Phase 1: Coaching and better logging

**Status:** In progress · **Roadmap version added:** 1.0

**Before building a lot:** put the app in front of 5–10 real lifters and use the privacy-friendly usage
stats (see the README's "Errors and usage stats") to see what people actually use. That should decide the
order as much as this list does.

### 1.1 Coaching progression (highest impact)

Best built together: these three turn the app from a logbook into something that tells you what to do
next.

| Id | Enhancement | Why it helps | What already exists | Status |
|---|---|---|---|---|
| 1.1.1 | **Effort per set (RIR / RPE).** One optional tap after a set: "how many more reps could you have done?" (0–4). | Next-set suggestions only see weight × reps, so they can't tell an easy 8 from a grinding 8 and sometimes push too fast or hold back. | Next-set suggestions (`src/lib/progress.js`), set rows in the session view. The coach assumes 2 reps in reserve; real RIR would make every target and goal projection sharper. | Planned |
| 1.1.2 | **Rep-range progression from the split.** With a range like 8–12: keep the weight until every set reaches 12, then add weight and drop back to 8 (double progression). | The most proven method for most lifters. | Split days already store reps as a range (e.g. `"8-12"`); suggestions engine. | Shipped in v0.0.8-alpha (the coach's targets) |
| 1.1.3 | **Stall and deload alerts.** When a lift hasn't improved in 3 sessions, or session intensity keeps falling, say so and suggest a lighter week or a variation. | Catches plateaus and fatigue before they cost weeks. | Records engine (`src/lib/records.js`), set and session intensity. | Shipped in v0.0.8-alpha (the coach's deload and split checks) |

### 1.2 Log any workout

| Id | Enhancement | Why it helps | What already exists | Status |
|---|---|---|---|---|
| 1.2.1 | **More set types:** timed holds (planks), cardio (time and distance), assisted lifts (weight taken off), and left/right sides for one-arm or one-leg work. | Today everything must be weight × reps, so some workouts can't be logged accurately. | Bodyweight exercises (added load). | Planned |
| 1.2.2 | **Warm-up sets.** Generate them from the working weight (bar, about 50%, 70%, 85%) with the plates shown. | Used every session; saves the mental math. | Plate calculator (`src/lib/plates.js`). | Planned |
| 1.2.3 | **Rest time per exercise.** For example, 3 min for squats and 60 s for curls. | One rest timer for everything is wrong for most sessions. | Rest timer (one setting in Settings › Training). | Planned |

### 1.3 Balance and recovery

| Id | Enhancement | Why it helps | What already exists | Status |
|---|---|---|---|---|
| 1.3.1 | **Weekly sets per muscle against a target** (about 10–20 hard sets), flagging muscles you're under-training and imbalances such as too much pushing versus pulling. | Balanced progress, fewer injuries from imbalance. | Muscle focus widget (sets per muscle over 7, 30 or 90 days). | Planned |
| 1.3.2 | **Check-in before a session:** sleep, soreness and energy on a 1–5 scale. On a bad day the suggestions ease off automatically. | Fits training to the day instead of forcing it. | Next-set suggestions. | Planned |

### 1.4 Guidance

| Id | Enhancement | Why it helps | What already exists | Status |
|---|---|---|---|---|
| 1.4.1 | **Notes that stay with each exercise** (seat height, grip, cues), shown the next time you do it. | Setup details stop getting lost between sessions. | Session notes (per session only). | Planned |
| 1.4.2 | **Swap an exercise** for another that works the same muscle, for when equipment is taken. | Keeps the plan on track in a busy gym. | Exercise library with muscle groups. | Planned |

### 1.5 The coach (added in roadmap 1.1)

The coach (`src/lib/coach.js`) shipped in v0.0.8-alpha. These make it smarter, in rough order of value.

| Id | Enhancement | Why it helps | What already exists | Status |
|---|---|---|---|---|
| 1.5.1 | **The coach:** targets (weight, reps, sets), today's call (train, go easy, rest), deloads and weeks off, the split check, lift goals with realistic dates and 4-week blocks. | Turns the log into what to do next. | – | Shipped in v0.0.8-alpha |
| 1.5.2 | **Learn each lifter's own rates.** Keep the coach's projections and compare them with what happened; tune the pace, fatigue thresholds and deload timing per person, and show how accurate it's been. | Population averages are a start; individuals vary two- or threefold. | Goal plans, e1RM history per lift. | Planned |
| 1.5.3 | **Readiness check-in feeds the call** (with 1.3.2): sleep, soreness, energy, and optionally resting heart rate. | Today's call currently sees only the log. | Today's call. | Planned |
| 1.5.4 | **Strength standards by bodyweight, sex and age** (optional profile fields) to judge how ambitious a goal is and where gains slow. | Makes "realistic" sharper for very strong or very new lifters. | Bodyweight log, experience level. | Planned |
| 1.5.5 | **More goal kinds:** reps at a weight (10 pull-ups), bodyweight targets, weekly volume, a total (squat + bench + deadlift). | Not every goal is a one-rep max. | Lift goals. | Planned |
| 1.5.6 | **Variations when a lift stalls:** suggest a paused, tempo or close-grip version for a 4-week block (with 1.4.2 swaps). | The split check can say "change" but not yet to what. | Split check, exercise library. | Planned |
| 1.5.7 | **Test-day helper:** warm-up ramp and attempt selection (about 90%, 95%, then the goal) with plates shown (with 1.2.2). | Testing a max well is a skill; this removes the guesswork. | Plate calculator, goal "ready" state. | Planned |
| 1.5.8 | **Coach nudges:** a push reminder on deload weeks, planned rest days and when a milestone is due. | The advice reaches you without opening the app. | Workout reminders (web push). Since v0.1.3-alpha they follow the coach (a lighter week, an easy day, quiet when it calls rest); since v0.1.6-alpha they're about a session to finish or the next session. | In progress (the milestone nudge is still to do) |
| 1.5.9 | **Run the coach off the main thread** (a Web Worker) if logs grow far past today's size. | Today it takes milliseconds; this keeps it that way at any size. | Cached coach reading. | Planned |

## Phase 2

To be planned. Add it here as a new section, list it in the overview, and raise the roadmap's version.

## Notes for whoever builds these

- Keep the logic in `src/lib/` as pure functions with unit tests (as `progress.js` and `records.js` are),
  and add e2e tests for the screens (`tests/e2e/`).
- New per-set data (effort, set type) lives inside the session's `items` JSON, so no new tables are needed.
  New per-exercise data (rest time, pinned notes) needs columns on `exercises`; update
  `supabase/schema.sql` and run the migration before deploying the app.
- Export and import (`src/lib/importer.js`) and offline sync (`src/lib/sync.js`) must carry any new
  fields.
- When an item ships: set its status to "Shipped in vX.Y.Z", add it to the README's "What it does", and
  update the in-app guide (`src/ui/guide.js`) and "How the numbers work".

## Revision history

| Roadmap version | Date | App version | Change |
|---|---|---|---|
| 1.0 | 26 October 2026 | 0.0.5-alpha | First roadmap: Phase 1 (10 items) planned; Beta starts after the last phase. |
| 1.1 | 27 October 2026 | 0.0.8-alpha | Added 1.5 The coach (1.5.1 shipped, 1.5.2–1.5.9 planned); 1.1.2 and 1.1.3 shipped as part of it. |
