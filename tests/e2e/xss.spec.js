/* Security: an exercise, note or session name with HTML in it is shown as text and never runs, through the
   search highlighting and the reps-left screens. */
import { test, expect } from '@playwright/test';
import { FakeSupabase, login } from './fake-supabase.js';
const EVIL = '<img src=x onerror="window.__pwned=1">Bench';
test('names with HTML in them are shown as text, never run', async ({ page }) => {
  const ex = [{ id: crypto.randomUUID(), name: EVIL, muscle: 'Chest', kind: 'w', note: '<b onmouseover="window.__pwned=2">n</b>' }];
  const live = { id: crypto.randomUUID(), name: '<script>window.__pwned=3</script>', started_at: new Date(Date.now() - 6e5).toISOString(), ended_at: null,
    items: [{ id: 'L1', exId: ex[0].id, sets: [{ id: 'q0', w: 80, r: 8, done: false }, { id: 'q1', w: 80, r: 8, done: false }] }] };
  await login(page, new FakeSupabase({ defaults: [], exercises: ex, sessions: [live] }), 'A');
  await page.goto('/session/' + live.id);
  await page.click('[data-act="done"][data-set="q0"]');
  await page.locator('.rir [data-v="0"]').click();
  await page.click('[data-act="add-ex"]');
  for (const q of ['img', 'onerror', '<', '"', 'bench', '<img src=x onerror=window.__pwned=4>']) { await page.fill('#pkq', q); await page.waitForTimeout(150); }
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
  expect(await page.locator('#pkl img, .ex img, #pkl script').count()).toBe(0);
  await page.fill('#pkq', 'img');
  await expect(page.locator('#pkl .pk .n').first()).toContainText('<img src=x');
  await expect(page.locator('#pkl .pk .n mark').first()).toHaveText('img');
});
