/* Cardio: a cardio exercise in any session (time always, and the metrics you choose), cardio days in a split,
   records, and a page per cardio exercise. */
import { test, expect } from '@playwright/test';
import crypto from 'node:crypto';
import { FakeSupabase, login, benchHistory } from './fake-supabase.js';

const day = n => new Date(Date.now() - n * 864e5).toISOString();
/* bench history plus two runs: 30:00 for 5 km, then 32:00 for 5.4 km */
function cardioHistory() {
  const h = benchHistory(), run = { id: crypto.randomUUID(), name: 'Run', muscle: 'Cardio', kind: 'c' };
  const bout = (n, t, d, e) => ({ id: crypto.randomUUID(), name: null, started_at: day(n), ended_at: day(n - 0.03), items: [{ id: 'r' + n, exId: run.id, m: ['d', 'e'], sets: [{ id: 'b' + n, t, d, e, done: true }] }] });
  return { ...h, run, exercises: [...h.exercises, run], sessions: [...h.sessions, bout(6, 1920, 5400, 7), bout(12, 1800, 5000, 6)] };
}
const sessRow = (fake, id) => fake.sessions.find(s => s.id === id);
async function emptySession(page) {
  await page.locator('[data-act="start-menu"]:visible').first().click();
  await page.locator('[data-st-foot]', { hasText: 'Empty session' }).click();
  await expect(page).toHaveURL(/\/session\//);
  return page.url().split('/').pop();
}
async function pickCardio(page, name) {
  await page.click('[data-act="add-ex"]');
  await page.click('#pkm [data-m="Cardio"]');
  await page.locator('#pkl .pk', { hasText: name }).first().click();
  await expect(page.locator('.ex.cx h3', { hasText: name })).toBeVisible();
}

test('a run in any session: time always, the metrics you track, pace worked out, effort, and records', async ({ page }) => {
  const data = cardioHistory(), fake = new FakeSupabase(data);
  await login(page, fake, 'A');
  const id = await emptySession(page);
  await pickCardio(page, 'Run');
  const card = page.locator('.ex.cx');
  /* last time's time is the hint, and last time's metrics are on */
  await expect(card.locator('[data-f="ct"]')).toHaveAttribute('placeholder', '32:00');
  await expect(card.locator('[data-k="d"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(card.locator('[data-k="hr"]')).toHaveAttribute('aria-pressed', 'false');
  await expect(card.locator('.sub')).toContainText('longest 32:00');
  await card.locator('[data-f="ct"]').fill('35');
  await card.locator('[data-f="cd"]').fill('6');
  await expect(card.locator('[data-pace]')).toHaveText('5:50 /km');
  await card.locator('.eff button').nth(7).click();
  await expect(card.locator('.eff-w')).toContainText('8 Hard');
  await card.locator('[data-k="hr"]').click();
  await card.locator('[data-f="chr"]').fill('152');
  /* a new record shows on the bout as you type */
  await expect(card.locator('.set-pr')).toContainText('Longest + Farthest + Fastest yet');
  await card.locator('[data-act="done"]').click();
  await expect(page.locator('#toast')).toContainText('run yet');
  await expect(page.locator('#strip')).toContainText('35 min cardio');
  await page.click('[data-act="finish"]');
  await expect.poll(() => sessRow(fake, id)?.ended_at).toBeTruthy();
  const it = sessRow(fake, id).items[0];
  expect(it.m).toEqual(['d', 'hr', 'e']);
  expect(it.sets[0]).toMatchObject({ t: 2100, d: 6000, hr: 152, e: 8, done: true });
});

test('turning a metric off clears what was typed in it', async ({ page }) => {
  const fake = new FakeSupabase(cardioHistory());
  await login(page, fake, 'A');
  const id = await emptySession(page);
  await pickCardio(page, 'Run');
  const card = page.locator('.ex.cx');
  await card.locator('[data-f="ct"]').fill('20');
  await card.locator('[data-f="cd"]').fill('3');
  await card.locator('[data-k="d"]').click();
  await expect(card.locator('[data-f="cd"]')).toHaveCount(0);
  await expect.poll(() => { const s = sessRow(fake, id); return s && s.items[0] && JSON.stringify([s.items[0].m, s.items[0].sets[0].d ?? null]); }).toBe(JSON.stringify([['e'], null]));
});

test('a built-in kind joins your library the first time you pick it, and a cardio session counts for the week', async ({ page }) => {
  const fake = new FakeSupabase(benchHistory());
  await login(page, fake, 'A');
  const id = await emptySession(page);
  await pickCardio(page, 'Row');
  await expect.poll(() => fake.exercises.find(e => e.name === 'Row')).toMatchObject({ kind: 'c', muscle: 'Cardio' });
  const card = page.locator('.ex.cx');
  await card.locator('[data-f="ct"]').fill('12:30');
  await card.locator('[data-f="cd"]').fill('3000');
  await expect(card.locator('[data-pace]')).toHaveText('2:05 /500m');
  await card.locator('[data-act="done"]').click();
  await page.click('[data-act="finish"]');
  await expect.poll(() => sessRow(fake, id)?.ended_at).toBeTruthy();
  await page.goto('/history');
  await expect(page.locator(`#hlist [data-id="${id}"]`).first()).toContainText('13 min cardio');
  await expect(page.locator(`#hlist [data-id="${id}"]`).first()).toContainText('Row');
});

test('a cardio day in a split: minutes planned, and starting it hints the time', async ({ page }) => {
  const data = cardioHistory(), run = data.run;
  data.splits = [{ id: crypto.randomUUID(), name: 'Run club', days: [{ id: 'c1', type: 'Cardio', exercises: [{ id: 'x1', exId: run.id, name: 'Run', muscle: 'Cardio', kind: 'c', sets: 1, reps: '', min: 40 }] }] }];
  const fake = new FakeSupabase(data);
  await login(page, fake, 'A');
  await page.goto('/splits/' + data.splits[0].id);
  await expect(page.locator('.day.cday')).toContainText('Cardio day · 40 min planned');
  await page.locator('[data-f="dmin"]').fill('45');
  await expect.poll(() => fake.splits[0].days[0].exercises[0].min).toBe(45);
  await page.click('[data-act="start-day"]');
  await expect(page).toHaveURL(/\/session\//);
  await expect(page.locator('.ex.cx [data-f="ct"]')).toHaveAttribute('placeholder', '45:00');
  /* ticking it takes the planned time */
  await page.locator('.ex.cx [data-act="done"]').click();
  await expect(page.locator('#strip')).toContainText('45 min cardio');
});

test('a cardio exercise has its own page: records, totals and recent bouts', async ({ page }) => {
  const data = cardioHistory(), fake = new FakeSupabase(data);
  await login(page, fake, 'A');
  await page.goto('/exercises/' + data.run.id);
  await expect(page.locator('h1')).toContainText('Run');
  const recs = page.locator('.recs');
  await expect(recs).toContainText('32:00');
  await expect(recs).toContainText('5.4 km');
  await expect(recs).toContainText('/km');
  await expect(page.locator('.kv')).toContainText('1 h 02');
  await expect(page.locator('.hist-s').first()).toContainText('32:00 · 5.4 km');
});

test('a new exercise can be cardio: no muscle group to pick', async ({ page }) => {
  const fake = new FakeSupabase(benchHistory());
  await login(page, fake, 'A');
  await page.goto('/exercises');
  await page.click('[data-act="new-ex"]');
  await page.fill('#ef-n', 'Assault bike');
  await page.click('#ef-k [data-k="c"]');
  await expect(page.locator('#ef-mw')).toBeHidden();
  await page.click('#ef-save');
  await expect.poll(() => fake.exercises.find(e => e.name === 'Assault bike')).toMatchObject({ kind: 'c', muscle: 'Cardio' });
});

test('a finished cardio session reads as logged: no metric chips, nothing to type into', async ({ page }) => {
  const data = cardioHistory(), fake = new FakeSupabase(data), runSess = data.sessions[2];
  await login(page, fake, 'A');
  await page.goto('/history');
  await page.locator(`[data-act="open"][data-id="${runSess.id}"]`).click();
  await expect(page.locator('.ex.cx [data-f="ct"]')).toHaveValue('32:00');
  await expect(page.locator('.ex.cx [data-f="ct"]')).toHaveAttribute('readonly', '');
  await expect(page.locator('.ex.cx .cx-m')).toHaveCount(0);
});
