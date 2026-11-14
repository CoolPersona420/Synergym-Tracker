/* Replace exercise: from an exercise's ⋯ menu in a session, swap it for another in the same place. */
import { test, expect } from '@playwright/test';
import { FakeSupabase, login } from './fake-supabase.js';

const X = (name, muscle, kind = 'w') => ({ id: crypto.randomUUID(), name, muscle, kind });
const day = n => new Date(Date.now() - n * 864e5).toISOString();
const done = (k, w, r, n = 3) => Array.from({ length: n }, (_, i) => ({ id: `${k}${i}`, w, r, done: true }));
const hint = (k, w, r, n) => Array.from({ length: n }, (_, i) => ({ id: `${k}${i}`, w: null, r: null, pw: w, pr: r, done: false }));

/* a live Legs session: Smith Squat (4 sets, 100×5 hints, or 2 of them logged), Romanian Deadlift, Leg Press.
   Leg Press was 180×10 last time; Leg Extension 60×12; Hip Thrust is another muscle; Rowing is cardio */
async function setup(page, { logged = 0, ended = false } = {}) {
  const ex = { smith: X('Smith Squat', 'Quads'), press: X('Leg Press', 'Quads'), ext: X('Leg Extension', 'Quads'), rdl: X('Romanian Deadlift', 'Hamstrings'), thrust: X('Hip Thrust', 'Glutes'), row: X('Rowing', 'Cardio', 'c') };
  const smith = Array.from({ length: 4 }, (_, i) => i < logged ? { id: 'q' + i, w: 100, r: 5, pw: 100, pr: 5, done: true } : { id: 'q' + i, w: null, r: null, pw: 100, pr: 5, done: false });
  const live = { id: crypto.randomUUID(), name: 'Legs', started_at: new Date(Date.now() - 20 * 6e4).toISOString(), ended_at: ended ? new Date().toISOString() : null, items: [
    { id: 'L1', exId: ex.smith.id, sets: smith }, { id: 'L2', exId: ex.rdl.id, sets: hint('r', 90, 8, 3) }, { id: 'L3', exId: ex.press.id, sets: hint('p', 180, 10, 3) }] };
  const fake = new FakeSupabase({ defaults: [], exercises: Object.values(ex), sessions: [live,
    { id: crypto.randomUUID(), name: 'Legs', started_at: day(4), ended_at: day(3.96), items: [{ id: 'a1', exId: ex.smith.id, sets: done('a1', 100, 5, 4) }, { id: 'a2', exId: ex.press.id, sets: done('a2', 180, 10) }, { id: 'a3', exId: ex.ext.id, sets: done('a3', 60, 12) }, { id: 'a4', exId: ex.thrust.id, sets: done('a4', 140, 10) }] }] });
  await login(page, fake, 'A');
  await page.goto('/session/' + live.id);
  await expect(page.locator('[data-item="L1"] h3')).toHaveText('Smith Squat');
  const saved = () => fake.sessions.find(s => s.id === live.id);
  return { fake, ex, live, saved };
}
const names = page => page.locator('.items .ex h3').allTextContents();

test('Replace swaps the exercise in place: same sets, the new one’s hints, the same muscle listed first, and Undo', async ({ page }) => {
  const { ex, saved } = await setup(page);
  await page.click('[data-act="item-menu"][data-item="L1"]');
  await page.locator('#sheet .menu button', { hasText: 'Replace exercise' }).click();
  await expect(page.locator('#sheet h3')).toHaveText('Replace Smith Squat');
  await expect(page.locator('#sheet .pk-note')).toContainText('4 sets');
  /* the same muscle first, under its own heading; not the exercise itself, nor cardio */
  await expect(page.locator('#pkl .pk-sec').first()).toHaveText('Also works quads');
  const rows = await page.locator('#pkl .pk .n').allTextContents();
  expect(rows.slice(0, 2).sort()).toEqual(['Leg Extension', 'Leg Press']);
  expect(rows).not.toContain('Smith Squat');
  expect(rows).not.toContain('Rowing');
  await expect(page.locator('#pkm [data-m="Cardio"]')).toHaveCount(0);
  await expect(page.locator('#pkl .pk', { hasText: 'Leg Press' })).toContainText('in this session');
  await page.locator('#pkl .pk', { hasText: 'Leg Extension' }).click();
  /* same card, same place, same number of sets, with Leg Extension's last numbers as hints */
  await expect(page.locator('[data-item="L1"] h3')).toHaveText('Leg Extension');
  expect(await names(page)).toEqual(['Leg Extension', 'Romanian Deadlift', 'Leg Press']);
  await expect(page.locator('[data-item="L1"] [data-f="w"]')).toHaveCount(4);
  await expect(page.locator('[data-item="L1"] [data-f="w"]').first()).toHaveAttribute('placeholder', '60');
  await expect(page.locator('[data-item="L1"] [data-f="r"]').first()).toHaveAttribute('placeholder', '12');
  await expect.poll(() => saved().items[0].exId).toBe(ex.ext.id);
  expect(saved().items[0].sets.map(s => s.id)).toEqual(['q0', 'q1', 'q2', 'q3']);
  /* Undo puts it back */
  await expect(page.locator('#toast')).toContainText('Smith Squat swapped for Leg Extension');
  await page.click('#toast .toast-act');
  await expect(page.locator('[data-item="L1"] h3')).toHaveText('Smith Squat');
  await expect(page.locator('[data-item="L1"] [data-f="w"]').first()).toHaveAttribute('placeholder', '100');
  await expect.poll(() => saved().items[0].exId).toBe(ex.smith.id);
});

test('with sets logged it asks: swap the rest keeps the done sets and puts the new exercise just below', async ({ page }) => {
  const { ex, saved } = await setup(page, { logged: 2 });
  await page.click('[data-act="item-menu"][data-item="L1"]');
  await page.locator('#sheet .menu button', { hasText: 'Replace exercise' }).click();
  await page.locator('#pkl .pk', { hasText: 'Leg Extension' }).click();
  await expect(page.locator('#sheet h3')).toHaveText('2 sets are logged');
  await expect(page.locator('#sheet .sh-note')).toContainText('You did 2 of 4 sets of Smith Squat');
  await page.locator('#sheet .menu button', { hasText: 'Swap the rest for Leg Extension' }).click();
  expect(await names(page)).toEqual(['Smith Squat', 'Leg Extension', 'Romanian Deadlift', 'Leg Press']);
  await expect(page.locator('[data-item="L1"] [data-f="w"]')).toHaveCount(2);
  const second = page.locator('.items .ex').nth(1);
  await expect(second.locator('[data-f="w"]')).toHaveCount(2);
  await expect(second.locator('[data-f="w"]').first()).toHaveAttribute('placeholder', '60');
  await expect.poll(() => saved().items.map(i => [i.exId, i.sets.length])).toEqual([[ex.smith.id, 2], [ex.ext.id, 2], [ex.rdl.id, 3], [ex.press.id, 3]]);
  expect(saved().items[0].sets.map(s => [s.w, s.r])).toEqual([[100, 5], [100, 5]]);
});

test('with sets logged, Move all takes them to the new exercise with their numbers', async ({ page }) => {
  const { ex, saved } = await setup(page, { logged: 2 });
  await page.click('[data-act="item-menu"][data-item="L1"]');
  await page.locator('#sheet .menu button', { hasText: 'Replace exercise' }).click();
  await page.locator('#pkl .pk', { hasText: 'Leg Extension' }).click();
  await page.locator('#sheet .menu button', { hasText: 'Move all 4 to Leg Extension' }).click();
  await expect(page.locator('[data-item="L1"] h3')).toHaveText('Leg Extension');
  await expect(page.locator('[data-f="w"][data-set="q0"]')).toHaveValue('100');
  await expect.poll(() => saved().items[0].exId).toBe(ex.ext.id);
  expect(saved().items[0].sets.map(s => s.r)).toEqual([5, 5, null, null]);
});

test('a finished session opened to view has no Replace', async ({ page }) => {
  await setup(page, { ended: true });
  await page.click('[data-act="item-menu"][data-item="L1"]');
  await expect(page.locator('#sheet')).toContainText('Exercise history');
  await expect(page.locator('#sheet')).not.toContainText('Replace exercise');
});

test('searching while replacing lists other muscles too, without headings', async ({ page }) => {
  await setup(page);
  await page.click('[data-act="item-menu"][data-item="L1"]');
  await page.locator('#sheet .menu button', { hasText: 'Replace exercise' }).click();
  await page.fill('#pkq', 'hip');
  await expect(page.locator('#pkl .pk-sec')).toHaveCount(0);
  await expect(page.locator('#pkl [data-act="pk-pick"] .n')).toHaveText(['Hip Thrust']);
  await page.locator('#pkl .pk', { hasText: 'Hip Thrust' }).click();
  await expect(page.locator('[data-item="L1"] h3')).toHaveText('Hip Thrust');
  await expect(page.locator('[data-item="L1"] [data-f="r"]').first()).toHaveAttribute('placeholder', '10');
});
