/* The update popup: when a new version is published, a popup in the middle of the screen asks to update and the
   app waits behind it. It never interrupts a session in progress. */
import { test, expect } from '@playwright/test';
import { FakeSupabase, login, benchHistory } from './fake-supabase.js';

/* "publish" a new version: the page the app checks now loads another build, and version.json describes it */
async function publish(page, info = { version: '0.9.0-alpha', notes: ['Typos are caught', 'Edit on every finished session', 'The list stays above the keyboard'] }) {
  await page.route(u => u.pathname === '/', async r => {
    if (r.request().resourceType() !== 'fetch') return r.continue();
    const res = await r.fetch(), html = (await res.text()).replace(/\/assets\/index-[^"']+\.js/, '/assets/index-NEXTBUILD.js');
    return r.fulfill({ response: res, body: html });
  });
  await page.route('**/version.json', r => info ? r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(info) }) : r.fulfill({ status: 404, body: '' }));
}
const check = page => page.evaluate(() => dispatchEvent(new Event('focus')));
const live = data => { const s = { id: crypto.randomUUID(), name: 'Push', started_at: new Date(Date.now() - 6e5).toISOString(), ended_at: null,
  items: [{ id: 'L1', exId: data.exercises[0].id, sets: [{ id: 'q0', w: 80, r: 8, pw: 80, pr: 8, done: true }, { id: 'q1', w: null, r: null, pw: 80, pr: 8, done: false }] }] };
  data.sessions.unshift(s); return s; };

test('a new version shows the popup in the middle of the screen, with what’s new; it can’t be closed, only updated', async ({ page }) => {
  await publish(page);
  await login(page, new FakeSupabase(benchHistory()), 'A');
  await check(page);
  const pop = page.locator('#upd');
  await expect(pop).toBeVisible();
  await expect(pop).toHaveAttribute('role', 'alertdialog');
  await expect(pop.locator('h2')).toHaveText('Update ready');
  await expect(pop.locator('.upd-v')).toHaveText(/Version 0\.9\.0 · was \d+\.\d+\.\d+/);
  await expect(pop.locator('.upd-new li')).toHaveText(['Typos are caught', 'Edit on every finished session', 'The list stays above the keyboard']);
  /* in the middle */
  const b = await pop.locator('.upd-box').boundingBox(), vw = page.viewportSize();
  expect(Math.abs(b.x + b.width / 2 - vw.width / 2)).toBeLessThan(4);
  expect(Math.abs(b.y + b.height / 2 - vw.height / 2)).toBeLessThan(vw.height * 0.1);
  /* no way around it: Escape, Tab, and a tap beside it change nothing */
  await page.keyboard.press('Escape');
  await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement.id)).toBe('upd-go');
  await page.mouse.click(8, 8);
  await expect(pop).toBeVisible();
  /* nothing behind it is reachable */
  expect(await page.evaluate(() => { const r = document.querySelector('#nav').getBoundingClientRect(), el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!el.closest('#upd'); })).toBe(true);
  /* Update now reloads into the new version */
  await Promise.all([page.waitForEvent('framenavigated'), page.click('#upd-go')]);
});

test('a session in progress is never interrupted: the popup waits until it’s finished', async ({ page }) => {
  const data = benchHistory(), s = live(data);
  await publish(page);
  await login(page, new FakeSupabase(data), 'A');
  await page.goto('/session/' + s.id);
  await check(page);
  await page.waitForTimeout(6000);
  await expect(page.locator('#upd')).toHaveCount(0);
  /* even away from the session page, while it's still live */
  await page.goto('/'); await check(page); await page.waitForTimeout(5000);
  await expect(page.locator('#upd')).toHaveCount(0);
  /* finished: once its summary is closed, the popup comes */
  await page.goto('/session/' + s.id);
  await page.click('[data-act="finish"]');
  await expect(page.locator('#sheet h3')).toContainText('done');
  await page.waitForTimeout(1500);
  await expect(page.locator('#upd')).toHaveCount(0);
  await page.locator('#sheet [data-act="close"]').last().click();
  await expect(page.locator('#upd')).toBeVisible({ timeout: 8000 });
});

test('editing a past session isn’t interrupted either', async ({ page }) => {
  const data = benchHistory(), last = data.sessions[0];
  await publish(page);
  await login(page, new FakeSupabase(data), 'A');
  await page.goto('/session/' + last.id);
  await page.click('.s-edit');
  await expect(page.locator('[data-act="edit-save"]')).toBeVisible();
  await check(page); await page.waitForTimeout(5000);
  await expect(page.locator('#upd')).toHaveCount(0);
  await page.click('[data-act="edit-discard"]');
  await expect(page.locator('#upd')).toBeVisible({ timeout: 8000 });
});

test('without a connection, Update now waits for one', async ({ page, context }) => {
  await publish(page);
  await login(page, new FakeSupabase(benchHistory()), 'A');
  await check(page);
  await expect(page.locator('#upd')).toBeVisible();
  await context.setOffline(true);
  await expect(page.locator('#upd-go')).toBeDisabled();
  await expect(page.locator('#upd-go')).toHaveText('Waiting for connection…');
  await context.setOffline(false);
  await expect(page.locator('#upd-go')).toBeEnabled();
  await expect(page.locator('#upd-go')).toHaveText('Update now');
});

test('without version.json the popup still works, just without the version and the list', async ({ page }) => {
  await publish(page, null);
  await login(page, new FakeSupabase(benchHistory()), 'A');
  await check(page);
  await expect(page.locator('#upd')).toBeVisible();
  await expect(page.locator('#upd .upd-v')).toHaveCount(0);
  await expect(page.locator('#upd .upd-new')).toHaveCount(0);
  await expect(page.locator('#upd-go')).toBeEnabled();
});

test('no new version, no popup', async ({ page }) => {
  await login(page, new FakeSupabase(benchHistory()), 'A');
  await check(page); await page.waitForTimeout(3000);
  await expect(page.locator('#upd')).toHaveCount(0);
});
