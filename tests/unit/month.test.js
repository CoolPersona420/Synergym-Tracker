import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthSummary, monthStart } from '../../src/lib/month.js';

const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h).getTime();
const sess = (t, exId, sets) => ({ startedAt: t, items: [{ exId, sets: sets.map(([w, r]) => ({ w, r })) }] });

test('monthStart is local midnight on the 1st, and steps back across a year', () => {
  assert.equal(monthStart(at(2026, 11, 23)), new Date(2026, 10, 1).getTime());
  assert.equal(monthStart(at(2026, 1, 10), -1), new Date(2025, 11, 1).getTime());
});

test('stronger is each lift’s best estimated 1RM this month against its best last month, averaged', () => {
  const now = at(2026, 11, 23), from = monthStart(now);
  const s = [
    sess(at(2026, 10, 6), 'bench', [[80, 8]]), sess(at(2026, 10, 20), 'bench', [[82.5, 6]]), // Oct best: 80×8 = 101.3
    sess(at(2026, 10, 8), 'squat', [[100, 5]]),                                               // Oct: 116.7
    sess(at(2026, 11, 4), 'bench', [[85, 8]]),                                                 // Nov: 107.7 → +6.25%
    sess(at(2026, 11, 11), 'squat', [[100, 5]]),                                               // Nov: same → 0%
    sess(at(2026, 11, 12), 'curl', [[20, 10]])                                                 // only Nov: not compared
  ];
  const M = monthSummary(s, from, now);
  assert.deepEqual(M.lifts.map(l => l.exId), ['bench', 'squat']);
  assert.ok(Math.abs(M.lifts[0].pct - 6.25) < 1e-9);
  assert.ok(Math.abs(M.strength - 3.125) < 1e-9);
  assert.equal(M.count, 3);
  assert.equal(M.prevCount, 3);
});

test('sessions and volume race the same days of last month while the month is going', () => {
  const now = at(2026, 11, 10), from = monthStart(now);
  const s = [sess(at(2026, 10, 3), 'a', [[100, 10]]), sess(at(2026, 10, 25), 'a', [[100, 10]]), sess(at(2026, 11, 5), 'a', [[100, 12]])];
  const M = monthSummary(s, from, now);
  assert.equal(M.prevSame, 1);
  assert.equal(M.prevCount, 2);
  assert.equal(M.vol, 1200);
  assert.equal(M.prevVol, 1000);
  assert.ok(Math.abs(M.volPct - 20) < 1e-9);
});

test('a finished month is compared with the whole month before it', () => {
  const nov = monthStart(at(2026, 11, 23)), from = monthStart(nov, -1);
  const s = [sess(at(2026, 9, 28), 'a', [[50, 10]]), sess(at(2026, 10, 30), 'a', [[50, 10]]), sess(at(2026, 11, 2), 'a', [[60, 10]])];
  const M = monthSummary(s, from, nov - 1);
  assert.equal(M.count, 1);
  assert.equal(M.prevSame, 1);
  assert.equal(M.volPct, 0);
});

test('cardio, empty sessions and sets without reps change nothing; bodyweight adds the body', () => {
  const now = at(2026, 11, 23), from = monthStart(now);
  const s = [
    { startedAt: at(2026, 10, 5), items: [{ exId: 'pull', sets: [{ w: 0, r: 8 }] }, { exId: 'row', sets: [{ t: 1200 }] }] },
    { startedAt: at(2026, 11, 5), items: [{ exId: 'pull', sets: [{ w: 10, r: 8 }, { w: 30, r: null }] }, { exId: 'row', sets: [{ t: 1500 }] }] },
    { startedAt: at(2026, 11, 6), items: [] }
  ];
  const M = monthSummary(s, from, now, { loadOf: (st, id) => (id === 'pull' ? 80 : 0) + (+st.w || 0), isLift: id => id !== 'row' });
  assert.equal(M.count, 1);
  assert.deepEqual(M.lifts.map(l => l.exId), ['pull']);
  assert.ok(Math.abs(M.lifts[0].pct - 12.5) < 1e-9); // (90 / 80 - 1) at the same reps
});

test('nothing to compare: no strength, no volume change', () => {
  const now = at(2026, 11, 23), M = monthSummary([sess(at(2026, 11, 2), 'a', [[50, 5]])], monthStart(now), now);
  assert.equal(M.strength, null);
  assert.equal(M.volPct, null);
  assert.equal(M.count, 1);
});
