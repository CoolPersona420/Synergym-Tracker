/* The exercise picker: each muscle group ends with a way to add your own exercise to it. */
import { test, expect } from '@playwright/test';
import { FakeSupabase, login, benchHistory } from './fake-supabase.js';

test('each muscle group in the picker ends with "Other … exercise", which adds one already filed under it', async ({ page }) => {
  const fake = new FakeSupabase(benchHistory());
  await login(page, fake, 'A');
  await page.locator('[data-act="start-menu"]:visible').first().click();
  await page.locator('[data-st-foot]', { hasText: 'Empty session' }).click();
  await expect(page).toHaveURL(/\/session\//);
  const id = page.url().split('/').pop();
  await page.click('[data-act="add-ex"]');
  /* not under All */
  await expect(page.locator('#pkl .pk-other')).toHaveCount(0);
  await page.click('#pkm [data-m="Chest"]');
  const other = page.locator('#pkl .pk').last();
  await expect(other).toContainText('Other chest exercise…');
  await expect(other).toContainText('cable press');
  await other.click();
  await expect(page.locator('#sheet h3')).toHaveText('Add exercise');
  await expect(page.locator('#ef-m [data-m="Chest"]')).toHaveClass(/on/);
  await page.fill('#ef-n', 'Cable Press');
  await page.click('#ef-save');
  await expect(page.locator('.ex h3', { hasText: 'Cable Press' })).toBeVisible();
  await expect.poll(() => fake.exercises.find(e => e.name === 'Cable Press')).toMatchObject({ muscle: 'Chest', kind: 'w' });
  await expect.poll(() => { const s = fake.sessions.find(x => x.id === id); return s && s.items.length; }).toBe(1);
});
