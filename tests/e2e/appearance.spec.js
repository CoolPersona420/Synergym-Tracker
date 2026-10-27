/* The Home Screen icon follows the app (its theme, or with Auto the phone's light or dark mode) unless Settings
   fixes it, without ever changing the app's theme; and the week can start on Monday, Sunday or Saturday. */
import { test, expect } from '@playwright/test';
import { FakeSupabase, login, benchHistory } from './fake-supabase.js';

const phoneOnly = info => test.skip(info.project.name !== 'phone', 'phone only');
const icon = page => page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
const manifest = page => page.locator('link[rel="manifest"]').getAttribute('href');

test('the app icon matches the phone’s light or dark mode, then the theme, unless fixed to light or dark', async ({ page }, info) => {
  phoneOnly(info);
  await page.emulateMedia({ colorScheme: 'light' });
  await login(page, new FakeSupabase(benchHistory()), 'A');
  expect(await icon(page)).toBe('/icons/light-180.png');
  expect(await manifest(page)).toBe('/manifests/light.webmanifest');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(() => icon(page)).toBe('/icons/dark-180.png');
  /* a named theme puts its colours on the icon */
  await page.goto('/settings');
  await page.click('[data-act="d-theme"][data-t="ocean"]');
  await expect.poll(() => icon(page)).toBe('/icons/ocean-180.png');
  await expect(page.locator('.ic-opt[data-v="app"] img')).toHaveAttribute('src', '/icons/ocean-180.png');
  /* fixing the icon to light leaves the app's theme alone */
  await page.click('[data-act="app-icon"][data-v="light"]');
  await expect.poll(() => icon(page)).toBe('/icons/light-180.png');
  expect(await manifest(page)).toBe('/manifests/light.webmanifest');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'ocean');
  await expect(page.locator('.ic-opt[data-v="light"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.sg-f').filter({ hasText: 'Your app’s theme stays as it is.' })).toBeVisible();
  /* and it's remembered on this phone */
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#nav') && !document.querySelector('#nav').hidden);
  expect(await icon(page)).toBe('/icons/light-180.png');
  await page.click('[data-act="app-icon"][data-v="app"]');
  await expect.poll(() => icon(page)).toBe('/icons/ocean-180.png');
});

test('every icon and manifest is served, with an Android themed icon', async ({ page }) => {
  for (const v of ['light', 'dark', 'ocean', 'volt', 'solarized-light']) {
    for (const f of [`${v}-180.png`, `${v}-192.png`, `${v}-512.png`, `${v}-maskable.png`]) {
      const r = await page.request.get('/icons/' + f);
      expect(r.status(), f).toBe(200); expect(r.headers()['content-type']).toContain('image/png');
    }
    const m = await (await page.request.get(`/manifests/${v}.webmanifest`)).json();
    expect(m.id).toBe('/'); expect(m.start_url).toBe('/');
    expect(m.icons.map(i => i.purpose)).toEqual(['any', 'any', 'maskable', 'monochrome']);
  }
  const root = await (await page.request.get('/manifest.webmanifest')).json();
  expect(root.icons.some(i => i.purpose === 'monochrome' && i.src === '/icons/monochrome.png')).toBe(true);
});

test('a link from Settings carries the icon into Safari, and leaves the address clean', async ({ page }) => {
  await page.goto('/?icon=sage');
  await expect.poll(() => icon(page)).toBe('/icons/sage-180.png');
  expect(new URL(page.url()).search).toBe('');
  expect(await page.evaluate(() => localStorage.getItem('sg-icon'))).toBe('sage');
});

test.describe('in the iPhone app', () => {
  test.use({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });
  test('Settings explains that iPhone keeps its icon, and copies a link to add it again', async ({ page, context }, info) => {
    phoneOnly(info);
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.addInitScript(() => Object.defineProperty(navigator, 'standalone', { get: () => true }));
    await page.emulateMedia({ colorScheme: 'dark' });
    await login(page, new FakeSupabase(benchHistory()), 'A');
    await page.goto('/settings');
    await expect(page.getByText('iPhone keeps the icon Synergym had when it was added.', { exact: false })).toBeVisible();
    await page.click('[data-act="icon-safari"]');
    await expect(page.locator('#toast')).toContainText('Link copied');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/\/\?icon=dark$/);
  });
});

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
