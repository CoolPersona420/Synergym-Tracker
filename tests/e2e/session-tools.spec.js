/* Session tools: the summary after Finish (with Undo), dragging exercises into a new order, exercise notes,
   and warm-up sets that never count toward records, intensity or volume. */
import { test, expect } from '@playwright/test';
import { FakeSupabase, login } from './fake-supabase.js';

const X = (name, muscle) => ({ id: crypto.randomUUID(), name, muscle, kind: 'w' });
const day = n => new Date(Date.now() - n * 864e5).toISOString();
const done = (k, w, r, n = 3) => Array.from({ length: n }, (_, i) => ({ id: `${k}${i}`, w, r, done: true }));
const hint = (k, w, r, n = 3) => Array.from({ length: n }, (_, i) => ({ id: `${k}${i}`, w: null, r: null, pw: w, pr: r, done: false }));

/* a live Push session (Bench Press 2 of 3 done at 80×8, Overhead Press, Incline Dumbbell Press); last Push was 77.5×8 */
async function setup(page, { benchDone = 2, split = false } = {}) {
  const bench = X('Bench Press', 'Chest'), ohp = X('Overhead Press', 'Shoulders'), inc = X('Incline Dumbbell Press', 'Chest');
  const sp = { id: crypto.randomUUID(), name: 'PPL', days: [{ id: 'd1', type: 'Push', exercises: [bench, ohp, inc].map((e, k) => ({ id: 'e' + k, exId: e.id, name: e.name, muscle: e.muscle, kind: 'w', sets: 3, reps: '8' })) }, { id: 'd2', type: 'Pull', exercises: [] }] };
  const benchSets = [0, 1, 2].map(i => i < benchDone ? { id: 'q' + i, w: 80, r: 8, pw: 77.5, pr: 8, done: true } : { id: 'q' + i, w: null, r: null, pw: 77.5, pr: 8, done: false });
  const live = { id: crypto.randomUUID(), name: 'Push', started_at: new Date(Date.now() - 50 * 6e4).toISOString(), ended_at: null, split_id: split ? sp.id : null, split_day: split ? 0 : null,
    items: [{ id: 'L1', exId: bench.id, sets: benchSets }, { id: 'L2', exId: ohp.id, sets: hint('o', 47.5, 8) }, { id: 'L3', exId: inc.id, sets: hint('n', 26, 10) }] };
  const fake = new FakeSupabase({ defaults: [], exercises: [bench, ohp, inc], splits: [sp], sessions: [live,
    { id: crypto.randomUUID(), name: 'Push', started_at: day(3), ended_at: day(2.96), split_id: split ? sp.id : null, split_day: split ? 0 : null,
      items: [{ id: 'a1', exId: bench.id, sets: done('a1', 77.5, 8) }, { id: 'a2', exId: ohp.id, sets: done('a2', 47.5, 8) }] }] });
  await login(page, fake, 'A');
  await page.goto('/session/' + live.id);
  await expect(page.locator('[data-item="L1"] h3')).toHaveText('Bench Press');
  await page.waitForTimeout(1000); /* the page has settled in */
  return { fake, live, sp, ex: { bench, ohp, inc }, saved: () => fake.sessions.find(s => s.id === live.id) };
}
const names = page => page.locator('.items .ex h3').allTextContents();
/* press the grip, move like a finger would, hold at the screen's edge while the page scrolls along, let go */
async function dragTo(page, grip, target) {
  /* in the middle of the screen, clear of the header that sticks to the top */
  await grip.evaluate(e => e.scrollIntoView({ block: 'center', behavior: 'instant' })); await page.waitForTimeout(150);
  const b = await grip.boundingBox(), x = b.x + b.width / 2, y = b.y + b.height / 2;
  await page.mouse.move(x, y); await page.mouse.down();
  const t = typeof target === 'number' ? { x, y: y + target } : target;
  for (let i = 1; i <= 15; i++) { await page.mouse.move(x + (t.x - x) * i / 15, y + (t.y - y) * i / 15); await page.waitForTimeout(25); }
  if (t.hold) await page.waitForTimeout(t.hold);
  await page.mouse.up(); await page.waitForTimeout(500);
}
test('Finish shows how it went: intensity, volume, sets, records and the best set; Undo finish goes back to logging', async ({ page }) => {
  const { saved } = await setup(page);
  await page.click('[data-act="finish"]');
  await expect(page.locator('#sheet h3')).toHaveText('Push, done');
  await expect(page.locator('#sheet .ts-kv')).toContainText('intensity');
  await expect(page.locator('#sheet .ts-kv')).toContainText('2'); /* sets */
  await expect(page.locator('#sheet')).toContainText('Weight PR');
  await expect(page.locator('#sheet .fs-best')).toContainText('Bench Press');
  await expect(page.locator('#sheet .fs-best')).toContainText('80 kg × 8');
  await expect.poll(() => saved().ended_at).toBeTruthy();
  /* the unticked hints were tidied away on finishing… */
  expect(saved().items.map(i => i.sets.length)).toEqual([2]);
  /* …and Undo finish brings them all back, live */
  await page.locator('#sheet #fs-undo').click();
  await expect(page.locator('#toast')).toContainText('Back to logging');
  await expect(page.locator('[data-act="finish"]')).toBeVisible();
  await expect.poll(() => saved().ended_at).toBeNull();
  expect(saved().items.map(i => i.sets.length)).toEqual([3, 3, 3]);
});

test('the summary compares volume with the last time this split day was done', async ({ page }) => {
  await setup(page, { split: true });
  await page.click('[data-act="finish"]');
  await expect(page.locator('#sheet .fs-vs')).toContainText('on last Push');
});

test('drag an exercise by its grip to a new place; the order is saved', async ({ page }) => {
  const { saved, ex } = await setup(page);
  /* up to the top of the screen, holding there while the page scrolls up to the first exercise */
  const g = page.locator('[data-item="L3"] .grip'), box = await (await g.elementHandle()).boundingBox();
  await dragTo(page, g, { x: box.x + 10, y: 4, hold: 2500 });
  await expect.poll(() => names(page)).toEqual(['Incline Dumbbell Press', 'Bench Press', 'Overhead Press']);
  await expect.poll(() => saved().items.map(i => i.exId)).toEqual([ex.inc.id, ex.bench.id, ex.ohp.id]);
  /* a short wiggle leaves it where it was */
  await dragTo(page, page.locator('[data-item="L1"] .grip'), 6);
  expect(await names(page)).toEqual(['Incline Dumbbell Press', 'Bench Press', 'Overhead Press']);
});

test('drag an exercise within a split day', async ({ page }) => {
  const { fake, sp } = await setup(page);
  await page.goto('/splits/' + sp.id);
  const rows = page.locator('.day[data-did="d1"] .dex .nm b');
  await expect(rows).toHaveCount(3); await page.waitForTimeout(1200);
  await expect(rows).toHaveText(['Bench Press', 'Overhead Press', 'Incline Dumbbell Press']);
  await dragTo(page, page.locator('.day[data-did="d1"] .dex').first().locator('.grip'), 260);
  await expect(rows).toHaveText(['Overhead Press', 'Incline Dumbbell Press', 'Bench Press']);
  await expect.poll(() => fake.splits.find(x => x.id === sp.id).days[0].exercises.map(e => e.name)).toEqual(['Overhead Press', 'Incline Dumbbell Press', 'Bench Press']);
});

test('a setup note stays with the exercise: added from its card, shown in every session and on its page', async ({ page }) => {
  const { fake, ex } = await setup(page);
  await page.locator('article[data-item="L2"] .tl-note').click();
  await expect(page.locator('#sheet h3')).toHaveText('Overhead Press setup');
  await page.fill('#nt-v', 'Seat 4, elbows under the bar');
  await page.click('#nt-save');
  await expect(page.locator('article[data-item="L2"] .ex-note')).toContainText('Seat 4, elbows under the bar');
  await expect(page.locator('article[data-item="L2"] .tl-note')).toHaveCount(0);
  await expect.poll(() => fake.exercises.find(e => e.id === ex.ohp.id).note).toBe('Seat 4, elbows under the bar');
  await page.goto('/exercises/' + ex.ohp.id);
  await expect(page.locator('.ex-pnote .ex-note')).toContainText('Seat 4');
  await page.locator('.ex-pnote .ex-note').click();
  await page.click('#nt-del');
  await expect(page.locator('.ex-pnote .ex-note-add')).toBeVisible();
  await expect.poll(() => fake.exercises.find(e => e.id === ex.ohp.id).note).toBeNull();
});

test('warm-ups build to the working weight and never count toward records, intensity or volume', async ({ page }) => {
  const { saved } = await setup(page);
  const card = page.locator('[data-item="L2"]');
  const strip = await page.locator('#strip').textContent();
  await card.locator('[data-act="add-wu"]').click();
  /* 40%, 60% and 80% of 47.5 kg, rounded to 2.5 kg */
  await expect(card.locator('.set.wu .sno')).toHaveText(['W1', 'W2', 'W3']);
  expect(await card.locator('.set.wu [data-f="w"]').evaluateAll(els => els.map(e => e.placeholder))).toEqual(['20', '27.5', '37.5']);
  await expect(card.locator('[data-act="add-wu"]')).toHaveCount(0);
  /* ticking one counts it as done, but the session's numbers don't move */
  await card.locator('.set.wu [data-act="done"]').first().click();
  await expect(card.locator('.set.wu').first()).toHaveClass(/done/);
  expect(await page.locator('#strip').textContent()).toBe(strip);
  await expect.poll(() => saved().items[1].wu?.length).toBe(3);
  /* finishing keeps the warm-up that was done, apart from the working sets */
  await page.click('[data-act="finish"]');
  await expect.poll(() => saved().ended_at).toBeTruthy();
  const it = saved().items.find(i => i.id === 'L2');
  expect(it ? it.wu : null).toBeFalsy(); /* no working sets were done for it, so it isn't kept */
});

test('warm-ups are saved with an exercise that has working sets, and can be deleted from their menu', async ({ page }) => {
  const { saved } = await setup(page, { benchDone: 0 });
  const card = page.locator('[data-item="L1"]');
  await card.locator('[data-act="add-wu"]').click();
  await expect(card.locator('.set.wu')).toHaveCount(3);
  await card.locator('.set.wu .sno').nth(2).click();
  await page.locator('#sheet .menu button', { hasText: 'Delete this warm-up' }).click();
  await expect(card.locator('.set.wu')).toHaveCount(2);
  await card.locator('.set.wu [data-act="done"]').first().click();
  /* a working set done: the + Warm-up button is gone for good */
  await card.locator('.set:not(.wu) [data-act="done"]').first().click();
  await page.click('[data-act="finish"]');
  await expect.poll(() => saved().ended_at).toBeTruthy();
  const it = saved().items.find(i => i.id === 'L1');
  expect(it.wu).toEqual([expect.objectContaining({ w: 30, r: 8, done: true })]);
  expect(it.sets).toHaveLength(1);
});

test('reps in reserve: after ticking a set, an optional tap says how many reps were left; it shows under the set number', async ({ page }) => {
  const { saved } = await setup(page, { benchDone: 0 });
  const card = page.locator('[data-item="L1"]');
  await card.locator('.set [data-act="done"]').first().click();
  const ask = card.locator('.rir');
  await expect(ask).toHaveCount(1);
  await expect(ask).toContainText('How many more could you do?');
  await ask.locator('[data-v="2"]').click();
  await expect(card.locator('.rir')).toHaveCount(0);
  await expect(card.locator('.sno').first().locator('.tank')).toContainText('2 left');
  await expect(card.locator('.sno').first().locator('.tank i.f')).toHaveCount(2);
  await expect.poll(() => saved().items[0].sets[0].rir).toBe(2);
  /* ignoring it is fine: ticking the next set moves the question there */
  await card.locator('.set [data-act="done"]').nth(1).click();
  await expect(card.locator('.set').nth(1).locator('.rir')).toHaveCount(1);
  await card.locator('.set [data-act="done"]').nth(2).click();
  await expect(card.locator('.set').nth(1).locator('.rir')).toHaveCount(0);
  await expect(card.locator('.set').nth(2).locator('.rir')).toHaveCount(1);
  /* the set's menu asks again, and tapping the same answer clears it */
  await card.locator('.sno').first().click();
  await page.locator('#sheet .menu button', { hasText: 'Reps left (RIR)' }).click();
  await card.locator('.set').first().locator('.rir [data-v="2"]').click();
  await expect(card.locator('.sno').first().locator('.tank')).toHaveCount(0);
  await expect.poll(() => 'rir' in saved().items[0].sets[0]).toBe(false);
  /* one question at a time: set 3's went when set 1's was asked again. 4 means 4 or more */
  await expect(card.locator('.rir')).toHaveCount(0);
  await card.locator('.sno').nth(2).click();
  await page.locator('#sheet .menu button', { hasText: 'Reps left (RIR)' }).click();
  await card.locator('.set').nth(2).locator('.rir [data-v="4"]').click();
  await expect(card.locator('.sno').nth(2).locator('.tank')).toContainText('4+ left');
  await expect(card.locator('.sno').nth(2).locator('.tank i.f')).toHaveCount(4);
});
