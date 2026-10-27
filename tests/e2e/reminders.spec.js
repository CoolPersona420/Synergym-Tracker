/* Reminders on a phone: the phone signs up again by itself when its registration was lost, a phone that hasn't
   allowed notifications yet says so, the app keeps the server's brief up to date, and a tapped reminder opens its page. */
import { test, expect } from '@playwright/test';
import { FakeSupabase, login, benchHistory } from './fake-supabase.js';

const phoneOnly = info => test.skip(info.project.name !== 'phone', 'phone only');
/* a browser that can receive push, with notifications in the given state */
const pushPhone = (page, perm) => page.addInitScript(perm => {
  let has = false; window.__sw = [];
  const sub = { endpoint: 'https://push.example/device-1', toJSON() { return { endpoint: this.endpoint, keys: { p256dh: 'p256', auth: 'au' } }; }, unsubscribe: async () => { has = false; return true; } };
  const pm = { getSubscription: async () => (has ? sub : null), subscribe: async () => { has = true; return sub; } };
  const reg = { pushManager: pm, active: null };
  Object.defineProperty(navigator, 'serviceWorker', { value: { ready: Promise.resolve(reg), getRegistration: async () => reg, register: async () => reg, addEventListener: (t, f) => t === 'message' && window.__sw.push(f), startMessages() {} } });
  window.PushManager = function PushManager() {};
  window.Notification = { permission: perm, requestPermission: async () => { window.Notification.permission = 'granted'; return 'granted'; } };
}, perm);
/* bench history with a split, so the brief has a next day and a target */
function withSplit() {
  const h = benchHistory(), bench = h.exercises[0];
  h.splits = [{ id: crypto.randomUUID(), name: 'Push Pull', days: [{ id: 'd1', type: 'Push', exercises: [{ id: 'e1', exId: bench.id, name: 'Bench Press', muscle: 'Chest', kind: 'w', sets: 3, reps: '8-12' }] }, { id: 'd2', type: 'Pull', exercises: [] }] }];
  for (const s of h.sessions) { s.split_id = h.splits[0].id; s.split_day = 1; }
  return h;
}

test('a phone with reminders on signs up again by itself, and saves what the next reminder can say', async ({ page }, info) => {
  phoneOnly(info);
  await pushPhone(page, 'granted');
  /* reminders on for the account, but the server has lost this phone (signed out, reinstalled, renewed by iOS) */
  const fake = new FakeSupabase({ ...withSplit(), profile: { reminder_on: true, reminder_time: '06:30:00', reminder_days: 127, tz: 'Indian/Mauritius' } });
  await login(page, fake, 'A');
  await expect.poll(() => fake.pushSubs.map(s => s.endpoint)).toEqual(['https://push.example/device-1']);
  await expect.poll(() => fake.profiles[0].reminder_brief?.day).toBe('Push');
  const b = fake.profiles[0].reminder_brief;
  expect(b.lift).toBe('Bench Press');
  expect(b.tgt).toMatch(/^\d+(\.\d)? kg × \d+$/);
  expect(b.coach).toBe(true);
  expect(['train', 'easy', 'rest']).toContain(b.call);
  await page.goto('/settings');
  await expect(page.locator('[data-act="rem-toggle"]')).toHaveAttribute('aria-pressed', 'true');
});

test('reminders on for the account but not yet allowed on this phone: Settings says so, and the switch fixes it', async ({ page }, info) => {
  phoneOnly(info);
  await pushPhone(page, 'default');
  const fake = new FakeSupabase({ ...benchHistory(), profile: { reminder_on: true, reminder_time: '18:00:00', reminder_days: 127, tz: 'Europe/London' } });
  await login(page, fake, 'A');
  await page.goto('/settings');
  const t = page.locator('[data-act="rem-toggle"]');
  await expect(t).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByText('On for your account. Turn on to get them on this phone.')).toBeVisible();
  expect(fake.pushSubs.length).toBe(0);
  await t.click();
  await expect.poll(() => fake.pushSubs.length).toBe(1);
  await expect(t).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#rem-foot')).toContainText('stays quiet');
});

test('a test reminder sends what a real one would say', async ({ page }, info) => {
  phoneOnly(info);
  await pushPhone(page, 'granted');
  let sent = null;
  await page.route('**/api/reminders', r => { sent = r.request().postDataJSON(); r.fulfill({ status: 200, contentType: 'application/json', body: '{"sent":1}' }); });
  const fake = new FakeSupabase({ ...withSplit(), profile: { reminder_on: true, reminder_time: '18:00:00', reminder_days: 127, tz: 'Europe/London' } });
  await login(page, fake, 'A');
  await page.goto('/settings');
  await page.click('[data-act="rem-test"]');
  await expect(page.locator('#toast')).toContainText('Test sent');
  expect(sent.test).toBe(true);
  expect(sent.ctx).toMatchObject({ name: 'Test', target: 3, total: 2, gap: 3, brief: { day: 'Push', lift: 'Bench Press' } });
});

test('tapping a reminder while the app is open goes to its page', async ({ page }, info) => {
  phoneOnly(info);
  await pushPhone(page, 'granted');
  const fake = new FakeSupabase(benchHistory());
  await login(page, fake, 'A');
  await page.evaluate(() => window.__sw.forEach(f => f({ data: { open: '/coach/goals' } })));
  await expect(page).toHaveURL(/\/coach\/goals$/);
  await expect(page.locator('.co-tabs [aria-selected="true"]')).toContainText('Goals');
});
