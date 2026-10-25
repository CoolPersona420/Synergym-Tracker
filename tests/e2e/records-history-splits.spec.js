/* Live PRs, History filters, the six-split limit, and today's summary. */
import crypto from 'node:crypto';
import { test, expect } from '@playwright/test';
import { FakeSupabase, login, benchHistory } from './fake-supabase.js';

const phoneOnly = info => test.skip(info.project.name !== 'phone', 'phone only');
const day = n => new Date(Date.now() - n * 864e5).toISOString();

test('PRs show under a set as it is typed: weight, both, then reps', async ({ page }) => {
  const fake = new FakeSupabase(benchHistory());
  await login(page, fake, 'A');
  await page.locator('#nav .nav-train').click();
  await page.locator('#sheet-body [data-st-foot]', { hasText: 'Empty session' }).click();
  await page.locator('[data-act="add-ex"]').first().click();
  await page.locator('#sheet-body .pk', { hasText: 'Bench Press' }).click();
  const card = page.locator('.ex', { hasText: 'Bench Press' });
  await expect(card.locator('[data-orm]')).toContainText('PR 80×8');
  const set = k => card.locator('.set').nth(k);
  await set(0).locator('input[data-f="w"]').fill('82.5');
  await set(0).locator('input[data-f="r"]').fill('5');
  await expect(set(0).locator('.set-pr')).toBeVisible();
  await expect(set(0).locator('.set-pr')).toContainText('Weight PR');
  await expect(set(0).locator('.set-pr')).toContainText('heaviest yet');
  await set(0).locator('input[data-f="r"]').fill('9');
  await expect(set(0).locator('.set-pr')).toContainText('Weight + rep PR');
  /* the faded 80 counts: 80×10 beats the 9 reps done at 80 or more */
  await set(1).locator('input[data-f="r"]').fill('10');
  await expect(set(1).locator('.set-pr')).toContainText('Rep PR');
  /* back under the record: the line goes away */
  await set(1).locator('input[data-f="r"]').fill('3');
  await expect(set(1).locator('.set-pr')).toBeHidden();
});

test('an exercise page shows its records', async ({ page }) => {
  const fake = new FakeSupabase(benchHistory());
  await login(page, fake, 'A');
  await page.goto('/exercises/' + fake.exercises[0].id);
  const recs = page.locator('.recs');
  await expect(recs).toContainText('Heaviest');
  await expect(recs).toContainText('80 × 8');
  await expect(recs).toContainText('Best reps by weight');
});

test('History filters: tap search for filters; date, exercise, muscle and PR combine', async ({ page }) => {
  const fake = new FakeSupabase(benchHistory());
  const row = { id: crypto.randomUUID(), name: 'Barbell Row', muscle: 'Back', kind: 'w' };
  fake.exercises.push({ ...row, user_id: fake.uid, archived: false, is_default: true });
  fake.sessions.push({ id: crypto.randomUUID(), user_id: fake.uid, name: 'Pull', notes: '', started_at: day(40), ended_at: day(39.96), split_id: null, split_day: null, items: [{ id: 'r1', exId: row.id, sets: [{ id: 'rs1', w: 60, r: 10, done: true }] }] });
  await login(page, fake, 'A');
  await page.goto('/history');
  await expect(page.locator('#hlist .row')).toHaveCount(3);
  await expect(page.locator('.hf')).toHaveCount(0);
  await page.locator('.search[data-f="q"]').click();
  await expect(page.locator('.hf')).toBeVisible();

  await page.locator('[data-act="hf-pick"][data-k="pr"]').click();
  await page.locator('#sheet-body .hf-o', { hasText: 'Weight PRs' }).click();
  await expect(page.locator('#hlist .row')).toHaveCount(1);
  await expect(page.locator('.hf-n')).toHaveText('1 session found');

  await page.locator('[data-act="hf-clear"]').click();
  await page.locator('[data-act="hf-pick"][data-k="ex"]').click();
  await page.fill('#hf-q', 'row');
  await page.locator('#sheet-body .hf-o', { hasText: 'Barbell Row' }).click();
  await expect(page.locator('#hlist .row')).toHaveCount(1);
  await expect(page.locator('[data-k="ex"]')).toContainText('Barbell Row');

  /* Barbell Row was 40 days ago: last 30 days leaves nothing */
  await page.locator('[data-act="hf-pick"][data-k="date"]').click();
  await page.locator('#sheet-body [data-hfd="30"]').click();
  await expect(page.locator('#hlist')).toContainText('No sessions match.');

  await page.locator('[data-act="hf-clear"]').click();
  await page.locator('[data-act="hf-pick"][data-k="muscle"]').click();
  await page.locator('#sheet-body .hf-o', { hasText: 'Chest' }).click();
  await expect(page.locator('#hlist .row')).toHaveCount(2);

  /* a custom range */
  await page.locator('[data-act="hf-clear"]').click();
  await page.locator('[data-act="hf-pick"][data-k="date"]').click();
  const iso = n => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
  await page.fill('#hf-from', iso(12)); await page.fill('#hf-to', iso(1));
  await page.click('#hf-apply');
  await expect(page.locator('#hlist .row')).toHaveCount(2);
});

function sixSplits(fake) {
  const ids = [];
  for (let i = 1; i <= 6; i++) { const id = crypto.randomUUID(); ids.push(id); fake.splits.push({ id, user_id: fake.uid, name: 'Plan ' + i, description: '', days: [{ id: 'd' + i, type: 'Push', rest: false, exercises: [] }], share_token: null, copied_from: null, updated_at: new Date(Date.now() - i * 1000).toISOString() }); }
  return ids;
}

test('six splits is the limit: new split asks to delete one; past sessions keep the split name', async ({ page }) => {
  const fake = new FakeSupabase(benchHistory());
  const ids = sixSplits(fake);
  fake.sessions[0].split_id = ids[5]; fake.sessions[0].split_day = 0;
  await login(page, fake, 'A');
  await page.goto('/splits');
  await expect(page.locator('.mgroup').first()).toContainText('6 of 6');
  await page.locator('[data-act="new-split"]').first().click();
  await expect(page.locator('#sheet-body h3')).toHaveText('6 splits is the limit');
  await expect(page.locator('#sheet-body .sp-full .row')).toHaveCount(6);
  await page.locator('#sheet-body .sp-full .row', { hasText: 'Plan 6' }).locator('[data-act="split-del"]').click();
  await page.locator('#sheet-body .btn', { hasText: 'Delete' }).last().click();
  await expect.poll(() => fake.splits.length).toBe(5);
  await expect.poll(() => fake.profiles[0].split_archive && fake.profiles[0].split_archive[ids[5]]?.name).toBe('Plan 6');
  await expect(page.locator('.mgroup').first()).toContainText('5 of 6');
  /* now there's room */
  await page.locator('[data-act="new-split"]').first().click();
  await expect(page.locator('#sheet-body h3')).toHaveText('New split');
  await page.locator('#sheet-body [data-act="close"]').first().click();

  /* history still names the deleted split, and can filter by it */
  await page.goto('/history');
  await expect(page.locator('#hlist .row').first()).toContainText('Plan 6');
  await page.locator('[data-act="hf-toggle"]').click();
  await page.locator('[data-act="hf-pick"][data-k="split"]').click();
  const opt = page.locator('#sheet-body .hf-o', { hasText: 'Plan 6' });
  await expect(opt).toContainText('deleted split');
  await opt.click();
  await expect(page.locator('#hlist .row')).toHaveCount(1);
});

test('duplicating at the limit is blocked too', async ({ page }) => {
  const fake = new FakeSupabase(benchHistory());
  sixSplits(fake);
  await login(page, fake, 'A');
  await page.goto('/splits');
  await page.locator('[data-act="dup-split"]').first().click();
  await expect(page.locator('#sheet-body h3')).toHaveText('6 splits is the limit');
  expect(fake.splits).toHaveLength(6);
});

test('importing a file with more than six splits is refused before anything changes', async ({ page }) => {
  const fake = new FakeSupabase(benchHistory());
  await login(page, fake, 'A');
  await page.goto('/settings');
  const splits = Array.from({ length: 7 }, (_, i) => ({ id: 'p' + i, name: 'Plan ' + i, days: [{ type: 'Push', exercises: [] }] }));
  await page.setInputFiles('#imp', { name: 'big.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ app: 'Synergym', library: [{ id: 'e', name: 'Squat', muscle: 'Legs' }], sessions: [], splits })) });
  await expect(page.locator('#sheet-body h3')).toHaveText('Can’t import this file');
  await expect(page.locator('#sheet-body')).toContainText('up to 6');
  expect(fake.log).not.toContain('A import_replace');
});

test('today’s summary: tap the date; shows today, the week and the next split day with targets', async ({ page }) => {
  const fake = new FakeSupabase(benchHistory());
  const ex = fake.exercises[0];
  fake.splits.push({ id: crypto.randomUUID(), user_id: fake.uid, name: 'Upper', description: '', days: [{ id: 'u1', type: 'Push', rest: false, exercises: [{ id: 'x1', exId: ex.id, name: 'Bench Press', muscle: 'Chest', kind: 'w', sets: 3, reps: '8' }] }], share_token: null, copied_from: null, updated_at: new Date().toISOString() });
  await login(page, fake, 'A');
  await page.locator('.ts-open').click();
  await expect(page.locator('#sheet-body h3')).toHaveText('Today');
  await expect(page.locator('#sheet-body')).toContainText('Nothing logged yet today.');
  await expect(page.locator('.ts-week')).toContainText('This week');
  const next = page.locator('.ts-next');
  await expect(next).toContainText('Up next');
  await expect(next).toContainText('Upper · Day 1');
  await expect(next.locator('.ts-ex')).toContainText('82.5×8');
  await next.locator('[data-to="start"]').click();
  await expect(page).toHaveURL(/\/session\//);
  await expect(page.locator('#sheet')).toBeHidden();
});

test('on a phone, pulling Home down past the hint opens today’s summary', async ({ page }, info) => {
  phoneOnly(info);
  await login(page, new FakeSupabase(benchHistory()), 'A');
  await page.waitForTimeout(1500);
  const cdp = await page.context().newCDPSession(page);
  const at = y => [{ x: 200, y }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: at(260) });
  for (let k = 1; k <= 10; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: at(260 + 16 * k) });
  await expect(page.locator('#pull-hint')).toHaveText('Release for today');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.locator('#sheet-body h3')).toHaveText('Today');
  /* a short pull does nothing */
  await page.locator('#sheet-body [data-act="close"]').first().click();
  await expect(page.locator('#sheet')).toBeHidden();
  await page.waitForTimeout(600);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: at(260) });
  for (let k = 1; k <= 4; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: at(260 + 15 * k) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(400);
  await expect(page.locator('#sheet')).toBeHidden();
});
