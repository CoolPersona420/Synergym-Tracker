/* The toast: frosted glass like the session bar; swipe it up to dismiss, a tap clears one without a button. */
import { test, expect } from '@playwright/test';
import { FakeSupabase, login, benchHistory } from './fake-supabase.js';

const X = (name, muscle) => ({ id: crypto.randomUUID(), name, muscle, kind: 'w' });
const day = n => new Date(Date.now() - n * 864e5).toISOString();

/* a live session with Barbell Row; replacing it with Lat Pulldown shows "… swapped for …" with Undo */
async function swapToast(page) {
  const row = X('Barbell Row', 'Back'), lat = X('Lat Pulldown', 'Back');
  const live = { id: crypto.randomUUID(), name: 'Pull', started_at: new Date(Date.now() - 6e5).toISOString(), ended_at: null,
    items: [{ id: 'L1', exId: row.id, sets: [{ id: 'q0', w: null, r: null, pw: 70, pr: 8, done: false }] }] };
  const fake = new FakeSupabase({ defaults: [], exercises: [row, lat], sessions: [live,
    { id: crypto.randomUUID(), name: 'Pull', started_at: day(3), ended_at: day(2.96), items: [{ id: 'a', exId: lat.id, sets: [{ id: 'a1', w: 60, r: 10, done: true }] }] }] });
  await login(page, fake, 'A');
  await page.goto('/session/' + live.id);
  await page.click('[data-act="item-menu"][data-item="L1"]');
  await page.locator('#sheet .menu button', { hasText: 'Replace exercise' }).click();
  await page.locator('#pkl .pk', { hasText: 'Lat Pulldown' }).click();
  await expect(page.locator('#toast')).toHaveClass(/show/);
  await expect(page.locator('#toast')).toContainText('Barbell Row swapped for Lat Pulldown');
  await page.waitForTimeout(600);
  return { fake, live, lat };
}
async function drag(page, dy) {
  const b = await page.locator('#toast .tx').boundingBox(), x = b.x + b.width / 2, y = b.y + b.height / 2;
  await page.mouse.move(x, y); await page.mouse.down();
  for (let i = 1; i <= 6; i++) { await page.mouse.move(x, y + dy * i / 6); await page.waitForTimeout(16); }
  await page.mouse.up();
}

test('the toast is glass like the session bar, with a solid action button', async ({ page }) => {
  await swapToast(page);
  const st = await page.locator('#toast').evaluate(el => { const s = getComputedStyle(el); return { blur: s.backdropFilter || s.webkitBackdropFilter, bg: s.backgroundColor }; });
  expect(st.blur).toContain('blur');
  const [glass, act, solid] = await page.evaluate(() => [getComputedStyle(document.querySelector('.transport')).backgroundColor, getComputedStyle(document.querySelector('.toast-act')).backgroundColor,
    getComputedStyle(document.documentElement).getPropertyValue('--solid').trim()]);
  expect(st.bg).toBe(glass);
  expect(act).not.toBe(st.bg);
  expect(solid).toBeTruthy();
});

test('swiping the toast up dismisses it without undoing; a short pull springs back', async ({ page }) => {
  const { fake, live, lat } = await swapToast(page);
  /* a little pull: it comes back, still showing */
  await drag(page, -12);
  await page.waitForTimeout(600);
  await expect(page.locator('#toast')).toHaveClass(/show/);
  await expect.poll(() => page.locator('#toast').evaluate(el => el.style.translate)).toBe('');
  /* a real swipe up: gone, and the swap stays */
  await drag(page, -70);
  await expect(page.locator('#toast')).not.toHaveClass(/show/);
  await expect(page.locator('#toast')).toBeHidden();
  await expect(page.locator('[data-item="L1"] h3')).toHaveText('Lat Pulldown');
  await expect.poll(() => fake.sessions.find(s => s.id === live.id).items[0].exId).toBe(lat.id);
});

test('a swipe that ends on Undo doesn’t press it; Undo pressed on its own still undoes', async ({ page }) => {
  await swapToast(page);
  const b = await page.locator('#toast .toast-act').boundingBox(), x = b.x + b.width / 2, y = b.y + b.height / 2;
  await page.mouse.move(x, y); await page.mouse.down();
  await page.mouse.move(x, y + 12); await page.mouse.move(x, y + 20); await page.mouse.move(x, y + 8); await page.mouse.move(x, y); await page.mouse.up();
  await page.waitForTimeout(500);
  await expect(page.locator('[data-item="L1"] h3')).toHaveText('Lat Pulldown');
  await page.click('#toast .toast-act');
  await expect(page.locator('[data-item="L1"] h3')).toHaveText('Barbell Row');
  await expect(page.locator('#toast')).not.toHaveClass(/show/);
});

test('a tap clears a toast that has no button', async ({ page }) => {
  const data = benchHistory(), fake = new FakeSupabase(data);
  await login(page, fake, 'A');
  await page.goto('/session/' + data.sessions[0].id);
  await page.locator('[data-f="w"][data-set="s31"]').click();
  await expect(page.locator('#toast')).toHaveClass(/show/);
  await expect(page.locator('#toast .toast-act')).toHaveCount(0);
  await page.waitForTimeout(600);
  await page.locator('#toast').click();
  await expect(page.locator('#toast')).not.toHaveClass(/show/);
});
