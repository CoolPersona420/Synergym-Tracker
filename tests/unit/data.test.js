import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanSession, cleanDays } from '../../src/lib/sanitize.js';
import { parseImport } from '../../src/lib/importer.js';
import { profFromDb, profToDb, DEFAULT_PROFILE } from '../../src/lib/profile.js';
import { isNoise, redactPath } from '../../src/lib/telemetry.js';

test('sessions are cleaned: bad sets dropped, numbers forced, limits applied', () => {
  const s = cleanSession({ id: 'a', startedAt: 1000, items: [{ exId: 'x', sets: [{ id: 's', w: '80', r: '8.4' }, null, { w: -5, r: 3 }] }, { sets: [] }], notes: 7 });
  assert.equal(s.items.length, 1);
  assert.deepEqual(s.items[0].sets.map(x => [x.w, x.r]), [[80, 8], [0, 3]]);
  assert.equal(s.notes, '');
  assert.equal(cleanSession(null), null);
});

test('split days are capped and defaulted', () => {
  const d = cleanDays([{ type: 'Push', exercises: [{ name: 'Bench', sets: 99, reps: 8 }] }]);
  assert.equal(d[0].exercises[0].sets, 20);
  assert.equal(d[0].exercises[0].reps, '8');
  assert.deepEqual(cleanDays('nope'), []);
});

test('profile round-trips through its database row, bodyweight log included', () => {
  const p = { ...DEFAULT_PROFILE, unit: 'lb', bw: 81.234, bwLog: [{ d: '2026-10-20', kg: 81.2 }], widgets: ['week:m'] };
  const back = profFromDb(profToDb(p));
  assert.equal(back.unit, 'lb'); assert.equal(back.bw, 81.23);
  assert.deepEqual(back.bwLog, [{ d: '2026-10-20', kg: 81.2 }]);
  assert.deepEqual(back.widgets, ['week:m']);
  assert.equal(profToDb({ ...DEFAULT_PROFILE }).bw_log, null);
});

test('an export parses with fresh ids and every reference remapped', () => {
  const file = {
    app: 'Synergym', version: 3, exportedAt: '2026-10-01T10:00:00Z',
    profile: { unit: 'kg', bw: 80, nextDay: { sp: 'sp1', i: 1, at: 5 } },
    library: [{ id: 'e1', name: 'Bench Press', muscle: 'Chest', kind: 'w' }, { id: 'e2', name: 'bench press', muscle: 'Chest' }, { id: 'e3', name: 'Pull-up', kind: 'bw' }],
    sessions: [{ id: 's1', startedAt: 1000, items: [{ id: 'i', exId: 'e2', sets: [{ id: 'a', w: 80, r: 8 }] }, { id: 'j', exId: 'gone', sets: [] }], splitId: 'sp1', splitDay: 1 }],
    splits: [{ id: 'sp1', name: 'PPL', days: [{ type: 'Push', exercises: [{ exId: 'e1', name: 'Bench Press', sets: 3, reps: '8' }] }] }]
  };
  const d = parseImport(file);
  assert.equal(d.library.length, 2, 'duplicate names merge');
  const bench = d.library.find(e => e.name === 'Bench Press');
  assert.notEqual(bench.id, 'e1');
  assert.equal(d.sessions[0].items.length, 1, 'items for unknown exercises are dropped');
  assert.equal(d.sessions[0].items[0].exId, bench.id);
  assert.equal(d.sessions[0].splitId, d.splits[0].id);
  assert.equal(d.splits[0].days[0].exercises[0].exId, bench.id);
  assert.equal(d.profile.nextDay.sp, d.splits[0].id);
  assert.ok(d.sessions[0].endedAt > d.sessions[0].startedAt);
});

test('lift goals: cleaned, one per exercise, round-trip the database row, and follow their exercise on import', () => {
  const g = [{ id: 'a', exId: 'sq', kg: 150, by: 0, at: 5, from: 120 }, { exId: 'sq', kg: 160 }, { exId: 'bp', kg: -1 }, { exId: 'dl', kg: '200' }, null];
  const clean = profFromDb(profToDb({ ...DEFAULT_PROFILE, liftGoals: g })).liftGoals;
  assert.deepEqual(clean.map(x => [x.exId, x.kg, x.by, x.from]), [['sq', 150, null, 120], ['dl', 200, null, null]]);
  assert.equal(profToDb({ ...DEFAULT_PROFILE, liftGoals: [] }).lift_goals, null);
  /* the coach is on unless switched off */
  assert.equal(profFromDb({}).coachOn, true);
  assert.equal(profFromDb(profToDb({ ...DEFAULT_PROFILE, coachOn: false })).coachOn, false);
  const d = parseImport({ app: 'Synergym', library: [{ id: 'old-sq', name: 'Back Squat', kind: 'w' }], sessions: [], splits: [],
    profile: { liftGoals: [{ id: 'g', exId: 'old-sq', kg: 150, at: 1 }, { id: 'h', exId: 'gone', kg: 100, at: 1 }] } });
  assert.equal(d.profile.liftGoals.length, 1);
  assert.equal(d.profile.liftGoals[0].exId, d.library[0].id);
});

test('files that are not exports are rejected', () => {
  assert.equal(parseImport(null), null);
  assert.equal(parseImport({ app: 'Other', sessions: [{}] }), null);
  assert.equal(parseImport({ app: 'Synergym', library: [], sessions: [], splits: [] }), null);
});

test('error noise is ignored and ids are redacted from paths', () => {
  assert.equal(isNoise('Script error.'), true);
  assert.equal(isNoise('x', 'at chrome-extension://abc/x.js'), true);
  assert.equal(isNoise('TypeError: x is undefined', 'at main.js'), false);
  assert.equal(redactPath('/s/2f1c6d5e-1b2a-4c3d-9e8f-0a1b2c3d4e5f'), '/s/:id');
  assert.equal(redactPath('/today'), '/today');
});

test('the browser prefix is stripped and repeats are reported once', () => {
  const sent = [], listeners = {};
  globalThis.addEventListener = (t, f) => { listeners[t] = f; };
  globalThis.location = { pathname: '/s/2f1c6d5e-1b2a-4c3d-9e8f-0a1b2c3d4e5f' };
  return import('../../src/lib/telemetry.js').then(({ trackErrors }) => {
    const report = trackErrors(e => sent.push(e), { max: 2 });
    listeners.error({ message: 'Uncaught TypeError: x is not a function', error: { stack: 'at a (main.js:1:1)' } });
    listeners.error({ message: 'Uncaught TypeError: x is not a function', error: { stack: 'at b (main.js:9:9)' } });
    report('second'); report('third');
    assert.deepEqual(sent.map(e => e.message), ['TypeError: x is not a function', 'second']);
    assert.equal(sent[0].path, '/s/:id');
  });
});

test('reminder days and times read naturally', async () => {
  const { daysText, timeText } = await import('../../src/lib/push.js');
  assert.equal(daysText(127), 'Every day');
  assert.equal(daysText(31), 'Weekdays');
  assert.equal(daysText(96), 'Weekends');
  assert.equal(daysText(0b10101), 'Mon, Wed, Fri');
  assert.equal(timeText('18:05'), '6:05 pm');
  assert.equal(timeText('00:30'), '12:30 am');
  assert.equal(timeText('12:00'), '12:00 pm');
});

test('the week can start on Monday, Sunday or Saturday', async () => {
  const { weekStart, shiftWeek, setWeekStart } = await import('../../src/lib/util.js'), { daysText } = await import('../../src/lib/push.js');
  const wed = new Date(2026, 9, 28, 15).getTime(), day = t => new Date(t).getDay();
  assert.equal(day(weekStart(wed)), 1, 'Monday by default');
  setWeekStart(0); assert.equal(day(weekStart(wed)), 0); assert.equal(new Date(weekStart(wed)).getDate(), 25);
  /* Sunday itself starts its own week */
  assert.equal(weekStart(new Date(2026, 10, 1, 9).getTime()), new Date(2026, 10, 1).getTime());
  setWeekStart(6); assert.equal(new Date(weekStart(wed)).getDate(), 24); assert.equal(day(shiftWeek(wed, 1)), 6);
  setWeekStart('nonsense'); assert.equal(day(weekStart(wed)), 1);
  assert.equal(profFromDb({}).weekStart, 1);
  assert.equal(profFromDb({ week_start: 0 }).weekStart, 0);
  assert.equal(profFromDb({ week_start: 3 }).weekStart, 1);
  assert.equal(profToDb({ ...DEFAULT_PROFILE, weekStart: 6 }).week_start, 6);
  assert.equal(daysText(0b1000001, [6, 0, 1, 2, 3, 4, 5]), 'Sun, Mon', 'listed in the order the week runs');
});
