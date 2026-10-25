# Synergym

A lifting log: sessions, exercises, sets, reps and weight, with automatic set and session
intensity, superset / giant set / drop set detection, a consistency score, an editable
exercise list per user, and training splits you can share.

- **Look:** monochrome by default (follows your device's light or dark setting), with 11 named themes in
  Settings › Theme: Mono Light/Dark, Solarized Light/Dark, Gruvbox Light/Dark, Nord, Dracula, Ocean, Sage and Volt.
  The sun / moon button flips to each theme's light or dark partner. Spacing, type sizes and two-column splits
  follow the golden ratio (φ = 1.618); the scale and theme tokens are at the top of `src/style.css`.
- **1RM:** each exercise keeps a confirmed one-rep max. While logging, the card shows it live; when a
  completed set beats it, Synergym asks whether to save the new 1RM. It can also be set by hand on the exercise page.
- **Muscle groups:** each user edits their own list (Exercises › Edit groups): add, rename (exercises follow), remove.
- **Brand:** the wolf mascot (white head, red eyes) is the logo, the loading screen lockup and the app
  icon (`public/icon.svg`, `apple-touch-icon.png`, `icon-192/512.png`, `icon-maskable-512.png`). The wordmark is Teko Bold, slanted 12°.
- **Accounts:** a login page and a five-step registration: account, name and username, units /
  bodyweight / experience, goal and days per week, then a recommended starter split.

- **Frontend:** plain JavaScript + Vite, deployed on Vercel.
- **Backend:** Supabase (Postgres, email + password auth).
- **Security:** Row Level Security on every table. Each account can only read and write its own
  rows. Splits are shared only through checked database functions. Strict security headers
  (CSP, HSTS, no framing) come from `vercel.json`.

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
