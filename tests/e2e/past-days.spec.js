import { test, expect } from '@playwright/test';
import { FakeSupabase, login, benchHistory } from './fake-supabase.js';

/* bench press: 80×8 three times three days ago (sets s31–s33), 77.5×8 ten days ago */
const keyAgo = (page, n) => page.evaluate(n => { const d = new Date(Date.now() - n * 864e5); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }, n);
const exRow = (fake, id) => fake.exercises.find(e => e.id === id);
async function editLast(page, last, sets) {
  await page.goto('/session/' + last.id);
  await page.click('.s-edit');
  for (const [id, w] of sets) await page.locator(`[data-f="w"][data-set="${id}"]`).fill(String(w));
  await page.click('[data-act="edit-save"]');
  await page.locator('#sheet button', { hasText: 'Update' }).click();
}

test('an edit that beats a saved 1RM offers to raise it; the coach plans from the corrected session', async ({ page }) => {
  const data = benchHistory(), ex = data.exercises[0], last = data.sessions[0];
  Object.assign(ex, { one_rm: 100, one_rm_at: new Date(Date.now() - 20 * 864e5).toISOString() });
  const fake = new FakeSupabase(data);
  await login(page, fake, 'A');
  await page.goto('/exercises/' + ex.id);
  const coachBefore = await page.locator('#view .card', { hasText: 'next time' }).first().innerText();
  await editLast(page, last, [['s31', 110]]);
  await expect(page.locator('#sheet h3')).toHaveText('New 1RM PR?');
  await expect(page.locator('#sheet .orm-list')).toContainText('139.5');
  await page.click('#orm-apply');
  await expect.poll(() => exRow(fake, ex.id).one_rm).toBe(139.5);
  await expect(page.locator('#toast')).toContainText('1RM: 139.5');
  /* the 1RM dates from the corrected session, and the coach's next target follows */
  await page.click('.s-top [data-act="back"]');
  await page.goto('/exercises/' + ex.id);
  await expect(page.locator('#view .card').first()).toContainText('Your 1RM');
  await expect(page.locator('#view .card').first()).toContainText(new Date(Date.parse(last.ended_at)).getDate().toString().padStart(2, '0'));
  expect(await page.locator('#view .card', { hasText: 'next time' }).first().innerText()).not.toBe(coachBefore);
});

test('correcting the session a saved 1RM came from offers to lower it; Undo takes it back', async ({ page }) => {
  const data = benchHistory(), ex = data.exercises[0], last = data.sessions[0];
  /* 80×8 is an estimated 101.5, saved during that session */
  Object.assign(ex, { one_rm: 101.5, one_rm_at: last.ended_at });
  const fake = new FakeSupabase(data);
  await login(page, fake, 'A');
  await editLast(page, last, [['s31', 70], ['s32', 70], ['s33', 70]]);
  await expect(page.locator('#sheet h3')).toHaveText('Lower your 1RM?');
  await page.click('#orm-apply');
  await expect.poll(() => exRow(fake, ex.id).one_rm).toBe(null);
  await page.locator('#toast .toast-act').click();
  await expect.poll(() => exRow(fake, ex.id).one_rm).toBe(101.5);
});

test('Not now keeps the saved 1RM', async ({ page }) => {
  const data = benchHistory(), ex = data.exercises[0], last = data.sessions[0];
  Object.assign(ex, { one_rm: 100, one_rm_at: new Date(Date.now() - 20 * 864e5).toISOString() });
  const fake = new FakeSupabase(data);
  await login(page, fake, 'A');
  await editLast(page, last, [['s31', 110]]);
  await page.locator('#sheet button', { hasText: 'Not now' }).click();
  await page.waitForTimeout(600);
  expect(exRow(fake, ex.id).one_rm).toBe(100);
});

test('a missed day: tap it on the heat map, log it, and it counts', async ({ page }) => {
  const data = benchHistory(), ex = data.exercises[0], fake = new FakeSupabase(data);
  await login(page, fake, 'A');
  await page.goto('/w/consistency');
  const k = await keyAgo(page, 1);
  await page.locator(`.heat.tap [data-k="${k}"]`).click();
  await expect(page.locator('#sheet')).toContainText('Nothing logged on this day.');
  await page.click('#dy-log');
  await page.locator('#sheet button', { hasText: 'Empty session' }).click();
  await expect(page.locator('.ed-bar')).toContainText('Logging');
  await page.click('[data-act="add-ex"]');
  await page.locator(`[data-act="pk-pick"][data-id="${ex.id}"]`).click();
  /* last time's numbers are the hints; ticking a set takes them */
  await page.locator('#view [data-act="done"]').first().click();
  await page.click('[data-act="edit-save"]');
  await expect(page.locator('#toast')).toContainText('Logged for');
  await expect.poll(() => fake.sessions.length).toBe(3);
  const s = fake.sessions.find(x => !data.sessions.some(y => y.id === x.id));
  const d = new Date(s.started_at), want = await page.evaluate(() => new Date(Date.now() - 864e5).toDateString());
  expect(d.toDateString()).toBe(want);
  expect(s.items[0].sets.filter(x => x.r > 0).map(x => [x.w, x.r])).toEqual([[80, 8]]);
  await page.goto('/w/consistency');
  await expect(page.locator(`.heat.tap [data-k="${k}"]`)).toHaveClass(/l[1-4]/);
});

test('a missed day can be marked as a rest day, and a draft left unsaved goes away', async ({ page }) => {
  const data = benchHistory(), fake = new FakeSupabase(data);
  await login(page, fake, 'A');
  await page.goto('/w/consistency');
  const k = await keyAgo(page, 5);
  await page.locator(`.heat.tap [data-k="${k}"]`).click();
  await page.click('#dy-rest');
  await expect(page.locator(`.heat.tap [data-k="${k}"]`)).toHaveClass(/rd/);
  /* the rest day can be undone from the same place */
  await page.locator(`.heat.tap [data-k="${k}"]`).click();
  await expect(page.locator('#sheet')).toContainText('Rest day');
  await page.click('#dy-unrest');
  await expect(page.locator('#sheet')).toContainText('Nothing logged on this day.');
  await page.click('#dy-log');
  await page.locator('#sheet button', { hasText: 'Empty session' }).click();
  await expect(page.locator('.ed-bar')).toBeVisible();
  await page.click('[data-act="edit-discard"]');
  await expect(page).toHaveURL(/\/w\/consistency/);
  await page.waitForTimeout(600);
  expect(fake.sessions.length).toBe(2);
});

test('History: Log a past day picks the day first', async ({ page }) => {
  const fake = new FakeSupabase(benchHistory());
  await login(page, fake, 'A');
  await page.goto('/history');
  await page.click('[data-act="log-past"]');
  const yesterday = await page.evaluate(() => { const d = new Date(Date.now() - 864e5); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
  await expect(page.locator('#pd-day')).toHaveValue(yesterday);
  await page.click('#pd-go');
  await expect(page.locator('#sheet')).toContainText('Nothing logged on this day.');
  await expect(page.locator('#dy-log')).toBeVisible();
});
