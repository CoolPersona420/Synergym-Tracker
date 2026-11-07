/* The Logbook from a computer's sidebar, the L key and the Consistency map; and a year of Consistency on a phone in
   two rows. */
import { test, expect } from '@playwright/test';
import { FakeSupabase, login, benchHistory } from './fake-supabase.js';

test('on a computer the Logbook is in the sidebar and on the L key, and a day on the Consistency map opens it', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'sidebar and mouse');
  const data = benchHistory(), last = data.sessions[0];
  await login(page, new FakeSupabase(data), 'A');
  const item = page.locator('#nav .nav-i[data-v="logbook"]');
  await expect(item).toBeVisible();
  await item.click();
  await expect(page).toHaveURL(/\/logbook$/);
  await expect(item).toHaveClass(/\bon\b/);
  await page.goto('/history'); await page.waitForTimeout(600);
  await page.keyboard.press('l');
  await expect(page).toHaveURL(/\/logbook$/);
  /* typing an l in a text box is just typing */
  await page.goto('/history'); await page.locator('.hsearch input').fill('l');
  await expect(page).toHaveURL(/\/history$/);
  /* the day of the last session, from its square */
  await page.goto('/w/consistency');
  const t = await page.evaluate(iso => { const d = new Date(iso); d.setHours(12); return [...document.querySelectorAll('.heat i[data-act="lb-day"]')].find(e => new Date(+e.dataset.t).toDateString() === d.toDateString())?.dataset.t; }, last.started_at);
  expect(t).toBeTruthy();
  await page.locator(`.heat i[data-t="${t}"]`).click();
  await expect(page).toHaveURL(/\/logbook$/);
  await expect(page.locator('#lb-day')).toContainText('Push');
});

test('a phone keeps the Logbook off its dock', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'phone dock');
  await login(page, new FakeSupabase(benchHistory()), 'A');
  await expect(page.locator('#nav .nav-i[data-v="logbook"]')).toBeHidden();
  await expect(page.locator('#nav .nav-i:visible')).toHaveCount(5);
});

test('a year of Consistency on a phone is two rows of half a year, each day twice the size', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'phone layout');
  await login(page, new FakeSupabase(benchHistory()), 'A');
  await page.goto('/w/consistency'); await page.waitForTimeout(900);
  const one = await page.locator('.heat i').first().boundingBox();
  await page.locator('[data-act="w-opt"][data-v="52"]').click();
  await expect(page.locator('.heat-rows .heat')).toHaveCount(2);
  expect(await page.locator('.heat-rows .heat').first().locator('i').count()).toBe(26 * 7);
  await expect(page.locator('.heat-rows .lbl').last()).toContainText('now');
  const big = await page.locator('.heat-rows .heat i').first().boundingBox();
  expect(big.width).toBeGreaterThan(8);
  expect(big.width).toBeLessThan(one.width);
});
