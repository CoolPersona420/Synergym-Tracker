/* Tags: a machine tag (one at a time, weighted exercises only) keeps its own numbers, like a separate lift; labels
   (belt, paused, wide grip) are for finding sessions and never split the numbers. Tags carry over to the next
   session; the card switches between two machines in one tap; a set far from usual asks "Different machine today?". */
import { test, expect } from '@playwright/test';
import { FakeSupabase, login } from './fake-supabase.js';

const day = n => new Date(Date.now() - n * 864e5).toISOString();
const sets = (k, w, r, n = 3) => Array.from({ length: n }, (_, i) => ({ id: `${k}${i}`, w, r, done: true }));
const past = (n, items) => ({ id: crypto.randomUUID(), name: 'Arms', started_at: day(n), ended_at: day(n - 0.04), items });
const A = { id: 'mA', name: 'Cable stack', what: '', setup: '' };
const B = { id: 'mB', name: 'Hammer Strength', what: '', setup: '' };

/* Triceps Pushdown: two old sessions on no machine (40×10), two on the cable stack (40×10), then two on the Hammer
   machine with a Rope label (25×12, the latest); a live session with a Cable Curl in it */
async function setup(page, { machines = [A, B], extra = [] } = {}) {
  const tri = { id: crypto.randomUUID(), name: 'Triceps Pushdown', muscle: 'Triceps', kind: 'w', machines };
  const curl = { id: crypto.randomUUID(), name: 'Cable Curl', muscle: 'Biceps', kind: 'w' };
  const it = (k, w, r, mc, tags) => ({ id: k, exId: tri.id, ...(mc ? { mc } : {}), ...(tags ? { tags } : {}), sets: sets(k, w, r) });
  const old = [past(30, [it('o1', 40, 10)]), past(27, [it('o2', 40, 10)]), past(20, [it('a1', 40, 10, 'mA')]), past(17, [it('a2', 40, 10, 'mA')]), past(10, [it('b1', 25, 12, 'mB', ['Rope'])]), past(6, [it('b2', 25, 12, 'mB', ['Rope'])])];
  const live = { id: crypto.randomUUID(), name: 'Arms', started_at: new Date(Date.now() - 20 * 6e4).toISOString(), ended_at: null, items: [{ id: 'L0', exId: curl.id, sets: [{ id: 'c0', w: null, r: null, done: false }] }] };
  const fake = new FakeSupabase({ defaults: [], exercises: [tri, curl, ...extra], sessions: [...old, live] });
  await login(page, fake, 'A');
  return { fake, tri, live, saved: () => fake.sessions.find(s => s.id === live.id), item: () => fake.sessions.find(s => s.id === live.id).items.find(i => i.exId === tri.id) };
}
async function add(page, live, name = 'Triceps Pushdown') {
  await page.goto('/session/' + live.id);
  await page.locator('[data-act="add-ex"]').first().click();
  await page.locator('[data-act="pk-pick"]', { hasText: name }).first().click();
  const card = page.locator('article.ex', { has: page.locator('h3', { hasText: name }) });
  await expect(card).toBeVisible();
  return card;
}

test('added to a session it starts with last time’s machine and labels, and that machine’s own numbers', async ({ page }) => {
  const { live, item } = await setup(page);
  const card = await add(page, live);
  await expect(card.locator('.tl-main .tc')).toHaveText(['KGHammer Strength', 'Rope']);
  await expect(card.locator('.tl-sw')).toHaveText('⇄ Cable stack');
  await expect(card.locator('.sugg .lbl').first()).toHaveText('Last on Hammer Strength');
  await expect(card.locator('.sugg')).toContainText('25×12');
  await expect(card.locator('input[data-f="w"]').first()).toHaveAttribute('placeholder', '25');
  await expect.poll(() => item()?.mc).toBe('mB');
  expect(item().tags).toEqual(['Rope']);
});

test('one tap on the line switches to the other machine, and the hints follow', async ({ page }) => {
  const { live, item } = await setup(page);
  const card = await add(page, live);
  await card.locator('.tl-sw').click();
  await expect(page.locator('#toast')).toContainText('On Cable stack: Last → Try follows it');
  await expect(card.locator('.tl-main .tc.m')).toContainText('Cable stack');
  await expect(card.locator('.tl-sw')).toHaveText('⇄ Hammer Strength');
  await expect(card.locator('.sugg .lbl').first()).toHaveText('Last on Cable stack');
  await expect(card.locator('input[data-f="w"]').first()).toHaveAttribute('placeholder', '40');
  await expect.poll(() => item()?.mc).toBe('mA');
});

test('the tags sheet: machine tiles with their numbers, Last → Try for the pick, labels and ideas', async ({ page }) => {
  const { live, item } = await setup(page);
  const card = await add(page, live);
  await card.locator('.tl-main').click();
  await expect(page.locator('.tg-top h3')).toHaveText('Triceps Pushdown');
  const tiles = page.locator('.mtiles .mtile');
  await expect(tiles).toHaveCount(4);
  await expect(page.locator('.mtile.on')).toContainText('Hammer Strength');
  await expect(tiles.filter({ hasText: 'Cable stack' })).toContainText('53.5');
  await expect(page.locator('.tg-prev')).toContainText('25×12');
  await tiles.filter({ hasText: 'Cable stack' }).click();
  await expect(page.locator('.tg-prev')).toContainText('On Cable stack · Rope');
  await expect(page.locator('.tg-prev b')).toHaveText('40×10→ try42.5×10');
  /* a label of its own, and an idea */
  await page.locator('[data-act="tg-add"][data-k="l"]').click();
  await page.fill('#tg-new', 'Slow negatives');
  await page.keyboard.press('Enter');
  await page.locator('.chip.sug', { hasText: 'Belt' }).click();
  await page.locator('[data-act="tg-lb"][data-v="Rope"]').click();
  await page.locator('[data-act="tg-close"]').click();
  await expect(card.locator('.tl-main .tc')).toHaveText(['KGCable stack', 'Slow negatives', 'Belt']);
  await expect.poll(() => item()?.tags).toEqual(['Slow negatives', 'Belt']);
});

test('a new machine starts fresh, with a word on what that means', async ({ page }) => {
  const { live, fake, tri, item } = await setup(page);
  const card = await add(page, live);
  await card.locator('.tl-main').click();
  await page.locator('[data-act="tg-add"][data-k="w"]').click();
  await expect(page.locator('#tg-new')).toBeFocused();
  /* names worth offering for a pushdown; the cable stack is already one of its machines */
  await expect(page.locator('.tg-addr .chip.sug')).toHaveText(['Dual pulley', 'Functional trainer']);
  await page.locator('.tg-addr .chip.sug', { hasText: 'Dual pulley' }).click();
  await expect(page.locator('#toast')).toContainText('Dual pulley: its own numbers start with today’s sets');
  await expect(page.locator('.tg-prev')).toContainText('First time on it');
  await expect(page.locator('.mtile.on')).toContainText('Dual pulley');
  await page.locator('[data-act="tg-close"]').click();
  await expect(card.locator('.sugg')).toHaveCount(0);
  await expect.poll(() => fake.exercises.find(e => e.id === tri.id).machines.map(m => m.name)).toEqual(['Cable stack', 'Hammer Strength', 'Dual pulley']);
  expect(item().mc).toBe(fake.exercises.find(e => e.id === tri.id).machines[2].id);
});

test('a set far from usual asks “Different machine today?”, and one tap moves it', async ({ page }) => {
  const { live, item } = await setup(page);
  const card = await add(page, live);
  const row = card.locator('.set').first();
  await row.locator('input[data-f="w"]').fill('40');
  await row.locator('input[data-f="r"]').fill('10');
  await row.locator('.chk').click();
  const ask = card.locator('.mca');
  await expect(ask).toContainText('Different machine today?');
  await expect(card.locator('.rir')).toHaveCount(0);
  /* no new 1RM while it might be another machine */
  await expect(page.locator('#toast')).not.toContainText('New 1RM');
  await ask.locator('[data-act="mca-pick"]', { hasText: 'Cable stack' }).click();
  await expect(page.locator('#toast')).toContainText('On Cable stack');
  await expect(card.locator('.mca')).toHaveCount(0);
  await expect(card.locator('.tl-main .tc.m')).toContainText('Cable stack');
  await expect.poll(() => item()?.mc).toBe('mA');
  /* asked once: another far-off set doesn't ask again */
  const r2 = card.locator('.set').nth(1);
  await r2.locator('input[data-f="w"]').fill('80');
  await r2.locator('input[data-f="r"]').fill('5');
  await r2.locator('.chk').click();
  await expect(card.locator('.mca')).toHaveCount(0);
});

test('intensity, records and the 1RM count each machine on its own', async ({ page }) => {
  const { live } = await setup(page);
  const card = await add(page, live);
  const row = card.locator('.set').first();
  await row.locator('input[data-f="w"]').fill('27.5');
  await row.locator('input[data-f="r"]').fill('12');
  await row.locator('.chk').click();
  /* against Hammer’s best (25×12), not the cable stack’s 40×10 */
  await expect(row.locator('.int')).toHaveText(/^1\d\d$/);
  await expect(row.locator('.set-pr')).toContainText('Weight PR');
  await expect(page.locator('#toast')).toContainText('New 1RM: 38.5 kg on Triceps Pushdown · Hammer Strength');
  await expect(card.locator('.mca')).toHaveCount(0);
});

test('a bodyweight exercise has labels only: no machine', async ({ page }) => {
  const pull = { id: crypto.randomUUID(), name: 'Pull-up', muscle: 'Back', kind: 'bw', machines: [A] };
  const { live, saved } = await setup(page, { extra: [pull] });
  const card = await add(page, live, 'Pull-up');
  await expect(card.locator('.tline.empty')).toContainText('Tag it: grip, paused, rings');
  await card.locator('.tline.empty').click();
  await expect(page.locator('.mtile')).toHaveCount(0);
  await expect(page.locator('.tg-prev')).toHaveCount(0);
  await page.locator('.chip.sug', { hasText: 'Wide grip' }).click();
  await page.locator('[data-act="tg-close"]').click();
  await expect(card.locator('.tl-main .tc')).toHaveText(['Wide grip']);
  await expect.poll(() => saved().items.find(i => i.exId === pull.id)?.tags).toEqual(['Wide grip']);
});

test('the exercise page: machine tiles to follow, labels to filter, older sessions put on a machine with Undo', async ({ page }) => {
  const { fake, tri } = await setup(page);
  await page.goto('/exercises/' + tri.id);
  const tiles = page.locator('.mc-card .mtile');
  await expect(tiles).toHaveCount(4);
  await expect(page.locator('.mc-card .mtile.on')).toContainText('Hammer Strength');
  await expect(page.locator('.orm-card .card-h .lbl')).toHaveText(/^1RM · Hammer Strength/);
  await tiles.filter({ hasText: 'Cable stack' }).click();
  await expect(page.locator('.recs .card-h .lbl').first()).toContainText('Records · Cable stack');
  await expect(page.locator('.kv .term').first()).toHaveText('6');
  /* labels filter the recent sets */
  await page.locator('.lb-f [data-act="ex-lb"]', { hasText: 'Rope' }).click();
  await expect(page.locator('.hist-s')).toHaveCount(2);
  await page.locator('.lb-f [data-act="ex-lb"]', { hasText: 'Rope' }).click();
  await expect(page.locator('.hist-s')).toHaveCount(6);
  /* the two from before machines */
  await expect(page.locator('.mc-ns')).toContainText('2 sessions from before you added machines');
  await page.locator('[data-act="mc-tag"]').click();
  await page.locator('#tg-list .su-r').first().click();
  await expect(page.locator('#tg-go')).toHaveText(/Put 2 sessions on Cable stack/);
  await page.locator('#tg-go').click();
  await expect(page.locator('.mc-ns')).toHaveCount(0);
  await expect.poll(() => fake.sessions.filter(s => s.items.some(i => i.id === 'o1' || i.id === 'o2')).map(s => s.items[0].mc)).toEqual(['mA', 'mA']);
  await page.locator('#toast .toast-act').click();
  await expect(page.locator('.mc-ns')).toBeVisible();
});

test('Edit tags renames a machine, moves a label to Machine, and removes a machine never used', async ({ page }) => {
  const { fake, tri } = await setup(page, { machines: [A, B, { id: 'mC', name: 'Spare', what: '', setup: '' }] });
  await page.goto('/exercises/' + tri.id);
  await page.locator('.mc-card [data-act="tags"]').click();
  await expect(page.locator('.tg-top .lbl')).toHaveText('Edit tags');
  const ren = page.locator('[data-ren="w"][data-id="mB"]');
  await ren.fill('Hammer');
  await ren.press('Enter');
  await expect.poll(() => fake.exercises.find(e => e.id === tri.id).machines.find(m => m.id === 'mB').name).toBe('Hammer');
  await expect(page.locator('.tg-ed', { has: page.locator('[data-id="mA"]') }).locator('.tg-n')).toHaveText('2 sessions');
  await page.locator('.tg-ed', { has: page.locator('[data-id="mC"]') }).locator('[data-act="tg-del"]').click();
  await expect.poll(() => fake.exercises.find(e => e.id === tri.id).machines.map(m => m.id)).toEqual(['mA', 'mB']);
  await page.locator('[data-act="tg-move"][data-k="l"][data-id="Rope"]').click();
  await expect(page.locator('#toast')).toContainText('Rope is now a machine');
  /* the Rope sessions were already on Hammer: they keep it, and lose the label */
  await expect.poll(() => fake.sessions.flatMap(s => s.items).filter(i => i.id === 'b1' || i.id === 'b2').map(i => [i.mc, i.tags ?? null])).toEqual([['mB', null], ['mB', null]]);
  expect(fake.exercises.find(e => e.id === tri.id).machines.map(m => m.name)).toEqual(['Cable stack', 'Hammer', 'Rope']);
});

test('each machine has its own 1RM: set one by hand and only that machine follows it', async ({ page }) => {
  const { fake, tri } = await setup(page);
  await page.goto('/exercises/' + tri.id);
  await expect(page.locator('.orm-card .bignum')).toContainText('35');
  await page.locator('.orm-card [data-act="edit-orm"]').click();
  await expect(page.locator('#sheet h3')).toHaveText('Triceps Pushdown · Hammer Strength 1RM');
  await page.fill('#orm-v', '40');
  await page.click('#orm-save');
  await expect(page.locator('.orm-card .bignum')).toContainText('40');
  await expect(page.locator('.orm-card')).toContainText('Set by you');
  await expect.poll(() => fake.exercises.find(e => e.id === tri.id).machines.find(m => m.id === 'mB').orm).toBe(40);
  await page.locator('.mc-card .mtile', { hasText: 'Cable stack' }).click();
  await expect(page.locator('.orm-card .bignum')).toContainText('53.5');
});
