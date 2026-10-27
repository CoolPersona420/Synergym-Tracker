import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compose, quiet, every, cleanBrief } from '../../api/_nudge.js';

const brief = { coach: true, day: 'Lower', n: 5, lift: 'Back Squat', tgt: '137.5 kg × 5', call: 'train', for: '2026-10-27' };
const base = { uid: 'u1', name: 'Alex Moreau', day: '2026-10-27', dow: 2, wk: 1, target: 4, gap: 2, streak: 0, total: 30, since: 1, rest: false, today: false, brief };
const msg = over => compose({ ...base, ...over });
/* every wording, across many days */
const days = n => Array.from({ length: n }, (_, i) => `2026-11-${String(i + 1).padStart(2, '0')}`);

test('quiet on a trained day, a rest day, after the weekly target, on the coach’s rest day, and in a week off', () => {
  assert.equal(quiet({ ...base, today: true }), 'trained');
  assert.equal(quiet({ ...base, rest: true }), 'rest-day');
  assert.equal(quiet({ ...base, wk: 4 }), 'target-met');
  assert.equal(quiet({ ...base, brief: { ...brief, call: 'rest', for: '2026-10-27' } }), 'coach-rest');
  /* the app's day keys aren't zero-padded */
  assert.equal(quiet({ ...base, day: '2026-03-05', brief: { ...brief, call: 'rest', for: '2026-3-5' } }), 'coach-rest');
  /* a rest call made for another day doesn't count */
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

test('what’s next: the split day and its first target, in a few wordings', () => {
  const seen = new Set();
  for (const day of days(30)) {
    const m = msg({ day });
    assert.ok(m.title && m.body, day);
    assert.match(m.title + ' ' + m.body, /Lower/);
    assert.match(m.body, /Back Squat 137\.5 kg × 5/);
    assert.equal(m.url, '/'); assert.equal(m.tag, 'reminder');
    seen.add(m.title);
  }
  assert.ok(seen.size >= 3, 'titles vary from day to day');
  assert.deepEqual(msg({}), msg({}), 'the same person on the same day gets the same message');
});

test('a first session, and coming back without guilt', () => {
  const f = msg({ total: 0, gap: 3 });
  assert.match(f.body, /first set/);
  for (const day of days(20)) {
    const m = msg({ day, gap: 16, since: 7 });
    assert.match(m.body, /2 weeks/);
    assert.match(m.body, /lighter/, 'the coach eases targets after two weeks away');
    assert.doesNotMatch(m.title + m.body, /miss|lost|streak|lazy|!/i);
  }
  assert.match(msg({ gap: 8 }).body, /8 days/);
  assert.doesNotMatch(msg({ gap: 8, brief: { ...brief, coach: false } }).body, /lighter/);
  /* someone who trains once a week isn't "away" after a week */
  assert.doesNotMatch(msg({ gap: 8, target: 1, wk: 0 }).body, /8 days/);
});

test('a goal ready to test, a lighter week, an easy day', () => {
  const goal = { lift: 'Back Squat', kg: '150 kg', left: '0 kg', pct: 100, ready: true };
  const g = msg({ brief: { ...brief, goal } });
  assert.match(g.title, /Back Squat 150 kg/); assert.equal(g.url, '/coach/goals');
  const d = msg({ brief: { ...brief, deload: 'deload' } });
  assert.match(d.body, /half the sets/); assert.equal(d.url, '/coach/recovery');
  const e = msg({ brief: { ...brief, call: 'easy', for: '2026-10-27' } });
  assert.match(e.body, /lighter/); assert.equal(e.url, '/coach');
  /* yesterday's easy call isn't today's */
  assert.doesNotMatch(msg({ brief: { ...brief, call: 'easy', for: '2026-10-26' } }).body, /lighter/);
});

test('one more for the week, last session’s record, a goal getting close', () => {
  const w = msg({ wk: 3, target: 4 });
  assert.match(w.title, /One more|one to go/); assert.match(w.body, /Lower/);
  const r = msg({ brief: { ...brief, pr: 'Bench Press' } });
  assert.match(r.title + r.body, /Bench Press/);
  assert.doesNotMatch(msg({ gap: 5, brief: { ...brief, pr: 'Bench Press' } }).title + msg({ gap: 5, brief: { ...brief, pr: 'Bench Press' } }).body, /Bench Press/, 'a record is news for a few days only');
  const close = days(30).map(day => msg({ day, brief: { ...brief, goal: { lift: 'Back Squat', kg: '150 kg', left: '6 kg', pct: 85, wk: '5×3 at 127.5 kg' } } }));
  const goalDays = close.filter(m => m.url === '/coach/goals');
  assert.ok(goalDays.length > 3 && goalDays.length < 20, 'a goal in reach comes up some days, not every day');
  assert.match(goalDays[0].body, /About 6 kg to go/);
});

test('without a split or a coach it still reads naturally', () => {
  const m = msg({ brief: {}, wk: 2 });
  assert.match(m.body, /2 of 4 this week/);
  const n = msg({ brief: null, wk: 0 });
  assert.match(n.body, /First session of the week/);
  const bw = msg({ brief: { day: 'Pull', n: 4, lift: 'Pull-up', tgt: '12 reps' } });
  assert.match(bw.body, /Pull-up,? 12 reps|Pull-up 12 reps/);
});

test('the brief is checked: odd shapes and long text can’t break a message', () => {
  assert.deepEqual(cleanBrief(null), {});
  assert.deepEqual(cleanBrief([1, 2]), {});
  const b = cleanBrief({ day: 'x'.repeat(200), call: 'nap', deload: 'sometimes', n: 'lots', goal: { lift: 'Squat' } });
  assert.equal(b.day.length, 30); assert.equal(b.call, null); assert.equal(b.deload, null); assert.equal(b.n, 0); assert.equal(b.goal, null);
  const m = msg({ name: null, brief: { day: '<b>Legs</b>', lift: 'Squat', tgt: '100 kg × 5', n: 1 } });
  assert.ok(m.body.length <= 170);
  assert.match(m.title + m.body, /<b>Legs<\/b>/, 'notifications show plain text, so nothing is escaped or lost');
});

test('a test reminder ignores the quiet rules', () => {
  assert.equal(compose({ ...base, today: true }), null);
  assert.ok(compose({ ...base, today: true }, { force: true }));
  assert.ok(compose({}, { force: true }).title);
});
