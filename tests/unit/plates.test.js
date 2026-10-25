import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PLATES, platesFor, sideText } from '../../src/lib/plates.js';

test('100 kg on a 20 kg bar is 25 + 15 each side', () => {
  const r = platesFor(100, 20, PLATES.kg);
  assert.deepEqual(r.side, [25, 15]);
  assert.equal(r.loaded, 100); assert.equal(r.left, 0);
});

test('82.5 kg uses the small plates', () => {
  assert.deepEqual(platesFor(82.5, 20, PLATES.kg).side, [25, 5, 1.25]);
});

test('225 lb is two 45s each side', () => {
  const r = platesFor(225, 45, PLATES.lb);
  assert.deepEqual(r.side, [45, 45]);
  assert.equal(sideText(r.side), '2 × 45');
});

test('weights that cannot be loaded report the remainder', () => {
  const r = platesFor(101, 20, PLATES.kg);
  assert.equal(r.loaded, 100); assert.equal(r.left, 1);
});

test('lighter than the bar, and nothing at all', () => {
  assert.equal(platesFor(15, 20, PLATES.kg).under, true);
  assert.deepEqual(platesFor(0, 20, PLATES.kg).side, []);
  assert.deepEqual(platesFor(20, 20, PLATES.kg).side, []);
});

test('side text folds repeats', () => {
  assert.equal(sideText([20, 20, 10, 2.5]), '2 × 20 + 10 + 2.5');
  assert.equal(sideText([]), '');
});
