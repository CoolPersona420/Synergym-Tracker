/* GitHub issue #2 (the exercise list hidden under an iPhone keyboard) and #3 (a typo like 106 reps polluting the
   stats, with no visible way to edit a finished session). */
import { test, expect } from '@playwright/test';
import { FakeSupabase, login } from './fake-supabase.js';

const X = (name, muscle) => ({ id: crypto.randomUUID(), name, muscle, kind: 'w' });
const day = n => new Date(Date.now() - n * 864e5).toISOString();
const sets = (k, w, r) => [0, 1, 2].map(i => ({ id: `${k}${i}`, w, r, done: true }));
/* Bench Press: three sessions of 80 × 8 (the last one with 106 typed for set 2), and a live session */
function data({ typo = true, liveOnly = false } = {}) {
  const bench = X('Bench Press', 'Chest'), row = X('Barbell Row', 'Back'), squat = X('Back Squat', 'Quads'), curl = X('Barbell Curl', 'Biceps');
  const past = [10, 7, 3].map((n, j) => ({ id: crypto.randomUUID(), name: 'Push', started_at: day(n), ended_at: day(n - 0.04),
    items: [{ id: 'b' + n, exId: bench.id, sets: j === 2 && typo ? [{ id: 'x0', w: 80, r: 8, done: true }, { id: 'x1', w: 80, r: 106, done: true }, { id: 'x2', w: 80, r: 7, done: true }] : sets('b' + n, 80, 8) }] }));
  const live = { id: crypto.randomUUID(), name: 'Push', started_at: new Date(Date.now() - 6e5).toISOString(), ended_at: null,
    items: [{ id: 'L1', exId: bench.id, sets: [0, 1, 2].map(i => ({ id: 'q' + i, w: null, r: null, pw: 80, pr: 8, done: false })) }] };
  return { bench, past, live, d: { defaults: [], exercises: [bench, row, squat, curl], sessions: liveOnly ? [live, ...past] : [live, ...past] } };
}
const rowOf = (fake, id) => fake.sessions.find(s => s.id === id);

/* ---------- #2: the keyboard ---------- */
/* a stand-in for the phone's keyboard: the visible part of the screen shrinks, as iPhone reports it */
const FAKE_VV = () => {
  const vv = new EventTarget(); vv.height = innerHeight; vv.width = innerWidth; vv.offsetTop = 0; vv.offsetLeft = 0; vv.scale = 1; vv.pageTop = 0;
  window.visualViewport = vv; window.__kb = h => { vv.height = innerHeight - h; vv.dispatchEvent(new Event('resize')); };
};

test('#2: with the keyboard up, the exercise search and its list sit above it', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'phones only: a computer has no on-screen keyboard');
  await page.addInitScript(FAKE_VV);
  const { live, d } = data();
  await login(page, new FakeSupabase(d), 'A');
  await page.goto('/session/' + live.id);
  await page.click('[data-act="add-ex"]');
  await page.fill('#pkq', 'b');
  await expect(page.locator('#pkl [data-act="pk-pick"]').first()).toBeVisible();
  await page.evaluate(() => window.__kb(336));
  await expect(page.locator('html')).toHaveClass(/kb-open/);
  const vis = await page.evaluate(() => innerHeight - 336);
  /* the sheet ends where the keyboard starts, and its first matches are in view above it */
  await expect.poll(() => page.locator('#sheet .sp').evaluate(e => Math.round(e.getBoundingClientRect().bottom))).toBeLessThanOrEqual(vis + 1);
  const first = await page.locator('#pkl [data-act="pk-pick"]').first().boundingBox();
  expect(first.y + first.height).toBeLessThanOrEqual(vis);
  /* the search box is in view too */
  const q = await page.locator('#pkq').boundingBox();
  expect(q.y).toBeGreaterThanOrEqual(0);
  /* the list scrolls in what's left */
  expect(await page.locator('#sheet .sp').evaluate(e => getComputedStyle(e).overflowY)).toBe('auto');
  /* keyboard down: back as it was */
  await page.evaluate(() => window.__kb(0));
  await expect(page.locator('html')).not.toHaveClass(/kb-open/);
  await expect.poll(() => page.locator('#sheet .sp').evaluate(e => Math.round(innerHeight - e.getBoundingClientRect().bottom))).toBeLessThanOrEqual(1);
});

/* ---------- #3: typos ---------- */
test('#3: a past typo is flagged, left out of the stats, and fixed from the session; the record and coach come right', async ({ page }) => {
  const { bench, past, d } = data(), fake = new FakeSupabase(d), last = past[2];
  await login(page, fake, 'A');
  /* the exercise page: the estimate comes from 80 × 8, not 80 × 106, and the typo is listed */
  await page.goto('/exercises/' + bench.id);
  const card = page.locator('.sus-card');
  await expect(card).toContainText('1 set looks like a typo');
  await expect(card).toContainText('80 kg × 106');
  await expect(card).toContainText('your usual 8 reps');
  const orm = page.locator('#view .card', { hasText: 'Estimated 1RM' }).first();
  await expect(orm).not.toContainText('362');
  await expect(orm).toContainText('101');
  await expect(orm).not.toContainText('× 106');
  /* Fix it opens that session ready to edit, with the question on the set */
  await card.locator('[data-act="sus-open"]').click();
  await expect(page.locator('[data-act="edit-save"]')).toBeVisible();
  const q = page.locator('[data-sus="x1"]');
  await expect(q).toContainText('106 reps?');
  await expect(q).toContainText('You usually do 8');
  await q.locator('[data-act="sus-fix"]').click();
  await expect(page.locator('[data-f="r"][data-set="x1"]')).toHaveValue('10');
  await expect(page.locator('[data-sus="x1"]')).toBeHidden();
  await page.click('[data-act="edit-save"]');
  /* an edit of a past day asks how to save; update this one */
  const upd = page.locator('#sheet button', { hasText: /Update/ });
  if (await upd.count()) await upd.first().click();
  await expect.poll(() => rowOf(fake, last.id).items[0].sets[1].r).toBe(10);
  await page.goto('/exercises/' + bench.id);
  await expect(page.locator('.sus-card')).toHaveCount(0);
});

test('#3: a past typo opened from elsewhere says so, and Fix it starts editing', async ({ page }) => {
  const { past, d } = data();
  await login(page, new FakeSupabase(d), 'A');
  await page.goto('/session/' + past[2].id);
  const q = page.locator('[data-sus="x1"]');
  await expect(q).toContainText('Typo?');
  await expect(q).toContainText('106 reps is far more than your usual 8');
  /* no record is claimed for it */
  await expect(page.locator('[data-prb="x1"]')).toBeHidden();
  await q.locator('[data-act="sus-edit"]').click();
  await expect(page.locator('[data-act="edit-save"]')).toBeVisible();
  await expect(page.locator('[data-sus="x1"] [data-act="sus-keep"]')).toBeVisible();
});

test('#3: while logging, 106 reps asks before it counts; Make it 10 fixes it, with Undo', async ({ page }) => {
  const { live, d } = data({ typo: false }), fake = new FakeSupabase(d);
  await login(page, fake, 'A');
  await page.goto('/session/' + live.id);
  await page.fill('[data-f="r"][data-set="q0"]', '106');
  const q = page.locator('[data-sus="q0"]');
  await expect(q).toContainText('106 reps?');
  await expect(q).toContainText('You usually do 8');
  await expect(page.locator('.set[data-susk="r"]')).toHaveCount(1);
  /* it isn't a record, and the session's numbers leave it out */
  await expect(page.locator('[data-prb="q0"]')).toBeHidden();
  await expect(page.locator('[data-orm="L1"]')).not.toContainText('362');
  await q.locator('[data-act="sus-fix"]').click();
  await expect(page.locator('[data-f="r"][data-set="q0"]')).toHaveValue('10');
  await expect(page.locator('[data-sus="q0"]')).toBeHidden();
  await page.locator('#toast .toast-act').click();
  await expect(page.locator('[data-f="r"][data-set="q0"]')).toHaveValue('106');
  await expect(page.locator('[data-sus="q0"]')).toBeVisible();
});

test('#3: Keep says it was no typo: the set counts, is saved as kept, and is never asked about again', async ({ page }) => {
  const { live, d } = data({ typo: false }), fake = new FakeSupabase(d);
  await login(page, fake, 'A');
  await page.goto('/session/' + live.id);
  await page.fill('[data-f="r"][data-set="q0"]', '40');
  await page.fill('[data-f="w"][data-set="q0"]', '20');
  await expect(page.locator('[data-sus="q0"]')).toContainText('40 reps?');
  await page.locator('[data-sus="q0"] [data-act="sus-keep"]').click();
  await expect(page.locator('[data-sus="q0"]')).toBeHidden();
  await expect(page.locator('#toast')).toContainText('Kept as it is');
  await expect.poll(() => rowOf(fake, live.id).items[0].sets[0].ok).toBe(true);
  /* it now counts: 20 kg × 40 is a rep record at that weight */
  await expect(page.locator('[data-prb="q0"]')).toBeVisible();
  await page.reload();
  await expect(page.locator('[data-f="r"][data-set="q0"]')).toHaveValue('40');
  await expect(page.locator('[data-sus="q0"]')).toBeHidden();
});

test('#3: a weight typo (800 kg for 80) is caught too', async ({ page }) => {
  const { live, d } = data({ typo: false });
  await login(page, new FakeSupabase(d), 'A');
  await page.goto('/session/' + live.id);
  await page.fill('[data-f="w"][data-set="q0"]', '800');
  await page.fill('[data-f="r"][data-set="q0"]', '8');
  const q = page.locator('[data-sus="q0"]');
  await expect(q).toContainText('800 kg?');
  await expect(q).toContainText('Your heaviest is 80 kg');
  await expect(page.locator('.set[data-susk="w"]')).toHaveCount(1);
  await q.locator('[data-act="sus-fix"]').click();
  await expect(page.locator('[data-f="w"][data-set="q0"]')).toHaveValue('80');
  /* normal numbers are never asked about */
  await page.fill('[data-f="r"][data-set="q1"]', '9');
  await expect(page.locator('[data-sus="q1"]')).toBeHidden();
});

test('#3: the session’s own line under the exercise name leaves the typo out too', async ({ page }) => {
  const { past, d } = data();
  await login(page, new FakeSupabase(d), 'A');
  await page.goto('/session/' + past[2].id);
  await expect(page.locator('[data-sus="x1"]')).toBeVisible();
  await expect(page.locator('#view .ex-h .sub').first()).not.toContainText('362');
});
