# Roadmap

Planned enhancements, kept here as a record until they're built. Each one moves to the README's
"What it does" list (and out of this file) when it ships.

The goal behind all of them: help people keep progressing, not just keep a log. They should cost no extra
taps for anyone who doesn't use them. The core loop (open, log a set, done) stays fast.

**Status key:** Planned · In progress · Shipped (removed from this file)

**Before building a lot:** put the app in front of 5–10 real lifters and use the privacy-friendly usage
stats (see the README's "Errors and usage stats") to see what people use. That should decide the order as
much as this list does.

## 1. Coaching progression (highest impact)

Recommended to build these three together: they turn the app from a logbook into something that tells you
what to do next.

| # | Enhancement | Why it helps | What already exists | Status |
|---|---|---|---|---|
| 1.1 | **Effort per set (RIR / RPE).** One optional tap after a set: "how many more reps could you have done?" (0–4). | Next-set suggestions only see weight × reps, so they can't tell an easy 8 from a grinding 8 and sometimes push too fast or hold back. | Next-set suggestions (`src/lib/progress.js`), set rows in the session view. | Planned |
| 1.2 | **Rep-range progression from the split.** With a range like 8–12: keep the weight until every set reaches 12, then add weight and drop back to 8 (double progression). | The most proven method for most lifters. | Split days already store reps as a range (e.g. `"8-12"`); suggestions engine. | Planned |
| 1.3 | **Stall and deload alerts.** When a lift hasn't improved in 3 sessions, or session intensity keeps falling, say so and suggest a lighter week or a variation. | Catches plateaus and fatigue before they cost weeks. | Records engine (`src/lib/records.js`), set and session intensity. | Planned |

## 2. Log any workout

| # | Enhancement | Why it helps | What already exists | Status |
|---|---|---|---|---|
| 2.1 | **More set types:** timed holds (planks), cardio (time and distance), assisted lifts (weight taken off), and left/right sides for one-arm or one-leg work. | Today everything must be weight × reps, so some workouts can't be logged accurately. | Bodyweight exercises (added load). | Planned |
| 2.2 | **Warm-up sets.** Generate them from the working weight (bar, about 50%, 70%, 85%) with the plates shown. | Used every session; saves the mental math. | Plate calculator (`src/lib/plates.js`). | Planned |
| 2.3 | **Rest time per exercise.** For example, 3 min for squats and 60 s for curls. | One rest timer for everything is wrong for most sessions. | Rest timer (one setting in Settings › Training). | Planned |

## 3. Balance and recovery

| # | Enhancement | Why it helps | What already exists | Status |
|---|---|---|---|---|
| 3.1 | **Weekly sets per muscle against a target** (about 10–20 hard sets), flagging muscles you're under-training and imbalances such as too much pushing versus pulling. | Balanced progress, fewer injuries from imbalance. | Muscle focus widget (sets per muscle over 7, 30 or 90 days). | Planned |
| 3.2 | **Check-in before a session:** sleep, soreness and energy on a 1–5 scale. On a bad day the suggestions ease off automatically. | Fits training to the day instead of forcing it. | Next-set suggestions. | Planned |

## 4. Guidance

| # | Enhancement | Why it helps | What already exists | Status |
|---|---|---|---|---|
| 4.1 | **Notes that stay with each exercise** (seat height, grip, cues), shown the next time you do it. | Setup details stop getting lost between sessions. | Session notes (per session only). | Planned |
| 4.2 | **Swap an exercise** for another that works the same muscle, for when equipment is taken. | Keeps the plan on track in a busy gym. | Exercise library with muscle groups. | Planned |

## Notes for whoever builds these

- Keep the logic in `src/lib/` as pure functions with unit tests (as `progress.js` and `records.js` are),
  and add e2e tests for the screens (`tests/e2e/`).
- New per-set data (effort, set type) lives inside the session's `items` JSON, so no new tables are needed.
  New per-exercise data (rest time, pinned notes) needs columns on `exercises`; update
  `supabase/schema.sql` and run the migration before deploying the app.
- Export and import (`src/lib/importer.js`) and offline sync (`src/lib/sync.js`) must carry any new
  fields.
- Update the in-app guide (`src/ui/guide.js`), "How the numbers work", and the README when a feature
  ships.
