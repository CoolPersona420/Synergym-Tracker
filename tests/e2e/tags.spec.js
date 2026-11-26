/* Tags: short labels on an exercise in a session (the machine, the grip, a belt) for finding sessions again. They
   never change the numbers, which stay one per exercise, and they carry over to the next session. */
import { test, expect } from '@playwright/test';
import { FakeSupabase, login } from './fake-supabase.js';

const day = n => new Date(Date.now() - n * 864e5).toISOString();
const sets = (k, w, r, n = 3) => Array.from({ length: n }, (_, i) => ({ id: `${k}${i}`, w, r, done: true }));
const past = (n, items) => ({ id: crypto.randomUUID(), name: 'Arms', started_at: day(n), ended_at: day(n - 0.04), items });

/* Triceps Pushdown: two sessions tagged Cable stack (40×10), then two tagged Hammer and Rope (25×12, the latest) */
async function setup(page, { extra = [] } = {}) {
  const tri = { id: crypto.randomUUID(), name: 'Triceps Pushdown', muscle: 'Triceps', kind: 'w' };
  const curl = { id: crypto.randomUUID(), name: 'Cable Curl', muscle: 'Biceps', kind: 'w' };
  const it = (k, w, r, tags) => ({ id: k, exId: tri.id, ...(tags ? { tags } : {}), sets: sets(k, w, r) });
  const old = [past(20, [it('a1', 40, 10, ['Cable stack'])]), past(17, [it('a2', 40, 10, ['Cable stack'])]), past(10, [it('b1', 25, 12, ['Hammer', 'Rope'])]), past(6, [it('b2', 25, 12, ['Hammer', 'Rope'])])];
  const live = { id: crypto.randomUUID(), name: 'Arms', started_at: new Date(Date.now() - 20 * 6e4).toISOString(), ended_at: null, items: [{ id: 'L0', exId: curl.id, sets: [{ id: 'c0', w: null, r: null, done: false }] }] };
  const fake = new FakeSupabase({ defaults: [], exercises: [tri, curl, ...extra], sessions: [...old, live] });
  await login(page, fake, 'A');
  return { fake, tri, curl, live, item: id => fake.sessions.find(s => s.id === live.id).items.find(i => i.exId === (id || tri.id)) };
}
async function add(page, live, name = 'Triceps Pushdown') {
  await page.goto('/session/' + live.id);
  await page.locator('[data-act="add-ex"]').first().click();
  await page.locator('[data-act="pk-pick"]', { hasText: name }).first().click();
  const card = page.locator('article.ex', { has: page.locator('h3', { hasText: name }) });
  await expect(card).toBeVisible();
  return card;
}

test('added to a session it starts with last time’s tags; the hints are last time’s, as always', async ({ page }) => {
  const { live, item } = await setup(page);
  const card = await add(page, live);
  await expect(card.locator('.tl-main .tc')).toHaveText(['Hammer', 'Rope']);
  await expect(card.locator('.sugg')).toContainText('25×12');
  await expect.poll(() => item()?.tags).toEqual(['Hammer', 'Rope']);
});

test('tags don’t change the numbers: intensity and records stay one per exercise', async ({ page }) => {
  const { live } = await setup(page);
  const card = await add(page, live);
  const row = card.locator('.set').first();
  await row.locator('input[data-f="w"]').fill('40');
  await row.locator('input[data-f="r"]').fill('10');
  await row.locator('.chk').click();
  /* 40×10 is the exercise's best whatever it was tagged: full intensity, no new record */
  await expect(row.locator('.int')).toHaveText('100');
  await expect(row.locator('.set-pr')).toBeHidden();
  await expect(card.locator('.mca')).toHaveCount(0);
});

test('the tags sheet: this exercise’s tags to tap, a new one, and ideas', async ({ page }) => {
  const { live, item } = await setup(page);
  const card = await add(page, live);
  await card.locator('.tl-main').click();
  await expect(page.locator('.tg-top h3')).toHaveText('Triceps Pushdown');
  await expect(page.locator('.tg-lead')).toContainText('Tags don’t change your numbers');
  await expect(page.locator('.tg-chips [data-act="tg-lb"]')).toHaveText(['Hammer', 'Rope', 'Cable stack']);
  await page.locator('.tg-chips [data-v="Cable stack"]').click();
  await page.locator('.tg-chips [data-v="Hammer"]').click();
  await page.locator('[data-act="tg-add"]').click();
  await page.fill('#tg-new', 'Slow negatives');
  await page.keyboard.press('Enter');
  await page.locator('.chip.sug', { hasText: 'Straight bar' }).click();
  await page.locator('[data-act="tg-close"]').click();
  await expect(card.locator('.tl-main .tc')).toHaveText(['Rope', 'Cable stack', 'Slow negatives', 'Straight bar']);
  await expect.poll(() => item()?.tags).toEqual(['Rope', 'Cable stack', 'Slow negatives', 'Straight bar']);
});

test('an exercise with no tags offers them; bodyweight works the same way', async ({ page }) => {
  const pull = { id: crypto.randomUUID(), name: 'Pull-up', muscle: 'Back', kind: 'bw' };
  const { live, item } = await setup(page, { extra: [pull] });
  const card = await add(page, live, 'Pull-up');
  await expect(card.locator('.tline.empty')).toContainText('Tag it: grip, paused, rings');
  await card.locator('.tline.empty').click();
  await page.locator('.chip.sug', { hasText: 'Wide grip' }).click();
  await page.locator('[data-act="tg-close"]').click();
  await expect(card.locator('.tl-main .tc')).toHaveText(['Wide grip']);
  await expect.poll(() => item(pull.id)?.tags).toEqual(['Wide grip']);
});

test('the exercise page filters recent sets by tag; Edit tags renames one everywhere and removes another', async ({ page }) => {
  const { fake, tri } = await setup(page);
  await page.goto('/exercises/' + tri.id);
  await expect(page.locator('.lb-f [data-act="ex-lb"]')).toHaveText(['Cable stack 2', 'Hammer 2', 'Rope 2']);
  await page.locator('.lb-f [data-act="ex-lb"]', { hasText: 'Hammer' }).click();
  await expect(page.locator('.hist-s')).toHaveCount(2);
  await page.locator('.lb-f [data-act="ex-lb"]', { hasText: 'Hammer' }).click();
  await expect(page.locator('.hist-s')).toHaveCount(4);
  /* one 1RM for the exercise: the cable stack's 40×10 */
  await expect(page.locator('.orm-card .bignum')).toContainText('53.5');
  await page.locator('.card-h [data-act="tags"]').click();
  await expect(page.locator('.tg-top .lbl')).toHaveText('Edit tags');
  const ren = page.locator('[data-ren="Hammer"]');
  await ren.fill('Hammer ISO');
  await ren.press('Enter');
  await expect.poll(() => fake.sessions.flatMap(s => s.items).filter(i => i.id === 'b1' || i.id === 'b2').map(i => i.tags)).toEqual([['Hammer ISO', 'Rope'], ['Hammer ISO', 'Rope']]);
  await page.locator('.tg-ed', { has: page.locator('[data-ren="Rope"]') }).locator('[data-act="tg-sure"]').click();
  await page.locator('[data-act="tg-rm"]').click();
  await expect.poll(() => fake.sessions.flatMap(s => s.items).filter(i => i.id === 'b1' || i.id === 'b2').map(i => i.tags)).toEqual([['Hammer ISO'], ['Hammer ISO']]);
  await expect(page.locator('#toast')).toContainText('Rope removed from Triceps Pushdown');
});

test('the Logbook finds sessions by tag: a Tag filter, and the search matches tags', async ({ page }) => {
  await setup(page);
  await page.goto('/history');
  await page.locator('.search[data-f="q"]').click();
  await page.locator('[data-act="hf-pick"][data-k="tag"]').click();
  await expect(page.locator('#sheet h3')).toHaveText('Filter by tag');
  await expect(page.locator('#sheet-body .hf-o', { hasText: 'Hammer' })).toContainText('2 sessions');
  await page.locator('#sheet-body .hf-o', { hasText: 'Cable stack' }).click();
  await expect(page.locator('.hf-n')).toHaveText('2 sessions found');
  await expect(page.locator('[data-k="tag"]')).toContainText('Cable stack');
  await page.locator('[data-act="hf-clear"]').click();
  await page.fill('.search[data-f="q"]', 'rope');
  await expect(page.locator('.hf-n')).toHaveText('2 sessions found');
});

test('tapping a tag on the exercise page sums it up: sessions, best set with it, last time', async ({ page }) => {
  const { tri } = await setup(page);
  await page.goto('/exercises/' + tri.id);
  await expect(page.locator('.tg-sum')).toHaveCount(0);
  await page.locator('.lb-f [data-act="ex-lb"]', { hasText: 'Hammer' }).click();
  await expect(page.locator('.tg-sum')).toContainText(/^With Hammer · 2 sessions · best set 25×12 · last /);
  await page.locator('.lb-f [data-act="ex-lb"]', { hasText: 'Cable stack' }).click();
  await expect(page.locator('.tg-sum')).toContainText('With Cable stack · 2 sessions · best set 40×10');
});
