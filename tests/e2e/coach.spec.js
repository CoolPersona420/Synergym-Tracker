/* The coach: today's call, targets for the next session, deloads, and lift goals. */
import { test, expect } from '@playwright/test';
import crypto from 'node:crypto';
import { FakeSupabase, login, benchHistory } from './fake-supabase.js';

const day = n => new Date(Date.now() - n * 864e5).toISOString();
const sets = (w, r, n = 3) => Array.from({ length: n }, (_, k) => ({ id: crypto.randomUUID().slice(0, 8) + k, w, r, done: true }));
const session = (n, items, extra = {}) => ({ id: crypto.randomUUID(), name: 'Session', started_at: day(n), ended_at: day(n - 0.04), items, ...extra });
/* a bench history and a split whose Push day asks for 8–12 reps */
function withSplit(extra = {}) {
  const h = benchHistory(), bench = h.exercises[0];
  const split = { id: crypto.randomUUID(), name: 'Push Pull', days: [{ id: 'd1', type: 'Push', exercises: [{ id: 'e1', exId: bench.id, name: 'Bench Press', muscle: 'Chest', kind: 'w', sets: 3, reps: '8-12' }] }, { id: 'd2', type: 'Pull', exercises: [] }] };
  return new FakeSupabase({ ...h, splits: [split], ...extra });
}

test('Home shows the coach; its page gives today’s call and targets inside the split’s rep range', async ({ page }) => {
  const fake = withSplit();
  await login(page, fake, 'A');
  const card = page.locator('[data-w="coach"]');
  await expect(card).toContainText('Train');
  await card.click();
  await expect(page).toHaveURL(/\/coach$/);
  await expect(page.locator('.co-hero')).toContainText('Train');
  /* the plan is the first tab */
  await expect(page.locator('.co-tabs [data-t="plan"]')).toHaveAttribute('aria-selected', 'true');
  /* last time 80×8 on every set, range 8–12: same weight, a rep more */
  const row = page.locator('.co-plan .row', { hasText: 'Bench Press' });
  await expect(row).toContainText('80 kg × 9');
  await expect(row).toContainText('3 sets');
  await expect(row).toContainText('one more rep');
  /* starting the day fills those targets in as hints */
  await page.locator('.co-hero [data-act="start-day"]').click();
  await page.waitForSelector('.s-top');
  await expect(page.locator('.ex .set input[data-f="w"]').first()).toHaveAttribute('placeholder', '80');
  await expect(page.locator('.ex .set input[data-f="r"]').first()).toHaveAttribute('placeholder', '9');
  await expect(page.locator('.ex .sugg')).toContainText('80×9');
});

test('after a run of training days the coach says rest, and one tap makes it a rest day', async ({ page }) => {
  const h = benchHistory(), ex = h.exercises[0];
  const run = [3, 2, 1].map(n => session(n, [{ id: 'i' + n, exId: ex.id, sets: sets(80, 8) }]));
  const fake = new FakeSupabase({ exercises: h.exercises, sessions: run });
  await login(page, fake, 'A');
  await page.goto('/coach');
  await expect(page.locator('.co-hero h2')).toHaveText('Rest day');
  await expect(page.locator('.co-hero')).toContainText('3 training days in a row');
  await page.locator('.co-hero [data-act="rest-today"]').click();
  await expect(page.locator('.co-hero')).toContainText('You marked today as a rest day');
  await expect.poll(() => (fake.profiles[0].rest_days || []).length).toBe(1);
});

test('when lifts stall the coach calls a deload, and session targets go lighter with fewer sets', async ({ page }) => {
  const h = benchHistory(), bench = h.exercises[0], squat = { id: crypto.randomUUID(), name: 'Back Squat', muscle: 'Quads', kind: 'w' };
  const flat = Array.from({ length: 9 }, (_, i) => session(41 - i * 5, [{ id: 'b' + i, exId: bench.id, sets: sets(80, 5) }, { id: 's' + i, exId: squat.id, sets: sets(100, 5) }]));
  const fake = new FakeSupabase({ exercises: [bench, squat], sessions: flat });
  await login(page, fake, 'A');
  await page.goto('/coach');
  /* the Recovery tab is flagged, and opens on a tap */
  await expect(page.locator('.co-tabs [data-t="recovery"] .co-dot')).toBeVisible();
  await page.locator('.co-tabs [data-t="recovery"]').click();
  await expect(page.locator('.co-rec .co-pill')).toHaveText('Deload now');
  await expect(page.locator('.co-rec')).toContainText('2 of your 2 main lifts have stalled');
  await expect(page.locator('.co-rec details')).toContainText('half your usual sets');
  await page.goto('/');
  await page.locator('[data-act="start-menu"]:visible').first().click();
  await page.click('[data-st-foot="0"]');
  await page.click('[data-act="add-ex"]');
  await page.locator('[data-act="pk-pick"]', { hasText: 'Bench Press' }).click();
  await expect(page.locator('.ex .sugg')).toContainText('deload');
  await expect(page.locator('.ex .sugg')).toContainText('72.5×5');
  /* and the session says why */
  await expect(page.locator('.co-band')).toContainText('Deload week');
});

test('a squat goal: realistic date, milestones and this week’s block, which then sets the session target', async ({ page }) => {
  const squat = { id: crypto.randomUUID(), name: 'Back Squat', muscle: 'Quads', kind: 'w' };
  const climb = Array.from({ length: 10 }, (_, i) => session(35 - i * 3.5, [{ id: 'q' + i, exId: squat.id, sets: sets(100 + i, 5) }]));
  const fake = new FakeSupabase({ exercises: [squat], sessions: climb, profile: { experience: 'intermediate' } });
  await login(page, fake, 'A');
  await page.goto('/exercises/' + squat.id);
  await page.locator('.co-exg [data-act="goal-new"]').click();
  await expect(page.locator('#gl-ex')).toHaveValue(squat.id);
  await page.fill('#gl-kg', '150');
  await expect(page.locator('#gl-pre')).toContainText('likely');
  /* a deadline four weeks out is called out as unrealistic */
  const soon = new Date(Date.now() + 28 * 864e5).toISOString().slice(0, 10);
  await page.fill('#gl-by', soon);
  await page.locator('#gl-by').dispatchEvent('change');
  await expect(page.locator('#gl-pre')).toContainText('isn’t realistic');
  await page.fill('#gl-by', '');
  await page.locator('#gl-by').dispatchEvent('change');
  await page.click('#gl-save');
  await expect(page.locator('#toast')).toContainText('Goal saved');
  await expect.poll(() => fake.profiles[0].lift_goals && fake.profiles[0].lift_goals[0].kg).toBe(150);
  await expect(page.locator('.co-exg')).toContainText('150');

  /* the exercise page shows next time's target from the goal's block */
  await expect(page.locator('.co-nx')).toContainText('× 6');
  await page.goto('/coach/goals');
  const g = page.locator('.co-goal');
  await expect(g).toContainText('150 kg');
  await expect(g.locator('.co-pill')).toHaveText('On track');
  await expect(g).toContainText('Likely');
  await expect(g.locator('.co-block')).toContainText('Build block · week 1 of 4');
  await expect(g.locator('.co-block')).toContainText('4 × 6 at');
  /* the rest folds away until asked for */
  await expect(g.locator('.co-ms')).toBeHidden();
  await g.locator('.co-more summary').click();
  await expect(g.locator('.co-ms')).toBeVisible();
  expect(await g.locator('.co-ms span:not(.lbl)').count()).toBeGreaterThanOrEqual(3);
  /* the block sets the squat's target in a session */
  await page.goto('/');
  await page.locator('[data-act="start-menu"]:visible').first().click();
  await page.click('[data-st-foot="0"]');
  await page.click('[data-act="add-ex"]');
  await page.locator('[data-act="pk-pick"]', { hasText: 'Back Squat' }).click();
  await expect(page.locator('.ex .sugg')).toContainText('goal block');
  await expect(page.locator('.ex .sugg')).toContainText('×6');
  await expect(page.locator('.co-band')).toContainText('follows your 150 kg plan');
  /* the goal survives a reload */
  await page.goto('/coach/goals');
  await page.reload();
  await expect(page.locator('.co-goal')).toContainText('150 kg');
});

test('reaching a goal: “I lifted it” saves the one-rep max and closes the goal', async ({ page }) => {
  const squat = { id: crypto.randomUUID(), name: 'Back Squat', muscle: 'Quads', kind: 'w' };
  const hist = [session(6, [{ id: 'a', exId: squat.id, sets: sets(120, 3) }]), session(2, [{ id: 'b', exId: squat.id, sets: sets(125, 3) }])];
  const fake = new FakeSupabase({ exercises: [squat], sessions: hist, profile: { lift_goals: [{ id: 'g1', exId: squat.id, kg: 130, at: Date.now() - 30 * 864e5, from: 120 }] } });
  await login(page, fake, 'A');
  await page.goto('/coach');
  await page.locator('.co-tabs [data-t="goals"]').click();
  await expect(page.locator('.co-tabs [data-t="goals"] .co-n')).toHaveText('1');
  await expect(page.locator('.co-goal .co-pill')).toHaveText('Ready to test');
  await page.locator('.co-goal [data-act="goal-menu"]').click();
  await page.locator('#sheet-body button', { hasText: 'I lifted it' }).click();
  await expect(page.locator('#toast')).toContainText('Goal reached');
  await expect(page.locator('.co-goal')).toHaveCount(0);
  await expect.poll(() => fake.exercises[0].one_rm).toBe(130);
  await expect.poll(() => fake.profiles[0].lift_goals).toBeNull();
});

test('the Coach page fits a phone screen without scrolling, one tab at a time', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'phone layout');
  const fake = withSplit();
  await login(page, fake, 'A');
  await page.locator('[data-w="coach"]').click();
  await page.waitForSelector('.co-hero');
  const fits = () => page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 2 || document.querySelector('.co-foot').getBoundingClientRect().top < innerHeight);
  expect(await fits()).toBe(true);
  for (const t of ['goals', 'recovery']) { await page.locator(`.co-tabs [data-t="${t}"]`).click(); expect(await fits(), t).toBe(true); }
});

test('the split shows the coach’s view of it, and a tip when reps have no range', async ({ page }) => {
  const h = benchHistory(), bench = h.exercises[0];
  const split = { id: crypto.randomUUID(), name: 'Fixed reps', days: [{ id: 'd1', type: 'Push', exercises: [{ id: 'e1', exId: bench.id, name: 'Bench Press', muscle: 'Chest', kind: 'w', sets: 3, reps: '8' }] }] };
  const fake = new FakeSupabase({ ...h, splits: [split] });
  await login(page, fake, 'A');
  await page.goto('/splits/' + split.id);
  /* one chest exercise and nothing else: worth a tweak */
  await expect(page.locator('.co-band')).toContainText('Worth a tweak');
  await expect(page.locator('.co-band')).toContainText('doesn\'t train back');
  await expect(page.locator('.co-tip')).toContainText('give reps a range');
  await page.locator('.co-band').click();
  await expect(page).toHaveURL(/\/coach\/recovery$/);
  await expect(page.locator('.co-split')).toBeVisible();
});

test('switching the coach off in Settings hides it everywhere, and on again brings the card back where it was', async ({ page }) => {
  const fake = withSplit();
  await login(page, fake, 'A');
  await expect(page.locator('[data-w="coach"]')).toBeVisible();
  await page.goto('/settings');
  const sw = page.locator('.toggle[data-act="coach-switch"]');
  await expect(sw).toHaveAttribute('aria-pressed', 'true');
  await sw.click();
  await expect(page.locator('#toast')).toContainText('Coach off');
  await expect.poll(() => fake.profiles[0].coach_on).toBe(false);
  await expect(page.locator('.toggle[data-act="coach-switch"]')).toHaveAttribute('aria-pressed', 'false');
  /* Home: no card; the today panel: no coach line */
  await page.goto('/');
  await expect(page.locator('[data-w="coach"]')).toHaveCount(0);
  await page.locator('.ts-open').click();
  await expect(page.locator('#tsheet .ts-coach')).toHaveCount(0);
  await page.locator('#tsheet .tsh-x').click();
  /* Edit home doesn't offer it, and reordering keeps it saved for later */
  await page.locator('[data-act="edit-home"]').click();
  await expect(page.locator('.wrow[data-id="coach"]')).toHaveCount(0);
  await page.locator('.wrow[data-id="intensity"] [data-wmv]').first().click();
  await expect.poll(() => (fake.profiles[0].widgets || []).join(',')).toMatch(/^coach/);
  await page.locator('#sheet-body [data-act="close"]').first().click();
  /* a session from the split: the plain rule (last 80×8 → 82.5×8), no coach note */
  await page.goto('/splits/' + fake.splits[0].id);
  await expect(page.locator('.co-band, .co-tip')).toHaveCount(0);
  await page.locator('[data-act="start-day"]').first().click();
  await page.waitForSelector('.s-top');
  await expect(page.locator('.ex .sugg')).toContainText('82.5×8');
  await expect(page.locator('.co-band')).toHaveCount(0);
  /* the Coach page says it's off and can switch it back on */
  await page.goto('/coach');
  await expect(page.locator('.co-offc')).toContainText('Coach is off');
  await page.locator('.co-offc [data-act="coach-switch"]').click();
  await expect.poll(() => fake.profiles[0].coach_on).toBe(true);
  await expect(page.locator('.co-hero')).toBeVisible();
  await page.goto('/');
  await expect(page.locator('#dash > [data-w]').first()).toHaveAttribute('data-w', 'coach');
});
