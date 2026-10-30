# Synergym release notes

What changed in each release, newest first. Synergym is in alpha: features may change between releases.
Each version is set in `package.json` and shows in **Settings › About**. Planned work lives in
[ROADMAP.md](ROADMAP.md).

> **Version numbers:** the first releases were labelled 1.0.0 and 1.0.2 alpha. They were renumbered to
> 0.0.x to make clear the app is still in alpha: 1.0.0 is listed here as 0.0.1, 1.0.2 as 0.0.3, and the
> unlabelled release between them as 0.0.2.

---

## 0.1.14-alpha · 30 October 2026

**The Logbook**

- **Hold +, slide up.** Press and hold the round + button (Start session in the sidebar on a computer). A capsule
  rises from it, the way holding the mic and sliding up works in Telegram and WhatsApp. Slide up into it and let
  go: the Logbook grows out of the capsule. Let go early and it springs back; let go without sliding and the capsule
  waits a moment so you can tap it. A plain tap on + still starts a session. Holding Space on the button works too.
- **A calendar of every day,** shaded like the Consistency heat map (darker is harder, outlined is a rest day, today
  is ringed). Swipe or use the arrows for other months; the future stays closed.
- **Tap a day** to see its sessions. Open one to **Edit** it, with everything a live session has, linking sets
  included: save it as today's session or update it, with Undo. **Log a session** fills a day you didn't log, from
  your split or empty; **Rest day** marks it as rest.
- **The one place past days change.** Sessions opened from History or Home are view-only now (Repeat still works);
  a tap on one points you to the Logbook. The Consistency heat map and History no longer log days themselves.
- Records, estimated 1RMs, the coach and widgets follow every change, and a saved 1RM that no longer matches is
  offered for update, as before.

---

## 0.1.13-alpha · 30 October 2026

**Log the days you missed, and a saved 1RM that keeps up with your edits**

- **Log a past day.** Open the Consistency widget and tap any day, or tap **Log a past day** in History. You see
  what's on that day and can log a session for it (filled in from your split, or empty) or mark it a rest day.
  The session opens ready to fill in, dated that day at the time you usually train; tick the sets you did or type
  them, then Save. Nothing is saved until you do, and leaving drops the draft.
- **Your saved 1RM follows your edits, when you say so.** Records, estimated 1RMs, the coach's targets, streaks and
  every widget already recalculate after an edit. A 1RM you saved yourself didn't, so the coach kept planning from
  it. Now, after you save an edit or a missed day:
  - a set that beats your saved 1RM brings up the familiar **New 1RM PR?** sheet, dated from that session;
  - correcting the session your saved 1RM came from (say, a typo) offers to lower it back to your best estimate.
  Undo takes the 1RM back too.

---

## 0.1.12-alpha · 30 October 2026

**Edit a past session, and save it as the latest**

- **Finished sessions are locked until you tap Edit.** Before, a stray tap on a number in an old session changed
  your history straight away, with no Save and no Undo. Now a finished session reads exactly as you logged it; a tap
  on a number points you to **Edit**.
- **Edit** unlocks it as a draft: change any set, add or remove sets and exercises, and new records show as you type.
  Nothing is saved until you choose how:
  - **Save as today's session** logs it as a new session dated today. The original stays as it was.
  - **Update** fixes the original where it is.
- **Undo** follows every save for a few seconds. **✕**, or leaving the page, drops the changes, and Undo brings them
  back. A draft is never saved to your account or your phone, even if the app closes mid-edit.
- Inspired by Hevy's Edit Workout and Copy Workout, and StrengthLog's record list that updates when you fix a workout.

---

## 0.1.11-alpha · 29 October 2026

**CBum on Home**

- **Three quotes from Chris Bumstead (CBum),** six-time Classic Physique Olympia champion, joined the Home quotes:
  on champion mentality, and on never being the biggest guy in the gym. Each is from his own posts as reported
  by fitness news sites; the many lines credited to him online with no source were left out.

---

## 0.1.10-alpha · 29 October 2026

**Tap the quote for another**

- **More to read on Home:** Stoic lines from Marcus Aurelius, Seneca and Epictetus, and Dorian Yates on how he
  trained, joined the quotes. Each was checked against its source (standard translations for the Stoics; Yates'
  own interviews and posts), and the popular lines with no traceable source were left out.
- **Tap the quote (or press Enter on it) and the next one comes in.** Quotes come from a shuffled deck, so you
  see every one before any comes round again. A small shuffle mark next to the name shows it can be tapped.
- **On phones, the widgets resize with the quote** as it changes, so they still end just above the **+** button
  and nothing below them jumps.

---

## 0.1.9-alpha · 29 October 2026

**Fast with a big log, and a round of fixes**

Measured on a phone slowed to mid-range speed, with three years of training (about 620 sessions):

- **Exercises opens in about 0.13 s instead of 1.6 s,** and History in about 0.13 s instead of up to 0.8 s.
  Typing in History's search no longer stutters (from about 0.5 s per key to under 0.06 s). Home, Splits and
  Settings open about three times faster.
- **Records (PRs) are worked out far faster** as the log grows, and the numbers behind every screen are worked
  out again only when your data changes, not on every screen.
- **History shows 60 sessions at a time** and loads the next ones as you scroll; each month still shows its full
  count and volume.
- **During a workout,** a weight or reps you type saves at once, and the intensity and record lines update when
  you pause, so typing stays smooth.
- **Smoother scrolling on Android:** scrolling no longer waits for the app between movements, except for a
  swipe that starts at the very top or bottom (where the stretch and the today panel need it).

Fixed:

- An empty set in a live session became 0 kg × 0 after the app reopened or refreshed, so its hints vanished and
  ticking it asked for reps. Empty sets stay empty, and sets already saved as zeros read as empty again.
- Swapping two muscle group names (A to B and B to A) merged the two groups.
- A rest timer started within two seconds of the previous one ending was cleared straight away.
- Reordering a split's days left the day picked as up next pointing at a different day.
- Dragging a sheet closed could close a sheet opened just after it; a drag interrupted by the phone left the
  sheet half-way down.
- Logging in or signing up said nothing when the connection failed.
- Exports were stamped with the UTC date, and the CSV's times were in UTC; both now use your local date and time.
- A session holds up to 60 exercises: adding more now says so, instead of the extra ones going missing on the
  next load.

## 0.1.8-alpha · 29 October 2026

**Widgets first on phones, and an Ocean theme that holds together**

- **A compact greeting on phones.** The welcome text is about two thirds of its old size, in the same bold type,
  and the quote and spacing are tighter, so your widgets start about a third of the way down the screen instead
  of halfway (or lower on small phones). The first widget is taller for it. On short phones (iPhone SE and
  smaller) the quote steps aside for the widgets.
- **Edit home sits on the left on phones,** clear of the Start session button floating bottom right, and the
  widgets now stop above that button rather than running under it.
- **Ocean (the blue theme) looks the same everywhere:**
  - a widget opened full screen sits on the page's own blue gradient, instead of a flat navy block with the
    gradient showing round its edges;
  - its opening and closing animation, the today panel, the strip under the status bar and the opening splash
    use the same gradient, lined up with the page, instead of a flat colour.
  Other themes are one colour, so nothing changes for them.

## 0.1.7-alpha · 28 October 2026

**Reminders removed**

- Workout reminders are removed: **Settings › Reminders**, the push notifications, the server function that
  sent them and the schedule behind it. A phone that had signed up for them stops listening the next time the
  app opens, and nothing more is sent.
- In the database: the reminder settings on profiles (`reminder_on`, `reminder_time`, `reminder_days`, `tz`,
  `reminder_sent_on`, `reminder_brief`, `reminder_pushed_on`), the `push_subscriptions` table, the reminder
  functions and the schedule are deleted. No workouts or other data were touched.
- Unchanged: the start of the week, the close button and everything else from 0.1.6.

## 0.1.6-alpha · 28 October 2026

**Reminders about your sessions, and one close button everywhere**

- *(Removed in 0.1.7)* **Reminders are now about your sessions:**
  - **A session to finish:** one you started 3+ hours ago and never finished: "Push is still open · You
    started it earlier today and logged 9 sets. Finish it to save them and keep your next targets right."
    Tapping it opens that session. This one comes even on a day you've trained or marked as rest; one left
    open for days comes up every 3 days.
  - **Otherwise, your next session:** the day of your split and its first targets, like "Next up: Lower ·
    Back Squat 137.5 kg × 5, Romanian Deadlift 100 kg × 8, Leg Press 180 kg × 10, then 2 more." At most one
    short line comes first: your first session, coming back after a break, a lighter week, an easy day, one
    more for your weekly target, or the week so far.
  - Reminders about goals and records are gone. They stay quiet while you're training (a session started under
    3 hours ago), and the other quiet rules are unchanged.
- **One close button across the app:** every sheet, the today panel, the Coach, full-screen widgets and the
  tour now close with the same round ✕ in the top right corner, with a larger touch area. Sheets that said
  Close, Done or Later in that corner use it too, and confirmation sheets get one as well. Buttons that do
  something (Cancel, Skip, Got it) stay as they were.

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

**Reminders that know your training, and that keep arriving** *(removed in 0.1.7)*

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
  later), sends workout reminders *(removed in 0.1.7)*, never zooms, and has a floating dock and a quick opening splash.
- **Accounts:** email and password with a six-step setup and a short tour; one signed-in device per
  account; export as JSON or CSV, and import that replaces everything in one step.
- **Look:** a monochrome design that follows your device, plus eleven named themes; the wolf mascot as logo
  and icon; a cinematic splash after logging in; page transitions and fluid controls.
- **Help:** a user guide for phone and desktop, and "How the numbers work".
- **Behind the scenes:** error reports and privacy-friendly usage stats, lint, unit and browser tests on
  every push, and a build that won't deploy if tests fail.
