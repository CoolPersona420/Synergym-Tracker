/* Done for today, second sessions, and twice-a-day split days. */
import crypto from 'node:crypto';
import { test, expect } from '@playwright/test';
import { FakeSupabase, login } from './fake-supabase.js';

const bench = { id: crypto.randomUUID(), name: 'Bench Press', muscle: 'Chest', kind: 'w' };
const row = { id: crypto.randomUUID(), name: 'Barbell Row', muscle: 'Back', kind: 'w' };
const ex = (e, sets = 3) => ({ id: crypto.randomUUID().slice(0, 8), exId: e.id, name: e.name, muscle: e.muscle, kind: e.kind, sets, reps: '8' });
const day = (type, exs, more = {}) => ({ id: crypto.randomUUID().slice(0, 8), type, rest: false, exercises: exs, ...more });

/* a finished session earlier today (or `daysAgo` days back), logged against a split day */
function sessionOn(splitId, splitDay, daysAgo = 0) {
  const now = Date.now(), midnight = new Date().setHours(0, 0, 0, 0);
  const start = daysAgo ? now - daysAgo * 864e5 : now - Math.min(3600e3, (now - midnight) / 2);
  const end = start + (daysAgo ? 3600e3 : (now - start) / 2);
  return { id: crypto.randomUUID(), name: 'Push', started_at: new Date(start).toISOString(), ended_at: new Date(end).toISOString(), split_id: splitId, split_day: splitDay,
    items: [{ id: 'i1', exId: bench.id, sets: [1, 2, 3].map(k => ({ id: 's' + k, w: 80, r: 8, done: true })) }] };
}
function setup({ twice = false, daysAgo = 0, two = false } = {}) {
  const spId = crypto.randomUUID();
  const days = twice
    ? [day('Push', [ex(bench)]), day('Push', [ex(bench, 2)], { same: true }), day('Pull', [ex(row)]), day('Rest', [], { rest: true })]
    : [day('Push', [ex(bench)]), day('Pull', [ex(row)])];
  return new FakeSupabase({ exercises: [bench, row], splits: [{ id: spId, name: twice ? 'Twice a day' : 'Push Pull', days }], sessions: [sessionOn(spId, 0, daysAgo), ...(two ? [{ ...sessionOn(spId, 1, daysAgo), id: crypto.randomUUID(), name: 'Pull' }] : [])] });
}
const startButton = page => page.locator('#nav .nav-train');

test('after training today, Home shows it as completed with the next day waiting', async ({ page }) => {
  const fake = setup();
  await login(page, fake, 'A');
  const done = page.locator('.hero-cta .done-today');
  await expect(done).toBeVisible();
  await expect(done).toContainText('Completed today');
  await expect(done).toContainText('3 sets');
  await expect(done).toContainText('Pull, Day 2');
  await expect(page.locator('.hero-cta [data-act="rest-today"]')).toHaveCount(0);
});

test('starting again the same day asks first; Not now logs nothing', async ({ page }) => {
  const fake = setup();
  await login(page, fake, 'A');
  await startButton(page).click();
  await expect(page.locator('#sheet-body h3')).toHaveText('You’ve trained today');
  await expect(page.locator('#sheet-body')).toContainText('Start a 2nd session');
  await page.locator('#sheet-body .btns [data-act="close"]').click();
  await expect(page.locator('#sheet')).toBeHidden();
  await expect(page).toHaveURL(/\/$/);
  expect(fake.sessions).toHaveLength(1);

  /* confirming opens the day picker, with today's day marked as done */
  await startButton(page).click();
  await page.click('#sec-go');
  await expect(page.locator('#sheet-body h3')).toHaveText('Second session today');
  await expect(page.locator('.st-day.done')).toContainText('done today');
  await page.locator('.st-day', { hasText: 'Pull' }).click();
  await expect(page).toHaveURL(/\/session\//);
  await expect.poll(() => fake.sessions.length).toBe(2);
});

test('Second session on Home starts straight away, no question asked', async ({ page }) => {
  const fake = setup();
  await login(page, fake, 'A');
  await page.click('.hero-cta [data-act="second"]');
  await expect(page.locator('#sheet-body h3')).toHaveText('Second session today');
  await page.locator('#sheet-body [data-st-foot]', { hasText: 'Empty session' }).click();
  await expect(page).toHaveURL(/\/session\//);
  await expect.poll(() => fake.sessions.length).toBe(2);
});

test('a planned second session is up next on the same day and starts without asking', async ({ page }) => {
  const fake = setup({ twice: true });
  await login(page, fake, 'A');
  const cta = page.locator('.hero-cta');
  await expect(cta.locator('.what-pick').first()).toContainText('Day 1 · 2nd session');
  await expect(cta.locator('.dt-done')).toContainText('1st session done');
  await startButton(page).click();
  await expect(page.locator('#sheet-body h3')).toHaveText('Second session today');
  const planned = page.locator('.st-day.next');
  await expect(planned).toContainText('Day 1 · 2nd session');
  await planned.click();
  await expect(page).toHaveURL(/\/session\//);
  await expect.poll(() => fake.sessions.length).toBe(2);
  await expect.poll(() => fake.sessions.find(s => !s.ended_at)?.split_day).toBe(1);
});

test('a second session not done that day is skipped: the split moves on to the next day', async ({ page }) => {
  const fake = setup({ twice: true, daysAgo: 1 });
  await login(page, fake, 'A');
  const cta = page.locator('.hero-cta');
  await expect(cta.locator('.what-pick').first()).toContainText('Day 2');
  await expect(cta.locator('.what-pick').first()).toContainText('Pull');
  await expect(cta).not.toContainText('2nd session');
  /* not trained today, so starting doesn't ask */
  await startButton(page).click();
  await expect(page.locator('#sheet-body h3')).toHaveText('Start a session');
});

test('the split editor marks a day as a second session on the same day, and back', async ({ page }) => {
  const fake = setup({ twice: true, daysAgo: 1 });
  await login(page, fake, 'A');
  await page.goto('/splits/' + fake.splits[0].id);
  const cards = page.locator('.days > .day');
  await expect(cards.nth(1).locator('.day-n')).toHaveText('DAY 1 · 2ND SESSION');
  await expect(cards.nth(1)).toHaveClass(/second/);
  await expect(cards.nth(2).locator('.day-n')).toHaveText('DAY 2');
  await cards.nth(1).locator('[data-act="day-same"]').click();
  await expect(cards.nth(1).locator('.day-n')).toHaveText('DAY 2');
  await expect(cards.nth(2).locator('.day-n')).toHaveText('DAY 3');
  await expect.poll(() => fake.splits[0].days[1].same).toBe(false);
  await cards.nth(2).locator('[data-act="day-same"]').click();
  await expect(cards.nth(2).locator('.day-n')).toHaveText('DAY 2 · 2ND SESSION');
  await expect.poll(() => fake.splits[0].days[2].same).toBe(true);
  /* the first day and days after a rest day can't be a second session */
  await expect(cards.nth(0).locator('[data-act="day-same"]')).toHaveCount(0);
});

test('moving a second session to the top makes it its own day', async ({ page }) => {
  const fake = setup({ twice: true, daysAgo: 1 });
  await login(page, fake, 'A');
  await page.goto('/splits/' + fake.splits[0].id);
  const cards = page.locator('.days > .day');
  await cards.nth(1).locator('[data-act="day-move"][data-d="-1"]').click();
  await expect(cards.nth(0).locator('.day-n')).toHaveText('DAY 1');
  await expect(cards.nth(1).locator('.day-n')).toHaveText('DAY 2');
  await expect.poll(() => fake.splits[0].days.some(d => d.same)).toBe(false);
});

test('two sessions today: View sessions lists both, and a third can\'t start', async ({ page }) => {
  const fake = setup({ two: true });
  await login(page, fake, 'A');
  const cta = page.locator('.hero-cta');
  await expect(cta.locator('.done-today')).toContainText('2 sessions');
  await expect(cta.locator('.done-today')).toContainText('6 sets');
  await expect(cta.locator('.done-today b')).toHaveText(/^(Push \+ Pull|Pull \+ Push)$/);
  await expect(cta.locator('[data-act="second"]')).toHaveCount(0);
  await cta.locator('[data-act="today-sessions"]').click();
  await expect(page.locator('#sheet-body h3')).toHaveText('Today’s sessions');
  await expect(page.locator('#sheet-body .row')).toHaveCount(2);
  await page.locator('#sheet-body .row').filter({ has: page.locator('.t', { hasText: /^Pull$/ }) }).click();
  await expect(page).toHaveURL(/\/session\//);
  await expect(page.locator('#sheet')).toBeHidden();
  await page.goto('/');
  await startButton(page).click();
  await expect(page.locator('#sheet-body h3')).toHaveText('Done for today');
  await expect(page.locator('#sheet-body')).toContainText('the most for one day');
  await page.locator('#sheet-body .btns [data-act="close"]').click();
  expect(fake.sessions).toHaveLength(2);
});

test('a split day can\'t be a third session of the same day', async ({ page }) => {
  const fake = setup({ twice: true, daysAgo: 1 });
  await login(page, fake, 'A');
  await page.goto('/splits/' + fake.splits[0].id);
  const cards = page.locator('.days > .day');
  await expect(cards.nth(1).locator('.day-n')).toHaveText('DAY 1 · 2ND SESSION');
  await expect(cards.nth(2).locator('[data-act="day-same"]')).toHaveCount(0);
});
