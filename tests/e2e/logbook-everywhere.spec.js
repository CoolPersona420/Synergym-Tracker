/* A session logged for a past day from the Logbook counts everywhere: Home's widgets, History, the exercise's page,
   and the coach. */
import { test, expect } from '@playwright/test';
import { FakeSupabase, login, benchHistory } from './fake-supabase.js';
import { openLogbook, pickDay } from './logbook.js';

const ago = n => Date.now() - n * 864e5;
test('a session logged for yesterday from the Logbook shows up on Home, in History and on the exercise', async ({ page }) => {
  const data = benchHistory(), ex = data.exercises[0], fake = new FakeSupabase(data);
  await login(page, fake, 'A');
  /* before: the week widget's count */
  const weekCount = () => page.locator('[data-w="week"]').innerText();
  const before = await weekCount();
  await openLogbook(page);
  await pickDay(page, ago(1));
  await page.click('[data-act="lb-log"]');
  await page.locator('#sheet button', { hasText: 'Empty session' }).click();
  await page.click('[data-act="add-ex"]');
  await page.locator(`[data-act="pk-pick"][data-id="${ex.id}"]`).click();
  await page.locator('#view [data-act="done"]').first().click();
  await page.click('[data-act="edit-save"]');
  await expect(page.locator('#toast')).toContainText('Logged for');
  await expect.poll(() => fake.sessions.length).toBe(3);
  const id = fake.sessions.find(x => !data.sessions.some(y => y.id === x.id)).id;
  await page.goto('/'); await page.waitForTimeout(1200);
  /* Home: the Consistency map fills yesterday, recent sessions lists it first, the week counts it when it falls in this week */
  const heat = await page.locator('[data-w="consistency"] .heat i[class*="l"]').count();
  expect(heat).toBeGreaterThanOrEqual(3);
  await expect(page.locator(`[data-w="recent"] [data-id="${id}"]`).first()).toBeVisible();
  const sameWeek = await page.evaluate(t => { const ws = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x.getTime(); }; return ws(t) === ws(Date.now()); }, ago(1));
  if (sameWeek) await expect.poll(weekCount).not.toBe(before);
  /* History lists it, newest first */
  await page.goto('/history');
  await expect(page.locator('#hlist [data-act="open"]').first()).toHaveAttribute('data-id', id);
  /* the exercise's page shows it */
  await page.goto('/exercises/' + ex.id);
  await expect(page.locator('#view')).toContainText(new Date(ago(1)).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' }).replace(/\//g, '.'));
  /* and the coach counts it: trained yesterday, and in this week's count */
  await page.goto('/coach');
  await expect(page.locator('.co-hero')).toContainText('yesterday');
});
