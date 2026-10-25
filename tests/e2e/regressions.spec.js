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
