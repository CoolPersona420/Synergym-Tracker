# Synergym

A lifting log: sessions, exercises, sets, reps and weight, with automatic set and session
intensity, superset / giant set / drop set detection, a consistency score, an editable
exercise list per user, and training splits you can share.

- **Look:** monochrome by default (follows your device's light or dark setting), with 11 named themes in
  Settings › Theme: Mono Light/Dark, Solarized Light/Dark, Gruvbox Light/Dark, Nord, Dracula, Ocean, Sage and Volt.
  The sun / moon button flips to each theme's light or dark partner. Spacing, type sizes and two-column splits
  follow the golden ratio (φ = 1.618); the scale and theme tokens are at the top of `src/style.css`.
- **Focus:** whatever you're not working on recedes. Other exercise cards blur while you type into one, card
  grids and lists soften around the one you hover, and sheets blur the page behind them.
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

## Moving data from an earlier version

Open the old version (Plate Log), go to **Settings → Export JSON**, then in the new site go to
**Settings → Import JSON**. Exercises are matched by name, and anything missing is added to
your list as a custom exercise.

## Data model

| Table | Holds | Who can see it |
|---|---|---|
| `profiles` | username, name, units, rest timer, bodyweight, experience, goal | owner |
| `exercises` | each user's own exercise list (seeded from `default_exercises`) | owner |
| `sessions` | one row per workout; sets are stored as JSON inside it | owner |
| `splits` | training plans: days, session types, exercises with sets × reps | owner |
| `split_shares` | which user a split was shared with | sender and recipient |

The functions `share_split`, `unshare_split`, `split_recipients`, `shared_with_me`,
`get_public_split`, `restore_default_exercises` and `delete_account` handle the
cross-user actions safely.
