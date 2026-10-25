import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanBwLog, logBw, unlogBw, bwSeries, bwChange, weekSummary, dateKey } from '../../src/lib/body.js';

const day = (y, m, d, h = 12) => new Date(y, m - 1, d, h).getTime();

test('one entry per day, sorted, bad values dropped', () => {
  const l = cleanBwLog([{ d: '2026-10-02', kg: 81 }, { d: '2026-10-01', kg: 80 }, { d: '2026-10-02', kg: 81.5 }, { d: 'x', kg: 80 }, { d: '2026-10-03', kg: 5 }]);
  assert.deepEqual(l, [{ d: '2026-10-01', kg: 80 }, { d: '2026-10-02', kg: 81.5 }]);
  assert.deepEqual(cleanBwLog(null), []);
});

test('logging today replaces today; unlog removes a day', () => {
  let l = logBw([], 80, day(2026, 10, 20));
  l = logBw(l, 79.6, day(2026, 10, 20, 20));
  assert.deepEqual(l, [{ d: '2026-10-20', kg: 79.6 }]);
  assert.deepEqual(unlogBw(l, '2026-10-20'), []);
  assert.equal(dateKey(day(2026, 1, 5)), '2026-01-05');
});

test('the log keeps the latest 400 days', () => {
  const l = []; for (let i = 0; i < 450; i++) l.push({ d: dateKey(day(2025, 1, 1) + i * 864e5), kg: 80 });
  assert.equal(cleanBwLog(l).length, 400);
});

test('series and change over a window', () => {
  const now = day(2026, 10, 25), l = [{ d: '2026-06-01', kg: 90 }, { d: '2026-10-01', kg: 82 }, { d: '2026-10-24', kg: 80.5 }];
  assert.equal(bwSeries(l, 30, now).length, 2);
  assert.equal(bwChange(l, 30, now), -1.5);
  assert.equal(bwChange(l, 0, now), -9.5);
  assert.equal(bwChange([{ d: '2026-10-24', kg: 80 }], 30, now), null);
});

test('weekly summary counts sessions and finds lifts that went up', () => {
  const wk = day(2026, 10, 19, 0), now = day(2026, 10, 25);
  const s = (t, ex, w, r = 5) => ({ startedAt: t, items: [{ exId: ex, sets: [{ w, r }] }] });
  const W = weekSummary([
    s(day(2026, 10, 20), 'bench', 82.5), s(day(2026, 10, 22), 'squat', 100), s(day(2026, 10, 23), 'row', 60),
    s(day(2026, 10, 13), 'bench', 80), s(day(2026, 10, 6), 'squat', 100), s(day(2026, 10, 1), 'row', 55),
    { startedAt: day(2026, 10, 24), items: [] }
  ], wk, now);
  assert.equal(W.count, 3);
  assert.equal(W.vol, 82.5 * 5 + 100 * 5 + 60 * 5);
  assert.equal(W.lastVol, 80 * 5);
  assert.deepEqual(W.gains.map(g => g.exId), ['row', 'bench']);
  assert.equal(W.gains[1].by, 2.5);
});
