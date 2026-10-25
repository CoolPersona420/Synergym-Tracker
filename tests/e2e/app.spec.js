import { test, expect } from '@playwright/test';
import { FakeSupabase, login, benchHistory } from './fake-supabase.js';

const startEmptyWithBench = async page => {
  await page.locator('[data-act="start-menu"]:visible').first().click();
  await page.click('[data-st-foot="0"]');
  await page.waitForSelector('.s-top');
  await page.click('[data-act="add-ex"]');
  await page.locator('[data-act="pk-pick"]', { hasText: 'Bench Press' }).click();
  await page.waitForSelector('.ex .sugg');
};

test('login shows Home with the weekly summary', async ({ page }) => {
  const fake = new FakeSupabase(benchHistory());
  await login(page, fake, 'A');
  await expect(page.locator('[data-w="week"]')).toBeVisible();
  await expect(page.locator('[data-w="week"]')).toContainText(/session/);
});

test('next-set suggestion: last 80×8 → try 82.5×8, and Use fills the targets', async ({ page }) => {
  const fake = new FakeSupabase(benchHistory());
  await login(page, fake, 'A');
  await startEmptyWithBench(page);
  const sugg = page.locator('.ex .sugg');
  await expect(sugg).toContainText('80×8');
  await expect(sugg).toContainText('82.5×8');
  await sugg.locator('[data-act="sugg-use"]').click();
  await expect(page.locator('.ex .set input[data-f="w"]').first()).toHaveAttribute('placeholder', '82.5');
  await expect(page.locator('.ex .set input[data-f="r"]').first()).toHaveAttribute('placeholder', '8');
});

test('plate calculator shows the plates for each side', async ({ page }) => {
  const fake = new FakeSupabase(benchHistory());
  await login(page, fake, 'A');
  await startEmptyWithBench(page);
  await page.click('.ex [data-act="plates"]');
  /* opens on the last weight used: 80 kg is 25 + 5 a side */
  await expect(page.locator('#pl-out')).toContainText('25 + 5');
  await page.fill('#pl-w', '82.5');
  await expect(page.locator('#pl-out')).toContainText('25 + 5 + 1.25');
  await page.fill('#pl-w', '101');
  await expect(page.locator('#pl-out')).toContainText('1 kg can’t be loaded');
  await page.click('[data-bar="0"]');
  await page.fill('#pl-w', '80');
  await expect(page.locator('#pl-out')).toContainText('25 + 15');
  await page.click('[data-bar="15"]');
  await page.fill('#pl-w', '15');
  await expect(page.locator('#pl-out')).toContainText('Just the bar');
});

test('the chosen bar is remembered on this device', async ({ page }) => {
  const fake = new FakeSupabase(benchHistory());
  await login(page, fake, 'A');
  await startEmptyWithBench(page);
  await page.click('.ex [data-act="plates"]');
  await page.click('[data-bar="15"]');
  await page.keyboard.press('Escape');
  await page.click('.ex [data-act="plates"]');
  await expect(page.locator('[data-bar="15"]')).toHaveClass(/on/);
});

test('bodyweight: log a weight and see it in the trend', async ({ page }) => {
  const fake = new FakeSupabase({ profile: { bw_log: [{ d: '2026-01-01', kg: 82 }] } });
  await login(page, fake, 'A');
  await page.goto('/w/bw');
  await page.fill('#f-bw [name=bw]', '79.5');
  await page.click('#f-bw button[type=submit]');
  await expect(page.locator('.bw-list')).toContainText('79.5');
  await expect.poll(() => (fake.profiles[0].bw_log || []).map(e => e.kg)).toContain(79.5);
  expect(fake.profiles[0].bodyweight).toBe(79.5);
});

test('import warns before replacing, and replaces everything on confirm', async ({ page }) => {
  const fake = new FakeSupabase(benchHistory());
  await login(page, fake, 'A');
  const file = { app: 'Synergym', version: 3, exportedAt: new Date().toISOString(), profile: { unit: 'kg', bw: 70 },
    library: [{ id: 'x1', name: 'Front Squat', muscle: 'Quads', kind: 'w' }],
    sessions: [{ id: 'q', startedAt: Date.now() - 864e5, endedAt: Date.now() - 86e6, items: [{ id: 'i', exId: 'x1', sets: [{ id: 'a', w: 60, r: 5 }] }] }], splits: [] };
  await page.setInputFiles('#imp', { name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file)) });
  await expect(page.locator('#sheet')).toContainText('Replace all your data?');
  await expect(page.locator('.imp-warn')).toContainText('2 sessions');
  expect(fake.sessions.length).toBe(2);
  await page.click('#imp-go');
  await expect.poll(() => fake.log.includes('A import_replace')).toBe(true);
  expect(fake.sessions.length).toBe(1);
  expect(fake.exercises.map(e => e.name)).toEqual(['Front Squat']);
  expect(fake.exercises[0].id).not.toBe('x1');
});

test('import can be cancelled without changing anything', async ({ page }) => {
  const fake = new FakeSupabase(benchHistory());
  await login(page, fake, 'A');
  const file = { app: 'Synergym', library: [{ id: 'x1', name: 'Dip', kind: 'bw' }], sessions: [], splits: [] };
  await page.setInputFiles('#imp', { name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file)) });
  await page.locator('#sheet-body [data-act="close"]').last().click();
  expect(fake.log.includes('A import_replace')).toBe(false);
  expect(fake.sessions.length).toBe(2);
});

test('export downloads a JSON backup', async ({ page }) => {
  const fake = new FakeSupabase(benchHistory());
  await login(page, fake, 'A');
  await page.goto('/settings');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-act="export"][data-f="json"]')]);
  expect(dl.suggestedFilename()).toMatch(/^synergym-.*\.json$/);
});

test('one device at a time: a new login signs the old device out', async ({ browser }) => {
  const fake = new FakeSupabase();
  const a = await (await browser.newContext()).newPage(), b = await (await browser.newContext()).newPage();
  await login(a, fake, 'A');
  await login(b, fake, 'B');
  await a.evaluate(() => dispatchEvent(new Event('focus')));
  await expect(a.locator('.auth-box .msg')).toContainText('opened on another device', { timeout: 10000 });
  await b.evaluate(() => dispatchEvent(new Event('focus')));
  await b.waitForTimeout(500);
  await expect(b.locator('#nav')).toBeVisible();
});

test('errors are reported, once, for a signed-in user', async ({ page }) => {
  const fake = new FakeSupabase();
  await login(page, fake, 'A');
  await page.evaluate(() => { setTimeout(() => { throw new Error('e2e-boom'); }); setTimeout(() => { throw new Error('e2e-boom'); }, 10); });
  await expect.poll(() => fake.errors.map(e => e.p_message)).toContain('Error: e2e-boom');
  await page.waitForTimeout(300);
  expect(fake.errors.filter(e => /e2e-boom/.test(e.p_message)).length).toBe(1);
  expect(fake.errors[0].p_path).toBe('/');
});

test('no page errors across the main screens', async ({ page }) => {
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  const fake = new FakeSupabase(benchHistory());
  await login(page, fake, 'A');
  for (const path of ['/history', '/exercises', '/splits', '/settings', '/w/week', '/w/bw', '/w/intensity', '/today']) { await page.goto(path); await page.waitForTimeout(400); }
  expect(errs).toEqual([]);
});
