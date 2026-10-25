import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scanRecords, bestPerSession, repTable } from '../../src/lib/records.js';

let n = 0;
const sess = (sets, ex = 'bench') => ({ id: 's' + (++n), startedAt: n * 1000, items: [{ exId: ex, sets: sets.map(([w, r]) => ({ id: 'x' + (++n), w, r })) }] });
const kinds = (sessions) => { const r = scanRecords(sessions); return sessions.map(s => s.items[0].sets.map(st => r.bySet.get(st.id)?.kind || null)); };

test('the first session is the baseline: no records', () => {
  assert.deepEqual(kinds([sess([[60, 10], [80, 5], [100, 3]])]), [[null, null, null]]);
});

test('heavier than ever is a weight PR; with more reps than the record set, both', () => {
  const k = kinds([sess([[100, 5]]), sess([[102.5, 3]]), sess([[105, 6]])]);
  assert.deepEqual(k, [[null], ['w'], ['wr']]);
});

test('more reps at a weight already lifted (or heavier) is a rep PR', () => {
  const k = kinds([sess([[100, 5], [80, 8]]), sess([[100, 6], [80, 8], [90, 7]])]);
  /* 100×6 beats 5 at ≥100; 80×8 ties; 90×7 beats nothing at ≥90 (100×6 already) */
  assert.deepEqual(k[1], ['r', null, 'r']);
});

test('lighter sets with fewer reps than a heavier set are not records', () => {
  const k = kinds([sess([[100, 8]]), sess([[90, 7]])]);
  assert.deepEqual(k[1], [null]);
});

test('sets earlier the same day count: the second 100×6 is not a PR again', () => {
  const k = kinds([sess([[100, 5]]), sess([[100, 6], [100, 6], [100, 7]])]);
  assert.deepEqual(k[1], ['r', null, 'r']);
});

test('bodyweight with no added load: most reps is the record', () => {
  const k = kinds([sess([[0, 10]], 'pullup'), sess([[0, 9], [0, 12]], 'pullup'), sess([[5, 6]], 'pullup')]);
  assert.deepEqual(k, [[null], [null, 'r'], ['w']]);
});

test('sets with no reps are ignored', () => {
  const k = kinds([sess([[100, 5]]), sess([[120, 0], [120, null]])]);
  assert.deepEqual(k[1], [null, null]);
});

test('records per exercise, the state before each session, and one record per session', () => {
  const a = sess([[100, 5]]), b = sess([[102.5, 3], [105, 2], [80, 12]]);
  const r = scanRecords([a, b]);
  const e = r.ex.get('bench');
  assert.equal(e.w, 105); assert.equal(e.wr, 2); assert.equal(e.maxR, 12); assert.equal(e.maxRw, 80);
  assert.deepEqual(r.before.get(b.id + ':bench'), { w: 100, wr: 5, maxR: 5, maxRw: 100 });
  const best = bestPerSession(r.events);
  assert.equal(best.length, 1); assert.equal(best[0].w, 105);
  assert.deepEqual(repTable(e, 2), [{ w: 105, r: 2 }, { w: 102.5, r: 3 }]);
});

test('a custom weight rule (hint weights in a live session)', () => {
  const s1 = sess([[100, 5]]), s2 = { id: 'live', startedAt: 1e9, items: [{ exId: 'bench', sets: [{ id: 'h', w: null, pw: 102.5, r: 4 }] }] };
  const r = scanRecords([s1, s2], { weightOf: (st, s) => s.id === 'live' ? (st.w ?? st.pw) : st.w });
  assert.equal(r.bySet.get('h').kind, 'w');
});

test('a weighted set with no weight is left out', () => {
  const s1 = sess([[100, 5]]), s2 = sess([[null, 12], [100, 6]]);
  const r = scanRecords([s1, s2], { weightOf: st => +st.w > 0 ? +st.w : null });
  assert.equal(r.ex.get('bench').maxR, 6);
  assert.deepEqual(s2.items[0].sets.map(st => r.bySet.get(st.id)?.kind || null), [null, 'r']);
});
