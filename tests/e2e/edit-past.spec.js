import { test, expect } from '@playwright/test';
import { FakeSupabase, login, benchHistory } from './fake-supabase.js';
import { openInLogbook } from './logbook.js';

/* the last bench session, three days ago: 80×8 three times (sets s31, s32, s33); the one before was 77.5×8.
   Opened from its day in the Logbook, the one place past sessions change */
async function openLast(page) {
  const data = benchHistory(), fake = new FakeSupabase(data), last = data.sessions[0];
  await login(page, fake, 'A');
  await openInLogbook(page, last);
  return { fake, last, w: page.locator('[data-f="w"][data-set="s31"]'), r2: page.locator('[data-f="r"][data-set="s32"]') };
}
const row = (fake, id) => fake.sessions.find(s => s.id === id);
const outbox = page => page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('sg-outbox')).map(k => localStorage.getItem(k)).join(''));

test('a finished session has Edit wherever it’s opened (GitHub issue #3), and stays as it is until you tap it', async ({ page }) => {
  const data = benchHistory(), fake = new FakeSupabase(data), last = data.sessions[0];
  await login(page, fake, 'A');
  /* straight from a link, as from Home or an exercise's page */
  await page.goto('/session/' + last.id);
  await expect(page.locator('.s-meta')).toContainText('completed');
  await expect(page.locator('.s-edit')).toBeVisible();
  await expect(page.locator('.done-bar [data-act="sess-edit"]')).toBeVisible();
  /* its numbers don't change by accident: a tap on them points at Edit */
  await expect(page.locator('[data-f="w"][data-set="s31"]')).toHaveAttribute('readonly', '');
  await page.locator('[data-f="w"][data-set="s31"]').click();
  await expect(page.locator('#toast')).toContainText('Tap Edit');
  await page.click('[data-act="sess-menu"]');
  for (const t of ['Edit session', 'Change date', 'Repeat this session', 'Delete session']) await expect(page.locator('#sheet')).toContainText(t);
  await expect(page.locator('#sheet')).not.toContainText('Change this session');
  await page.keyboard.press('Escape');
  expect(row(fake, last.id).items[0].sets[0].w).toBe(80);
  /* the Edit at the bottom opens it ready to edit, right here */
  await page.locator('.done-bar [data-act="sess-edit"]').click();
  await expect(page.locator('[data-act="edit-save"]')).toBeVisible();
  await expect(page.locator('[data-f="w"][data-set="s31"]')).not.toHaveAttribute('readonly', '');
});

test('the Logbook’s List is the Logbook: a session opened from it has Edit, as from the Calendar', async ({ page }) => {
  const data = benchHistory(), fake = new FakeSupabase(data), last = data.sessions[0];
  await login(page, fake, 'A');
  await page.goto('/history');
  await page.locator(`[data-act="open"][data-id="${last.id}"]`).click();
  await expect(page.locator('.s-edit')).toBeVisible();
  await page.locator('.s-edit').click();
  await page.locator('[data-f="w"][data-set="s31"]').fill('85');
  await page.click('[data-act="edit-save"]');
  await page.locator('#sheet button', { hasText: /^Update/ }).click();
  await expect.poll(() => row(fake, last.id).items[0].sets[0].w).toBe(85);
  /* back to the List it came from */
  await page.click('.s-top [data-act="back"]');
  await expect(page).toHaveURL(/\/history$/);
});

test('a finished session reads as it was logged: nothing changes until Edit, and a tap points at Edit', async ({ page }) => {
  const { fake, last, w } = await openLast(page);
  await expect(w).toHaveAttribute('readonly', '');
  await w.click();
  await expect(page.locator('#toast')).toContainText('Tap Edit to change this session');
  await page.keyboard.type('9');
  await expect(w).toHaveValue('80');
  await expect(page.locator('#view [data-act="add-set"]').first()).toBeHidden();
  await expect(page.locator('#view [data-act="add-ex"]')).toBeHidden();
  await page.locator('#view [data-act="done"]').first().click({ force: true });
  await expect(page.locator('.set').first()).toHaveClass(/done/);
  expect(row(fake, last.id).items[0].sets[0].w).toBe(80);
});

test('Edit, then Update: fixed where it is, a new record shows as you type, nothing saves before Save, and Undo puts it back', async ({ page }) => {
  const { fake, last, w, r2 } = await openLast(page);
  await page.click('.s-edit');
  await expect(page.locator('.ed-bar')).toBeVisible();
  await expect(page.locator('.s-meta')).toContainText('editing');
  await expect(r2).not.toHaveAttribute('readonly', '');
  await expect(page.locator('[data-prb="s32"]')).toBeHidden();
  await r2.fill('10');
  await expect(page.locator('[data-prb="s32"]')).toBeVisible();
  await page.waitForTimeout(900);
  expect(row(fake, last.id).items[0].sets[1].r, 'nothing is saved while editing').toBe(8);
  expect(await outbox(page)).not.toContain('"r":10');
  await page.click('[data-act="edit-save"]');
  await page.locator('#sheet button', { hasText: 'Update' }).click();
  await expect(page.locator('#toast')).toContainText('Updated');
  await expect.poll(() => row(fake, last.id).items[0].sets[1].r).toBe(10);
  await expect(page.locator('.s-edit')).toBeVisible();
  await expect(r2).toHaveAttribute('readonly', '');
  await page.locator('#toast .toast-act').click();
  await expect.poll(() => row(fake, last.id).items[0].sets[1].r).toBe(8);
  await expect(r2).toHaveValue('8');
  await expect(w).toHaveValue('80');
});

test('Edit, then Save as today’s session: a new session today, the original untouched, and Undo removes it', async ({ page }) => {
  const { fake, last, w } = await openLast(page);
  const before = new Set(fake.sessions.map(s => s.id));
  await page.click('.s-edit');
  await w.fill('82.5');
  await page.click('[data-act="edit-save"]');
  await page.locator('#sheet button', { hasText: 'Log it as a new session today' }).click();
  await expect(page.locator('#toast')).toContainText('Saved as today’s session');
  await expect.poll(() => fake.sessions.length).toBe(3);
  const copy = fake.sessions.find(s => !before.has(s.id));
  expect(new Date(copy.started_at).toDateString()).toBe(new Date().toDateString());
  expect(Date.now() - Date.parse(copy.ended_at)).toBeLessThan(60000);
  expect(copy.items[0].sets.map(s => [s.w, s.r])).toEqual([[82.5, 8], [80, 8], [80, 8]]);
  expect(copy.items[0].sets[0].id).not.toBe('s31');
  expect(row(fake, last.id).items[0].sets[0].w, 'the original stays as it was').toBe(80);
  await expect(page).toHaveURL(new RegExp('/session/' + copy.id));
  await expect(page.locator('.s-edit')).toBeVisible();
  await page.locator('#toast .toast-act').click();
  await expect.poll(() => fake.sessions.length).toBe(2);
  await expect(page).toHaveURL(new RegExp('/session/' + last.id));
  await expect(w).toHaveValue('80');
});

test('Discard, or leaving mid-edit, puts the session back as it was; Undo brings the changes back', async ({ page }) => {
  const { fake, last, w } = await openLast(page);
  await page.click('.s-edit');
  await w.fill('90');
  await page.click('[data-act="edit-discard"]');
  await expect(w).toHaveValue('80');
  await expect(w).toHaveAttribute('readonly', '');
  await page.locator('#toast .toast-act').click();
  await expect(page.locator('.ed-bar')).toBeVisible();
  await expect(w).toHaveValue('90');
  /* leaving the page with changes: back to the Logbook */
  await page.click('.s-top [data-act="back"]');
  await expect(page.locator('#toast')).toContainText('Changes discarded');
  await expect(page).toHaveURL(/\/logbook$/);
  await page.locator('#toast .toast-act').click();
  await expect(page).toHaveURL(new RegExp('/session/' + last.id));
  await expect(w).toHaveValue('90');
  await expect(page.locator('.ed-bar')).toBeVisible();
  await page.click('[data-act="sess-menu"]');
  await page.locator('#sheet button', { hasText: 'Discard changes' }).click();
  await expect(w).toHaveValue('80');
  await page.waitForTimeout(800);
  expect(row(fake, last.id).items[0].sets[0].w).toBe(80);
  expect(await outbox(page)).not.toContain('"w":90');
});

test('saving an edit of an older session asks in plain words, the usual choice first, naming the day', async ({ page }) => {
  const { fake, last, w } = await openLast(page);
  await page.click('.s-edit');
  await w.fill('85');
  await page.click('[data-act="edit-save"]');
  const opts = page.locator('#sheet .save-opts .opt');
  await expect(opts).toHaveCount(2);
  const day = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date(last.started_at).getDay()];
  await expect(opts.first()).toContainText(`Update ${day}’s session`);
  await expect(opts.first()).toContainText('the one you opened');
  await expect(opts.nth(1)).toContainText('Log it as a new session today');
  await expect(opts.nth(1)).toContainText(`${day}’s session stays as it was`);
  await opts.first().click();
  await expect.poll(() => row(fake, last.id).items[0].sets[0].w).toBe(85);
});

test('no question when nothing changed, or when the session is from today: Save just saves', async ({ page }) => {
  const data = benchHistory(), ex = data.exercises[0];
  const today = { id: crypto.randomUUID(), name: 'Push', started_at: new Date(Date.now() - 2 * 3600e3).toISOString(), ended_at: new Date(Date.now() - 3600e3).toISOString(),
    items: [{ id: 't1', exId: ex.id, sets: [{ id: 'ts1', w: 80, r: 5, done: true }] }] };
  const fake = new FakeSupabase({ ...data, sessions: [...data.sessions, today] });
  await login(page, fake, 'A');
  /* unchanged: Save leaves edit mode without asking */
  await page.goto('/session/' + data.sessions[0].id);
  await page.click('.s-edit');
  await page.click('[data-act="edit-save"]');
  await expect(page.locator('#sheet')).toBeHidden();
  await expect(page.locator('[data-act="edit-save"]')).toHaveCount(0);
  /* today's: it saves in place */
  await page.goto('/session/' + today.id);
  await page.click('.s-edit');
  await page.locator('[data-f="w"][data-set="ts1"]').fill('82.5');
  await page.click('[data-act="edit-save"]');
  await expect(page.locator('#sheet')).toBeHidden();
  await expect(page.locator('#toast')).toContainText('Updated');
  await expect.poll(() => row(fake, today.id).items[0].sets[0].w).toBe(82.5);
});
