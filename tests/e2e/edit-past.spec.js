import { test, expect } from '@playwright/test';
import { FakeSupabase, login, benchHistory } from './fake-supabase.js';

/* the last bench session, three days ago: 80×8 three times (sets s31, s32, s33); the one before was 77.5×8 */
async function openLast(page) {
  const data = benchHistory(), fake = new FakeSupabase(data), last = data.sessions[0];
  await login(page, fake, 'A');
  await page.goto('/session/' + last.id);
  await expect(page.locator('.s-edit')).toBeVisible();
  return { fake, last, w: page.locator('[data-f="w"][data-set="s31"]'), r2: page.locator('[data-f="r"][data-set="s32"]') };
}
const row = (fake, id) => fake.sessions.find(s => s.id === id);
const outbox = page => page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('sg-outbox')).map(k => localStorage.getItem(k)).join(''));

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
  await page.locator('#sheet button', { hasText: 'Save as today’s session' }).click();
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
  /* leaving the page with changes */
  await page.click('.s-top [data-act="back"]');
  await expect(page.locator('#toast')).toContainText('Changes discarded');
  await expect(page).not.toHaveURL(/\/session\//);
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
