/* This month: a Home card and full view comparing the month with the one before (stronger by best estimated 1RM,
   sessions and volume against the same days), offered once to people who chose their own Home cards. */
import { test, expect } from '@playwright/test';
import { FakeSupabase, login } from './fake-supabase.js';

const X = (name, muscle, kind = 'w') => ({ id: crypto.randomUUID(), name, muscle, kind });
const lastMonth = d => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth() - 1, d, 18).getTime(); };
const monthName = (back = 0) => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth() - back, 1).toLocaleDateString('en-GB', { month: 'long' }); };

/* last month: Bench 80×8 and Squat 100×5; this month (in the last few hours): Bench 85×8, Squat 100×5, and a
   Curl that has nothing to compare with. Bench is 6.25% up, Squat level: 3.1% stronger on average. */
function data(profile = {}) {
  const bench = X('Bench Press', 'Chest'), squat = X('Back Squat', 'Quads'), curl = X('Barbell Curl', 'Biceps'), row = X('Rowing', 'Cardio', 'c');
  const sess = (t, list) => ({ id: crypto.randomUUID(), name: 'Day', started_at: new Date(t).toISOString(), ended_at: new Date(t + 3600e3).toISOString(),
    items: list.map(([ex, w, r], k) => ({ id: crypto.randomUUID(), exId: ex.id, sets: [0, 1, 2].map(j => ex.kind === 'c' ? { id: `c${k}${j}`, t: 600, done: true } : { id: crypto.randomUUID(), w, r, done: true }) })) });
  const now = Date.now();
  const sessions = [
    sess(lastMonth(3), [[bench, 80, 8], [squat, 100, 5]]), sess(lastMonth(12), [[bench, 77.5, 8], [row]]),
    sess(now - 3 * 3600e3, [[bench, 85, 8], [row]]), sess(now - 2 * 3600e3, [[squat, 100, 5]]), sess(now - 3600e3, [[curl, 30, 10]])
  ];
  return { ex: { bench, squat, curl }, d: { defaults: [], exercises: [bench, squat, curl, row], sessions, profile } };
}

test('the full view says how much stronger, lift by lift, with sessions against the same days of last month', async ({ page }) => {
  const { d } = data();
  await login(page, new FakeSupabase(d), 'A');
  await page.goto('/w/month');
  await page.locator('.wf-opts [data-v="this"]').click();
  const was = monthName(1);
  await expect(page.locator('.mo-line')).toHaveText(`+3.1% stronger than in ${was}`);
  await expect(page.locator('.wf-kv')).toContainText('Sessions3');
  await expect(page.locator('.wf-sec')).toContainText(`Lifts against ${was} · est. 1RM kg`);
  const rows = page.locator('.wf-sec .wk-g');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText('Bench Press');
  await expect(rows.nth(0)).toContainText('+6.3%');
  await expect(rows.nth(1)).toContainText('Back Squat');
  await expect(rows.nth(1)).toContainText('+0%');
  await expect(page.locator('.wf-body')).not.toContainText('Barbell Curl');
  await expect(page.locator('.wf-body')).not.toContainText('Rowing');
  /* last month, looking back at the one before it: nothing to compare, so it counts sessions */
  await page.locator('.wf-opts [data-v="last"]').click();
  await expect(page.locator('.mo-hero')).toContainText(`${was} in review`);
  await expect(page.locator('.mo-line')).toHaveText(`2 sessions in ${was}`);
});

test('a typo is left out: 800 kg for 80 doesn’t make the month look stronger', async ({ page }) => {
  const { d, ex } = data();
  const t = Date.now() - 4 * 3600e3;
  d.sessions.push({ id: crypto.randomUUID(), name: 'Day', started_at: new Date(t).toISOString(), ended_at: new Date(t + 3600e3).toISOString(),
    items: [{ id: crypto.randomUUID(), exId: ex.bench.id, sets: [{ id: 'ty0', w: 85, r: 8, done: true }, { id: 'ty1', w: 850, r: 8, done: true }] }] });
  await login(page, new FakeSupabase(d), 'A');
  await page.goto('/w/month');
  await page.locator('.wf-opts [data-v="this"]').click();
  await expect(page.locator('.mo-line')).toHaveText(`+3.1% stronger than in ${monthName(1)}`);
});

test('the Home card is there by default and opens the full view', async ({ page }) => {
  const { d } = data();
  await login(page, new FakeSupabase(d), 'A');
  const card = page.locator('[data-w="month"]');
  await expect(card).toBeVisible();
  const early = new Date().getDate() <= 5;
  await expect(card).toContainText(early ? `${monthName(1)} in review` : `${monthName(0)} so far`);
  if (!early) await expect(card.locator('.mo-h')).toHaveText(`+3.1% stronger than in ${monthName(1)}`);
  await card.click();
  await expect(page).toHaveURL(/\/w\/month$/);
});

test('people who chose their own Home cards get it once, after This week; removed, it stays removed', async ({ page }) => {
  const { d } = data({ widgets: ['coach:m', 'week:m', 'recent:l'] });
  const fake = new FakeSupabase(d);
  await login(page, fake, 'A');
  await expect(page.locator('[data-w="month"]')).toBeVisible();
  await expect.poll(() => fake.profiles[0].widgets).toEqual(['coach:m', 'week:m', 'month:m', 'recent:l', '~month']);
  await page.locator('[data-act="edit-home"]').click();
  await page.locator('.wrow[data-id="month"] [data-wtg]').click();
  await expect.poll(() => fake.profiles[0].widgets).toEqual(['coach:m', 'week:m', 'recent:l', '~month']);
  await page.reload();
  await expect(page.locator('[data-w="week"]')).toBeVisible();
  await expect(page.locator('[data-w="month"]')).toHaveCount(0);
  expect(fake.profiles[0].widgets).toEqual(['coach:m', 'week:m', 'recent:l', '~month']);
});
