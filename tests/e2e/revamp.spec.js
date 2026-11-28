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

/* a live session long enough to scroll: six exercises, the first with one set left to tick */
function liveSession() {
  const ex = ['Bench Press', 'Overhead Press', 'Incline Dumbbell Press', 'Tricep Pushdown', 'Lateral Raise', 'Dip'].map(name => ({ id: crypto.randomUUID(), name, muscle: 'Chest', kind: 'w' }));
  const live = { id: crypto.randomUUID(), name: 'Push', started_at: new Date(Date.now() - (24 * 60 + 51) * 1000).toISOString(), ended_at: null,
    items: ex.map((e, j) => ({ id: 'L' + j, exId: e.id, sets: [1, 2, 3].map(s => ({ id: `l${j}${s}`, w: j < 2 ? 60 : null, r: j < 2 ? 8 : null, done: j < 2 && !(j === 0 && s === 3) })) })) };
  return { fake: new FakeSupabase({ defaults: [], exercises: ex, sessions: [live] }), live };
}

test('the session bar shows when the session started over its sets and volume, Finish in the standout colour, and a line that empties with the rest', async ({ page }) => {
  const { fake, live } = liveSession();
  await login(page, fake, 'A');
  await page.goto('/session/' + live.id);
  const bar = page.locator('.transport');
  /* the minute the seeded session started, read in the page's time zone (worked out from now again it can tick over
     to the next minute and fail by one) */
  const started = await page.evaluate(at => { const d = new Date(at); return [d.getHours(), d.getMinutes()]; }, live.started_at);
  await expect(bar.locator('.tsum .tl')).toContainText(/started \d{1,2}[.:]\d{2}/i);
  await expect(bar.locator('.tsum .tl time')).toContainText(String(started[1]).padStart(2, '0'));
  await expect(bar.locator('.tsum .tv')).toContainText('6 sets');
  const [fin, ring] = await page.evaluate(() => { const p = document.createElement('i'); p.style.background = 'var(--ring)'; document.body.append(p); const r = getComputedStyle(p).backgroundColor; p.remove(); return [getComputedStyle(document.querySelector('.tfin')).backgroundColor, r]; });
  expect(fin).toBe(ring);
  /* tick the last set: the rest timer starts and its line is full, then empties */
  await page.locator('article.ex').first().locator('.chk').nth(2).click();
  await expect(bar.locator('.tsum.rest')).toBeVisible();
  await expect(bar.locator('.tprog')).toHaveClass(/\bon\b/);
  const scale = () => bar.locator('.tprog').evaluate(el => new DOMMatrix(getComputedStyle(el).transform).a);
  await expect.poll(scale).toBeGreaterThan(0.9);
  const a = await scale();
  await expect.poll(scale, { timeout: 4000 }).toBeLessThan(a - 0.005);
});

test('phone: in a session the bar slides away while scrolling down and comes back on scroll up', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'the bars only hide on a phone');
  const { fake, live } = liveSession();
  await login(page, fake, 'A');
  await page.goto('/session/' + live.id);
  await expect(page.locator('.transport .tfin')).toBeVisible();
  await page.waitForTimeout(600);
  expect(await scrollSteps(page, 40)).toBe(true);
  await expect.poll(() => page.locator('.transport').evaluate(el => el.getBoundingClientRect().top >= innerHeight - 1)).toBe(true);
  expect(await scrollSteps(page, -10, 2)).toBe(false);
  await expect(page.locator('.transport .tfin')).toBeInViewport();
});

test('themes are a popup: every theme in a single list with its colours, no groups; picking one applies it and closes the popup', async ({ page }) => {
  await login(page, new FakeSupabase(), 'A');
  await page.goto('/settings');
  const btn = page.locator('.th-cur');
  await expect(btn).toContainText('Auto');
  await expect(btn.locator('.th-sw i')).toHaveCount(4);
  await btn.click();
  const pop = page.locator('#sheet');
  await expect(pop.locator('h3')).toHaveText('Theme');
  await expect(pop.locator('.th-o')).toHaveCount(19);
  await expect(pop.locator('.th-o').first().locator('.th-sw i')).toHaveCount(4);
  await expect(pop.locator('.th-o[data-t="auto"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.themes-h')).toHaveCount(0);
  await pop.locator('.th-o[data-t="kanagawa"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'kanagawa');
  await expect(page.locator('#sheet')).toBeHidden();
  await expect(page.locator('.th-cur')).toContainText('Great Wave');
  /* closed without a pick: nothing changes */
  await page.locator('.th-cur').click();
  await expect(page.locator('#sheet .th-o[data-t="kanagawa"]')).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Escape');
  await expect(page.locator('#sheet')).toBeHidden();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'kanagawa');
});
