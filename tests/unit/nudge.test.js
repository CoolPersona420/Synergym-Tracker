import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compose, quiet, every, cleanBrief } from '../../api/_nudge.js';

const list = [{ lift: 'Back Squat', tgt: '137.5 kg × 5' }, { lift: 'Romanian Deadlift', tgt: '100 kg × 8' }, { lift: 'Leg Press', tgt: '180 kg × 10' }];
const brief = { coach: true, day: 'Lower', n: 5, list, call: 'train', for: '2026-10-27' };
const base = { uid: 'u1', name: 'Alex Moreau', day: '2026-10-27', dow: 2, wk: 1, target: 4, gap: 2, streak: 0, total: 30, since: 1, rest: false, today: false, brief };
const open = { open_id: 's-1', open_name: 'Push', open_mins: 300, open_days: 0, open_sets: 9 };
const msg = over => compose({ ...base, ...over });
/* every wording, across many days */
const days = n => Array.from({ length: n }, (_, i) => `2026-11-${String(i + 1).padStart(2, '0')}`);

test('a session left open: finish it, even on a day already trained, and it opens that session', () => {
  for (const day of days(10)) {
    const m = msg({ day, ...open, today: true });
    assert.match(m.title + ' ' + m.body, /Push is still open|Finish your session|wrap up/, day);
    assert.match(m.body, /earlier today and logged 9 sets/);
    assert.equal(m.url, '/session/s-1');
  }
  /* nothing logged yet, and no name */
  const e = msg({ ...open, open_name: null, open_sets: 0, open_days: 1 });
  assert.match(e.body, /yesterday but haven’t logged a set/);
  assert.match(msg({ ...open, open_name: null, open_days: 1, day: '2026-11-01' }).title + msg({ ...open, open_name: null, open_days: 1, day: '2026-11-02' }).title, /Your session is still open|Finish|wrap up/);
  /* the app's own shape, for a test */
  assert.equal(msg({ open: { id: 'x', name: 'Legs', mins: 400, days: 1, sets: 3 } }).url, '/session/x');
});

test('a session under way stays quiet; one left for days comes up every few days', () => {
  assert.equal(quiet({ ...base, ...open, open_mins: 45 }), 'in-session');
  assert.equal(quiet({ ...base, ...open, rest: true, wk: 9 }), null, 'a session to finish beats rest days and a met target');
  assert.equal(quiet({ ...base, ...open, open_days: 4, since: 1 }), 'thinned');
  assert.equal(quiet({ ...base, ...open, open_days: 4, since: 3 }), null);
});

test('otherwise it’s about the next session: the day and its first targets', () => {
  const seen = new Set();
  for (const day of days(30)) {
    const m = msg({ day });
    assert.match(m.title, /Lower/, day);
    assert.match(m.body, /Back Squat 137\.5 kg × 5, Romanian Deadlift 100 kg × 8/);
    assert.match(m.body, /then 2 more\.$/);
    assert.equal(m.url, '/'); assert.equal(m.tag, 'reminder');
    assert.ok(m.body.length <= 170);
    seen.add(m.title);
  }
  assert.ok(seen.size >= 3, 'titles vary from day to day');
  assert.deepEqual(msg({}), msg({}), 'the same person on the same day gets the same message');
});

test('one line of context: first session, coming back, a lighter week, an easy day, one more for the week', () => {
  assert.match(msg({ total: 0, brief: { day: 'Push', n: 4 } }).body, /^Your first session: .* 4 exercises ready\.$/);
  for (const day of days(10)) {
    const m = msg({ day, gap: 16, since: 7 });
    assert.match(m.body, /It’s been 2 weeks\. A short session still counts, and your targets start a little lighter\./);
    assert.match(m.title, /Lower/);
    assert.doesNotMatch(m.title + m.body, /miss|lost|streak|lazy|!/i);
  }
  assert.match(msg({ gap: 8 }).body, /It’s been 8 days\. A short session still counts\. /);
  assert.doesNotMatch(msg({ gap: 8, target: 1, wk: 0 }).body, /8 days/, 'someone who trains once a week isn’t away after a week');
  assert.match(msg({ brief: { ...brief, deload: 'deload' } }).body, /^Lighter week: .*Back Squat/);
  assert.match(msg({ brief: { ...brief, call: 'easy', for: '2026-10-27' } }).body, /^An easier day/);
  assert.doesNotMatch(msg({ brief: { ...brief, call: 'easy', for: '2026-10-26' } }).body, /easier/, 'yesterday’s easy call isn’t today’s');
  assert.match(msg({ wk: 3, target: 4 }).body, /^One more makes 4 this week\. /);
});

test('long target lists are trimmed to fit a notification', () => {
  const long = [1, 2, 3].map(i => ({ lift: `Very Long Exercise Name ${i} Variation`, tgt: '137.5 kg × 12' }));
  const m = msg({ wk: 3, brief: { ...brief, list: long, n: 7 } });
  assert.ok(m.body.length <= 170, m.body);
  assert.match(m.body, /Variation 137\.5 kg × 12, then \d more\.$/);
});

test('without a split it still reads naturally', () => {
  assert.match(msg({ brief: {}, wk: 0 }).body, /First session of the week/);
  const m = msg({ brief: null, wk: 2 });
  assert.ok(/2 of 4 this week|Whatever you train today counts/.test(m.body), m.body);
  assert.match(msg({ brief: { day: 'Pull', n: 4, list: [{ lift: 'Pull-up', tgt: '12 reps' }] } }).body, /Pull-up 12 reps, then 3 more\./);
});

test('quiet on a trained day, a rest day, after the weekly target, on the coach’s rest day, and in a week off', () => {
  assert.equal(quiet({ ...base, today: true }), 'trained');
  assert.equal(quiet({ ...base, rest: true }), 'rest-day');
  assert.equal(quiet({ ...base, wk: 4 }), 'target-met');
  assert.equal(quiet({ ...base, brief: { ...brief, call: 'rest', for: '2026-10-27' } }), 'coach-rest');
  /* the app's day keys aren't zero-padded */
  assert.equal(quiet({ ...base, day: '2026-03-05', brief: { ...brief, call: 'rest', for: '2026-3-5' } }), 'coach-rest');
  assert.equal(quiet({ ...base, brief: { ...brief, call: 'rest', for: '2026-10-26' } }), null);
  assert.equal(quiet({ ...base, brief: { ...brief, deload: 'off' } }), 'week-off');
  assert.equal(quiet(base), null);
  assert.equal(msg({ today: true }), null);
});

test('after time away, reminders thin out', () => {
  assert.equal(every(3), 1); assert.equal(every(12), 3); assert.equal(every(25), 7); assert.equal(every(90), 14); assert.equal(every(null), 1);
  assert.equal(quiet({ ...base, gap: 12, since: 1 }), 'thinned');
  assert.equal(quiet({ ...base, gap: 12, since: 3 }), null);
  assert.equal(quiet({ ...base, gap: 30, since: 6 }), 'thinned');
  assert.equal(quiet({ ...base, gap: 30, since: null }), null);
});

test('the brief is checked: odd shapes, old briefs and long text can’t break a message', () => {
  assert.deepEqual(cleanBrief(null), { list: [] });
  assert.deepEqual(cleanBrief([1, 2]), { list: [] });
  const b = cleanBrief({ day: 'x'.repeat(200), call: 'nap', deload: 'sometimes', n: 'lots', list: [null, { lift: 'Squat' }, 5] });
  assert.equal(b.day.length, 30); assert.equal(b.call, null); assert.equal(b.deload, null); assert.equal(b.n, 0); assert.deepEqual(b.list, []);
  /* a brief saved by an older app: one target as lift and tgt */
  assert.deepEqual(cleanBrief({ lift: 'Squat', tgt: '100 kg × 5' }).list, [{ lift: 'Squat', tgt: '100 kg × 5' }]);
  const m = msg({ name: null, brief: { day: '<b>Legs</b>', list: [{ lift: 'Squat', tgt: '100 kg × 5' }], n: 1 } });
  assert.match(m.title + m.body, /<b>Legs<\/b>/, 'notifications show plain text, so nothing is escaped or lost');
});

test('a test reminder ignores the quiet rules', () => {
  assert.equal(compose({ ...base, today: true }), null);
  assert.ok(compose({ ...base, today: true }, { force: true }));
  assert.ok(compose({}, { force: true }).title);
});
