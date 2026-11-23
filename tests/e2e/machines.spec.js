/* Machines and setup: an exercise can list the machines it's done on, and each one is its own lift for hints,
   targets, intensity and records. Without machines the card keeps one setup note; the first machine takes it. */
import { test, expect } from '@playwright/test';
import { FakeSupabase, login } from './fake-supabase.js';

const day = n => new Date(Date.now() - n * 864e5).toISOString();
const sets = (k, w, r, n = 3) => Array.from({ length: n }, (_, i) => ({ id: `${k}${i}`, w, r, done: true }));
const past = (n, items) => ({ id: crypto.randomUUID(), name: 'Arms', started_at: day(n), ended_at: day(n - 0.04), items });
const A = { id: 'mA', name: 'Cable stack', what: 'pulley at the top', setup: 'straight bar' };
const B = { id: 'mB', name: 'Hammer Strength', what: 'plate-loaded', setup: 'seat 4, rope' };

/* Triceps Pushdown: two old sessions with no machine (40×10), two on A (40×10), then two on B (25×12, the latest);
   a live session with nothing in it yet */
async function setup(page, { machines = [A, B], note = null } = {}) {
  const tri = { id: crypto.randomUUID(), name: 'Triceps Pushdown', muscle: 'Triceps', kind: 'w', note, machines };
  const curl = { id: crypto.randomUUID(), name: 'Cable Curl', muscle: 'Biceps', kind: 'w' };
  const it = (k, w, r, mc) => ({ id: k, exId: tri.id, ...(mc ? { mc } : {}), sets: sets(k, w, r) });
  const old = machines.length ? [past(30, [it('o1', 40, 10)]), past(27, [it('o2', 40, 10)]), past(20, [it('a1', 40, 10, 'mA')]), past(17, [it('a2', 40, 10, 'mA')]), past(10, [it('b1', 25, 12, 'mB')]), past(6, [it('b2', 25, 12, 'mB')])]
    : [past(10, [it('o1', 40, 10)]), past(6, [it('o2', 40, 10)])];
  const live = { id: crypto.randomUUID(), name: 'Arms', started_at: new Date(Date.now() - 20 * 6e4).toISOString(), ended_at: null, items: [{ id: 'L0', exId: curl.id, sets: [{ id: 'c0', w: null, r: null, done: false }] }] };
  const fake = new FakeSupabase({ defaults: [], exercises: [tri, curl], sessions: [...old, live] });
  await login(page, fake, 'A');
  return { fake, tri, live, saved: () => fake.sessions.find(s => s.id === live.id) };
}
async function addTri(page, live) {
  await page.goto('/session/' + live.id);
  await page.locator('[data-act="add-ex"]').first().click();
  await page.locator('[data-act="pk-pick"]', { hasText: 'Triceps Pushdown' }).first().click();
  const card = page.locator('.ex', { has: page.locator('h3', { hasText: 'Triceps Pushdown' }) });
  await expect(card).toBeVisible();
  return card;
}

test('added to a session it goes on the machine used last, with that machine’s own last numbers', async ({ page }) => {
  const { live, saved } = await setup(page);
  const card = await addTri(page, live);
  await expect(card.locator('.su .su-l')).toHaveText('B');
  await expect(card.locator('.su')).toContainText('Hammer Strength · seat 4, rope');
  await expect(card.locator('.sugg .lbl').first()).toHaveText('Last on B');
  await expect(card.locator('.sugg')).toContainText('25×12');
  await expect(card.locator('input[data-f="w"]').first()).toHaveAttribute('placeholder', '25');
  await expect.poll(() => saved().items.find(i => i.exId !== live.items[0].exId)?.mc).toBe('mB');
});

test('Change picks another machine: hints, targets and the saved item follow it', async ({ page }) => {
  const { live, saved } = await setup(page);
  const card = await addTri(page, live);
  await card.locator('.su').click();
  await expect(page.locator('#sheet h3')).toHaveText('Triceps Pushdown setup');
  /* A, B and + Another; B (the latest) is picked, its setup in the fields */
  await expect(page.locator('.qs-ms .chip')).toHaveCount(3);
  await expect(page.locator('.qs-ms .chip.on')).toContainText('Hammer Strength');
  await expect(page.locator('#qs-name')).toHaveValue('Hammer Strength');
  await page.locator('.qs-ms .chip').first().click();
  await expect(page.locator('#qs-go')).toHaveText(/Use A/);
  await page.locator('#qs-go').click();
  await expect(page.locator('#toast')).toContainText('Triceps Pushdown on A · Cable stack');
  await expect(card.locator('.su .su-l')).toHaveText('A');
  await expect(card.locator('.sugg .lbl').first()).toHaveText('Last on A');
  await expect(card.locator('input[data-f="w"]').first()).toHaveAttribute('placeholder', '40');
  await expect.poll(() => saved().items.find(i => i.exId !== live.items[0].exId)?.mc).toBe('mA');
});

test('intensity, records and the 1RM count each machine on its own; a set that beats the 1RM raises it there and then', async ({ page }) => {
  const { live } = await setup(page);
  const card = await addTri(page, live);
  const row = card.locator('.set').first();
  await row.locator('input[data-f="w"]').fill('27.5');
  await row.locator('input[data-f="r"]').fill('12');
  await row.locator('.chk').click();
  /* against B's best (25×12), not A's 40×10, which would make it about 70 */
  await expect(row.locator('.int')).toHaveText(/^1\d\d$/);
  await expect(row.locator('.set-pr')).toContainText('Weight PR');
  await expect(page.locator('#toast')).toContainText('New 1RM: 38.5 kg on Triceps Pushdown · B');
});

test('setup is tapped in: the fields fit the exercise, and the card shows the line', async ({ page }) => {
  const smith = { id: crypto.randomUUID(), name: 'Smith Squat', muscle: 'Quads', kind: 'w' };
  const live = { id: crypto.randomUUID(), name: 'Legs', started_at: new Date(Date.now() - 6e5).toISOString(), ended_at: null, items: [{ id: 'S1', exId: smith.id, sets: [{ id: 's1', w: null, r: null, done: false }] }] };
  const fake = new FakeSupabase({ defaults: [], exercises: [smith], sessions: [live] });
  await login(page, fake, 'A');
  await page.goto('/session/' + live.id);
  const card = page.locator('article[data-item="S1"]');
  await expect(card.locator('.ex-note-add')).toHaveText('Add setup: hook, pins, stance');
  await card.locator('.ex-note-add').click();
  await expect(page.locator('#sheet h3')).toHaveText('Smith Squat setup');
  await expect(page.locator('.qf .mk-x')).toHaveText(['Bar hook', 'Safety pins']);
  const hook = page.locator('.qf[data-f="hook"]');
  await hook.locator('[data-step="1"]').click();
  await hook.locator('[data-step="1"]').click();
  await expect(hook.locator('input')).toHaveValue('2');
  await page.locator('.qf[data-f="pins"] input').fill('8');
  await page.locator('.qrow[data-f="stance"] [data-cv="Shoulder-width"]').click();
  await page.locator('#qs-addnote').click();
  await page.fill('#qs-note', 'knees out');
  await expect(page.locator('#qs-prev')).toHaveText('Hook 2 · Pins 8 · Shoulder-width stance · knees out');
  await page.locator('#qs-go').click();
  await expect(card.locator('.ex-note')).toContainText('Your setup · Hook 2 · Pins 8 · Shoulder-width stance · knees out');
  await expect.poll(() => fake.exercises[0].note).toBe('Hook 2 · Pins 8 · Shoulder-width stance · knees out');
  /* opened again, it reads back into the fields */
  await card.locator('.ex-note').click();
  await expect(page.locator('.qf[data-f="pins"] input')).toHaveValue('8');
  await expect(page.locator('.qrow[data-f="stance"] .chip.on')).toHaveText('Shoulder-width');
  await expect(page.locator('#qs-note')).toHaveValue('knees out');
});

test('the setup you had becomes machine A when you add another', async ({ page }) => {
  const { live, fake, tri, saved } = await setup(page, { machines: [], note: 'Seat 4 · Rope' });
  const card = await addTri(page, live);
  await expect(card.locator('.ex-note')).toContainText('Your setup · Seat 4 · Rope');
  await card.locator('.ex-note').click();
  await expect(page.locator('.qf[data-f="seat"] input')).toHaveValue('4');
  await expect(page.locator('.qrow[data-f="att"] .chip.on')).toHaveText('Rope');
  await page.locator('#qs-more').click();
  await expect(page.locator('#qs-name')).toBeFocused();
  await page.fill('#qs-name', 'Hammer');
  await expect(page.locator('.qs-ms .chip.on')).toContainText('Hammer');
  await expect(page.locator('#qs-prev')).toContainText('Nothing set yet');
  await page.locator('#qs-go').click();
  await expect(card.locator('.su .su-l')).toHaveText('B');
  await expect.poll(() => fake.exercises.find(e => e.id === tri.id).machines?.map(m => [m.name, m.setup])).toEqual([['Machine A', 'Rope · Seat 4'], ['Hammer', '']]);
  expect(fake.exercises.find(e => e.id === tri.id).note).toBeNull();
  const mc = fake.exercises.find(e => e.id === tri.id).machines[1].id;
  await expect.poll(() => saved().items.find(i => i.exId === tri.id)?.mc).toBe(mc);
});

test('the exercise page shows each machine; tap one to follow it; older sessions can be tagged all at once, with Undo', async ({ page }) => {
  const { fake, tri } = await setup(page);
  await page.goto('/exercises/' + tri.id);
  const rows = page.locator('.mc-card .mc-r');
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText('Cable stack');
  await expect(rows.nth(2)).toContainText('Not set');
  await expect(rows.nth(2)).toContainText('2 sessions before machines');
  /* it follows B, the latest: B's estimate, not A's heavier one */
  await expect(page.locator('.mc-r.on')).toContainText('Hammer Strength');
  await expect(page.locator('.orm-card .card-h .lbl')).toHaveText(/^1RM · B/);
  await expect(page.locator('.recs .card-h .lbl').first()).toContainText('Records · B');
  await rows.nth(0).click();
  await expect(page.locator('.mc-r.on')).toContainText('Cable stack');
  await expect(page.locator('.recs .card-h .lbl').first()).toContainText('Records · A');
  /* the whole exercise still adds up */
  await expect(page.locator('.kv .term').first()).toHaveText('6');
  await page.locator('[data-act="mc-tag"]').click();
  await expect(page.locator('#sheet h3')).toHaveText('Which machine were they on?');
  await page.locator('#tg-list .su-r').first().click();
  await page.locator('#tg-go').click();
  await expect(rows).toHaveCount(2);
  await expect.poll(() => fake.sessions.filter(s => s.items.some(i => i.id === 'o1' || i.id === 'o2')).map(s => s.items[0].mc)).toEqual(['mA', 'mA']);
  await page.locator('#toast [data-act], #toast button').filter({ hasText: 'Undo' }).click();
  await expect(rows).toHaveCount(3);
  await expect.poll(() => fake.sessions.filter(s => s.items.some(i => i.id === 'o1' || i.id === 'o2')).map(s => s.items[0].mc ?? null)).toEqual([null, null]);
});

test('a machine with sets logged on it stays; an unused one can be removed', async ({ page }) => {
  const { fake, tri } = await setup(page, { machines: [A, B, { id: 'mC', name: 'Spare', what: '', setup: '' }] });
  await page.goto('/exercises/' + tri.id);
  await page.locator('.mc-acts [data-act="ex-setup"]').click();
  await page.locator('.qs-ms .chip').first().click();
  await expect(page.locator('#qs-del')).toHaveCount(0);
  await page.locator('.qs-ms .chip', { hasText: 'Spare' }).click();
  await page.locator('#qs-del').click();
  await expect(page.locator('.qs-ms .chip')).toHaveCount(3);
  await page.locator('#qs-go').click();
  await expect.poll(() => fake.exercises.find(e => e.id === tri.id).machines.map(m => m.id)).toEqual(['mA', 'mB']);
});

test('each machine has its own 1RM: set one by hand on B and the page, and B only, follow it', async ({ page }) => {
  const { fake, tri } = await setup(page);
  await page.goto('/exercises/' + tri.id);
  await expect(page.locator('.orm-card .bignum')).toContainText('35');
  await expect(page.locator('.orm-card')).toContainText('Updates by itself');
  await page.locator('.orm-card [data-act="edit-orm"]').click();
  await expect(page.locator('#sheet h3')).toHaveText('Triceps Pushdown · B 1RM');
  await page.fill('#orm-v', '40');
  await page.click('#orm-save');
  await expect(page.locator('.orm-card .bignum')).toContainText('40');
  await expect(page.locator('.orm-card')).toContainText('Set by you');
  await expect.poll(() => fake.exercises.find(e => e.id === tri.id).machines.find(m => m.id === 'mB').orm).toBe(40);
  expect(fake.exercises.find(e => e.id === tri.id).one_rm ?? null).toBeNull();
  /* A keeps its own */
  await page.locator('.mc-card .mc-r').first().click();
  await expect(page.locator('.orm-card .card-h .lbl')).toHaveText(/^1RM · A/);
  await expect(page.locator('.orm-card .bignum')).toContainText('53.5');
});
