/* The revamp: on a phone the dock steps aside while you scroll down a page and comes back when you scroll up or stop;
   tapping the tab you're on glides back to the top; buttons leave a drop of ink where you press. */
import { test, expect } from '@playwright/test';
import { FakeSupabase, login } from './fake-supabase.js';

const day = n => new Date(Date.now() - n * 864e5).toISOString();
function many() {
  const ex = { id: crypto.randomUUID(), name: 'Bench Press', muscle: 'Chest', kind: 'w' };
  const sessions = Array.from({ length: 24 }, (_, k) => ({ id: crypto.randomUUID(), name: 'Push', started_at: day(k * 2 + 1), ended_at: day(k * 2 + 0.95),
    items: [{ id: 'i' + k, exId: ex.id, sets: [1, 2, 3].map(s => ({ id: `s${k}${s}`, w: 60 + k, r: 8, done: true })) }] }));
  return new FakeSupabase({ defaults: [], exercises: [ex], sessions });
}
/* scroll in small steps, a frame apart, the way a finger does */
const scrollSteps = (page, dy, n = 8) => page.evaluate(async ([dy, n]) => {
  for (let i = 0; i < n; i++) { scrollBy(0, dy); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); }
  return document.body.classList.contains('dock-away');
}, [dy, n]);

test('phone: the dock slides away while scrolling down, and comes back on scroll up and when scrolling stops', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'the dock only hides on a phone');
  await login(page, many(), 'A');
  await page.goto('/history');
  await expect(page.locator('.nav-i.on')).toBeVisible();
  expect(await scrollSteps(page, 40)).toBe(true);
  expect(await scrollSteps(page, -30, 3)).toBe(false);
  expect(await scrollSteps(page, 40)).toBe(true);
  /* stop scrolling: it comes back on its own */
  await expect(page.locator('body')).not.toHaveClass(/dock-away/, { timeout: 3000 });
  await expect(page.locator('.nav-i.on')).toBeInViewport();
});

test('tapping the tab you are on glides back to the top of its page', async ({ page }) => {
  await login(page, many(), 'A');
  await page.goto('/history');
  await page.evaluate(() => scrollTo(0, 900));
  await expect(page.locator('body')).not.toHaveClass(/dock-away/, { timeout: 3000 });
  const url = page.url();
  await page.locator('.nav-i.on').click();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  expect(page.url()).toBe(url);
});

test('a button press leaves a drop of ink where it was touched', async ({ page }) => {
  await new FakeSupabase().attach(page, 'A');
  await page.goto('/');
  const b = page.locator('#f-auth button[type=submit]');
  await expect(b).toBeVisible();
  /* hover waits for the login box to finish arriving */
  await b.hover({ position: { x: 12, y: 10 } });
  await page.mouse.down();
  await expect(b).toHaveClass(/\bink\b/);
  expect(parseFloat(await b.evaluate(el => el.style.getPropertyValue('--ix')))).toBeCloseTo(12, 0);
  await page.mouse.up();
  await expect(b).not.toHaveClass(/\bink\b/, { timeout: 3000 });
});
