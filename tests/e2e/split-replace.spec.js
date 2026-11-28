/* Replace an exercise in a split: from its ⋯ menu, the picker lists the same muscle first, and the new exercise takes
   the old one's place with its sets, reps and link. Undo puts the old one back. */
import { test, expect } from '@playwright/test';
import { FakeSupabase, login } from './fake-supabase.js';

function setup() {
  const ex = [['Bench Press', 'Chest'], ['Incline Dumbbell Press', 'Chest'], ['Barbell Row', 'Back'], ['Treadmill', 'Cardio', 'c'], ['Rowing Machine', 'Cardio', 'c']]
    .map(([name, muscle, kind = 'w']) => ({ id: crypto.randomUUID(), name, muscle, kind }));
  const [bench, incline, row, tread] = ex;
  const sp = { id: crypto.randomUUID(), name: 'Push Pull', days: [{ id: 'd1', type: 'Push', rest: false, same: false, exercises: [
    { id: 'x1', exId: bench.id, name: bench.name, muscle: 'Chest', kind: 'w', sets: 4, reps: '6-8', g: 'g1' },
    { id: 'x2', exId: row.id, name: row.name, muscle: 'Back', kind: 'w', sets: 3, reps: '8-10', g: 'g1' },
    { id: 'x3', exId: tread.id, name: tread.name, muscle: 'Cardio', kind: 'c', sets: 1, reps: '', min: 20 }] }] };
  return { fake: new FakeSupabase({ defaults: [], exercises: ex, splits: [sp] }), sp, bench, incline };
}

test('an exercise in a split is replaced in place, keeping its sets, reps and link, with Undo', async ({ page }) => {
  const { fake, sp, incline } = setup();
  await login(page, fake, 'A');
  await page.goto('/splits/' + sp.id);
  await page.locator('[data-act="dex-menu"][data-day="0"][data-x="0"]').first().click();
  await page.locator('#sheet-body button', { hasText: 'Replace exercise' }).click();
  await expect(page.locator('#sheet h3')).toHaveText('Replace Bench Press');
  await expect(page.locator('#sheet .pk-note')).toContainText('4 sets of 6-8');
  /* the same muscle first, the exercise itself left out, the lift can't become cardio */
  await expect(page.locator('#pkl .pk-sec').first()).toContainText('Also works chest');
  await expect(page.locator('#pkl .pk', { hasText: 'Bench Press' })).toHaveCount(0);
  await expect(page.locator('#pkl .pk', { hasText: 'Barbell Row' })).toContainText('in this day');
  await page.locator('#pkl .pk', { hasText: 'Incline Dumbbell Press' }).click();
  await expect(page.locator('#sheet')).toBeHidden();
  await expect(page.locator('#toast')).toContainText('Bench Press replaced with Incline Dumbbell Press');
  const first = () => fake.splits[0].days[0].exercises[0];
  await expect.poll(() => first().exId).toBe(incline.id);
  expect(first()).toMatchObject({ id: 'x1', name: 'Incline Dumbbell Press', muscle: 'Chest', sets: 4, reps: '6-8', g: 'g1' });
  await expect(page.locator('#view')).toContainText('Incline Dumbbell Press');
  /* Undo puts Bench Press back */
  await page.locator('#toast .toast-act').click();
  await expect.poll(() => first().name).toBe('Bench Press');
});

test('cardio in a split swaps for cardio, keeping its minutes', async ({ page }) => {
  const { fake, sp } = setup();
  await login(page, fake, 'A');
  await page.goto('/splits/' + sp.id);
  await page.locator('[data-act="dex-menu"][data-day="0"][data-x="2"]').first().click();
  await page.locator('#sheet-body button', { hasText: 'Replace exercise' }).click();
  await expect(page.locator('#sheet h3')).toHaveText('Replace Treadmill');
  await expect(page.locator('#pkl .pk', { hasText: 'Bench Press' })).toHaveCount(0);
  await page.locator('#pkl .pk', { hasText: 'Rowing Machine' }).click();
  await expect.poll(() => fake.splits[0].days[0].exercises[2].name).toBe('Rowing Machine');
  expect(fake.splits[0].days[0].exercises[2]).toMatchObject({ id: 'x3', kind: 'c', min: 20 });
});
