import { test, expect } from '@playwright/test';
import { FakeSupabase, login, benchHistory } from './fake-supabase.js';

const phoneOnly = info => test.skip(info.project.name !== 'phone', 'phone only');

test('online onboarding: six steps, theme choice saved, then the tour', async ({ page }) => {
  const fake = new FakeSupabase({ profile: { onboarded: false, username: null, display_name: null } });
  await fake.attach(page, 'A');
  await page.goto('/');
  await page.fill('#f-auth [name=email]', fake.email); await page.fill('#f-auth [name=password]', fake.password);
  await page.click('#f-auth button[type=submit]');
  await page.waitForSelector('#f-ob2');
  await expect(page.locator('.ob-head .lbl')).toContainText('Step 2 of 6');
  await page.fill('#f-ob2 [name=name]', 'Robin'); await page.fill('#f-ob2 [name=username]', 'robin_lifts');
  await page.click('#f-ob2 button[type=submit]');
  await page.click('[data-act="ob-pick"][data-k="exp"][data-v="intermediate"]'); await page.click('[data-act="ob-next"]');
  await page.click('[data-act="ob-pick"][data-k="goal"][data-v="muscle"]'); await page.click('[data-act="ob-pick"][data-k="days"][data-v="4"]'); await page.click('[data-act="ob-next"]');
  await expect(page.locator('.opt.on')).toContainText('Upper / Lower');
  await page.click('[data-act="ob-next"]');
  await expect(page.locator('.ob-head .lbl')).toContainText('Step 6 of 6');
  await page.click('[data-act="ob-theme"][data-t="volt"]');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'volt');
  await page.click('[data-act="ob-finish"]');
  await expect(page.locator('.tour')).toBeVisible();
  await expect.poll(() => fake.profiles[0].theme).toBe('volt');
  expect(fake.profiles[0].onboarded).toBe(true);
  expect(fake.profiles[0].weekly_target).toBe(4);
  await page.locator('#sheet-body [data-act="close"]', { hasText: 'Skip' }).click();
});

test('the user guide opens from Settings and switches between phone and desktop', async ({ page }) => {
  const fake = new FakeSupabase(benchHistory());
  await login(page, fake, 'A');
  await page.goto('/settings');
  await page.locator('[data-act="nav"][data-v="guide"]').click();
  await expect(page).toHaveURL(/\/guide$/);
  await page.waitForSelector('.guide-sec');
  expect(await page.locator('.guide-sec').count()).toBeGreaterThanOrEqual(8);
  await page.click('[data-act="guide-dev"][data-v="desktop"]');
  await expect(page.locator('#g-around')).toContainText('sidebar');
  await page.click('[data-act="guide-dev"][data-v="phone"]');
  await expect(page.locator('#g-around')).toContainText('dock');
  await page.click('[data-act="guide-jump"][data-id="plates"]');
  await expect(page.locator('#g-plates')).toHaveAttribute('open', '');
  await page.click('[data-act="tour"]');
  await expect(page.locator('.tour')).toBeVisible();
});

test('reminders: turn on, set time and days, send a test, turn off', async ({ page }, info) => {
  phoneOnly(info);
  await page.addInitScript(() => {
    let has = false;
    const sub = { endpoint: 'https://push.example/device-1', toJSON() { return { endpoint: this.endpoint, keys: { p256dh: 'p256', auth: 'au' } }; }, unsubscribe: async () => { has = false; return true; } };
    const pm = { getSubscription: async () => (has ? sub : null), subscribe: async () => { has = true; return sub; } };
    const reg = { pushManager: pm, active: null };
    Object.defineProperty(navigator, 'serviceWorker', { value: { ready: Promise.resolve(reg), getRegistration: async () => reg, register: async () => reg, addEventListener() {} } });
    window.PushManager = function PushManager() {};
    window.Notification = { permission: 'default', requestPermission: async () => { window.Notification.permission = 'granted'; return 'granted'; } };
  });
  const fake = new FakeSupabase(benchHistory());
  await page.route('**/api/reminders', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"sent":1}' }));
  await login(page, fake, 'A');
  await page.goto('/settings');
  await page.click('[data-act="rem-toggle"]');
  await expect.poll(() => fake.pushSubs.map(s => s.endpoint)).toEqual(['https://push.example/device-1']);
  await expect.poll(() => fake.profiles[0].reminder_on).toBe(true);
  expect(fake.profiles[0].tz).toBeTruthy();
  await page.fill('[data-f="rem-time"]', '07:30');
  await expect.poll(() => fake.profiles[0].reminder_time).toBe('07:30');
  await page.click('[data-act="rem-day"][data-i="6"]');
  await expect.poll(() => fake.profiles[0].reminder_days).toBe(63);
  await expect(page.locator('#rem-foot')).toContainText('7:30 am');
  await page.click('[data-act="rem-test"]');
  await expect(page.locator('#toast')).toContainText('Test sent');
  await page.click('[data-act="rem-toggle"]');
  await expect.poll(() => fake.pushSubs.length).toBe(0);
  await expect.poll(() => fake.profiles[0].reminder_on).toBe(false);
});

test('phone: floating dock, and the session button animates away on Settings', async ({ page }, info) => {
  phoneOnly(info);
  const fake = new FakeSupabase(benchHistory());
  await login(page, fake, 'A');
  const nav = await page.locator('#nav').evaluate(n => { const c = getComputedStyle(n); return { left: c.left, radius: parseFloat(c.borderTopLeftRadius), bottom: n.getBoundingClientRect().bottom, vh: innerHeight }; });
  expect(nav.left).toBe('10px'); expect(nav.radius).toBeGreaterThan(20); expect(nav.vh - nav.bottom).toBeGreaterThanOrEqual(10);
  await page.locator('.nav-train').evaluate(el => { el.dataset.mark = 'same'; });
  await page.click('#nav [data-act="nav"][data-v="prefs"]');
  const mid = await page.waitForFunction(() => { const o = +getComputedStyle(document.querySelector('.nav-train')).opacity; return o > 0 && o < 1 ? o : null; }, null, { timeout: 2000 }).then(h => h.jsonValue(), () => null);
  await page.waitForTimeout(700);
  const after = await page.locator('.nav-train').evaluate(el => ({ mark: el.dataset.mark, op: getComputedStyle(el).opacity, vis: getComputedStyle(el).visibility }));
  expect(after.mark).toBe('same');
  expect(after.op).toBe('0'); expect(after.vis).toBe('hidden');
  expect(mid).not.toBeNull();
  await page.click('#nav [data-act="nav"][data-v="today"]');
  await page.waitForTimeout(700);
  expect(await page.locator('.nav-train').evaluate(el => getComputedStyle(el).opacity)).toBe('1');
});

test('phone: Home widgets are all the same size and fill down to the dock', async ({ page }, info) => {
  phoneOnly(info);
  const fake = new FakeSupabase({ ...benchHistory(), profile: { widgets: ['week:s', 'intensity:l', 'recent:m', 'bw:s'] } });
  await login(page, fake, 'A');
  await page.waitForTimeout(800);
  const r = await page.evaluate(() => { const cards = [...document.querySelectorAll('#dash > .w')].map(c => ({ width: c.offsetWidth, height: c.offsetHeight })); const edit = document.querySelector('#view .home-edit').getBoundingClientRect(), nav = document.querySelector('#nav').getBoundingClientRect(); return { w: cards.map(c => Math.round(c.width)), h: cards.map(c => Math.round(c.height)), gap: Math.round(nav.top - edit.bottom) }; });
  expect(new Set(r.w).size).toBe(1);
  expect(new Set(r.h).size).toBe(1);
  expect(r.h[0]).toBeGreaterThanOrEqual(240);
  expect(r.gap).toBeLessThan(60);
});

test('quick splash on phones only', async ({ page }, info) => {
  await page.route(/\.supabase\.co\//, r => r.abort());
  await page.goto('/');
  if (info.project.name === 'phone') {
    await expect(page.locator('#qsplash')).toHaveCount(1);
    await expect(page.locator('#qsplash')).toHaveCount(0, { timeout: 4000 });
  } else {
    await page.waitForTimeout(400);
    await expect(page.locator('#qsplash')).toHaveCount(0);
  }
  await expect(page.locator('#f-auth')).toBeVisible();
});

test('Settings › About shows the version from package.json, marked as alpha', async ({ page }) => {
  const { readFileSync } = await import('node:fs');
  const { version } = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
  const fake = new FakeSupabase(benchHistory());
  await login(page, fake, 'A');
  await page.goto('/settings');
  const row = page.locator('.srow', { hasText: 'Version' });
  await expect(row.locator('.ver')).toContainText('v' + version.split('-')[0]);
  if (version.includes('alpha')) { await expect(row.locator('.badge')).toHaveText('alpha'); await expect(page.locator('.sg', { hasText: 'Source code on GitHub' })).toContainText('early alpha'); }
  await expect(row).toContainText('Build ');
});

test('widget sizes are offered on wider screens only', async ({ page }, info) => {
  const fake = new FakeSupabase(benchHistory());
  await login(page, fake, 'A');
  await page.click('[data-act="edit-home"]');
  await page.waitForSelector('.wrow');
  const phone = info.project.name === 'phone';
  await expect(page.locator('.wrow .wsz')).toHaveCount(phone ? 0 : 4);
  await page.keyboard.press('Escape');
  await page.goto('/w/week');
  await expect(page.locator('.wf-size')).toHaveCount(phone ? 0 : 1);
});

test('in the Ocean theme the phone dock is solid, not see-through', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'phone only');
  await login(page, new FakeSupabase({ ...benchHistory(), profile: { theme: 'ocean' } }), 'A');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'ocean');
  const bg = await page.evaluate(() => { const c = getComputedStyle(document.querySelector('#nav')); return { color: c.backgroundColor, image: c.backgroundImage }; });
  expect(bg.color).toBe('rgb(5, 41, 76)');
  expect(bg.image).toContain('linear-gradient');
});
