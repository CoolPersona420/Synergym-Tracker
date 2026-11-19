/* Instant start: an online account opens from the copy kept on the device, then refreshes from the server in the
   background. A failed refresh keeps the copy on screen; signing out deletes it. */
import { test, expect } from '@playwright/test';
import { FakeSupabase, login, benchHistory } from './fake-supabase.js';

const snapCount = page => page.evaluate(() => new Promise(res => { const r = indexedDB.open('sg-snap', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('snap');
  r.onsuccess = () => { const q = r.result.transaction('snap').objectStore('snap').count(); q.onsuccess = () => res(q.result); q.onerror = () => res(-1); }; r.onerror = () => res(-1); }));

test('the copy on the device opens the app even when the server can’t be reached, and says so', async ({ page }) => {
  const data = benchHistory(), fake = new FakeSupabase(data);
  await login(page, fake, 'A');
  await page.goto('/history');
  await expect(page.locator('#hlist .row').first()).toBeVisible();
  await expect.poll(() => snapCount(page)).toBe(1);
  /* the server goes away: the app still opens on the Logbook with every session */
  await page.route(/\/rest\/v1\/(sessions|exercises|splits|profiles)/, r => r.abort());
  await page.reload();
  await expect(page.locator('#hlist .row')).toHaveCount(data.sessions.length);
  /* after the database library's own retries */
  await expect(page.locator('#toast')).toContainText(/showing what’s saved on this phone/i, { timeout: 30000 });
  await expect(page.locator('text=Couldn’t load')).toHaveCount(0);
});

test('what the server has replaces the copy in the background', async ({ page }) => {
  const data = benchHistory(), fake = new FakeSupabase(data);
  await login(page, fake, 'A');
  await page.goto('/history');
  await expect(page.locator('#hlist .row')).toHaveCount(2);
  await expect.poll(() => snapCount(page)).toBe(1);
  /* another device renamed a session meanwhile */
  fake.sessions[0].name = 'Push from the other phone';
  await page.reload();
  await expect(page.locator('#hlist')).toContainText('Push from the other phone');
});

test('signing out deletes the copy', async ({ page }) => {
  const fake = new FakeSupabase(benchHistory());
  await login(page, fake, 'A');
  await expect.poll(() => snapCount(page)).toBe(1);
  await page.goto('/settings');
  await page.locator('[data-act="signout"]').click();
  await expect(page.locator('#f-auth')).toBeVisible();
  await expect.poll(() => snapCount(page)).toBe(0);
});
