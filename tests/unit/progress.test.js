import { test } from 'node:test';
import assert from 'node:assert/strict';
import { topSet, suggestNext } from '../../src/lib/progress.js';

const snap = w => Math.round(w / 2.5) * 2.5;

test('top set is the heaviest, ties broken by reps', () => {
  assert.deepEqual(topSet([{ w: 60, r: 10 }, { w: 80, r: 6 }, { w: 80, r: 8 }, { w: 70, r: 12 }]), { w: 80, r: 8 });
  assert.equal(topSet([{ w: 50, r: 0 }]), null);
  assert.equal(topSet([]), null);
});

test('no history, no suggestion', () => {
  assert.equal(suggestNext([]), null);
  assert.equal(suggestNext([[{ w: 80, r: 0 }]]), null);
});

test('a clean session adds weight and keeps the reps (80×8 → 82.5×8)', () => {
  const g = suggestNext([[{ w: 80, r: 8 }, { w: 80, r: 8 }, { w: 80, r: 8 }]], { step: 2.5, round: snap });
  assert.deepEqual(g.next, { w: 82.5, r: 8 });
  assert.equal(g.why, 'load');
});

test('slipping since the time before holds the weight and adds a rep', () => {
  const g = suggestNext([[{ w: 80, r: 6 }], [{ w: 80, r: 8 }]], { step: 2.5, round: snap });
  assert.deepEqual(g.next, { w: 80, r: 7 });
  assert.equal(g.why, 'repeat');
});

test('later sets falling well short holds the weight', () => {
  const g = suggestNext([[{ w: 100, r: 8 }, { w: 100, r: 5 }]], { step: 2.5, round: snap });
  assert.deepEqual(g.next, { w: 100, r: 8 });
  assert.equal(g.why, 'consolidate');
});

test('low reps build reps before weight', () => {
  assert.deepEqual(suggestNext([[{ w: 140, r: 3 }]], { round: snap }).next, { w: 140, r: 4 });
});

test('bodyweight moves add a rep; weighted ones add load', () => {
  assert.deepEqual(suggestNext([[{ w: 0, r: 12 }]], { bw: true }).next, { w: 0, r: 13 });
  assert.equal(suggestNext([[{ w: 10, r: 8 }]], { bw: true, step: 2.5, round: snap }).next.w, 12.5);
});

test('a step that rounds back down still goes up', () => {
  const g = suggestNext([[{ w: 81, r: 8 }]], { step: 0.5, round: snap });
  assert.ok(g.next.w > 81);
});
