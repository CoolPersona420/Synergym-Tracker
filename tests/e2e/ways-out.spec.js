/* Every sheet has a visible way out, and pages reached from another one have a Back button (the installed
   iPhone app also swipes back from the edge: see swipe-back.spec.js). */
import { test, expect } from '@playwright/test';
import { FakeSupabase, login, benchHistory } from './fake-supabase.js';

test('every page reached from another one has a Back button', async ({ page }) => {
  const h = benchHistory(), fake = new FakeSupabase(h);
  await login(page, fake, 'A');
  for (const p of ['/exercises/' + h.exercises[0].id, '/guide', '/session/' + h.sessions[0].id]) {
    await page.goto(p);
    await expect(page.locator('#view [data-act="back"]').first(), p).toBeVisible();
  }
  await page.goto('/w/week');
  await expect(page.locator('[data-act="w-close"]')).toBeVisible();
});

test('“How the numbers work” closes from the top, without scrolling to the end', async ({ page }) => {
  const fake = new FakeSupabase(benchHistory());
  await login(page, fake, 'A');
  await page.goto('/coach');
  await page.locator('.co-foot [data-act="how"]').click();
  const close = page.locator('#sheet-body .sh-h [data-act="close"]');
  await expect(close).toBeInViewport();
  await close.click();
  await expect(page.locator('#sheet')).toBeHidden();
});

test('the today panel has a Close button on phones too', async ({ page }) => {
  const fake = new FakeSupabase(benchHistory());
  await login(page, fake, 'A');
  await page.locator('.ts-open').click();
  const close = page.locator('#tsheet .tsh-x');
  await expect(close).toBeVisible();
  await close.click();
  await expect(page.locator('#tsheet')).toBeHidden();
});
