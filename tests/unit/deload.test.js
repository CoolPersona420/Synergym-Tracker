import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanDeload, deloadWeeks, inDeload } from '../../src/lib/profile.js';

const DAY = 864e5, NOW = new Date(2026, 10, 28, 12).getTime();

test('the deload choice keeps its past weeks, cleaned, oldest first, at most 40', () => {
  assert.equal(cleanDeload(null), null);
  assert.equal(cleanDeload({}), null);
  assert.deepEqual(cleanDeload({ on: NOW, skip: 0 }), { on: NOW, skip: null, past: [] });
  const past = [[NOW - 10 * DAY, NOW - 5 * DAY], ['x', 1], [NOW - 40 * DAY, NOW - 33 * DAY], [NOW, NOW - DAY]];
  assert.deepEqual(cleanDeload({ past }).past, [[NOW - 40 * DAY, NOW - 33 * DAY], [NOW - 10 * DAY, NOW - 5 * DAY]]);
  const many = Array.from({ length: 50 }, (_, i) => [NOW - (100 - i) * DAY, NOW - (99 - i) * DAY]);
  assert.equal(cleanDeload({ past: many }).past.length, 40);
});

test('a session is a deload session when it overlaps a deload week, the running one included', () => {
  const d = { on: NOW - 2 * DAY, skip: null, past: [[NOW - 30 * DAY, NOW - 23 * DAY]] };
  const weeks = deloadWeeks(d, NOW, 7);
  assert.deepEqual(weeks, [[NOW - 30 * DAY, NOW - 23 * DAY], [NOW - 2 * DAY, NOW]]);
  const s = (start, end) => ({ startedAt: start, endedAt: end });
  assert.equal(inDeload(weeks, s(NOW - 25 * DAY, NOW - 25 * DAY + 3600e3), NOW), true);
  assert.equal(inDeload(weeks, s(NOW - 15 * DAY, NOW - 15 * DAY + 3600e3), NOW), false);
  /* started an hour before the deload was switched on, mid-session: it counts */
  assert.equal(inDeload(weeks, s(NOW - 2 * DAY - 3600e3, NOW - 2 * DAY + 1800e3), NOW), true);
  /* a live session during a running deload */
  assert.equal(inDeload(weeks, s(NOW - 600e3, null), NOW), true);
  /* a running deload's 7 days end on their own */
  assert.deepEqual(deloadWeeks({ on: NOW - 9 * DAY }, NOW, 7), [[NOW - 9 * DAY, NOW - 2 * DAY]]);
});
