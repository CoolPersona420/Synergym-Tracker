# Synergym

A lifting log for phone and desktop: log sessions as you train, see how hard each set and session
was, follow a training split, and watch your progress add up. Live at
<https://synergym-tracker-log.vercel.app>.

**Version 0.1.7, alpha.** Everything below works and is tested, but it's early: features may change
and you may meet the odd bug. Please report problems in [Issues](https://github.com/CoolPersona420/Synergym-Tracker/issues).
The version lives in `package.json` (`0.1.7-alpha`) and shows in Settings › About with the build it came from.

## What it does

- **Log sessions:** weight and reps per set (last time's numbers show as hints), a tick to finish a set,
  a rest timer, drop sets, and linked sets that are named automatically (superset, giant set, drop set,
  rest-pause, pyramid).
- **Records (PRs):** each exercise knows its records. A weight PR is heavier than ever, a rep PR is more
  reps than ever at that weight or heavier, and beating both is marked as both. Sets are judged live as you
  type them, and each exercise page shows its heaviest set, most reps and best reps by weight.
- **History filters:** filter by date (presets or any range), split (deleted ones too), exercise, muscle
  group and PR kind, combined with search.
- **Today's plan / summary:** swipe Home down on a phone (or tap the date) and a panel comes down from the
  top, following the finger; swipe it up to close. It's today's plan until the day's training is done, then
  today's summary: sessions, sets, volume and PRs, the week so far, and the split's next day with what to
  lift and what to aim for.
- **Coach:** reads your log and says what to do next (see [Coach](#coach)):
  - **targets** for every exercise (weight, reps and sets) that climb through your split's rep ranges,
    filled in when you start a split day and shown in the session;
  - **today's call:** train, go easy or rest, with the reasons;
  - **when to deload or take a week off**, and **whether to keep or change your split**;
  - **lift goals**, for example squat 150 kg: a realistic date and range, milestones, and 4-week training
    blocks that set that lift's targets.
- **Plate calculator:** the plates for each side of the bar for any weight, with your bar remembered.
- **Intensity and records:** every set and session gets an intensity score against your best; each
  exercise keeps a one-rep max, and beating it offers to save the new one.
- **Splits:** weekly plans with days, exercises, sets and reps and linked groups; start from a template,
  reorder days, and share by @username or by link. Home suggests the next day, or pick one from Up next.
  A day can be marked "same day as" the one before for training twice a day (Day 1 · 2nd session).
  Up to six splits; deleting one keeps its sessions and their split name in History.
- **Done for today:** after a finished session Home shows today as completed with the next day waiting;
  starting again that day asks first, unless the split plans a second session. Two sessions a day at most.
- **Rest days:** mark today as a rest day on Home; the start button turns into a moon and stars, and no
  session can be started until the rest day is undone.
- **Home:** a greeting and quote, the next session, and widgets you choose and size: the coach, this week's summary,
  bodyweight trend, intensity, consistency, volume, muscle focus, records, top lifts and your week's plan.
  Each opens full screen with more detail.
- **Bodyweight log**, **History** with search, and an **exercise library** of your own with editable
  muscle groups.
- **Themes:** Auto (follows the device) plus eleven named palettes.
- **Week start:** weeks start on Monday, Sunday or Saturday (**Settings › Training**), for the weekly
  target, streaks, charts and the today panel.
- **Phone app:** install it to the Home Screen. It opens without a connection, has a floating dock and a
  quick opening splash, never zooms, and the page stretches and springs back at the top and bottom like
  iOS (native on iPhone, recreated on Android). Installed on an iPhone, which has no browser back, you swipe
  in from the left edge to go back, as in other iPhone apps (`src/ui/edgeback.js`).
  - **Offline mode:** use it without an account, or take an account offline; going online merges and
    uploads (see below).
- **Accounts:** email and password; a six-step setup (account, name, body and units, goal and days, a
  starter split, a theme) followed by a short tour. One device is signed in per account at a time.
- **Your data:** export everything as JSON or every set as CSV; import replaces all data after a warning.
- **Help:** a user guide for phone and desktop (Settings › User guide) and "How the numbers work".

What changed in each release is in [RELEASE_NOTES.md](RELEASE_NOTES.md). What's planned from here to the Beta is in [ROADMAP.md](ROADMAP.md), in phases. Phase 1 covers coaching
progression, more set types, warm-ups, muscle balance and more.

## How it's built

- **Frontend:** plain JavaScript and Vite, deployed on Vercel.
- **Backend:** Supabase (Postgres, email and password auth).
- **Security:** Row Level Security on every table. Each account can only read and write its own rows.
  Splits are shared only through checked database functions. Strict security headers (CSP, HSTS, no
  framing) come from `vercel.json`.
- **Look:** spacing, type sizes and two-column splits follow the golden ratio (φ = 1.618); the scale and
  theme tokens are at the top of `src/style.css`. The wolf mascot is the logo, the splash and the app icon
  (`public/icon.svg` and the PNG icons). The wordmark is Teko Bold, slanted 12°.

## Deploy (about 10 minutes)

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com) (the free tier is fine).
2. **SQL Editor → New query**: paste all of `supabase/schema.sql` and click **Run**. (Re-running it later is safe; it only adds what is missing.)
3. **Project Settings → API**: copy the **Project URL** and the **publishable / anon key**.
   (Never use the `service_role` / secret key in the frontend.)
4. **Authentication → Sign In / Providers → Email**: keep **Confirm email** on and set the
   minimum password length to 8.
5. **Authentication → Emails → SMTP Settings**: add a custom SMTP sender (for example
   Resend, Postmark or Amazon SES). **This is required for public sign-ups.** Supabase's
   built-in mailer only sends to your own team's addresses and is heavily rate limited, so
   strangers would never receive their confirmation or password-reset emails.

### 2. Vercel

1. Push this folder to a GitHub repository.
2. In Vercel: **Add New → Project →** import the repository. The framework is detected as Vite.
3. Under **Environment Variables** add:
   - `VITE_SUPABASE_URL` = your Project URL
   - `VITE_SUPABASE_KEY` = your publishable / anon key
4. Click **Deploy** and note the URL (for example `https://plate-log.vercel.app`).

Prefer the command line? Run `npm i -g vercel`, then `vercel` and `vercel --prod` in this folder,
and add the two variables with `vercel env add`.

### 3. Point Supabase back at the site

**Authentication → URL Configuration**:
- **Site URL**: your Vercel URL.
- **Redirect URLs**: add `https://YOUR-DOMAIN/**`.

The links in confirmation and password-reset emails will now land on your site.

## Local development

```bash
cp .env.example .env.local   # fill in the two values
npm install
npm run dev
```

## Tests

```bash
npm run lint   # undefined names, duplicate keys, unreachable code
npm test       # unit tests for the pure logic in src/lib (Node's built-in test runner)
npm run e2e    # browser tests on phone and desktop sizes, with Supabase faked in the browser
```

`npm run build` runs lint and the unit tests before building, and Vercel deploys with `npm run build`,
so a change that breaks them never goes live. GitHub Actions (`.github/workflows/test.yml`) also runs
the browser tests on every push. They need no secrets: `tests/e2e/fake-supabase.js` answers the app's
auth and database calls in memory.

## Code layout

| Path | What's in it |
|---|---|
| `src/main.js` | app state, screens, actions, saving and sync |
| `src/lib/` | logic with no UI: the coach, progress suggestions, plates, bodyweight and weekly summary, data cleaning, import parsing, profile mapping, offline storage and sync, error reports and stats |
| `public/sw.js` | the service worker: the offline app shell |
| `src/ui/` | brand and icons, themes, the login and open splashes, the user guide |
| `src/data/` | starter split templates, quotes |

## Offline mode (phone app)

In the app installed on a phone's Home Screen, people can use Synergym without an account
(**Use offline without an account** on the login screen) or switch an existing account to offline
(**Settings › Use offline**). Everything is then kept in IndexedDB on the phone (`src/lib/localdb.js`) and
nothing is sent to the server. **Settings › Go online** logs in or creates an account and merges the
phone's data into it (`src/lib/sync.js`: exercises are matched by name, and only what changed offline is
uploaded). The phone's copy is cleared only after every upload has succeeded; a dropped connection, a
rejected record or a closed app leaves it in place and the next attempt picks up again. Offline is limited
to the installed phone app because browsers may clear a website's storage, but not a Home Screen app's.

The service worker (`public/sw.js`) caches the app so it opens without a connection, for everyone.

## User guide

New users get a short tour after setup; the full guide is at **Settings › User guide** (`/guide`), with
phone and desktop versions of each step. The text lives in `src/ui/guide.js`.

## Errors and usage stats

Errors in a signed-in user's browser are saved to `client_errors` (at most 30 an hour per user, kept 30
days, not readable through the API). Read them in the Supabase SQL editor:

```sql
select at, message, path, build from client_errors order by at desc limit 50;
```

Page views go to Vercel Web Analytics (no cookies; ids in addresses are replaced with `:id`). Turn it on
once in the Vercel dashboard: project → Analytics → Enable.

## Coach

The coach is a set of plain rules over your own log (`src/lib/coach.js`, pure functions with unit tests).
It runs in your browser, needs no extra data, and is worked out again only when finished sessions,
exercises, splits, goals or the date change, so the app stays as quick as before (three years of
four sessions a week takes a few milliseconds). Open it from its card on Home, the today panel, or the
sidebar on a computer: a short summary (train, go easy or rest, with the main reason and the next step) over
three tabs, **Plan**, **Goals** and **Recovery**, so it reads without scrolling. It also shows up where you
train: the targets in a session and a note when they're lighter, next time's target on each exercise page,
and its view of a split on the split's page. It's guidance, not medical advice.

**Settings › Coach** switches it off: the Home card hides (and comes back where it was when switched on),
every coach hint goes, sessions show plain next-set suggestions, and goals are kept (`profiles.coach_on`).

- **Targets.** Strength from a set is estimated with Epley (load × (1 + reps ÷ 30)), using sets of 12 reps
  or fewer. With a rep range in the split (say 8–12) it's double progression: keep the weight and add reps
  until every set reaches the top, then add about 2.5% (at least one plate step) and go back to the bottom;
  under the range twice at a weight drops 5%. Without a range it's the earlier next-set rule.
- **Today: train, go easy or rest.** Rest after more training days in a row than your split plans (2–4
  without a split, by experience) or when the split has a rest day next. Go easy (about 10% lighter, a set
  fewer) when this week's sets are 50% above your usual week (acute:chronic load), when two main lifts are 5%
  under their recent best two sessions running, when yesterday already gave today's muscles 6+ sets, or after
  two weeks away.
- **Deloads and weeks off.** A lighter week about every 10, 6 or 5 weeks of hard training (beginner,
  intermediate, advanced), counted from the last break of 6+ days or the last lighter week, and straight
  away when half the main lifts stall or two keep falling. A full week off after 16 weeks without a break,
  or when lifts stay stuck after a recent deload. While a deload is due, every target is about 10% lighter
  with half the sets. After a lighter week, stalls are ignored for two weeks while lifts bounce back.
- **The split.** Give a split 6–8 weeks. Time to change when, at the rate you actually train, a 4+ day split
  hits major muscles less than once a week, or when half the main lifts have stalled after 8+ weeks outside a
  deload; worth a tweak after 16 weeks with fewer than half still climbing, or if it skips a major muscle.
- **Goals.** A target one-rep max per lift, with an optional deadline. Your current max is the best estimate
  from your last three sessions (or a one-rep max saved in the last 6 weeks), eased off after 3+ weeks away.
  The pace blends your own 12-week trend (a median of pairwise slopes, so one odd day doesn't swing it)
  with typical gains for your level (about 1%, 0.5% or 0.2% a week), capped at twice the typical rate and
  slowing as the months go on. You get a likely date with a fast-to-slow range, milestones every 4 weeks,
  whether the deadline is realistic, and a plan in 4-week blocks (three building weeks, one deload): Build
  (4×6 at 72.5–77.5% of your current max) while the goal is over 10% away, Strength (5×3–4 at 80–85%)
  within 10%, Peak (heavy doubles and singles, then a test) within 3%. That lift's session targets follow
  the block. Goals are stored on the profile (`lift_goals`), so they sync, export and import.

## Export and import

**Settings → Export JSON** saves everything (exercises, sessions, splits, settings, bodyweight log);
**Export CSV** saves every set as a spreadsheet row. **Import JSON** replaces all of the account's data
with a file: it shows what will be deleted and offers to export first, then swaps everything in one
database transaction (`import_replace`), so a failed import changes nothing.

## Data model

| Table | Holds | Who can see it |
|---|---|---|
| `profiles` | username, name, units, rest timer, bodyweight, experience, goal, theme, muscle groups, home widgets, bodyweight log, active device (one signed-in device per account), deleted splits that sessions still point at (`split_archive`), lift goals (`lift_goals`), whether the coach is on (`coach_on`), the day weeks start on (`week_start`) | owner |
| `exercises` | each user's own exercise list (seeded from `default_exercises`) | owner |
| `sessions` | one row per workout; sets are stored as JSON inside it | owner |
| `splits` | training plans: days, session types, exercises with sets × reps; at most 6 per account (`splits_limit` trigger) | owner |
| `split_shares` | which user a split was shared with | sender and recipient |
| `client_errors` | errors reported by the app | nobody through the API (SQL editor only) |

The functions `share_split`, `unshare_split`, `split_recipients`, `shared_with_me`,
`get_public_split`, `restore_default_exercises`, `delete_account`, `import_replace` and `report_error` handle the
cross-user actions safely.
