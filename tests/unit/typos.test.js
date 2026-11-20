import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findTypos, likelyMeant } from '../../src/lib/typos.js';

/* sessions of one exercise: each array is a session's sets as [w, r] (or { w, r, ok }) */
const sess = (exId, ...lists) => lists.map((l, i) => ({ id: 's' + i, items: [{ exId, sets: l.map((x, j) => Array.isArray(x) ? { id: `s${i}x${j}`, w: x[0], r: x[1] } : { id: `s${i}x${j}`, ...x }) }] }));
const eights = [[80, 8], [80, 8], [80, 7]];

test('106 reps among sets of 8 is a typo, and 10 is what was most likely meant', () => {
  const t = findTypos(sess('b', eights, eights, [[80, 8], [80, 106], [80, 7]]));
  assert.equal(t.size, 1);
  const x = t.get('s2x1');
  assert.deepEqual([x.kind, x.v, x.usual, x.fix, x.sid, x.exId], ['r', 106, 8, 10, 's2', 'b']);
});

test('high reps that are normal for the exercise are left alone', () => {
  /* 50 push-ups when you usually do 40; 25 reps when you usually do 8 (under 30) */
  assert.equal(findTypos(sess('p', [[0, 40], [0, 38], [0, 42]], [[0, 40], [0, 50]])).size, 0);
  assert.equal(findTypos(sess('b', eights, eights, [[60, 25]])).size, 0);
  /* 30 reps, over three times the usual 8: asked about */
  assert.equal(findTypos(sess('b', eights, eights, [[60, 30]])).get('s2x0').kind, 'r');
});

test('with little history only the extreme counts', () => {
  assert.equal(findTypos(sess('n', [[80, 8], [80, 60]])).size, 0);
  const x = findTypos(sess('n', [[80, 8], [80, 106]])).get('s0x1');
  assert.equal(x.kind, 'r'); assert.equal(x.usual, null); assert.equal(x.fix, null);
  assert.equal(findTypos(sess('n', [[600, 5]])).get('s0x0').kind, 'w');
  assert.equal(findTypos(sess('n', [[450, 5]])).size, 0);
});

test('a weight far above the heaviest other set is a typo; real jumps and light weights are not', () => {
  const t = findTypos(sess('b', eights, eights, [[800, 8]]));
  assert.deepEqual([t.get('s2x0').kind, t.get('s2x0').usual, t.get('s2x0').fix], ['w', 80, 80]);
  /* 2.4 times the heaviest: a big day, not a typo */
  assert.equal(findTypos(sess('b', [[100, 5], [100, 5], [100, 5]], [[240, 1]])).size, 0);
  /* under 40 kg isn't checked for weight: 30 kg dumbbells after 10s */
  assert.equal(findTypos(sess('d', [[10, 10], [10, 10], [10, 10]], [[30, 10]])).size, 0);
  /* 50 after 10s is: and 5 is the likely meant weight */
  assert.equal(findTypos(sess('d', [[10, 10], [10, 10], [10, 10]], [[50, 10]])).get('s1x0').fix, 5);
});

test('a set kept as it is, cardio, and empty sets are never asked about', () => {
  assert.equal(findTypos(sess('b', eights, eights, [{ w: 80, r: 106, ok: true }])).size, 0);
  assert.equal(findTypos(sess('run', eights, eights, [[0, 106]]), () => 'c').size, 0);
  assert.equal(findTypos(sess('b', eights, eights, [{ w: 800, r: null }])).size, 0);
});

test('the likely meant number drops one digit (or a weight a tenth), near the usual, or there is no guess', () => {
  assert.equal(likelyMeant(106, 8), 10);
  assert.equal(likelyMeant(88, 8), 8);
  /* 1010 typed for 10 */
  assert.equal(likelyMeant(1010, 10), 10);
  assert.equal(likelyMeant(825, 82.5, true), 82.5);
  /* 225 typed by an 85 kg lifter: 22, 25 or 22.5 are no good guesses */
  assert.equal(likelyMeant(225, 85, true), null);
  assert.equal(likelyMeant(106, null), null);
});
