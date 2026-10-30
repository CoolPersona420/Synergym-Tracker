/* The app installed on an iPhone swipes back from the left edge, as iPhone apps do. */
import { test, expect } from '@playwright/test';
import { FakeSupabase, login, benchHistory } from './fake-supabase.js';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
/* a finger: down at (x, y), then moved in steps `ms` apart, then lifted (or held, to look mid-swipe) */
const down = (page, x, y = 420) => page.evaluate(([x, y]) => {
  const el = document.elementFromPoint(x, y) || document.body, t = (x, y) => new Touch({ identifier: 7, target: el, clientX: x, clientY: y, pageX: x, pageY: y });
  window.__f = { el, t, x, y, fire: (type, x, y) => el.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: type === 'touchend' ? [] : [t(x, y)], changedTouches: [t(x, y)] })) };
  window.__f.fire('touchstart', x, y);
}, [x, y]);
const moveTo = (page, x, y = 420, steps = 8, ms = 16) => page.evaluate(async ([x, y, steps, ms]) => {
  const f = window.__f;
  for (let i = 1; i <= steps; i++) { f.fire('touchmove', f.x + (x - f.x) * i / steps, f.y + (y - f.y) * i / steps); await new Promise(r => setTimeout(r, ms)); }
  f.x = x; f.y = y;
}, [x, y, steps, ms]);
const up = page => page.evaluate(() => window.__f.fire('touchend', window.__f.x, window.__f.y));
const swipe = async (page, x0, x1, opts = {}) => { await down(page, x0, opts.y); await moveTo(page, x1, opts.y1 ?? opts.y, opts.steps, opts.ms); await up(page); };
/* a page opened by its address has loaded (the app reloads) and finished drawing: nothing busy under the swipe */
const settled = async page => {
  await page.waitForFunction(() => !document.getElementById('splash') && !document.getElementById('qsplash') && document.querySelector('#view .card'));
  await page.waitForTimeout(300);
};

test.describe('installed on an iPhone', () => {
  test.use({ userAgent: IPHONE, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name !== 'phone', 'one phone run is enough');
    await page.addInitScript(() => Object.defineProperty(navigator, 'standalone', { get: () => true }));
  });

  test('swiping in from the left edge goes back, and names where it goes on the way', async ({ page }) => {
    const fake = new FakeSupabase(benchHistory());
    await login(page, fake, 'A');
    await page.locator('[data-w="coach"]').click();
    await expect(page).toHaveURL(/\/coach$/);
    await page.waitForTimeout(700);
    await down(page, 4);
    await moveTo(page, 160);
    await expect(page.locator('#eb-hint')).toContainText('Home');
    expect(+(await page.locator('#eb-hint').evaluate(el => getComputedStyle(el).opacity))).toBeGreaterThan(0.5);
    /* the page follows the finger */
    expect(await page.locator('#view > *').first().evaluate(el => el.style.translate)).toMatch(/^1[45]\d(\.\d)?px/);
    await up(page);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('[data-w="coach"]')).toBeVisible();
    await expect(page.locator('#eb-hint')).toHaveCSS('opacity', '0');
  });

  test('opened straight from a link, a swipe goes up a level: an exercise goes back to Exercises', async ({ page }) => {
    const h = benchHistory(), fake = new FakeSupabase(h);
    await login(page, fake, 'A');
    await page.goto('/exercises/' + h.exercises[0].id);
    await settled(page);
    await swipe(page, 4, 330);
    await expect(page).toHaveURL(/\/exercises$/);
  });

  test('a swipe that starts on the launch splash still springs back when the splash goes', async ({ page }) => {
    const h = benchHistory(), fake = new FakeSupabase(h);
    await login(page, fake, 'A');
    await page.goto('/exercises/' + h.exercises[0].id);
    /* the finger lands on the splash, which fades and leaves the page mid-swipe (a slow phone in CI hit this) */
    await page.waitForFunction(() => document.getElementById('qsplash'));
    await page.waitForTimeout(150);
    await down(page, 4);
    expect(await page.evaluate(() => window.__f.el.id)).toBe('qsplash');
    await moveTo(page, 70, 420, 8, 120);
    /* lift only once the splash has gone, however long this machine takes to get there */
    await page.waitForFunction(() => !window.__f.el.isConnected, null, { timeout: 8000 });
    await up(page);
    await expect.poll(() => page.locator('#view > *').first().evaluate(el => el.style.translate)).toBe('');
  });

  test('a short, slow drag springs back and stays put', async ({ page }) => {
    const h = benchHistory(), fake = new FakeSupabase(h);
    await login(page, fake, 'A');
    await page.goto('/exercises/' + h.exercises[0].id);
    await settled(page);
    await swipe(page, 4, 70, { ms: 70 });
    /* it springs home (however slow the machine), and stays on the page */
    await expect.poll(() => page.locator('#view > *').first().evaluate(el => el.style.translate)).toBe('');
    await page.waitForTimeout(300);
    await expect(page).toHaveURL(/\/exercises\/.+/);
  });

  test('only from the edge, only sideways, and not on the dock’s own pages or over a sheet', async ({ page }) => {
    const h = benchHistory(), fake = new FakeSupabase(h);
    await login(page, fake, 'A');
    await page.goto('/exercises/' + h.exercises[0].id);
    await page.waitForTimeout(700);
    /* from the middle of the screen: a normal touch */
    await swipe(page, 120, 380);
    await expect(page).toHaveURL(/\/exercises\/.+/);
    /* mostly down: a scroll */
    await swipe(page, 4, 40, { y: 300, y1: 700 });
    await expect(page).toHaveURL(/\/exercises\/.+/);
    /* a sheet is open: it keeps the touch */
    await page.locator('[data-act="edit-orm"]').click();
    await expect(page.locator('#sheet')).toBeVisible();
    await swipe(page, 4, 330, { y: 300 });
    await expect(page).toHaveURL(/\/exercises\/.+/);
    await page.locator('#sheet-body [data-act="close"]').first().click();
    /* Home and History are where you go back to, not from */
    for (const p of ['/', '/history']) {
      await page.goto(p); await page.waitForTimeout(700);
      await swipe(page, 4, 330, { y: 300 });
      await expect(page).toHaveURL(new RegExp(p === '/' ? '/$' : '/history$'));
    }
  });
});

test('not on Android or in a browser tab, which have their own back', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'touch only');
  const h = benchHistory(), fake = new FakeSupabase(h);
  await login(page, fake, 'A');
  await page.goto('/exercises/' + h.exercises[0].id);
  await page.waitForTimeout(700);
  await swipe(page, 4, 330);
  await expect(page).toHaveURL(/\/exercises\/.+/);
  await expect(page.locator('#eb-hint')).toHaveCount(0);
});
