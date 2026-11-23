/* Split invitations: a split shared with you waits under Splits until you accept it (a copy goes into your
   splits) or decline it; the sender sees each answer and can invite again after a decline. */
import { test, expect } from '@playwright/test';
import { FakeSupabase, login } from './fake-supabase.js';

const X = (name, muscle) => ({ id: crypto.randomUUID(), name, muscle, kind: 'w' });
const day = (type, ex) => ({ id: crypto.randomUUID(), type, exercises: ex.map(e => ({ id: crypto.randomUUID(), exId: e.id, name: e.name, muscle: e.muscle, kind: 'w', sets: 3, reps: '8-12' })) });
/* @alex shares "Push Pull Legs" (with a message); this account has one split of its own */
function data({ mine = 1, message = 'My PPL from this summer, try it for a month.' } = {}) {
  const bench = X('Bench Press', 'Chest'), row = X('Barbell Row', 'Back'), squat = X('Back Squat', 'Quads'), curl = X('Cable Curl', 'Biceps');
  const own = Array.from({ length: mine }, (_, k) => ({ id: crypto.randomUUID(), name: k ? `Split ${k + 1}` : 'Upper Lower', days: [day('Upper', [bench, row]), day('Lower', [squat])] }));
  const theirs = { split_id: crypto.randomUUID(), name: 'Push Pull Legs', days: [day('Push', [bench]), day('Pull', [row, curl]), day('Legs', [squat]), { id: 'r', type: 'Rest', rest: true, exercises: [] }], from_username: 'alex', message };
  return { own, theirs, fake: new FakeSupabase({ defaults: [], exercises: [bench, row, squat], splits: own, incoming: [theirs] }) };
}
const card = page => page.locator('.split-card.inv');
const badge = page => page.locator('#nav .nav-i[data-v="splits"] .nav-badge');

test('an invitation waits at the top of Splits, with the message and a count on the tab; Accept saves a copy', async ({ page }) => {
  const { fake } = data();
  await login(page, fake, 'A');
  await expect(badge(page)).toHaveText('1');
  await expect(page.locator('#nav .nav-i[data-v="splits"]')).toHaveAttribute('aria-label', 'Splits, 1 invitation waiting');
  await page.goto('/splits');
  await expect(page.locator('.mgroup').first()).toContainText('Waiting for you');
  await expect(card(page)).toContainText('Push Pull Legs');
  await expect(card(page)).toContainText('from @alex');
  await expect(card(page)).toContainText('3 training days');
  await expect(card(page).locator('.inv-msg')).toHaveText('“My PPL from this summer, try it for a month.”');
  await expect(page.locator('body')).not.toContainText('Shared with you');
  await card(page).locator('[data-act="inv-accept"]').click();
  /* a copy of its own, ready to train: Cable Curl was added to the library */
  await expect(page).toHaveURL(/\/splits\/[0-9a-f-]{36}$/);
  await expect(page.locator('#toast')).toContainText('Saved to your splits');
  await expect.poll(() => fake.splits.map(s => s.name).sort()).toEqual(['Push Pull Legs', 'Upper Lower']);
  expect(fake.splits.find(s => s.name === 'Push Pull Legs').copied_from).toBe('@alex');
  expect(fake.incoming[0].status).toBe('accepted');
  await expect(badge(page)).toHaveCount(0);
  await page.goto('/splits');
  await expect(card(page)).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('Waiting for you');
});

test('Decline asks first, then the invitation goes and the sender will see it', async ({ page }) => {
  const { fake } = data({ message: null });
  await login(page, fake, 'A');
  await page.goto('/splits');
  await expect(card(page).locator('.inv-msg')).toHaveCount(0);
  await card(page).locator('[data-act="inv-decline"]').click();
  await expect(page.locator('#sheet')).toContainText('Decline Push Pull Legs?');
  await expect(page.locator('#sheet')).toContainText('@alex sees that you declined');
  await page.locator('#sheet .btn', { hasText: 'Decline' }).click();
  await expect(card(page)).toHaveCount(0);
  await expect(page.locator('#toast')).toContainText('Declined. @alex will see that.');
  await expect(badge(page)).toHaveCount(0);
  expect(fake.incoming[0].status).toBe('declined');
  expect(fake.splits).toHaveLength(1);
});

test('opened, an invitation shows the whole split to look over, with Accept and Decline', async ({ page }) => {
  const { fake, theirs } = data();
  await login(page, fake, 'A');
  await page.goto('/splits');
  await card(page).locator('[data-act="open-shared"]').click();
  await expect(page).toHaveURL(new RegExp(`/splits/shared/${theirs.split_id}$`));
  await expect(page.locator('.s-top .lbl')).toHaveText('Invitation');
  await expect(page.locator('#view')).toContainText('Cable Curl');
  await expect(page.locator('#view .inv-msg')).toContainText('try it for a month');
  await page.locator('.done-bar [data-act="inv-accept"]').click();
  await expect(page).toHaveURL(/\/splits\/[0-9a-f-]{36}$/);
  expect(fake.incoming[0].status).toBe('accepted');
});

test('with six splits already, Accept asks to make room first and the invitation keeps waiting', async ({ page }) => {
  const { fake } = data({ mine: 6 });
  await login(page, fake, 'A');
  await page.goto('/splits');
  await card(page).locator('[data-act="inv-accept"]').click();
  await expect(page.locator('#sheet h3')).toHaveText('6 splits is the limit');
  expect(fake.incoming[0].status).toBe('pending');
  await expect(badge(page)).toHaveText('1');
});

test('the sender adds an optional message, sees each answer, and can invite again after a decline', async ({ page }) => {
  const { fake, own } = data();
  await login(page, fake, 'A');
  await page.goto('/splits/' + own[0].id);
  await page.locator('[data-act="share-split"]').click();
  await expect(page.locator('#sheet')).toContainText('They get an invitation under Splits');
  /* with a message */
  await page.fill('#sh-u', '@alex');
  await page.fill('#sh-msg', 'Try my upper/lower');
  await page.locator('#sh-form button[type=submit]').click();
  await expect(page.locator('#toast')).toContainText('Invitation sent to @alex');
  expect(fake.outgoing[0]).toMatchObject({ username: 'alex', status: 'pending', message: 'Try my upper/lower' });
  await expect(page.locator('.person', { hasText: '@alex' }).locator('.stt')).toHaveText('waiting');
  /* without one */
  await page.fill('#sh-u', 'sam');
  await page.locator('#sh-form button[type=submit]').click();
  await expect(page.locator('.person', { hasText: '@sam' })).toBeVisible();
  expect(fake.outgoing.find(x => x.username === 'sam').message).toBeNull();
  /* the answers come in */
  fake.outgoing.find(x => x.username === 'alex').status = 'accepted';
  fake.outgoing.find(x => x.username === 'sam').status = 'declined';
  await page.locator('#sheet-body [data-act="close"]').first().click();
  await page.reload();
  await page.locator('[data-act="share-split"]').click();
  await expect(page.locator('.person', { hasText: '@alex' }).locator('.stt')).toHaveText('accepted');
  await expect(page.locator('.person', { hasText: '@sam' }).locator('.stt')).toHaveText('declined');
  await expect(page.locator('.person', { hasText: '@alex' }).locator('[data-reshare]')).toHaveCount(0);
  await page.locator('.person', { hasText: '@sam' }).locator('[data-reshare]').click();
  await expect(page.locator('#toast')).toContainText('Invitation sent to @sam again');
  await expect(page.locator('.person', { hasText: '@sam' }).locator('.stt')).toHaveText('waiting');
  /* someone who accepted already has it; someone who doesn't exist is named */
  await page.fill('#sh-u', 'alex');
  await page.locator('#sh-form button[type=submit]').click();
  await expect(page.locator('#toast')).toContainText('@alex already accepted this split');
  await page.fill('#sh-u', 'nobody');
  await page.locator('#sh-form button[type=submit]').click();
  await expect(page.locator('#toast')).toContainText('No user called @nobody');
});
