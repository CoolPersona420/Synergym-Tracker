import { test, expect } from '@playwright/test';
import { FakeSupabase, login, benchHistory } from './fake-supabase.js';
test('a reload with a profile change still waiting keeps the user set up', async ({ page }) => {
  const fake = new FakeSupabase(benchHistory());
  await login(page, fake, 'A');
  await page.goto('/settings');
  await page.fill('[data-f="d-name"]', 'Renamed');
  await page.reload();
  await page.waitForSelector('#nav:not([hidden])', { state: 'attached' });
  await expect(page.locator('.ob')).toHaveCount(0);
  await expect.poll(() => fake.profiles[0].display_name).toBe('Renamed');
  expect(fake.profiles[0].onboarded).toBe(true);
});

test('a live session’s empty sets stay empty after a reload, showing last time’s numbers as hints', async ({ page }) => {
  const h = benchHistory(), fake = new FakeSupabase(h);
  await login(page, fake, 'A');
  /* repeat the last session: every set starts empty, with last time's weight and reps as hints */
  await page.goto('/session/' + h.sessions[0].id);
  await page.locator('#view [data-act="repeat"]').click();
  await expect(page.locator('#view [data-f="w"]').first()).toHaveAttribute('placeholder', '80');
  await expect.poll(() => fake.sessions.filter(s => !s.ended_at).length).toBe(1);
  await page.waitForTimeout(800);
  await page.reload();
  await page.waitForSelector('#view [data-f="w"]');
  const w = page.locator('#view [data-f="w"]').first(), r = page.locator('#view [data-f="r"]').first();
  await expect(w).toHaveValue(''); await expect(r).toHaveValue('');
  await expect(w).toHaveAttribute('placeholder', '80'); await expect(r).toHaveAttribute('placeholder', '8');
  /* ticking it takes the hints */
  await page.locator('#view [data-act="done"]').first().click();
  await expect(w).toHaveValue('80');
});

test('swapping two muscle group names swaps them, without merging the groups', async ({ page }) => {
  const ex = [{ id: crypto.randomUUID(), name: 'Bench Press', muscle: 'Chest', kind: 'w' }, { id: crypto.randomUUID(), name: 'Row', muscle: 'Back', kind: 'w' }];
  const fake = new FakeSupabase({ exercises: ex });
  await login(page, fake, 'A');
  await page.goto('/exercises');
  await page.click('[data-act="lib-menu"]');
  await page.locator('#sheet-body [data-mi]', { hasText: 'Edit muscle groups' }).click();
  const field = n => page.locator(`#sheet-body [data-mg]`).nth(n);
  await expect(field(0)).toBeVisible();
  const names = await page.locator('#sheet-body [data-mg]').evaluateAll(els => els.map(e => e.value));
  const ci = names.indexOf('Chest'), bi = names.indexOf('Back');
  await field(ci).fill('Back'); await field(bi).fill('Chest');
  await page.click('#mg-save');
  await expect.poll(() => fake.exercises.find(e => e.name === 'Bench Press').muscle).toBe('Back');
  await expect.poll(() => fake.exercises.find(e => e.name === 'Row').muscle).toBe('Chest');
});
