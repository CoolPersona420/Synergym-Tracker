/* Sliding along a switch, as on the dock: the pill follows the finger, letting go picks the option under it. */
import { test, expect } from '@playwright/test';
import { FakeSupabase, login, benchHistory } from './fake-supabase.js';

test('slide along a switch: the pill follows, the option you let go on is picked and saved; taps and scrolling still work', async ({ page }) => {
  const fake = new FakeSupabase(benchHistory());
  await login(page, fake, 'A');
  await page.goto('/settings');
  const opt = v => page.locator(`[data-act="d-week"][data-v="${v}"]`);
  const seg = page.locator('.seg', { has: opt(1) });
  /* the page has finished coming in, and scrolling it into view has settled */
  await page.waitForTimeout(1300); await opt(1).scrollIntoViewIfNeeded(); await page.waitForTimeout(400);
  await expect(opt(1)).toHaveAttribute('aria-pressed', 'true');
  const mid = async v => { const r = await opt(v).boundingBox(); return [r.x + r.width / 2, r.y + r.height / 2]; };
  const pillX = () => seg.evaluate(s => parseFloat(s.style.getPropertyValue('--x')) || 0);

  /* up and down is a scroll, not a slide: nothing changes */
  let [x, y] = await mid(1);
  await page.mouse.move(x, y); await page.mouse.down();
  for (let i = 1; i <= 5; i++) await page.mouse.move(x + i, y + i * 10);
  await expect(seg).not.toHaveClass(/drag/);
  await page.mouse.up();
  await expect(opt(1)).toHaveAttribute('aria-pressed', 'true');

  /* Mon to Sat: mid-slide the pill has moved and Sat is lit; let go and Sat is picked and saved */
  [x, y] = await mid(1); const [x6] = await mid(6), x0 = await pillX();
  await page.mouse.move(x, y); await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(x + (x6 - x) * i / 12, y);
  await expect(seg).toHaveClass(/drag/);
  await expect(opt(6)).toHaveClass(/hot/);
  expect(await pillX()).toBeGreaterThan(x0 + 20);
  await page.mouse.up();
  await expect(opt(6)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.seg.drag')).toHaveCount(0);
  await expect.poll(() => fake.profiles[0].week_start).toBe(6);

  /* slid away and back to where it was: nothing changes */
  [x, y] = await mid(6); const [x0b] = await mid(0);
  await page.mouse.move(x, y); await page.mouse.down();
  for (let i = 1; i <= 6; i++) await page.mouse.move(x + (x0b - x) * i / 6, y);
  for (let i = 5; i >= 0; i--) await page.mouse.move(x + (x0b - x) * i / 6, y);
  await page.mouse.up();
  await expect(opt(6)).toHaveAttribute('aria-pressed', 'true');

  /* a plain tap still picks */
  await opt(0).click();
  await expect(opt(0)).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => fake.profiles[0].week_start).toBe(0);
});

test('the Coach tabs slide too', async ({ page }) => {
  await login(page, new FakeSupabase(benchHistory()), 'A');
  await page.goto('/coach');
  await page.waitForTimeout(1300);
  const tabs = page.locator('.co-tabs [data-act="coach-tab"]');
  await expect(tabs.first()).toHaveClass(/on/);
  const a = await tabs.first().boundingBox(), b = await tabs.last().boundingBox(), y = a.y + a.height / 2;
  await page.mouse.move(a.x + a.width / 2, y); await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(a.x + a.width / 2 + (b.x - a.x) * i / 10, y);
  await page.mouse.up();
  await expect(tabs.last()).toHaveClass(/on/);
});
