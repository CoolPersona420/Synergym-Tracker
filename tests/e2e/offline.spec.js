import { test, expect } from '@playwright/test';
import { FakeSupabase, login, benchHistory } from './fake-supabase.js';

/* offline mode is for the app installed on a phone: pretend to be one */
test.beforeEach(async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'offline mode is phone-only');
  await page.addInitScript(() => Object.defineProperty(navigator, 'standalone', { get: () => true }));
});

/* no server at all: every request to Supabase fails, and is counted */
async function noServer(page) {
  const hits = [];
  const handler = r => { hits.push(r.request().url()); return r.abort(); };
  await page.route(/\.supabase\.co\//, handler);
  return { hits, off: () => page.unroute(/\.supabase\.co\//, handler) };
}
async function onboardOffline(page, name = 'Alex') {
  await page.goto('/');
  await page.click('[data-act="go-local-new"]');
  await page.waitForSelector('#f-ob2');
  await expect(page.locator('#f-ob2 [name=username]')).toHaveCount(0);
  await page.fill('#f-ob2 [name=name]', name);
  await page.click('#f-ob2 button[type=submit]');
  await page.click('[data-act="ob-pick"][data-k="exp"][data-v="beginner"]');
  await page.click('[data-act="ob-next"]');
  await page.click('[data-act="ob-pick"][data-k="goal"][data-v="strength"]');
  await page.click('[data-act="ob-next"]');
  await page.click('[data-act="ob-next"]');
  await page.click('[data-act="ob-theme"][data-t="dark"]');
  await page.click('[data-act="ob-finish"]');
  await page.waitForSelector('.tour');
  for (let i = 0; i < 4; i++) await page.click('#tour-next');
  await page.locator('#sheet-body [data-act="close"]', { hasText: 'Start training' }).click();
  await page.waitForSelector('#nav:not([hidden])');
}
async function logSet(page, exercise, w, r) {
  if (new URL(page.url()).pathname !== '/') { await page.click('#nav [data-act="nav"][data-v="today"]'); await page.waitForTimeout(400); }
  await page.locator('[data-act="start-menu"]:visible').first().click();
  await page.locator('[data-st-foot]', { hasText: 'Empty session' }).click();
  await page.waitForSelector('.s-top');
  await page.click('[data-act="add-ex"]');
  await page.locator('[data-act="pk-pick"]', { hasText: exercise }).first().click();
  await page.locator('.ex .set input[data-f="w"]').first().fill(String(w));
  await page.locator('.ex .set input[data-f="r"]').first().fill(String(r));
  await page.locator('.ex .set [data-act="done"]').first().click();
  await page.waitForTimeout(600);
}
const idbCount = page => page.evaluate(() => new Promise(res => { const q = indexedDB.open('synergym'); q.onsuccess = () => { const db = q.result; if (!db.objectStoreNames.contains('sessions')) return res(-1); const c = db.transaction('sessions').objectStore('sessions').count(); c.onsuccess = () => res(c.result); }; q.onerror = () => res(-1); }));

test('start offline without an account: onboarding, theme, tour, data kept on the phone with no network', async ({ page }) => {
  const net = await noServer(page);
  await onboardOffline(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await logSet(page, 'Bench Press', 60, 5);
  await page.reload();
  /* the reload lands back in the live session, read from the phone */
  await page.waitForSelector('#view .s-top');
  await expect(page.locator('#view .ex h3')).toContainText('Bench Press');
  await expect(page.locator('.nav-train')).toHaveAttribute('data-act', 'resume');
  expect(await idbCount(page)).toBe(1);
  await page.goto('/settings');
  await expect(page.locator('.sg')).toContainText(['Offline']);
  await expect(page.locator('[data-act="go-online"]')).toBeVisible();
  await expect(page.locator('[data-act="signout"]')).toHaveCount(0);
  expect(net.hits).toEqual([]);
});

test('go online with a new account: this phone’s data is merged into it and uploaded', async ({ page }) => {
  const net = await noServer(page);
  await onboardOffline(page, 'Sam');
  await logSet(page, 'Bench Press', 80, 5);
  await net.off();
  const fake = new FakeSupabase({ registered: false });
  await fake.attach(page, 'A');
  await page.goto('/settings');
  await page.click('[data-act="go-online"]');
  await expect(page.locator('.sync-note')).toBeVisible();
  await page.fill('#f-auth [name=email]', 'sam@example.com');
  await page.fill('#f-auth [name=password]', 'Lift1234x');
  await page.fill('#f-auth [name=password2]', 'Lift1234x');
  await page.click('#f-auth button[type=submit]');
  await expect.poll(() => fake.sessions.length, { timeout: 20000 }).toBe(1);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('sg-mode')), { timeout: 20000 }).toBe(null);
  const bench = fake.exercises.filter(e => e.name === 'Bench Press');
  expect(bench.length).toBe(1);
  expect(fake.sessions[0].items[0].exId).toBe(bench[0].id);
  expect(fake.profiles[0].onboarded).toBe(true);
  expect(fake.profiles[0].display_name).toBe('Sam');
  expect(fake.profiles[0].theme).toBe('dark');
  expect(fake.splits.length).toBe(1);
  expect(await idbCount(page)).toBe(0);
  await expect(page.locator('#sheet')).toContainText('Pick a username');
});

test('online → offline → online: only what changed offline is uploaded', async ({ page }) => {
  const fake = new FakeSupabase(benchHistory());
  await login(page, fake, 'A');
  await page.goto('/settings');
  await page.click('[data-act="go-offline"]');
  await page.click('#off-go');
  await expect(page.locator('[data-act="go-online"]')).toBeVisible();
  const net = await noServer(page);
  await logSet(page, 'Bench Press', 82.5, 8);
  await page.waitForTimeout(300);
  expect(net.hits).toEqual([]);
  await net.off();
  const before = fake.calls.filter(c => / POST \/rest\/v1\/sessions/.test(c)).length;
  await page.goto('/settings');
  await page.click('[data-act="go-online"]');
  await expect.poll(() => fake.sessions.length, { timeout: 20000 }).toBe(3);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('sg-mode')), { timeout: 20000 }).toBe(null);
  expect(fake.calls.filter(c => / POST \/rest\/v1\/sessions/.test(c)).length - before).toBe(1);
  expect(fake.log).toContain('A refresh');
});

test('if going online fails, everything stays on the phone', async ({ page }) => {
  const net = await noServer(page);
  await onboardOffline(page, 'Kai');
  await logSet(page, 'Bench Press', 70, 5);
  await net.off();
  const fake = new FakeSupabase({ registered: false });
  await fake.attach(page, 'A');
  /* the server rejects the session upload */
  await page.route(/\/rest\/v1\/sessions/, r => r.request().method() === 'POST' ? r.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST204', message: 'rejected' }) }) : r.fallback());
  await page.goto('/settings');
  await page.click('[data-act="go-online"]');
  await page.fill('#f-auth [name=email]', 'kai@example.com');
  await page.fill('#f-auth [name=password]', 'Lift1234x');
  await page.fill('#f-auth [name=password2]', 'Lift1234x');
  await page.click('#f-auth button[type=submit]');
  await expect(page.locator('#toast')).toContainText('Everything is still on this phone', { timeout: 20000 });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('sg-mode')).mode)).toBe('local');
  expect(await idbCount(page)).toBe(1);
  await expect(page.locator('[data-act="go-online"]')).toBeVisible();
});

test('the login screen offers offline only in the installed app', async ({ browser }) => {
  const ctx = await browser.newContext({ ...(await import('@playwright/test')).devices['Pixel 7'] });
  const p = await ctx.newPage();
  await p.route(/\.supabase\.co\//, r => r.abort());
  await p.goto('/');
  await p.waitForSelector('#f-auth');
  await expect(p.locator('[data-act="go-local-new"]')).toHaveCount(0);
  await expect(p.locator('.auth-off-n')).toContainText('Home Screen');
  await ctx.close();
});
