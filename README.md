# Synergym

A lifting log for phone and desktop: log sessions as you train, see how hard each set and session
was, follow a training split, and watch your progress add up. Live at
<https://synergym-tracker-log.vercel.app>.

## What it does

- **Log sessions:** weight and reps per set (last time's numbers show as hints), a tick to finish a set,
  a rest timer, drop sets, and linked sets that are named automatically (superset, giant set, drop set,
  rest-pause, pyramid).
- **Next-set suggestions:** each exercise shows last time's top set and what to try today.
- **Plate calculator:** the plates for each side of the bar for any weight, with your bar remembered.
- **Intensity and records:** every set and session gets an intensity score against your best; each
  exercise keeps a one-rep max, and beating it offers to save the new one.
- **Splits:** weekly plans with days, exercises, sets and reps and linked groups; start from a template,
  reorder days, and share by @username or by link. Home suggests the next day, or pick one from Up next.
- **Home:** a greeting and quote, the next session, and widgets you choose and size: this week's summary,
  bodyweight trend, intensity, consistency, volume, muscle focus, records, top lifts and your week's plan.
  Each opens full screen with more detail.
- **Bodyweight log**, **History** with search, and an **exercise library** of your own with editable
  muscle groups.
- **Themes:** Auto (follows the device) plus eleven named palettes.
- **Phone app:** install it to the Home Screen. It opens without a connection, has a floating dock and a
  quick opening splash, and never zooms.
  - **Reminders** at a chosen time on chosen days (see below).
  - **Offline mode:** use it without an account, or take an account offline; going online merges and
    uploads (see below).
- **Accounts:** email and password; a six-step setup (account, name, body and units, goal and days, a
  starter split, a theme) followed by a short tour. One device is signed in per account at a time.
- **Your data:** export everything as JSON or every set as CSV; import replaces all data after a warning.
- **Help:** a user guide for phone and desktop (Settings › User guide) and "How the numbers work".

## How it's built

- **Frontend:** plain JavaScript and Vite, deployed on Vercel (with one serverless function for reminders).
- **Backend:** Supabase (Postgres, email and password auth, pg_cron for reminders).
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
| `src/lib/` | logic with no UI: progress suggestions, plates, bodyweight and weekly summary, data cleaning, import parsing, profile mapping, offline storage and sync, push reminders, error reports and stats |
| `api/` | the reminders function (Vercel) |
| `public/sw.js` | the service worker: offline app shell and reminder notifications |
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

## Workout reminders

Phones can get a push notification at a chosen time on chosen days (**Settings › Reminders**). Days the
user already trained stay quiet. How it works:

- `push_subscriptions` holds each device's push endpoint; `profiles` holds the time, days and time zone.
- Every 5 minutes `pg_cron` calls `api/reminders.js` (a Vercel function) with a shared secret. It asks the
  database which devices are due (`reminders_due`), sends the notifications, and removes devices that are
  gone (`reminders_drop`).
- Setup (once): `supabase/reminders-cron.sql`. Vercel needs `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and
  `REMINDER_SECRET`; the secret also lives in Supabase Vault as `reminder_secret`.

On iPhone, notifications only work in the app added to the Home Screen (iOS 16.4 or later).

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

## Export and import

**Settings → Export JSON** saves everything (exercises, sessions, splits, settings, bodyweight log);
**Export CSV** saves every set as a spreadsheet row. **Import JSON** replaces all of the account's data
with a file: it shows what will be deleted and offers to export first, then swaps everything in one
database transaction (`import_replace`), so a failed import changes nothing.

## Data model

| Table | Holds | Who can see it |
|---|---|---|
| `profiles` | username, name, units, rest timer, bodyweight, experience, goal, theme, muscle groups, home widgets, bodyweight log, active device (one signed-in device per account) | owner |
| `exercises` | each user's own exercise list (seeded from `default_exercises`) | owner |
| `sessions` | one row per workout; sets are stored as JSON inside it | owner |
| `splits` | training plans: days, session types, exercises with sets × reps | owner |
| `split_shares` | which user a split was shared with | sender and recipient |
| `client_errors` | errors reported by the app | nobody through the API (SQL editor only) |
| `push_subscriptions` | each device that gets reminders | owner |

The functions `share_split`, `unshare_split`, `split_recipients`, `shared_with_me`,
`get_public_split`, `restore_default_exercises`, `delete_account`, `import_replace` and `report_error` handle the
cross-user actions safely.
