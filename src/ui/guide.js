/* The user guide (Settings › User guide) and the short tour new users see after setup.
   Written twice where phone and desktop differ; everything else is shared. */
import { ICON } from './brand.js';

const PLATE = '<svg class="ico" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.4"/></svg>';
const BELL = '<svg class="ico" viewBox="0 0 24 24"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5h4"/></svg>';
const CLOUD = '<svg class="ico" viewBox="0 0 24 24"><path d="M7 18h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.2 9.1 4.5 4.5 0 0 0 7 18z"/><path d="M4 4l16 16"/></svg>';
const PHONE = '<svg class="ico" viewBox="0 0 24 24"><rect x="7" y="3" width="10" height="18" rx="2.5"/><path d="M11 18h2"/></svg>';
const CHART = '<svg class="ico" viewBox="0 0 24 24"><path d="M4 19h16M7 16v-4M12 16V8M17 16v-7"/></svg>';

/* each section: id, icon, title, one-line summary, numbered steps, and an optional tip */
export function guideSections(device) {
  const phone = device === 'phone';
  return [
    { id: 'around', icon: ICON.home, t: 'Getting around', s: phone ? 'The dock at the bottom takes you everywhere.' : 'The sidebar on the left takes you everywhere.',
      steps: phone
        ? ['<b>Home</b> shows your next session, a quote and your widgets. Swipe the widgets sideways.', '<b>Splits</b> holds your training plans. <b>Exercises</b> is your library with each lift’s history. <b>History</b> lists every session.', 'The round <b>+</b> button above the dock starts a session from any tab.', '<b>Settings</b> has your profile, theme, reminders and data.']
        : ['<b>Home</b> shows your next session, a quote and your widgets.', '<b>Splits</b> holds your training plans. <b>Exercises</b> is your library with each lift’s history. <b>History</b> lists every session.', '<b>Start session</b> at the top of the sidebar starts a session from anywhere.', '<b>Settings</b> sits at the bottom of the sidebar.'],
      tip: 'Your changes save on their own. There’s no save button anywhere.' },
    { id: 'start', icon: ICON.plus, t: 'Start a session', s: 'From your split, or empty.',
      steps: [phone ? 'Tap the <b>+</b> button.' : 'Click <b>Start session</b>.', 'Pick the day from your split. Its exercises, sets and reps are filled in for you. Or choose <b>Empty session</b> and add exercises as you go.', 'On Home, the <b>Up next</b> menu lets you choose which day comes next. The split carries on from there.', 'Taking the day off? Tap <b>Rest day</b> on Home so your streak shows it.'],
      tip: 'A session in progress shows a play button. Tap it to jump back in.' },
    { id: 'log', icon: ICON.check, t: 'Log your sets', s: 'Weight, reps, tick. That’s it.',
      steps: ['Type the weight and reps for a set. Faded numbers are what you did last time. Leave them and they count as typed.', 'Tick the set when it’s done. The rest timer starts if it’s on.', 'Under each exercise, <b>Last 80×8 → Try 82.5×8</b> suggests your next target. Tap <b>Use</b> to fill it in.', `<b>+ Set</b> adds a set, <b>+ Drop</b> adds a lighter drop set. ${phone ? 'Tap' : 'Click'} a set’s number for more options.`, 'Tap <b>Finish</b> in the bar at the bottom when you’re done.'],
      tip: 'The intensity number shows how hard each set was against your best on that lift. 100 means you matched or beat it.' },
    { id: 'link', icon: ICON.link, t: 'Supersets and drop sets', s: 'Link sets and Synergym names them.',
      steps: ['In a session, tap the <b>link</b> button in the bottom bar.', 'Select two or more sets, then tap <b>Link</b>.', 'Two exercises make a superset, three or more a giant set. On one exercise, falling weight is a drop set.', 'In a split, link exercises the same way so every session starts with them grouped.'] },
    { id: 'plates', icon: PLATE, t: 'Plate calculator', s: 'What to put on each side of the bar.',
      steps: ['Tap <b>Plates</b> under any weighted exercise, or open a set’s menu and choose <b>Plate calculator</b>.', 'It opens on your last weight. Type any other weight to see the plates.', 'Pick your bar (20, 15 or 10 kg; 45, 35 or 25 lb). The app remembers it on this device.'] },
    { id: 'splits', icon: ICON.split, t: 'Plan with splits', s: 'Your week, day by day.',
      steps: ['Open <b>Splits</b> and tap <b>New split</b>. Start blank or from a template.', 'Name each day, add exercises, and set the sets and reps.', 'Use the arrows to reorder days. Mark a day as rest if you like.', 'Share a split with another user by their @username, or create a link anyone can open.'] },
    { id: 'progress', icon: CHART, t: 'Track your progress', s: 'Widgets, history and records.',
      steps: [`${phone ? 'Tap' : 'Click'} a widget on Home to open it full screen with more detail and ranges.`, '<b>Edit home</b> lets you choose widgets, their order and size.', '<b>This week</b> shows sessions so far and the lifts that went up. <b>Bodyweight</b> charts your weight; log it there or in Settings.', 'Open any exercise to see its one-rep max, records and every set you’ve done.'] },
    ...(phone ? [{ id: 'remind', icon: BELL, t: 'Reminders', s: 'A nudge on your training days.',
      steps: ['Open <b>Settings › Reminders</b> and turn them on. Allow notifications when your phone asks.', 'Choose the time and the days.', 'On days you’ve already trained, the reminder stays quiet.'],
      tip: 'On iPhone, reminders work in the app on your Home Screen, not in Safari.' }] : []),
    ...(phone ? [{ id: 'offline', icon: CLOUD, t: 'Use it offline', s: 'No account, or no signal.',
      steps: ['In the app on your Home Screen, choose <b>Use offline</b> on the login screen to start without an account. If you already have one, go to <b>Settings › Use offline</b>.', 'Everything is saved on your phone only.', 'To sync, choose <b>Settings › Go online</b>, then log in or create an account. Your phone’s workouts are uploaded to it.'],
      tip: 'Offline data lives only on this phone. Export a backup now and then from Settings.' }] : []),
    { id: 'data', icon: ICON.share, t: 'Your data', s: 'Export, import, themes and more.',
      steps: ['<b>Settings › Export</b> saves everything as a file (JSON), or every set as a spreadsheet (CSV).', '<b>Import</b> replaces all your data with a file. You’ll see what will be replaced first.', 'Pick a theme in <b>Settings › Appearance</b>. Units, weekly target and the rest timer are in <b>Training</b>.'] },
    { id: 'install', icon: PHONE, t: 'Install the app', s: phone ? 'Put Synergym on your Home Screen.' : 'Open Synergym in its own window.',
      steps: phone
        ? ['<b>iPhone:</b> in Safari, tap <b>Share</b>, then <b>Add to Home Screen</b>.', '<b>Android:</b> in Chrome, tap the <b>⋮</b> menu, then <b>Install app</b> (or <b>Add to Home screen</b>).', 'Open it from the icon. It runs full screen, like any other app.']
        : ['In Chrome or Edge, click the install icon at the right of the address bar.', 'Or open the browser menu and choose <b>Install Synergym</b>.'] }
  ];
}

/* the first-run tour: a few cards, no reading required */
export function tourSlides(device) {
  const phone = device === 'phone';
  return [
    { icon: ICON.home, t: 'Welcome in', b: phone ? 'Home shows what’s up next and your progress. The dock at the bottom takes you everywhere else.' : 'Home shows what’s up next and your progress. The sidebar takes you everywhere else.' },
    { icon: ICON.plus, t: 'Start a session', b: phone ? 'Tap the round + button, pick today’s day from your split, and it’s filled in for you.' : 'Click Start session, pick today’s day from your split, and it’s filled in for you.' },
    { icon: ICON.check, t: 'Log as you go', b: 'Type weight and reps, then tick the set. Faded numbers are last time; the suggestion under each exercise tells you what to try.' },
    { icon: CHART, t: 'Watch it add up', b: `${phone ? 'Tap' : 'Click'} any widget on Home for the full picture. Edit home to choose what you see.` },
    { icon: ICON.prefs, t: 'All set', b: 'The full guide is always in Settings › User guide.' }
  ];
}
