/* Deleting a session: from its ⋯ menu anywhere, the Discard button of a live one, or a row in History or the
   Logbook (swiped left on a phone, the bin beside it on a computer). It always asks first. */
import { test, expect } from '@playwright/test';
import { FakeSupabase, login, benchHistory } from './fake-supabase.js';
import { openLogbook, pickDay } from './logbook.js';

const row = (fake, id) => fake.sessions.find(s => s.id === id);
const confirm = page => page.locator('#sheet #cf-yes');

test('a recorded session opened from History deletes from its ⋯ menu, after asking; Cancel keeps it', async ({ page }) => {
  const data = benchHistory(), fake = new FakeSupabase(data), last = data.sessions[0];
  await login(page, fake, 'A');
  await page.goto('/history');
  await page.locator(`[data-act="open"][data-id="${last.id}"]`).click();
  await page.click('[data-act="sess-menu"]');
  await page.locator('#sheet button', { hasText: 'Delete session' }).click();
  await expect(page.locator('#sheet h3')).toHaveText('Delete session?');
  await page.locator('#sheet button', { hasText: 'Cancel' }).click();
  await expect(page.locator('#sheet')).toBeHidden();
  expect(row(fake, last.id)).toBeTruthy();
  await page.click('[data-act="sess-menu"]');
  await page.locator('#sheet button', { hasText: 'Delete session' }).click();
  await confirm(page).click();
  await expect(page).toHaveURL(/\/history$/);
  await expect(page.locator('#toast')).toContainText('Session deleted');
  await expect(page.locator(`#hlist [data-id="${last.id}"]`)).toHaveCount(0);
  await expect.poll(() => row(fake, last.id)).toBeUndefined();
});

test('a live session has a Discard button that asks first', async ({ page }) => {
  const fake = new FakeSupabase(benchHistory());
  await login(page, fake, 'A');
  await page.locator('[data-act="start-menu"]:visible').first().click();
  await page.locator('[data-st-foot]', { hasText: 'Empty session' }).click();
  await expect(page).toHaveURL(/\/session\//);
  const id = page.url().split('/').pop();
  await expect.poll(() => row(fake, id)).toBeTruthy();
  await page.click('[data-act="sess-del"]');
  await expect(page.locator('#sheet h3')).toHaveText('Discard this session?');
  await confirm(page).click();
  await expect(page).not.toHaveURL(/\/session\//);
  await expect(page.locator('#toast')).toContainText('Session discarded');
  await expect.poll(() => row(fake, id)).toBeUndefined();
});

test('deleting the session a saved 1RM came from offers to go back to the estimate', async ({ page }) => {
  const data = benchHistory(), ex = data.exercises[0], last = data.sessions[0];
  Object.assign(ex, { one_rm: 101.5, one_rm_at: last.ended_at });
  const fake = new FakeSupabase(data);
  await login(page, fake, 'A');
  await page.goto('/history');
  await page.locator(`[data-act="open"][data-id="${last.id}"]`).click();
  await page.click('[data-act="sess-menu"]');
  await page.locator('#sheet button', { hasText: 'Delete session' }).click();
  await confirm(page).click();
  await expect(page.locator('#sheet h3')).toHaveText('Lower your 1RM?');
  await expect(page.locator('#sheet')).toContainText('session you just deleted');
  await page.click('#orm-apply');
  await expect.poll(() => fake.exercises.find(e => e.id === ex.id).one_rm).toBe(null);
});

test('on a computer, a History row shows a bin while hovered; it asks, then the row goes', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'hover is for a mouse');
  const data = benchHistory(), fake = new FakeSupabase(data), last = data.sessions[0];
  await login(page, fake, 'A');
  await page.goto('/history');
  const wrap = page.locator(`#hlist .rsw[data-sw="${last.id}"]`), bin = wrap.locator('.rsw-del');
  await expect(bin).toHaveCSS('opacity', '0');
  await wrap.hover();
  await expect(bin).toHaveCSS('opacity', '1');
  await bin.click();
  await expect(page.locator('#sheet h3')).toHaveText('Delete session?');
  await confirm(page).click();
  await expect(page).toHaveURL(/\/history$/);
  await expect(wrap).toHaveCount(0);
  await expect.poll(() => row(fake, last.id)).toBeUndefined();
});

/* a finger on a row: down, across in steps, up */
const swipeRow = (page, sel, dx) => page.evaluate(async ([sel, dx]) => {
  const el = document.querySelector(sel), b = el.getBoundingClientRect(), x0 = b.right - 40, y = b.top + b.height / 2;
  const t = x => new Touch({ identifier: 3, target: el, clientX: x, clientY: y, pageX: x, pageY: y });
  const fire = (type, x) => el.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: type === 'touchend' ? [] : [t(x)], changedTouches: [t(x)] }));
  fire('touchstart', x0);
  for (let i = 1; i <= 10; i++) { fire('touchmove', x0 + dx * i / 10); await new Promise(r => setTimeout(r, 16)); }
  fire('touchend', x0 + dx);
}, [sel, dx]);

test('on a phone, swiping a row left shows Delete; a short swipe springs back, and a tap elsewhere closes it', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'swiping is for a finger');
  const data = benchHistory(), fake = new FakeSupabase(data), [last, prev] = data.sessions;
  await login(page, fake, 'A');
  await page.goto('/history');
  await page.waitForFunction(() => !document.getElementById('splash') && !document.getElementById('qsplash'));
  const wrap = page.locator(`#hlist .rsw[data-sw="${last.id}"]`);
  await swipeRow(page, `#hlist .rsw[data-sw="${last.id}"] .row`, -30);
  await expect(wrap).not.toHaveClass(/sw-open/);
  await swipeRow(page, `#hlist .rsw[data-sw="${last.id}"] .row`, -140);
  await expect(wrap).toHaveClass(/sw-open/);
  await expect(page).toHaveURL(/\/history$/);
  await wrap.locator('.rsw-del').click();
  await expect(page.locator('#sheet h3')).toHaveText('Delete session?');
  await confirm(page).click();
  await expect(wrap).toHaveCount(0);
  await expect.poll(() => row(fake, last.id)).toBeUndefined();
  expect(row(fake, prev.id)).toBeTruthy();
});

test('a day in the Logbook deletes its session from the row, and stays on the Logbook', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'one run is enough');
  const data = benchHistory(), fake = new FakeSupabase(data), last = data.sessions[0];
  await login(page, fake, 'A');
  await openLogbook(page);
  await pickDay(page, Date.parse(last.started_at));
  const wrap = page.locator(`#lb-day .rsw[data-sw="${last.id}"]`);
  await wrap.hover();
  await wrap.locator('.rsw-del').click();
  await confirm(page).click();
  await expect(page).toHaveURL(/\/logbook$/);
  await expect(page.locator('#lb-day')).toContainText('Nothing logged on this day');
  await expect.poll(() => row(fake, last.id)).toBeUndefined();
});
