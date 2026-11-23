import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupFields, parseSetup, formatSetup, setupHint } from '../../src/lib/setup.js';

const ids = (name, kind = 'w') => setupFields(name, kind).map(f => f.id);

test('the fields fit the exercise: Smith, leg press, cable, dumbbell, deadlift, machine, barbell, cardio, the rest', () => {
  assert.deepEqual(ids('Smith Squat'), ['hook', 'pins', 'stance', 'feet']);
  assert.deepEqual(ids('Leg Press'), ['seat', 'safety', 'feet', 'stance']);
  assert.deepEqual(ids('Triceps Pushdown'), ['pulley', 'att', 'seat']);
  assert.deepEqual(ids('Lat Pulldown'), ['pulley', 'att', 'seat']);
  assert.deepEqual(ids('Dumbbell Bench Press'), ['bench']);
  assert.deepEqual(ids('Romanian Deadlift'), ['stance', 'grip']);
  assert.deepEqual(ids('Leg Extension'), ['seat', 'back', 'pad']);
  assert.deepEqual(ids('Bench Press'), ['rack', 'safe', 'grip']);
  assert.deepEqual(ids('Run', 'c'), ['level', 'incline']);
  assert.deepEqual(ids('Pull-up', 'bw'), ['seat', 'grip', 'stance']);
  assert.equal(setupHint(setupFields('Smith Squat')), 'hook, pins, stance');
});

test('a setup is one line that reads back into its fields, with the rest kept as the note', () => {
  const F = setupFields('Smith Squat');
  const line = formatSetup({ hook: 12, pins: 8, stance: 'Shoulder-width', feet: 'Slightly forward' }, F, '  knees out ');
  assert.equal(line, 'Hook 12 · Pins 8 · Shoulder-width stance · Feet forward · knees out');
  assert.deepEqual(parseSetup(line, F), { v: { hook: 12, pins: 8, stance: 'Shoulder-width', feet: 'Slightly forward' }, note: 'knees out' });
  /* an older note stays a note; a plain "Seat 4" is read as the seat */
  assert.deepEqual(parseSetup('Seat 4, elbows under the bar', setupFields('Chest Press')), { v: {}, note: 'Seat 4, elbows under the bar' });
  assert.deepEqual(parseSetup('Seat 4', setupFields('Chest Press')), { v: { seat: 4 }, note: '' });
  assert.equal(formatSetup({}, F, ''), '');
  assert.equal(formatSetup({ hook: '' }, F, 'x'.repeat(300)).length, 200);
});
