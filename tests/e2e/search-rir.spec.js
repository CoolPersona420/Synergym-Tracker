/* v0.1.49: the exercise search (pinned at the top, best matches first, Enter takes the top one) and the reps-left
   question (one bar from all out to easy, last time's answer marked, Skip, and a steer for the next set). */
import { test, expect } from '@playwright/test';
import { FakeSupabase, login } from './fake-supabase.js';

const X = (name, muscle, kind = 'w') => ({ id: crypto.randomUUID(), name, muscle, kind });
const day = n => new Date(Date.now() - n * 864e5).toISOString();
const NAMES = ['Bench Press:Chest', 'Barbell Row:Back', 'Back Squat:Quads', 'Barbell Curl:Biceps', 'Incline Bench:Chest', 'Bulgarian Split Squat:Quads',
  'Cable Fly:Chest', 'Lat Pulldown:Back', 'Romanian Deadlift:Hamstrings', 'Leg Press:Quads', 'Leg Curl:Hamstrings', 'Seated Row:Back'];

/* a live Push session with Bench Press (set 1 done, sets 2 and 3 to go); last time's sets were 2, 1 and 0 reps short */
async function setup(page) {
  const ex = NAMES.map(s => X(...s.split(':'))), bench = ex[0];
  const live = { id: crypto.randomUUID(), name: 'Push', started_at: new Date(Date.now() - 6e5).toISOString(), ended_at: null,
    items: [{ id: 'L1', exId: bench.id, sets: [{ id: 'q0', w: 80, r: 8, pw: 80, pr: 8, done: true }, { id: 'q1', w: 80, r: 8, pw: 80, pr: 8, done: false }, { id: 'q2', w: null, r: null, pw: 80, pr: 7, done: false }] }] };
  const past = { id: crypto.randomUUID(), name: 'Push', started_at: day(3), ended_at: day(2.96),
    items: [{ id: 'a', exId: bench.id, sets: [0, 1, 2].map(i => ({ id: 'a' + i, w: 80, r: 8 - i, done: true, rir: 2 - i })) }] };
  const fake = new FakeSupabase({ defaults: [], exercises: ex, sessions: [live, past] });
  await login(page, fake, 'A');
  await page.goto('/session/' + live.id);
  await expect(page.locator('.ex[data-item="L1"] h3')).toHaveText('Bench Press');
  return { fake, ex, live, saved: () => fake.sessions.find(s => s.id === live.id) };
}
const rows = page => page.locator('#pkl .pk .n').allTextContents();

test('search: names starting with it first, then a word in them, then anywhere; letters marked; adding a new one last', async ({ page }) => {
  await setup(page);
  await page.click('[data-act="add-ex"]');
  await expect(page.locator('#pkm')).toBeVisible();
  await expect(page.locator('#sheet .q-x')).toBeHidden();
  await page.locator('#pkq').pressSequentially('b');
  const r = await rows(page);
  /* "B…" names, then "Incline Bench" (a word starting with b), then "Cable Fly" (a b inside), then Add "b" */
  expect(r.slice(0, 5).every(n => n.startsWith('B'))).toBe(true);
  expect(r.slice(5)).toEqual(['Incline Bench', 'Cable Fly', 'Add “b”']);
  await expect(page.locator('#pkl .pk.first .n')).toHaveText(r[0]);
  await expect(page.locator('#pkl .pk-count')).toContainText('7 matches');
  await expect(page.locator('#pkl .pk', { hasText: 'Cable Fly' }).locator('mark')).toHaveText('b');
  /* the muscle chips step aside while typing; ✕ clears and brings them back */
  await expect(page.locator('#pkm')).toBeHidden();
  await page.click('#sheet .q-x');
  await expect(page.locator('#pkq')).toHaveValue('');
  await expect(page.locator('#pkq')).toBeFocused();
  await expect(page.locator('#pkm')).toBeVisible();
  await expect(page.locator('#pkl mark')).toHaveCount(0);
  await expect(page.locator('#pkl .pk-count')).toHaveCount(0);
});

test('search looks through every muscle even with one picked, and the pick comes back when the search is cleared', async ({ page }) => {
  await setup(page);
  await page.click('[data-act="add-ex"]');
  await page.click('#pkm [data-m="Back"]');
  expect((await rows(page)).filter(n => !n.startsWith('Other'))).toEqual(expect.arrayContaining(['Barbell Row', 'Lat Pulldown', 'Seated Row']));
  await page.locator('#pkq').pressSequentially('leg');
  expect(await rows(page)).toEqual(['Leg Curl', 'Leg Press', 'Add “leg”']);
  await page.click('#sheet .q-x');
  await expect(page.locator('#pkm [data-m="Back"]')).toHaveClass(/on/);
  expect(await rows(page)).not.toContain('Leg Press');
});

test('Enter (the keyboard’s Search key) adds the top match; with no match it starts a new exercise of that name', async ({ page }) => {
  const { ex, saved } = await setup(page);
  await page.click('[data-act="add-ex"]');
  await page.locator('#pkq').pressSequentially('roman');
  await page.keyboard.press('Enter');
  await expect(page.locator('#sheet')).toBeHidden();
  await expect(page.locator('.ex h3').last()).toHaveText('Romanian Deadlift');
  await expect.poll(() => saved().items.map(i => i.exId)).toContain(ex[8].id);
  await page.click('[data-act="add-ex"]');
  await page.locator('#pkq').pressSequentially('Zercher Squat');
  await expect(page.locator('#pkl .pk')).toHaveCount(1);
  await page.keyboard.press('Enter');
  await expect(page.locator('#sheet input[value="Zercher Squat"], #sheet input').first()).toHaveValue('Zercher Squat');
});

test('with the keyboard up, the search stays pinned at the top while the list scrolls under it', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'phones only');
  await page.addInitScript(() => { const vv = new EventTarget(); Object.assign(vv, { height: innerHeight, width: innerWidth, offsetTop: 0, offsetLeft: 0, scale: 1, pageTop: 0 });
    window.visualViewport = vv; window.__kb = h => { vv.height = innerHeight - h; vv.dispatchEvent(new Event('resize')); }; });
  await setup(page);
  await page.click('[data-act="add-ex"]');
  await page.locator('#pkq').pressSequentially('e');
  await page.evaluate(() => window.__kb(400));
  await expect(page.locator('html')).toHaveClass(/kb-open/);
  await page.waitForTimeout(400);
  const y0 = (await page.locator('#pkq').boundingBox()).y;
  const sheetTop = await page.locator('#sheet .sp').evaluate(e => e.getBoundingClientRect().top);
  await page.locator('#sheet .sp').evaluate(e => { e.scrollTop = e.scrollHeight; });
  await page.waitForTimeout(200);
  const y1 = (await page.locator('#pkq').boundingBox()).y;
  expect(y1).toBeGreaterThanOrEqual(sheetTop);
  expect(y1).toBeLessThanOrEqual(y0);
  /* the last row is reachable above the keyboard */
  const last = await page.locator('#pkl .pk').last().boundingBox();
  expect(last.y + last.height).toBeLessThanOrEqual(await page.evaluate(() => innerHeight - 400 + 1));
});

test('reps left: one bar from all out to easy, last time’s answer marked, and Skip puts it away', async ({ page }) => {
  const { saved } = await setup(page);
  const card = page.locator('.ex[data-item="L1"]');
  await card.locator('[data-act="done"][data-set="q1"]').click();
  const ask = card.locator('.rir');
  await expect(ask).toContainText('How many more could you do?');
  await expect(ask.locator('.rir-bar button')).toHaveText(['0', '1', '2', '3', '4+']);
  await expect(ask).toContainText('All out');
  await expect(ask).toContainText('Easy');
  /* set 2 last time had 1 left */
  await expect(ask.locator('.rir-bar button.was')).toHaveText('1');
  await expect(ask.locator('[data-v="1"]')).toHaveAttribute('aria-label', /same as last time/);
  await ask.locator('.rir-skip').click();
  await expect(card.locator('.rir')).toHaveCount(0);
  await expect(card.locator('.rir-tip')).toHaveCount(0);
  expect('rir' in saved().items[0].sets[1]).toBe(false);
});

test('reps left: an answer gives a one-line steer for the next set, gone once that set is ticked', async ({ page }) => {
  const { saved } = await setup(page);
  const card = page.locator('.ex[data-item="L1"]'), tip = card.locator('.rir-tip');
  await card.locator('[data-act="done"][data-set="q1"]').click();
  await card.locator('.rir [data-v="0"]').click();
  await expect(tip).toHaveText('All out. Next set, consider 2.5 kg less.');
  await expect.poll(() => saved().items[0].sets[1].rir).toBe(0);
  await expect(card.locator('.sno').nth(1).locator('.tank i')).toHaveCount(4);
  await expect(card.locator('.sno').nth(1).locator('.tank i.f')).toHaveCount(0);
  /* asked again from the set's menu: a different answer, a different steer */
  await card.locator('.sno').nth(1).click();
  await page.locator('#sheet .menu button', { hasText: 'Reps left (RIR)' }).click();
  await expect(tip).toHaveCount(0);
  await card.locator('.rir [data-v="3"]').click();
  await expect(tip).toHaveText('Plenty left. Next set, you could add 2.5 kg.');
  await card.locator('.sno').nth(1).click();
  await page.locator('#sheet .menu button', { hasText: 'Reps left (RIR)' }).click();
  await card.locator('.rir [data-v="2"]').click();
  await expect(tip).toHaveText('Right on target. Keep the weight for the next set.');
  /* ticking the next set: the steer goes and the question moves there */
  await card.locator('[data-act="done"][data-set="q2"]').click();
  await expect(tip).toHaveCount(0);
  await expect(card.locator('.set').nth(2).locator('.rir')).toHaveCount(1);
  /* the last set: an answer, but nothing left to steer */
  await card.locator('.set').nth(2).locator('.rir [data-v="0"]').click();
  await expect(card.locator('.rir-tip')).toHaveCount(0);
});
