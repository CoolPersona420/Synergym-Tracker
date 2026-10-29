import { test, expect } from '@playwright/test';
import { FakeSupabase, login, benchHistory } from './fake-supabase.js';
/* Every screen and the common actions, on a phone and a computer: no script errors and no console errors. */
test('no errors on any screen or common action', async ({ page }, info) => {
  test.setTimeout(240000);
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_|favicon|net::/.test(m.text())) errs.push('console: ' + m.text()); });
  const h = benchHistory(); const ex = h.exercises[0];
  h.splits = [{ id: crypto.randomUUID(), name: 'PPL', days: [{ id: 'd1', type: 'Push', exercises: [{ id: 'e1', exId: ex.id, name: ex.name, muscle: 'Chest', kind: 'w', sets: 3, reps: '8-12' }] }, { id: 'd2', type: 'Rest', rest: true, exercises: [] }, { id: 'd3', type: 'Pull', exercises: [] }] }];
  const fake = new FakeSupabase({ ...h, profile: { lift_goals: [{ id: 'g', exId: ex.id, kg: 100, at: Date.now() - 864e5 * 20, from: 95 }] } });
  await login(page, fake, 'A');
  const routes = ['/', '/history', '/exercises', '/exercises/' + ex.id, '/splits', '/splits/' + h.splits[0].id, '/settings', '/guide', '/coach', '/coach/goals', '/coach/recovery', '/w/week', '/w/intensity', '/w/consistency', '/w/recent', '/w/bw', '/w/prs', '/session/' + h.sessions[0].id, '/nope', '/session/missing', '/exercises/missing'];
  for (const r of routes) { await page.goto(r); await page.waitForTimeout(500); }
  /* actions */
  await page.goto('/'); await page.locator('.ts-open').click(); await page.waitForTimeout(400); await page.keyboard.press('Escape');
  await page.goto('/history'); await page.locator('.search').fill('Push'); await page.locator('.search').fill(''); await page.click('[data-act="hf-toggle"]');
  await page.goto('/settings'); await page.click('[data-act="how"]'); await page.keyboard.press('Escape');
  await page.click('[data-act="d-week"][data-v="0"]'); await page.click('[data-act="d-theme"][data-t="ocean"]'); await page.click('[data-act="d-theme"][data-t="auto"]');
  await page.goto('/'); await page.evaluate(() => document.querySelector('[data-act="start-day"]')?.click()); await page.waitForTimeout(800);
  if (page.url().includes('/session/')) {
    await page.locator('#view [data-f="w"]').first().fill('82.5'); await page.locator('#view [data-f="r"]').first().fill('9');
    await page.locator('#view [data-act="done"]').first().click(); await page.waitForTimeout(400); await page.keyboard.press('Escape');
    await page.locator('#view [data-act="add-set"]').first().click();
  }
  await page.goto('/exercises'); await page.click('[data-act="lib-menu"]'); await page.keyboard.press('Escape');
  await page.goto('/splits/' + h.splits[0].id); await page.waitForTimeout(400);
  await page.goto('/w/bw'); await page.waitForTimeout(300);
  expect(errs, errs.join('\n')).toEqual([]);
});
