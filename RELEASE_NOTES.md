# Synergym release notes

What changed in each release, newest first. Synergym is in alpha: features may change between releases.
Each version is set in `package.json` and shows in **Settings › About**. Planned work lives in
[ROADMAP.md](ROADMAP.md).

> **Version numbers:** the first releases were labelled 1.0.0 and 1.0.2 alpha. They were renumbered to
> 0.0.x to make clear the app is still in alpha: 1.0.0 is listed here as 0.0.1, 1.0.2 as 0.0.3, and the
> unlabelled release between them as 0.0.2.

---

## 0.1.5-alpha · 28 October 2026

**App icon options removed**

- The app icon options from 0.1.4 are removed: the light, dark and theme-coloured icons, **Settings › App
  icon**, and Android's one-colour themed icon. The icon is the original white wolf on black again, on every
  phone. An icon already on a Home Screen stays as it is until Synergym is added again.
- The start of the week (**Settings › Training**) stays.

## 0.1.4-alpha · 27 October 2026

**An app icon in your colours, and your own start of the week**

- *(Removed in 0.1.5)* **The Home Screen icon matches the app.** The wolf now comes white on black, black on white, and in each
  theme's colours. By default the icon follows the app: your theme, or with Auto your phone's light mode
  (white) or dark mode (black). **Settings › App icon** can keep it light or dark instead, and your app's theme
  never changes with it.
  - **iPhone:** an icon is set when Synergym is added to the Home Screen, and iOS doesn't let web apps change
    it afterwards or give them a dark version. The icon is right whenever you add it, and Settings explains how
    to change it: copy a link, add Synergym again from Safari, and remove the old icon.
  - **Android:** Chrome updates the installed icon by itself, usually within a day of opening the app. With
    **Themed icons** on (Android 13 or later), a new one-colour wolf follows your phone's colours and light or
    dark mode.
- **Choose the day your week starts:** Monday, Sunday or Saturday, in **Settings › Training**. It sets this
  week's count, the weekly target and streaks, the charts, the today panel and reminders, and the reminder
  days are listed in that order. Saved to your account (`profiles.week_start`).
- **Fixed:** changing a reminder's time briefly showed the footer's old wording.

## 0.1.3-alpha · 27 October 2026

**Reminders that know your training, and that keep arriving**

- **Each reminder is written for you, from your own log,** in wording that changes from day to day. Usually
  it says what's next ("Up next: Lower · Back Squat 137.5 kg × 5 to start, then 4 more exercises"). Other days
  it's a first session, coming back after time away (without guilt, and with a note that targets start a
  little lighter), a goal ready to test, a lighter week, an easy day the coach suggests, one more session to
  reach your weekly target, or last session's record. Tapping it opens the page it's about: Home, the Coach,
  Goals or Recovery.
- **It knows when to stay quiet:** on a day you've trained or marked as rest, when the coach calls rest or a
  week off, and once your week's target is met. After time away it comes less often (every 3 days after 10
  days, weekly after 3 weeks, fortnightly after 2 months).
- **Fixed: reminders could stop arriving while Settings still showed them on.** Phones lose their push
  registration (iOS after an update or a reinstall, and signing out removes it), and nothing signed them up
  again. Now each time the app opens, a phone with reminders on and notifications allowed signs up again on
  its own. A phone that hasn't allowed notifications yet says "On for your account. Turn on to get them on this
  phone", and a problem with this phone stays visible in Settings.
- **Send a test reminder** now sends what a real one would say right now, and makes sure this phone is signed
  up first.
- Behind the scenes: the app saves a short brief for the server (`profiles.reminder_brief`); the server's new
  `reminders_next` and `reminders_done` replace `reminders_due` and `reminders_drop`; reminders are only
  counted as handled for people with a phone signed up, so a phone that signs up within the 45-minute window
  still gets that day's reminder.

## 0.1.2-alpha · 27 October 2026

**The Coach card and a full-screen Coach**

- **A more informative Coach card on Home.** Under today's call and its reason, four short rows:
  - **Next:** the next day and its first target, like "Lower · Back Squat 137.5×1 +1";
  - **Week:** sessions in the last 7 days against your target, with a bar;
  - **Recovery:** weeks since your last lighter week, or "Deload next week" in red when one is due;
  - **Goal:** your goal, how far along you are, and when it's likely.
  Each row opens its part of the Coach (Plan, Recovery or Goals). On phones, and on the large card, the next
  session's targets are listed underneath.
- **The Coach opens full screen on phones and tablets,** like a widget's full view, with a **✕** at the top to
  close it and go back. The bottom bar steps aside on phones. On a computer it stays a page in the sidebar.

## 0.0.11-alpha · 27 October 2026

**The coach, redesigned and built into the app**

- **A Coach page that reads without scrolling.** A short summary on top says whether to train, go easy or
  rest, with the main reason and the next step (Start the day, Resume, or Make today a rest day). Tap **Why**
  for the rest. Below it, three tabs:
  - **Plan:** the next split day, one line per exercise with its target.
  - **Goals:** each goal on one compact card (now, progress, likely date and this week's work). Milestones,
    the pace, the deadline check and tips fold away under **Plan details**.
  - **Recovery:** lighter weeks and your split, side by side in short cards.
  The Goals tab shows how many goals you have, and Recovery gets a dot when a deload or a split change needs
  a look. Links can open a tab directly (`/coach/goals`, `/coach/recovery`).
- **The coach shows up where you train:**
  - a note at the top of a session when today's targets are lighter (an easy day or a deload week), or when
    a lift follows a goal's block;
  - next time's target on each exercise page, with the reason;
  - the coach's view of the split you're on at the top of its page, and a tip when reps have no range;
  - the Home card lists the next targets on wider screens, and stays short on phones;
  - the new-user tour introduces the coach.
- **Switch the coach off** in **Settings › Coach**. Its Home card is hidden, every coach hint goes, and
  sessions go back to plain next-set suggestions. Switch it back on and the card returns where it was.
  Goals are kept while it's off. The choice is saved to your account (`profiles.coach_on`).

## 0.0.10-alpha · 27 October 2026

**Swipe back on iPhone**

- **In the app installed on an iPhone, swipe in from the left edge to go back,** as in other iPhone apps.
  The page follows your finger with a shadow on its edge, a pill says where you're going ("‹ Home",
  "‹ Exercises"), and letting go past a third of the screen, or with a flick, goes back while the page
  underneath slides in. Anything less springs back. It works on pages you reach from another one (Coach, an
  exercise, a split, the guide, a session, a full-screen widget). It's off in Safari tabs and on Android,
  which have their own back.
- **How the numbers work** has a Close button at the top, not only Done at the end of a long read.
- **The today panel** shows its Close button on phones too. Swiping up still closes it.

## 0.0.9-alpha · 27 October 2026

**Admin removed**

- The admin console, account approval and account deactivation from 0.0.7 are removed from the app and the
  database. New accounts can use the app straight away again. No account was affected: all were active and
  none blocked.
- Accounts are now managed in the Supabase dashboard: see who's signed up under Authentication › Users,
  block someone by setting a ban in SQL, or delete an account (which deletes all of its data).

## 0.0.8-alpha · 27 October 2026

**The coach**

A coach that reads your log and says what to do next. It runs in your browser and is worked out again only
when your data changes (about 3 ms for three years of logs).

- **Targets for every exercise:** weight, reps and sets. With a rep range in your split, like 8–12, the
  weight stays the same until every set reaches the top, then goes up about 2.5% and back to the bottom.
  Falling short of the range twice at a weight drops it 5%. Starting a split day fills the targets in as
  hints.
- **Today: train, go easy or rest,** with the reasons: training days in a row, your split's rest day, a jump
  in this week's sets, lifts dipping under your recent best, yesterday already working today's muscles, or
  time away.
- **Lighter weeks and weeks off:** about every 10, 6 or 5 weeks depending on experience, sooner when main
  lifts stall or fall. A full week off after 16 weeks without a break, or when a lighter week didn't help.
  While a deload is due, targets are lighter with half the sets.
- **Your split:** keep it, tweak it or change it, with ideas. Give a split 6 to 8 weeks first.
- **Lift goals,** for example squat 150 kg: a realistic date and range from your own trend and typical gains
  for your level, a check on your deadline, milestones, and 4-week training blocks (build, strength, peak)
  that set that lift's targets. **I lifted it** saves the new one-rep max and closes the goal.
- A Coach card first on Home, a line in the today panel, a goal card on each weighted exercise, and Coach in
  the sidebar on a computer.
- **Fixed:** the exercise page's number tiles no longer overflow a 320px-wide phone.

## 0.0.7-alpha · 27 October 2026

**Admin console** *(removed in 0.0.9)*

- An admin console at `/admin` with an overview of accounts and activity, user management (approve,
  deactivate, reactivate, sign out everywhere, delete, make admin), errors, an activity log and settings.
- New accounts waited for an admin's approval; deactivated accounts were blocked from signing in.

## 0.0.6-alpha · 26 October 2026

**Rest days that mean rest**

- **A rest day blocks new sessions until it's undone.** The + button, the day picker, Empty, split days,
  Repeat and Second session all show a sheet with **Keep resting** or **Undo rest day**, and undoing carries
  straight on into what you were starting. A live session can still be resumed.
- **On a rest day the start button shows a moon and stars.**
- Calm greeting on rest days.
- **Fixed:** in the Ocean theme, a dark band showed under the dock when scrolled to the bottom. The page
  background now reaches every edge in all themes.
- New **ROADMAP.md**: Phase 1 of the road from Alpha to Beta, with versioning and a revision history.

## 0.0.5-alpha · 26 October 2026

**Today's plan comes down from the top**

- Pull Home down on a phone (or tap the date) and **today's plan** comes down from the top under your finger,
  and becomes **today's summary** once the day's training is done. Let go past a point, or flick down, and it
  springs open. Swipe it up to close.
- The pill under its edge reads "Swipe to see today's plan" or "…today's summary", and sits a little lower.
- Home's top no longer rubber-bands under the panel.

## 0.0.4-alpha · 26 October 2026

- **Fixed:** in the Ocean theme the floating dock on phones was nearly see-through. It's now solid; other
  themes keep their frosted dock.

## 0.0.3-alpha · 25 October 2026 *(released as 1.0.2 alpha)*

**Records, History filters, six splits, today's summary**

- **Records (PRs) known live:** a weight PR, a rep PR, or both, judged as each set is typed. A line under the
  set says what it beat, and each exercise page gets a records card.
- **History filters:** date (presets or any range), split (deleted ones too), exercise, muscle and PR kind,
  combined with search.
- **Six splits at most.** Deleting a split keeps its sessions and their split name in History.
- **Today's summary:** pull Home down or tap the date for today's sessions, sets, volume, minutes and PRs, the
  week so far, and the split's next day with each exercise's target.

## 0.0.2-alpha · 25 October 2026 *(unlabelled at the time)*

**Done for today, twice-a-day splits, rubber-band scrolling**

- **Completed today:** after a finished session, Home shows today as done, with the next split day waiting.
  Starting another session the same day asks first.
- **Twice-a-day split days:** a day can be marked "same day as" the one before it (Day 1 · 2nd session). Two
  sessions a day at most; **View sessions** shows both.
- The completed badge and session name are now one field.
- **Rubber-band scrolling on phones:** native on iPhone, recreated on Android with the same physics.
- On phones, Home widgets are one size, so there are no size controls there.

## 0.0.1-alpha · 23–25 October 2026 *(released as 1.0.0 alpha)*

**The first release**

- **Logging:** sessions with weight and reps per set (last time's numbers as hints), a rest timer, drop sets
  and linked sets named automatically (superset, giant set, drop set, rest-pause, pyramid).
- **Strength and progress:** set and session intensity, a saved or estimated one-rep max per exercise that
  offers to update when you beat it, next-set suggestions, a plate calculator, a bodyweight log and a weekly
  summary.
- **Splits:** weekly plans with templates, linked exercises, reordering, sharing by @username or link, and an
  Up next picker on Home.
- **Home:** a greeting, a quote and widgets you choose and size, each opening full screen.
- **Phone app:** install it to the Home Screen; it opens offline, can be used without an account (sync
  later), sends workout reminders, never zooms, and has a floating dock and a quick opening splash.
- **Accounts:** email and password with a six-step setup and a short tour; one signed-in device per
  account; export as JSON or CSV, and import that replaces everything in one step.
- **Look:** a monochrome design that follows your device, plus eleven named themes; the wolf mascot as logo
  and icon; a cinematic splash after logging in; page transitions and fluid controls.
- **Help:** a user guide for phone and desktop, and "How the numbers work".
- **Behind the scenes:** error reports and privacy-friendly usage stats, lint, unit and browser tests on
  every push, and a build that won't deploy if tests fail.
