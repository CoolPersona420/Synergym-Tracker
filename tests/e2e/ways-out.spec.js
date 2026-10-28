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

test('one close button everywhere: the same round ✕, top right, named Close', async ({ page }, info) => {
  const fake = new FakeSupabase(benchHistory());
  await login(page, fake, 'A');
  const same = async (sel, what) => {
    const x = page.locator(sel);
    await expect(x, what).toBeVisible();
    await expect(x, what).toHaveClass(/\bxbtn\b/);
    expect(await x.getAttribute('aria-label'), what).toMatch(/^Close/);
    const b = await x.boundingBox();
    expect(Math.round(b.width), what).toBe(40); expect(Math.round(b.height), what).toBe(40);
    return x;
  };
  await page.goto('/settings');
  await page.click('[data-act="how"]');
  await (await same('#sheet-body .sh-h [data-act="close"]', 'a sheet')).click();
  await page.click('[data-act="tour"]');
  await (await same('#sheet-body .tour-x', 'the tour')).click();
  await expect(page.locator('#sheet')).toBeHidden();
  await page.goto('/w/week');
  await same('[data-act="w-close"]', 'a full-screen widget');
  await page.goto('/');
  await page.locator('.ts-open').click();
  await same('#tsheet .tsh-x', 'the today panel');
  if (info.project.name === 'phone') { await page.goto('/coach'); await same('.co-top [data-act="coach-close"]', 'the Coach'); }
  /* no sheet header still has a text Close, Done or Later button */
  expect(await page.evaluate(() => [...document.querySelectorAll('.sh-h .btn')].map(b => b.textContent.trim()))).toEqual([]);
});
