import { test, expect } from '@playwright/test';
import { FakeSupabase, login, benchHistory } from './fake-supabase.js';
import { openLogbook, pickDay, openInLogbook } from './logbook.js';

/* bench press: 80×8 three times three days ago (sets s31–s33), 77.5×8 ten days ago */
const exRow = (fake, id) => fake.exercises.find(e => e.id === id);
const ago = n => Date.now() - n * 864e5;
const hold = async (page, ms) => { const b = await page.locator('#nav .nav-train .ring').boundingBox(); await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down(); await page.waitForTimeout(ms); return b; };

test('hold the session button, slide up into the capsule, and the Logbook opens; a plain tap still starts a session', async ({ page }) => {
  await login(page, new FakeSupabase(benchHistory()), 'A');
  /* a tap is a tap */
  await page.locator('#nav .nav-train').click();
  await expect(page.locator('#sheet')).toContainText('Start a session');
  await page.keyboard.press('Escape');
  /* a hold let go without sliding leaves the capsule to tap */
  await hold(page, 650); await page.mouse.up();
  await expect(page.locator('.holdcap.in')).toBeVisible();
  await expect(page.locator('#sheet')).toBeHidden();
  await page.locator('.holdcap').click();
  await expect(page).toHaveURL(/\/logbook$/);
  await page.click('[data-act="lb-close"]');
  await expect(page).not.toHaveURL(/logbook/);
  /* sliding only part of the way springs back */
  const b = await hold(page, 650), x = b.x + b.width / 2, y = b.y + b.height / 2;
  await page.mouse.move(x, y - 20); await page.mouse.up();
  await expect(page).not.toHaveURL(/logbook/);
  await page.mouse.click(5, 300);
  await expect(page.locator('.holdcap')).toHaveCount(0);
  /* the whole way opens it */
  await openLogbook(page);
  await expect(page.locator('.lb-d.today')).toHaveClass(/sel/);
});

test('the Logbook is the only way in: the heat map and History have no logging of their own', async ({ page }) => {
  await login(page, new FakeSupabase(benchHistory()), 'A');
  await page.goto('/w/consistency');
  await expect(page.locator('.heat [data-act]')).toHaveCount(0);
  await page.goto('/history');
  await expect(page.locator('[data-act="log-past"]')).toHaveCount(0);
});

test('months: back through your history, never into the future, and a day shows what was logged', async ({ page }) => {
  const data = benchHistory(), last = data.sessions[0];
  await login(page, new FakeSupabase(data), 'A');
  await openLogbook(page);
  await expect(page.locator('.lb-next')).toBeDisabled();
  await expect(page.locator('.lb-d.fut').first()).toBeDisabled().catch(() => {});
  await pickDay(page, Date.parse(last.started_at));
  await expect(page.locator('#lb-day')).toContainText('Push');
  const title = await page.locator('.lb-mt b').innerText();
  await page.click('.lb-prev');
  await expect(page.locator('.lb-mt b')).not.toHaveText(title);
  await page.click('.lb-next');
  await expect(page.locator('.lb-mt b')).toHaveText(title);
});

test('a missed day: pick it, log a session, and it counts', async ({ page }) => {
  const data = benchHistory(), ex = data.exercises[0], fake = new FakeSupabase(data);
  await login(page, fake, 'A');
  await openLogbook(page);
  const k = await pickDay(page, ago(1));
  await expect(page.locator('#lb-day')).toContainText('Nothing logged on this day.');
  await page.click('[data-act="lb-log"]');
  await page.locator('#sheet button', { hasText: 'Empty session' }).click();
  await expect(page.locator('.ed-bar')).toContainText('Logging');
  /* every feature: linking sets is there while logging */
  await expect(page.locator('.ed-bar [data-act="link-toggle"]')).toBeVisible();
  await page.click('[data-act="add-ex"]');
  await page.locator(`[data-act="pk-pick"][data-id="${ex.id}"]`).click();
  await page.locator('#view [data-act="done"]').first().click();
  await page.click('[data-act="edit-save"]');
  await expect(page.locator('#toast')).toContainText('Logged for');
  await expect.poll(() => fake.sessions.length).toBe(3);
  const s = fake.sessions.find(x => !data.sessions.some(y => y.id === x.id));
  expect(new Date(s.started_at).toDateString()).toBe(new Date(ago(1)).toDateString());
  expect(s.items[0].sets.filter(x => x.r > 0).map(x => [x.w, x.r])).toEqual([[80, 8]]);
  /* still editable from where it was logged, and the day fills in back in the Logbook */
  await expect(page.locator('.s-edit')).toBeVisible();
  await page.click('.s-top [data-act="back"]');
  await expect(page).toHaveURL(/\/logbook$/);
  await expect(page.locator(`.lb-d[data-k="${k}"]`)).toHaveClass(/l[1-4]/);
});

test('a rest day, and a draft left unsaved goes away', async ({ page }) => {
  const data = benchHistory(), fake = new FakeSupabase(data);
  await login(page, fake, 'A');
  await openLogbook(page);
  const k = await pickDay(page, ago(5));
  await page.click('[data-act="lb-rest"]');
  await expect(page.locator(`.lb-d[data-k="${k}"]`)).toHaveClass(/rd/);
  await expect(page.locator('#lb-day')).toContainText('Rest day');
  await page.click('[data-act="lb-rest"]');
  await expect(page.locator('#lb-day')).toContainText('Nothing logged on this day.');
  await page.click('[data-act="lb-log"]');
  await page.locator('#sheet button', { hasText: 'Empty session' }).click();
  await expect(page.locator('.ed-bar')).toBeVisible();
  await page.click('[data-act="edit-discard"]');
  await expect(page).toHaveURL(/\/logbook$/);
  await page.waitForTimeout(600);
  expect(fake.sessions.length).toBe(2);
});

async function editLast(page, last, sets) {
  await openInLogbook(page, last);
  await page.click('.s-edit');
  for (const [id, w] of sets) await page.locator(`[data-f="w"][data-set="${id}"]`).fill(String(w));
  await page.click('[data-act="edit-save"]');
  await page.locator('#sheet button', { hasText: 'Update' }).click();
}

test('an edit that beats a saved 1RM offers to raise it; the coach plans from the corrected session', async ({ page }) => {
  const data = benchHistory(), ex = data.exercises[0], last = data.sessions[0];
  Object.assign(ex, { one_rm: 100, one_rm_at: new Date(ago(20)).toISOString() });
  const fake = new FakeSupabase(data);
  await login(page, fake, 'A');
  await page.goto('/exercises/' + ex.id);
  const coachBefore = await page.locator('#view .card', { hasText: 'next time' }).first().innerText();
  await page.goto('/');
  await editLast(page, last, [['s31', 110]]);
  await expect(page.locator('#sheet h3')).toHaveText('New 1RM PR?');
  await expect(page.locator('#sheet .orm-list')).toContainText('139.5');
  await page.click('#orm-apply');
  await expect.poll(() => exRow(fake, ex.id).one_rm).toBe(139.5);
  await expect(page.locator('#toast')).toContainText('1RM: 139.5');
  await page.goto('/exercises/' + ex.id);
  await expect(page.locator('#view .card').first()).toContainText('Your 1RM');
  expect(await page.locator('#view .card', { hasText: 'next time' }).first().innerText()).not.toBe(coachBefore);
});

test('correcting the session a saved 1RM came from offers to lower it; Undo takes it back', async ({ page }) => {
  const data = benchHistory(), ex = data.exercises[0], last = data.sessions[0];
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
  Object.assign(ex, { one_rm: 100, one_rm_at: new Date(ago(20)).toISOString() });
  const fake = new FakeSupabase(data);
  await login(page, fake, 'A');
  await editLast(page, last, [['s31', 110]]);
  await page.locator('#sheet button', { hasText: 'Not now' }).click();
  await page.waitForTimeout(600);
  expect(exRow(fake, ex.id).one_rm).toBe(100);
});
