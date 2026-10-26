/* The rubber band at the top and bottom of the page on phones. */
import { test, expect, devices } from '@playwright/test';
import { FakeSupabase, login, benchHistory } from './fake-supabase.js';

const phoneOnly = info => test.skip(info.project.name !== 'phone', 'phone only');
/* where an element sits on the page (not on screen), so only the stretch moves it, not scrolling */
const topOf = (page, sel) => page.evaluate(s => document.querySelector(s).getBoundingClientRect().top + scrollY, sel);

/* the page's entrance animations have finished, so positions hold still */
const settled = page => page.waitForFunction(() => document.getAnimations().every(a => a.timeline !== document.timeline || a.playState !== 'running' || a.effect.getComputedTiming().iterations === Infinity));

/* drag one finger from y0 to y1 in small steps, like a real swipe; returns a function that lifts it */
async function drag(page, y0, y1) {
  const cdp = await page.context().newCDPSession(page);
  const at = y => [{ x: 200, y }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: at(y0) });
  for (let k = 1; k <= 12; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: at(y0 + (y1 - y0) * k / 12) });
  return () => cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

/* on Home a pull from the top brings down the today panel instead (records-history-splits.spec.js) */
test('pulling past the top stretches the page with resistance, then it springs back', async ({ page }, info) => {
  phoneOnly(info);
  await login(page, new FakeSupabase(benchHistory()), 'A');
  await page.goto('/guide');
  await page.waitForSelector('.guide-sec');
  await settled(page);
  const el = '#view .guide-sec', before = await topOf(page, el);
  const lift = await drag(page, 300, 480);
  const pulled = await topOf(page, el) - before;
  expect(pulled).toBeGreaterThan(30);
  expect(pulled).toBeLessThan(180);
  /* the dock stays where it is */
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('#nav')).translate)).toBe('none');
  await lift();
  await expect.poll(() => topOf(page, el), { timeout: 3000 }).toBeCloseTo(before, 0);
  await expect(page.locator('#tsheet')).toBeHidden();
});

test('pulling past the bottom lifts the page, then it springs back', async ({ page }, info) => {
  phoneOnly(info);
  await login(page, new FakeSupabase(benchHistory()), 'A');
  await settled(page);
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(300); await settled(page);
  const before = await topOf(page, '#view .home-edit');
  const lift = await drag(page, 600, 420);
  const pulled = before - await topOf(page, '#view .home-edit');
  expect(pulled).toBeGreaterThan(30);
  expect(pulled).toBeLessThan(180);
  await lift();
  await expect.poll(() => topOf(page, '#view .home-edit'), { timeout: 3000 }).toBeCloseTo(before, 0);
});

test('in the middle of the page a swipe just scrolls', async ({ page }, info) => {
  phoneOnly(info);
  await login(page, new FakeSupabase(benchHistory()), 'A');
  await page.goto('/guide');
  await page.waitForSelector('.guide-sec');
  await page.evaluate(() => scrollTo(0, 400));
  await page.waitForTimeout(300);
  for (const [a, b] of [[440, 520], [520, 440]]) {
    const lift = await drag(page, a, b);
    expect(await page.evaluate(() => [...document.querySelectorAll('#view *')].some(el => el.style.translate))).toBe(false);
    await lift();
  }
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(200);
});

test('iPhones keep their own rubber band', async ({ browser }, info) => {
  phoneOnly(info);
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await ctx.newPage();
  await new FakeSupabase().attach(page);
  await page.goto('/');
  await expect(page.locator('html')).toHaveClass(/\bios\b/);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).overscrollBehaviorY)).toBe('auto');
  await ctx.close();
});

test('the session bar stays fixed while the page stretches', async ({ page }, info) => {
  phoneOnly(info);
  await login(page, new FakeSupabase(benchHistory()), 'A');
  await page.locator('#nav .nav-train').click();
  await page.locator('#sheet-body [data-st-foot]', { hasText: 'Empty session' }).click();
  await page.waitForSelector('.transport');
  await page.waitForTimeout(800);
  const bar = () => page.evaluate(() => document.querySelector('.transport').getBoundingClientRect().bottom);
  const before = await bar();
  const lift = await drag(page, 250, 430);
  expect(await page.evaluate(() => [...document.querySelectorAll('#view *')].some(el => el.style.translate))).toBe(true);
  expect(await bar()).toBeCloseTo(before, 0);
  await lift();
});

test('a fling into the top bounces off it', async ({ page }, info) => {
  phoneOnly(info);
  await login(page, new FakeSupabase(benchHistory()), 'A');
  await page.goto('/guide');
  await page.waitForSelector('.guide-sec');
  await page.evaluate(() => scrollTo(0, 400));
  await page.waitForTimeout(200);
  /* a finger lifts, then the page coasts up into the top at about 1500 px/s */
  (await drag(page, 700, 700))();
  const peak = await page.evaluate(async () => {
    const tick = () => new Promise(r => requestAnimationFrame(r));
    for (let y = 400; y > 0; y -= 25) { scrollTo(0, Math.max(0, y - 25)); await tick(); }
    let max = 0; const t0 = performance.now();
    while (performance.now() - t0 < 400) { const v = parseFloat((document.querySelector('#view > *').style.translate || '0 0').split(' ')[1]) || 0; max = Math.max(max, v); await tick(); }
    return max;
  });
  expect(peak).toBeGreaterThan(8);
  expect(peak).toBeLessThan(80);
  await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('#view > *')].some(el => el.style.translate))).toBe(false);
});
