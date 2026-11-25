# Synergym release notes

What changed in each release, newest first. Synergym is in alpha: features may change between releases.
Each version is set in `package.json` and shows in **Settings › About**. Planned work lives in
[ROADMAP.md](ROADMAP.md).

> **Version numbers:** the first releases were labelled 1.0.0 and 1.0.2 alpha. They were renumbered to
> 0.0.x to make clear the app is still in alpha: 1.0.0 is listed here as 0.0.1, 1.0.2 as 0.0.3, and the
> unlabelled release between them as 0.0.2.

---

## 0.2.1-alpha · 25 November 2026

**Tags: machines and labels**

- **Machines and labels:** tap the tags line on an exercise's card. A **machine** (the cable stack, the Hammer
  Strength one) keeps its own numbers: Last → Try, the faded hints, intensity, 1RM and records. **Labels** (Belt,
  Paused, Wide grip) are for finding sessions again and never change your numbers. One machine at a time, as many
  labels as you like. The sheet shows each machine's 1RM and last set, and Last → Try for what you pick.
- **"Different machine today?":** tick a set far from what that lift usually takes and one line under it offers your
  other machines, a new one, or Not now. One tap and your numbers stay right.
- **A 1RM that updates itself:** your 1RM is the higher of one you set by hand and your best set's estimate, for each
  machine. Tick a set that beats it and a short message says so; there's no question to answer mid-set any more.
- **Tags stay on:** an exercise starts with last time's machine and labels, so if nothing changed you tap nothing.
  Done on two machines? The tags line switches to the other one in one tap.
- **Suggestions instead of typing:** machine names that fit the exercise (Cable stack, Plate-loaded, Smith machine),
  and labels from your other exercises.
- **Bodyweight exercises** have labels only: their numbers are always yours, no machine.
- **The exercise page** shows a tile per machine to follow, labels that filter Recent sets, **Edit tags** (rename,
  move a tag between Machine and Labels, remove a machine never used), and puts sessions from before you added
  machines on one in one go.
- **Your setup note** is a plain note again, with a smaller sheet; **Note** sits beside the tags line.
- **Edits and deletes adjust a 1RM you set by hand:** if it came from a session you correct or delete, it goes back
  to your best estimate on its own, and **Undo** (or **Keep 1RM**) takes that back.
- Machines are named everywhere instead of lettered A and B, and the CSV export has a labels column.

---

## 0.2.0-alpha · 23 November 2026

**Machines, a calmer Home, and a little motion**

- **Track the machine you used:** an exercise can list the machines you do it on (Triceps Pushdown on the cable
  stack, or on the plate-loaded one), each with a name, what it is and your setup on it. Pick one on the exercise's
  card in a session and its own last numbers, targets, intensity, estimated max and records follow it, because
  40 kg on one machine isn't 40 kg on another. Volume, sets and streaks still add up across all of them.
- **One setup line:** the exercise note and machines are now one line on the card: **Add setup: machine, seat,
  grip**. Without machines it's your note, as before; **Done on more than one machine? Add machines** turns it into
  a machine list, and your note becomes the first machine's setup.
- **A greeting after training that knows what you did:** a new PR is named ("a new PR on Bench Press"), finishing
  your week's target says so, a streak every four weeks is counted, and otherwise you see what's next in your split.
- **By machine, on the exercise page:** each machine's estimated max and sessions. Tap one and the page's
  estimate, chart, records and the coach's next target follow it. Sessions from before you added machines show as
  **Not set**, and **Tag all** puts them on one machine in one go, with **Undo**.
- **Slight motion where there was none:** new sets and exercises fade in, a ticked set's check pops, an intensity
  number rolls to its new value, the session total gives a small nudge when it changes, and deleting a set or an
  exercise folds it away. Reduced motion and Lite mode switch it all off.
- **No more quotes:** Home's greeting stands on its own, without the motivational quote under it. On a computer
  the greeting now runs across the full width instead of sharing it with the quote.
- **Even spacing on phones:** the greeting, today's card, its buttons and your first widget now sit at an even
  distance from each other, so your widgets start higher on the screen.
- **Today's numbers in their card:** once you've trained, the sets, volume and what's next show inside the
  "Completed today" card, under the session they describe.
- **Fixed:** importing a backup no longer drops your exercise notes.

---

## 0.1.52-alpha · 23 November 2026

**Split invitations**

- **Accept or decline:** a split shared with you now arrives as an invitation at the top of Splits, with who sent
  it, when, its days, and their message if they wrote one. A number on the Splits tab says how many are waiting.
  **Accept** saves a copy to your splits, ready to train (with room made first if you have six). **Decline** asks
  once, then removes it. Open an invitation to look over every day and exercise before you answer.
- **A message with it:** when you share a split you can add a short note (up to 140 characters). It's optional.
- **See who said yes:** your share sheet shows each person as waiting, accepted or declined. After a decline, ↻
  invites them again; someone who accepted already has their copy.
- **Replaces "Shared with you":** that list is gone. A split shared before this update arrives as an invitation,
  so nothing that was shared with you disappears.

---

## 0.1.51-alpha · 23 November 2026

**Reminders in your own calendar**

- **Add a split to your calendar:** the new **Calendar** button on a split (an icon on a phone) puts your training
  days in your phone's own calendar as weekly events. Pick the weekdays, a time and how early to be reminded, and
  see the week it makes before adding anything. No account or server is involved: the app makes a calendar file
  and your phone adds it.
- **One tap to train:** each event's link opens that day's workout in Synergym, started and ready to log. If a
  session is already going, it takes you back to it. Signed out, it opens the workout as soon as you sign in.
- **Never the wrong day:** when a split has as many training days as the weekdays you pick, each event is named
  (Mon Push, Wed Pull, Fri Legs). When it rotates through the week instead, the events say Training and open
  whatever is next in the split.
- **Good to know:** on iPhone, calendar links open in Safari rather than the Home Screen app, so sign in there once,
  or open Synergym from your Home Screen. After changing a split, delete the old events and add them again.

---

## 0.1.50-alpha · 23 November 2026

**How much stronger this month**

- **Stronger than last month:** a new Home card, **This month**, says how much stronger you are than last month,
  for example "+3.1% stronger than in October". Each lift's best estimated one-rep max this month is set against
  its best last month, averaged over the lifts you trained in both, and the lifts that went up are listed.
- **A fair race:** sessions and volume are counted against the same days of last month while the month is still
  going, so the 23rd compares with the 23rd. Warm-ups and numbers flagged as likely typos are left out.
- **A look back:** in the first five days of a month the card shows the month just gone ("October in review").
  Open it for every lift, sessions, volume and records, for this month or last.
- **On every Home:** it's added after **This week**, once, even if you chose your own cards. Remove it in Edit
  home and it stays removed.
- **Fixed:** a theme picked on another device now shows as soon as the app has the latest data, instead of after
  the next restart. And opening the app from the copy kept on the phone no longer risks saving settings from that
  older copy over newer ones.

---

## 0.1.49-alpha · 23 November 2026

**A quicker exercise search, and a clearer reps-left question**

- **A quicker exercise search:** in the exercise picker the title and search stay pinned at the top while the list
  scrolls under them, so the box never slides away behind the keyboard. Names that start with what you type come
  first, then names with a word that does, with the matched letters marked; each exercise takes one line, so more
  fit above the keyboard. A search looks through every muscle (the muscle chips step aside while you type), a ✕
  clears it, and **Add "…"** for a new exercise sits at the end.
- **A clearer reps-left question:** after a set is ticked, **How many more could you do?** is one bar from 0 (all
  out) to 4+ (easy), with a dot on what you answered for that set last time, and **Skip** to put it away.
- **A steer for the next set:** once you answer, a line says what to do with the next set: all out, consider a
  step lighter; 1 or 2 left, keep the weight; 3 or more, you could add a step (reps instead, for bodyweight).
- **Search, then Enter:** the top match is highlighted, and the keyboard's Search key (Enter on a computer) adds it.
  With no match, it starts a new exercise of that name.
- **Dots, not jargon:** under a set's number, four dots fill for the reps you had left, in place of "2 RIR".

---

## 0.1.48-alpha · 21 November 2026

**Update when a new version is out, never mid-session**

- **An update popup:** when a new version of Synergym is published, a popup in the middle of the screen says so,
  with the new version and what's new in it, and the app waits behind it until you tap **Update now**. It can't be
  closed or skipped, so everyone stays on the latest version. Before this, an update only showed as a small bar, or
  the app reloaded by itself.
- **Never during a session:** while a session is live (even if you've stepped away to Home) or you're editing one,
  the popup waits. It comes up once you've finished or discarded it, and not while a sheet is open or you're typing.
- **Nothing lost:** Update now saves anything still waiting to upload first. Without a connection it says "Waiting
  for connection…" and goes ahead once you're back online.
- **What's new is written for you:** each release's first few headlines from these notes show in the popup.

---

## 0.1.47-alpha · 20 November 2026

**Fixes for the first two issues on GitHub**

- **The exercise list stays above the keyboard (issue #2):** on an iPhone, typing in the exercise search slid the
  keyboard over the list, so the matches were hidden. While a keyboard is up, the sheet now fits the visible part of
  the screen above it, and its list scrolls there.
- **Edit on every finished session (issue #3):** a session opened from Home or an exercise's page used to be
  read-only, with editing tucked away in its ⋯ menu. Every finished session now has **Edit**, at the top and next to
  Repeat at the bottom, wherever it's opened. Its numbers still don't change until you tap it.
- **Typos are caught (issue #3):** one slip like 106 reps for 10 used to wreck an exercise's numbers (an estimated max
  of 362 kg, a coach target of 80 × 106). Now a number far beyond your usual asks before it counts: **106 reps? You
  usually do 8**, with **Keep** or **Make it 10** (and Undo). Reps are asked about from 30 and over three times your
  usual; a weight from 40 kg and over two and a half times your heaviest; with little history, only 100+ reps or
  500+ kg. Until you answer, the set is left out of records, estimated maxes, intensity, volume, hints and the coach.
- **Old typos are found:** sets already logged that look like typos show on their session ("Typo? … Fix it") and on
  the exercise's page ("1 set looks like a typo" with **Fix it**, which opens the session ready to edit). Fix one or
  keep it, and the numbers come right everywhere.

---

## 0.1.46-alpha · 19 November 2026

**A steadier instant start**

- **No redraw for nothing:** after opening from the copy on your device, the app redrew the page as soon as the
  server answered, even when nothing had changed. You couldn't see it, but it could cut an opening animation short
  or move the keyboard's focus. It now redraws only when the server's data differs, and the same goes for the
  refresh when you come back to the app after a while.
- **A fresher copy:** the copy on your device is saved again right after each change reaches the server (and a
  second and a half after you stop typing), so opening the app moments after a change shows it straight away.

---

## 0.1.45-alpha · 19 November 2026

**Opens at once, a smaller app, and tidier details**

- **Instant start:** with an account, the app used to wait for your whole history to download before showing
  anything: a few seconds on 3G, and an error page on a patchy signal. It now opens straight away from a copy kept
  on your device, then catches up with your account in the background. If the server can't be reached, your log
  stays on screen with a note ("Showing what's saved on this phone") instead of an error. The copy is per account,
  kept in its own small database on the device, and deleted when you sign out.
- **A smaller app:** the database library bundled parts the app never uses (live updates, file storage, server
  functions). Using only its sign-in and database parts makes the app about 95 KB smaller (26 KB less to
  download), with the same sign-in, so nobody is signed out by the update.
- **One unit for volume:** volumes from 1,000 kg up show in tonnes (6.5 t, 15.2 t), so a list never mixes
  "6,510 kg" with "15.2 t". In pounds it's thousands (14.3k lb).
- **Menus read better:** each option's hint now sits under its label, so a long hint reads as a line instead of a
  squeezed column beside it.
- **Shorter editing bar:** while editing or logging a past day, the bar says "Save to keep it" instead of
  "Nothing is saved until you tap Save", so it fits on a phone.
- **Fix:** an exercise note added while offline could be lost if the app was closed before it synced. It's kept now.

---

## 0.1.44-alpha · 19 November 2026

**A summary when you finish, warm-ups, notes, reps in reserve, and drag to reorder**

- **Finish summary:** tapping **Finish** now shows how it went: intensity, volume, sets and minutes, the volume
  change on the last time you did this split day (or a session of the same name), any records, and your best set
  with its estimated 1RM. **Undo finish** takes you straight back to logging, every set and hint as it was.
- **Warm-up sets:** before your working sets, **+ Warm-up** adds warm-ups that build to the first working weight:
  about 40%, 60% and 80% of it for 8, 5 and 3 reps (two steps for light weights), rounded to what you can load.
  They show as W1, W2… above set 1, tick like any set, and never count toward records, intensity, volume or the
  coach. Delete one, or all, from its number. Ticked warm-ups are saved with the session; the rest are dropped.
- **Drag to reorder:** hold the six dots beside an exercise's name and move it, in a live or edited session and in
  a split day. The others slide out of the way, the page scrolls along at the edges, and on a computer's two
  columns it moves across too. Move up and Move down stay in the ⋯ menu for the keyboard.
- **Exercise notes:** an exercise can keep a note (seat, grip, setup, up to 200 characters). Add it from its card
  in a session or from the exercise's page; it shows on that card in every session. Notes are part of export and
  import, and of offline mode.
- **Reps in reserve:** after you tick a working set, a small **Reps left?** row asks how many more reps you had in
  you: 0, 1, 2, 3 or 4+. Tap one or carry on (it moves to the next set you tick). The answer shows as "2 RIR" under
  the set's number and is saved with the set; the set's menu asks again, and tapping the same answer clears it.
  For now it's a record for you; the coach doesn't use it yet.

---

## 0.1.43-alpha · 18 November 2026

**Fixes from a full check on phone and computer**

- **The Coach says one thing:** when a week off was due, the Coach could say **Train** ("nothing says you need a
  rest") right above **Take a week off**, and Home still said the next day "is calling". A break that's due now
  leads the call: a week off reads **Week off** (with *Make today a rest day*), a deload reads **Deload**, and Home's
  greeting agrees. Targets are unchanged.
- **One "this week":** Home's This week card counted from the start of your week, the Coach the last 7 days, so
  the same screen could say 2 of 3 and 4 of 3. Both now count from the start of the week you chose in Settings.
- **No blank screen after a release:** for a few seconds after an update, the app could load a page whose files
  weren't online yet. It now opens the last version that works until the new one's files are there, then switches;
  a file that fails to load is retried. Build files also load from the phone's copy more reliably.
- **Easier to read:** grey text (dates, hints, labels) is a step darker in every theme, to the 4.5:1 contrast
  that small text needs. Each theme keeps its own colours.
- **Logbook calendar on smaller laptops:** between tablet and full desktop widths, the days that list what you
  trained got too narrow to read. Below 1200px wide the calendar keeps compact days, with the day and the month
  beside it.
- **Keyboard on a computer:** an open menu keeps Tab and Shift+Tab inside it, and gives focus back to the button
  that opened it when it closes.
- **Fingertip-sized taps on a phone:** Home's widget dots, a split day's up/down arrows, text links, the date on
  Home and the switches in Settings take a tap just beside them too. They look the same.

---

## 0.1.42-alpha · 18 November 2026

**Messages that match the app, and swipe away**

- **Glass, like the session bar:** the messages at the top of the screen ("Saved", "… swapped for …" with Undo) are
  now the same frosted glass as the bar at the bottom of a session, with the action (Undo) as a solid button like
  that bar's Save or Finish. They follow the theme: light glass on light themes, dark on dark ones.
- **Swipe up to dismiss:** a message follows your finger; swipe it up and it's gone, let go early and it springs
  back. Its time stops while you hold it, and a swipe that ends on Undo doesn't press it. A message without a button
  also clears with a tap.

---

## 0.1.41-alpha · 14 November 2026

**Replace an exercise mid-session**

- **⋯ › Replace exercise:** in a live session (or one you're editing), an exercise's ⋯ menu can swap it for another.
  The new one takes the same place and the same number of sets, keeps any superset links, and shows its own last
  numbers as hints, so its weights never come from the exercise it replaced. With no history yet, the reps hint stays
  and the weight is left blank. **Undo** puts it back.
- **The right swap first:** the picker lists exercises for the same muscle first, under "Also works quads" (or chest,
  back…), most used at the top, then everything else; exercises already in the session say so. A lift swaps for a
  lift and cardio for cardio. Search and "add a new one" work as usual.
- **Sets already logged? It asks once:** **Swap the rest** keeps the done sets with the old exercise and puts the
  new one just below with the sets that are left (the machine was taken); **Move all** takes every set, numbers and
  all, to the new exercise (they were logged under the wrong one). With nothing logged, the swap is instant.
- **Nothing else changes:** your split keeps its plan, and records, the coach, the Logbook and widgets follow the
  session as it now is. Finished sessions opened just to view don't offer it.

---

## 0.1.40-alpha · 12 November 2026

**The guide catches up, and the Logbook's List edits like its Calendar**

- **Open from the List, edit right there:** a session opened from the Logbook's List now has **Edit**, as one opened
  from its Calendar does; the List is the Logbook. Opened anywhere else (Home's recent sessions, an exercise's
  page), a session stays read-only, and **⋯ › Change this session** now opens it ready to edit.
- **No more pointers to the old hold on +:** a tap on a read-only session's numbers, and its ⋯ menu, used to say
  "hold + and slide up" for the Logbook, a gesture removed in 0.1.38. They now point to ⋯ › Change this session.
- **The user guide is up to date:** the dock's tabs (Logbook in History's place), the sidebar (Logbook and the **L**
  key), the Coach all at once on a computer, Consistency's year on a phone, and how and where a session can be
  changed. The README and roadmap match the app too (cardio is marked as shipped).

---

## 0.1.39-alpha · 7 November 2026

**Widgets open like the Coach, and a smoother Logbook flip**

- **Every widget opens like the Coach:** the page rises over Home as Home sinks back, then its title, options and each
  section come in one after another. Closing plays it in reverse and puts you back where you were on Home. (Before,
  the card grew into the page.)
- **Calendar and List flip smoothly:** the Logbook's title and switch hold still, the switch's pill glides across, and
  the page underneath slides sideways toward the side you picked, the same motion as changing tabs.

---

## 0.1.38-alpha · 7 November 2026

**One Logbook: History and the Logbook are now the same tab**

- **One place for every session:** History is now the **Logbook**, in the same spot on the dock and in the sidebar,
  with a book for its icon. A **Calendar | List** switch at the top flips between the month calendar and the list of
  every session (search and filters as before), and the tab opens on the one you used last. The title and switch
  stay put as you flip.
- **No more hold on +:** the + button only starts a session now; the Logbook is simply its tab. On a computer the
  **L** key and a click on any day of the Consistency map still take you there.
- **A calendar made for a computer:** each day shows what you trained and its volume, as a calendar app's month does;
  beside it are the day you picked and **This month** (sessions, training days, volume, cardio, rest days, and what
  you trained). Phones keep the compact calendar.
- **Logged for a past day, counted everywhere:** a session you log for an earlier day shows in your week, the
  Consistency map, recent sessions, the exercise's page, records and the coach, as any other does (now tested).

---

## 0.1.37-alpha · 7 November 2026

**Coach made for a computer, the Logbook one click away, and a bigger year**

- **Coach on a computer:** the whole page at once, no tabs. Today's call is one wide banner (the call, its reason
  and the Start button), then the next session and your goals beside recovery, which stays in view as you scroll.
  A COACH title heads it like the other pages. Phones keep their tabs.
- **The Logbook on a computer:** it's in the sidebar under History, on the **L** key from anywhere, and a click on
  any day of the Consistency map opens that day in it. Holding Start session still works.
- **A year of Consistency on a phone:** 52 weeks now show as two rows of half a year, older on top, so each day
  is twice the size it was.

---

## 0.1.36-alpha · 7 November 2026

**Slide along any switch, and Ocean retired**

- **Slide to choose, like the dock:** every switch in the app (Units, Week starts on, the Coach tabs, a widget's
  range and size, the plate calculator's bar, the guide's Phone and Desktop) can now be slid along as well as
  tapped. Press, slide, and the pill follows your finger; each option lights up with a light tick as you pass it,
  and letting go picks it. Sliding up or down still scrolls the page, and a tap still works as before.
- **The Ocean theme is gone:** Auto plus ten named themes remain. If you had Ocean chosen, Synergym switches you to
  Auto (it follows your phone's light or dark setting); pick any theme in **Settings › Appearance**.
- **Nothing else changes:** your data, other themes, the dock and the glass finish are as they were.

---

## 0.1.35-alpha · 7 November 2026

**A glass finish, in every theme**

- **Light on the edges:** cards, exercise cards in a session and split cards now catch a rim of light along
  their top edge, with a soft sheen under it and a little light pooling up from the bottom, like a glass card.
- **The dock and the + too:** the dock, the highlight on the tab you're on and the + button get the same lit top
  edge; the + also has a gentle gloss.
- **Your colours stay yours:** only light is added (white on dark themes, a faint shade on light ones), so every
  theme keeps its colours, and nothing moves, changes size or animates differently.

---

## 0.1.34-alpha · 6 November 2026

**A smooth dock, even when the phone is busy**

- **No more stutter going to Settings and back:** the dock's stretch and the highlight used to be drawn by the
  page itself, so whenever the phone was busy (drawing the new page as it slides in) they froze for a moment and
  jumped. Now every moving part of the dock (the pill's end, the tabs, the highlight and the +) moves by
  transform, which phones run smoothly at their full frame rate, up to 120 fps, whatever the page is doing.
- **Same look, same timing:** the + still minimizes first and the dock then stretches into its place; back, the
  dock shrinks and the + grows in. Nothing about how it looks has changed.

---

## 0.1.33-alpha · 6 November 2026

**Drag along the dock, and a calmer + on Settings**

- **Drag the dock, as on iPhone:** press on the dock and slide. The highlight lifts and follows your finger, each
  tab lights up as you pass it with a light tick, and the tab you let go on opens. Tapping a tab still works.
- **One thing at a time on Settings, and calmer:** the + now minimizes first (about half a second), drifting to
  the right as it shrinks, and only then does the dock stretch gently into its place. Leaving Settings is the
  mirror: the dock shrinks back first, then the + grows in from the right with a soft bounce.

---

## 0.1.32-alpha · 6 November 2026

**The + minimizes on Settings**

- Tapping **Settings** now minimizes the **+**: it shrinks into its own centre where it stands, the + turning a
  quarter, while the dock's end slides in underneath it. Leaving Settings, it grows back out of the dock with a
  slight bounce and turns upright again.
- Before, the + was pushed to the right by the stretching dock and faded out, so it looked like it blinked away.
  The dock's frame now keeps one size and only its pill stretches, so page changes never squeeze the dock either.

---

## 0.1.31-alpha · 5 November 2026

**Superset a set from its menu**

- Tap a set's number and choose **Superset with…**. The session's other exercises are listed with their sets as
  chips (weight × reps, or "empty"); tap the one to pair with and the two are linked as a superset, tagged
  SS·A, SS·B and so on, with a note saying what was linked.
- **+ New set** adds a set to that exercise (hinted like its last one) and links it in one go.
- A set that's already in a superset shows its tag and an outline; picking it brings your set into that group,
  so three exercises become a giant set. Unlink from group in the same menu still separates a set again.
- The link button in the bottom bar still works for selecting several sets at once.

---

## 0.1.30-alpha · 5 November 2026

**The dock on Settings stretches into the +'s place**

- On **Settings** the dock no longer jumps to the full width of the screen. Its left edge stays where it is and
  only its right end slides over as the **+** shrinks away, so the dock is exactly as long as the dock and the +
  were together. Leaving Settings brings the + back the same way.

---

## 0.1.29-alpha · 5 November 2026

**Polish from a full check across every theme**

- Checked every theme (Auto in light and dark, and all twelve named ones) on Home, History with a row swiped open,
  a session with a lift and a run, the exercise picker, Settings, and the Logbook's hold, reveal and close,
  plus the computer's sidebar: no errors anywhere, and the layouts hold.
- **Fixed:** right after switching theme in Settings, the dock kept the previous theme's light or dark tones
  until the app was reopened. It now changes with the theme.
- **Clearer dock icons in light themes:** the icons of the tabs you're not on were a pale grey on the grey dock;
  they're a little darker now (comfortably readable in Mono Light, Solarized Light, Gruvbox Light and Sage).

---

## 0.1.28-alpha · 5 November 2026

**A new dock on phones**

- The dock is now a compact pill of icons (Home, Splits, Exercises, History, Settings) with the round **+**
  beside it, level with it, instead of a full-width bar of labelled tabs with the + floating above. The names
  are gone from view but still read out by screen readers.
- The tab you're on sits in a soft raised circle (white on grey in light themes, a lighter tone in dark ones)
  that glides to the next tab when you switch. Tabs dip slightly when pressed.
- On **Settings**, which has no + button, the + shrinks into the dock as the dock spreads across the full width,
  and comes back when you leave.
- Home's widgets now fill down to the dock itself, since the + no longer floats above it.

---

## 0.1.27-alpha · 4 November 2026

**Theme picker spacing**

- On a phone, the strip of themes in **Settings › Appearance** no longer starts flush against the card's edge:
  the first theme lines up with "Theme" and "Home widgets", and scrolled to the end the last one keeps the same
  space before the edge. (Snapping pulled the first tile to the edge, and Safari dropped the space at the end.)

---

## 0.1.26-alpha · 4 November 2026

**Edit a session straight from History**

- Swiping a session left in History (or on a Logbook day) now shows two round buttons: a grey **pencil** and the
  coral **bin**. They grow in one after the other as the row makes room, with clear space after the score.
- The pencil opens the session already being edited, exactly as **Edit** does in the Logbook: change sets,
  add or remove exercises, and nothing is saved until **Save** (as today's session, or as an update to this
  one); ✕ or leaving puts it back as it was. A live session simply opens.
- On a computer, the pencil and the bin appear beside a row while you hover it.
- Opening a past session normally still shows it as logged, read-only; the pencil is the quick way in.

---

## 0.1.25-alpha · 4 November 2026

**More room around Delete**

- A swiped-open session row now leaves about 30px between the score and the Delete pill (it was about 18px),
  so the two never feel crowded.

---

## 0.1.24-alpha · 3 November 2026

**Add your own exercise from any muscle group**

- In the exercise picker (adding to a session or a split day), every muscle group now ends with **Other …
  exercise**, like **Other cardio…**: "Other chest exercise…", "Other back exercise…" and so on, with a couple
  of examples. Tap it and **Add exercise** opens with that group already chosen; save and it goes straight into
  your session (or split day) and your exercise list. Your own muscle groups get the row too.

---

## 0.1.23-alpha · 3 November 2026

**A cleaner swipe to delete**

- Swiping a session left no longer slides the whole row off the screen. The row makes room instead: the name
  keeps its place and shortens with "…", the score moves over, and a rounded **Delete** pill grows in from the
  right edge, coloured like the app's chips (dark text on coral in dark themes, light on deep red in light
  ones), so it reads clearly in every theme. Its bin and word fade in once there's room, never half cut.
- More room: a wider pill, with clear space between it and the score.
- Smooth all the way: while your finger is down the row follows it exactly; let go and it eases open or shut
  frame by frame (the same on every phone, older iPhones included). Let go past half way, or flick, and it
  stays open; anything less springs back. Push an open row back to shut it, or tap anywhere else. It never
  covers the score while you swipe.
- After you confirm, the deleted row fades, slides a little and folds away, and the rows below close the gap.
  Deleting still asks first.

---

## 0.1.22-alpha · 3 November 2026

**Cardio**

- **Cardio in any session.** Tap + and choose **Cardio**: Run, Walk, Cycle, Row, Elliptical, Stairs, Swim,
  Jump rope or HIIT, or **Other cardio…** to name your own (assault bike, a class). Picking one adds it to your
  exercise list.
- **Time always, plus what you choose.** Under the name, **Track** turns on distance (with pace worked out, or
  speed on a bike), average heart rate, calories and effort 1–10 (a ten-step scale). Your choice is remembered
  for that exercise. Time takes 30, 30:15 or 1:05:00; distance is km (miles with lb), metres for rowing and
  swimming, paced per 500 m and per 100 m.
- **Records:** longest, farthest and fastest pace, shown as you type and when you tick the bout, like lifting
  PRs. Each cardio exercise has its own page: records, minutes by session, totals and recent bouts.
- **Cardio days.** Add cardio to a split day and set its minutes; a day of only cardio shows as a **Cardio
  day** with the minutes planned, and starting it fills in the time.
- **It counts.** Cardio sessions count toward the weekly target and streak, show on the heat map and in the
  Logbook (shaded by effort), and appear in History as "35 min cardio". The coach keeps reading lifting only.
- CSV export has time, distance, heart rate, calories and effort columns.
- Database: exercises can now be of kind cardio (`c`); see `supabase/schema.sql`.

---

## 0.1.21-alpha · 3 November 2026

**Delete a session from anywhere**

- **Swipe a session left** in History or on a Logbook day and a red **Delete** grows in from the edge; let go
  past halfway and it stays open, tap anywhere else to close it. On a computer, a bin slides in beside the row
  you hover.
- **Every session's ⋯ menu** has **Delete session**, including sessions opened from History, which used to be
  view-only. A live session also has a quiet **Discard session** under its notes.
- **It always asks first**, naming the session and its date. Records, estimates, the coach and your widgets
  update by themselves, and if a 1RM you saved came from the deleted session, Synergym offers to go back to
  your best estimate.

---

## 0.1.20-alpha · 3 November 2026

**The Logbook opens with a circular reveal**

- Let go of the capsule and the Logbook is uncovered by a circle growing from its knob, quick to start and
  settling gently. The page underneath holds still, so there's no blank moment and nothing slides into place.
  Closing it shrinks the circle back into the + button (Start session on a computer).

---

## 0.1.19-alpha · 31 October 2026

**Smoother opening, and a key for the Logbook**

- **Opening a widget is one smooth motion.** The card grows into the full view as a single surface: what was on
  the card fades out first, and the full view fades in as it finishes growing. Before, both showed through each
  other halfway, and the page kept drifting after it landed. Closing shrinks it back into its card the same way.
- **The Logbook moves the same way.** It still grows out of the capsule, and now shrinks back into the + button
  when you close it, instead of just fading.
- **The Logbook has a key** under the calendar, in the Consistency heat map's words: less to more intense, rest,
  and today.

---

## 0.1.18-alpha · 31 October 2026

**Striped rest days on the Consistency heat map too**

- Rest days on the Consistency heat map (the Home card and its full view) are now striped like the Logbook's,
  and the **Rest** key in its legend matches. The stripes are finer on the 52-week view, where the days are small.

---

## 0.1.17-alpha · 31 October 2026

**A calmer Logbook**

- **Room to breathe.** Days without a session are now just their date, with more space between days and around
  the month. Only days you trained get a tile (darker for harder sessions), so your training stands out at a glance.
- **Rest days are striped,** with diagonal lines, instead of an outline.
- **The capsule stays a pill.** Sliding past the end of the Logbook capsule no longer pushes its knob outside the
  pill; it stops at the far end, with the same gap all round.

---

## 0.1.16-alpha · 30 October 2026

**Swipes that can't get stuck**

- **Fixed:** on an iPhone (the app installed), a swipe back from the left edge started in the first second after
  opening the app could leave the page stuck partly slid over. The finger had landed on the launch splash, which
  fades out and leaves the page mid-swipe, and the end of the swipe was then never heard. Our test suite caught
  it on GitHub's slower machines.
- The same guard now covers every touch gesture: swiping back, pulling down the today panel, and the stretch at
  the top and bottom of the page. Each listens on the element your finger touched as well as the page, so the
  end of a gesture always lands, even if what you touched is redrawn mid-gesture.

---

## 0.1.15-alpha · 30 October 2026

**On a computer, the Logbook opens to the right**

- Holding **Start session** in the sidebar now brings the Logbook capsule out **beside** the button, level with
  it, and you **drag right** into it (or click it). On a phone it's unchanged: hold + and slide up. The capsule is
  solid over the page so its label stays readable.

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
