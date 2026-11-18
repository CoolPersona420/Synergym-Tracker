/* What the app says should agree with itself, and work by keyboard and by finger: the Coach's call, the week's
   count, menus by keyboard, tap areas on a phone, and the Logbook's calendar on a small laptop. */
import { test, expect } from '@playwright/test';
import { FakeSupabase, login } from './fake-supabase.js';

const X = (name, muscle) => ({ id: crypto.randomUUID(), name, muscle, kind: 'w' });
/* 20 weeks of training 4 days a week with no break: a week off is due. The last session was two days ago. */
function noBreak() {
  const bench = X('Bench Press', 'Chest'), squat = X('Back Squat', 'Quads');
  const sessions = [];
  for (let d = 2, n = 0; d < 140; d++) {
    if (d % 7 === 3 || d % 7 === 6 || d % 7 === 0) continue;
    const t = Date.now() - d * 864e5, ex = n % 2 ? squat : bench;
    sessions.push({ id: crypto.randomUUID(), name: n % 2 ? 'Lower' : 'Upper', started_at: new Date(t).toISOString(), ended_at: new Date(t + 3600e3).toISOString(),
      items: [{ id: 'i' + n, exId: ex.id, sets: [0, 1, 2].map(k => ({ id: `s${n}${k}`, w: 60 + n * 0.25, r: 8, done: true })) }] });
    n++;
  }
  return { exercises: [bench, squat], sessions, defaults: [] };
}

test('when a week off is due, the Coach says so everywhere: no "Train" beside "Take a week off"', async ({ page }) => {
  await login(page, new FakeSupabase(noBreak()), 'A');
  const card = page.locator('[data-w="coach"]');
  await expect(card.locator('.co-call-t')).toHaveText('Week off');
  await expect(card).toContainText('A week off is due');
  await expect(card).toContainText('Take a week off');
  await expect(card).not.toContainText('nothing says you need a rest');
  await page.goto('/coach');
  await expect(page.locator('.co-hero .co-call-t')).toHaveText('Week off');
  await expect(page.locator('.co-hero')).toContainText('Make today a rest day');
});

test('"this week" is one count: Home’s This week and the Coach agree', async ({ page }) => {
  await login(page, new FakeSupabase(noBreak()), 'A');
  const n = await page.evaluate(() => {
    /* sessions since the start of this week (Monday by default) */
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime();
  });
  const fake = new FakeSupabase(noBreak()), expected = fake.sessions.filter(s => new Date(s.started_at).getTime() >= n).length;
  await expect(page.locator('[data-w="coach"] [data-k="week"]')).toContainText(`${expected} of 3`);
  await page.goto('/coach');
  await expect(page.locator('.co-hero')).toContainText(`${expected} of 3 this week`);
});

test('on a computer, an open menu keeps the keyboard and gives it back when it closes', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  const bench = X('Bench Press', 'Chest'), live = { id: crypto.randomUUID(), name: 'Push', started_at: new Date(Date.now() - 6e5).toISOString(), ended_at: null,
    items: [{ id: 'L1', exId: bench.id, sets: [{ id: 'q0', w: null, r: null, pw: 60, pr: 8, done: false }] }] };
  await login(page, new FakeSupabase({ exercises: [bench], sessions: [live], defaults: [] }), 'A');
  await page.goto('/session/' + live.id);
  const dots = page.locator('[data-act="item-menu"][data-item="L1"]');
  await dots.focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#sheet')).toBeVisible();
  for (let i = 0; i < 12; i++) { await page.keyboard.press(i % 4 === 3 ? 'Shift+Tab' : 'Tab'); expect(await page.evaluate(() => !!document.activeElement.closest('#sheet'))).toBe(true); }
  await page.keyboard.press('Escape');
  await expect(page.locator('#sheet')).toBeHidden();
  expect(await page.evaluate(() => document.activeElement.dataset.act)).toBe('item-menu');
});

test('on a phone, small controls take a fingertip: a tap just beside them still lands', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone');
  await login(page, new FakeSupabase(noBreak()), 'A');
  const near = async (sel, dx, dy) => page.evaluate(([sel, dx, dy]) => { const el = document.querySelector(sel); el.scrollIntoView({ block: 'center', behavior: 'instant' }); const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2 + dx, r.top + r.height / 2 + dy); return !!hit && (hit === el || el.contains(hit)); }, [sel, dx, dy]);
  /* Home's widget dots are 8px: 16px above one still picks it */
  await expect(page.locator('.dash-dots button').nth(1)).toBeVisible();
  expect(await near('.dash-dots button:nth-child(2)', 0, 16)).toBe(true);
  /* the date at the top opens today's summary from a little above or below it */
  expect(await near('.ts-open', 0, 15)).toBe(true);
  await page.goto('/settings');
  /* once the page has settled in */
  await expect(page.locator('.toggle').first()).toBeVisible(); await page.waitForTimeout(1200);
  expect(await near('.toggle', 0, 18)).toBe(true);
});

test('a small laptop’s Logbook calendar keeps compact days, so nothing is crushed', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  await login(page, new FakeSupabase(noBreak()), 'A');
  for (const [w, chips] of [[1024, false], [1440, true]]) {
    await page.setViewportSize({ width: w, height: 800 });
    await page.goto('/logbook');
    await expect(page.locator('.lb-grid')).toBeVisible();
    await expect(page.locator('.lb-day')).toBeVisible();
    if (chips) await expect(page.locator('.lb-ev').first()).toBeVisible();
    else expect(await page.locator('.lb-ev:visible').count()).toBe(0);
  }
});
