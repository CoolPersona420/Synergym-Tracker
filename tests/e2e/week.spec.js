/* The week can start on Monday, Sunday or Saturday. */
import { test, expect } from '@playwright/test';
import { FakeSupabase, login } from './fake-supabase.js';

test('the week can start on Sunday: this week’s count and the setting follow it', async ({ page }) => {
  /* a session on each of the last six days: since Monday that's (weekday + 6) % 7 of them, since Sunday weekday */
  const ex = { id: crypto.randomUUID(), name: 'Bench Press', muscle: 'Chest', kind: 'w' }, now = new Date(), dow = now.getDay();
  const sessions = [1, 2, 3, 4, 5, 6].map(n => { const t = new Date(now.getFullYear(), now.getMonth(), now.getDate() - n, 12);
    return { id: crypto.randomUUID(), name: 'Push', started_at: t.toISOString(), ended_at: new Date(+t + 3600e3).toISOString(), items: [{ id: 'i' + n, exId: ex.id, sets: [{ id: 's' + n, w: 80, r: 8, done: true }] }] }; });
  const fake = new FakeSupabase({ exercises: [ex], sessions });
  await login(page, fake, 'A');
  const week = async () => { await page.goto('/'); await page.locator('.ts-open').click(); return page.locator('#tsheet .ts-week b').textContent(); };
  expect(await week()).toBe(`${(dow + 6) % 7} of 3`);
  await page.goto('/settings');
  await expect(page.locator('[data-act="d-week"][data-v="1"]')).toHaveAttribute('aria-pressed', 'true');
  await page.click('[data-act="d-week"][data-v="0"]');
  await expect(page.locator('[data-act="d-week"][data-v="0"]')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => fake.profiles[0].week_start).toBe(0);
  expect(await week()).toBe(`${dow} of 3`);
});
