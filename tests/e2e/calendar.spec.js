/* Calendar reminders: a split's training days as weekly events in the phone's calendar (an .ics file made on the
   device), each with a reminder and a link, /go/<split>/<day>, that opens that workout. */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { FakeSupabase, login } from './fake-supabase.js';

const X = (name, muscle) => ({ id: crypto.randomUUID(), name, muscle, kind: 'w' });
function data({ past = [], live = false } = {}) {
  const ex = ['Bench Press:Chest', 'Overhead Press:Shoulders', 'Barbell Row:Back', 'Lat Pulldown:Back', 'Back Squat:Quads'].map(s => X(...s.split(':')));
  const day = (type, list, extra = {}) => ({ id: crypto.randomUUID(), type, exercises: list.map(i => ({ id: crypto.randomUUID(), exId: ex[i].id, name: ex[i].name, muscle: ex[i].muscle, kind: 'w', sets: 3, reps: '8-12' })), ...extra });
  const sp = { id: crypto.randomUUID(), name: 'Push Pull Legs', days: [day('Push', [0, 1]), day('Pull', [2, 3]), day('Rest', [], { rest: true }), day('Legs', [4])] };
  const sessions = past.map((di, k) => { const t = Date.now() - (k + 2) * 864e5;
    return { id: crypto.randomUUID(), name: sp.days[di].type, started_at: new Date(t).toISOString(), ended_at: new Date(t + 3600e3).toISOString(), split_id: sp.id, split_day: di,
      items: [{ id: 'p' + k, exId: sp.days[di].exercises[0].exId, sets: [{ id: 'ps' + k, w: 50, r: 8, done: true }] }] }; });
  if (live) sessions.push({ id: 'live-1', name: 'Arms', started_at: new Date(Date.now() - 6e5).toISOString(), ended_at: null, items: [{ id: 'l1', exId: ex[0].id, sets: [{ id: 'l1s', w: null, r: null, done: false }] }] });
  return { sp, ex, d: { defaults: [], exercises: ex, splits: [sp], sessions } };
}
const download = async (page) => {
  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#cal-add').click()]);
  return { name: dl.suggestedFilename(), text: readFileSync(await dl.path(), 'utf8') };
};

test('a split’s Calendar sheet: training days lined up by name, a reminder, and a file the calendar adds', async ({ page }, info) => {
  const { sp, d } = data();
  await login(page, new FakeSupabase(d), 'A');
  await page.goto('/splits/' + sp.id);
  const btn = page.locator('[data-act="cal-split"]');
  await expect(btn).toBeVisible();
  /* a phone shows just the icon */
  await expect(btn.locator('.cal-l')).toBeVisible({ visible: info.project.name !== 'phone' });
  await btn.click();
  await expect(page.locator('#sheet h3')).toHaveText('Add to your calendar');
  /* three training days (the rest day isn't one): Monday, Wednesday and Friday, named in order */
  await expect(page.locator('.cal-days button.on')).toHaveCount(3);
  await expect(page.locator('.cal-wk > div')).toHaveText([/Mon\s*Push/, /Wed\s*Pull/, /Fri\s*Legs/]);
  await expect(page.locator('#cal-time')).toHaveValue('18:00');
  await expect(page.locator('#cal-add')).toHaveText(/Add 3 weekly events/);
  const { name, text } = await download(page);
  expect(name).toBe('push-pull-legs-synergym.ics');
  expect(text.match(/BEGIN:VEVENT/g)).toHaveLength(3);
  const unfolded = text.replace(/\r\n /g, '');
  expect(unfolded).toContain('SUMMARY:Push · Synergym');
  expect(unfolded).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO');
  expect(unfolded).toContain('RRULE:FREQ=WEEKLY;BYDAY=FR');
  expect(unfolded).toMatch(new RegExp(`URL:http://localhost:4173/go/${sp.id}/3\\r\\n`));
  expect(unfolded).toContain('TRIGGER:-PT30M');
  expect(unfolded).toContain('Bench Press\\, Overhead Press.');
  await expect(page.locator('#toast')).toContainText('Calendar file ready: open it to add 3 events');
});

test('days that don’t line up with the split say Training and open whatever is next; the choice is remembered', async ({ page }) => {
  const { sp, d } = data();
  await login(page, new FakeSupabase(d), 'A');
  await page.goto('/splits/' + sp.id);
  await page.locator('[data-act="cal-split"]').click();
  await page.locator('[data-cal-wd="3"]').click();
  await page.locator('[data-cal-al="60"]').click();
  await page.locator('#cal-time').fill('07:15');
  await page.locator('#cal-time').dispatchEvent('change');
  await expect(page.locator('.cal-wk > div')).toHaveText([/Mon\s*Training/, /Wed\s*Training/, /Thu\s*Training/, /Fri\s*Training/]);
  await expect(page.locator('#sheet')).toContainText('it rotates through the week');
  const { text } = await download(page);
  const u = text.replace(/\r\n /g, '');
  expect(u.match(/SUMMARY:Training · Synergym/g)).toHaveLength(4);
  expect(u).toMatch(new RegExp(`URL:http://localhost:4173/go/${sp.id}\\r\\n`));
  expect(u).toMatch(/DTSTART:\d{8}T071500/);
  expect(u).toContain('TRIGGER:-PT60M');
  /* opened again: the same days, time and reminder */
  await page.locator('[data-act="cal-split"]').click();
  await expect(page.locator('.cal-days button.on')).toHaveCount(4);
  await expect(page.locator('#cal-time')).toHaveValue('07:15');
  await expect(page.locator('[data-cal-al="60"]')).toHaveClass(/on/);
});

test('the event’s link opens that day’s workout, started', async ({ page }) => {
  const { sp, d } = data();
  const fake = new FakeSupabase(d);
  await login(page, fake, 'A');
  await page.goto(`/go/${sp.id}/1`);
  await expect(page).toHaveURL(/\/session\//);
  await expect(page.locator('.items .ex h3')).toHaveText(['Barbell Row', 'Lat Pulldown']);
  await expect(page.locator('#toast')).toContainText('Pull started from your calendar');
  await expect.poll(() => fake.sessions.find(s => !s.ended_at && s.split_id === sp.id)?.split_day).toBe(1);
});

test('a "whatever is next" link starts the day after the last one trained, skipping rest', async ({ page }) => {
  const { sp, d } = data({ past: [1] });
  await login(page, new FakeSupabase(d), 'A');
  await page.goto(`/go/${sp.id}`);
  await expect(page).toHaveURL(/\/session\//);
  await expect(page.locator('.items .ex h3')).toHaveText(['Back Squat']);
});

test('with a session already going, the link goes back to it instead of starting another', async ({ page }) => {
  const { sp, d } = data({ live: true });
  const fake = new FakeSupabase(d);
  await login(page, fake, 'A');
  await page.goto(`/go/${sp.id}/0`);
  await expect(page).toHaveURL(/\/session\/live-1$/);
  await expect(page.locator('#toast')).toContainText('Your session is still going');
  expect(fake.sessions.filter(s => !s.ended_at)).toHaveLength(1);
});

test('opened while signed out, the link waits for sign-in and then opens the workout', async ({ page }) => {
  const { sp, d } = data();
  const fake = new FakeSupabase(d);
  await fake.attach(page, 'A');
  await page.goto(`/go/${sp.id}/0`);
  await expect(page.locator('#f-auth')).toBeVisible();
  await page.fill('#f-auth [name=email]', fake.email);
  await page.fill('#f-auth [name=password]', fake.password);
  await page.click('#f-auth button[type=submit]');
  await expect(page).toHaveURL(/\/session\//, { timeout: 15000 });
  await expect(page.locator('.items .ex h3')).toHaveText(['Bench Press', 'Overhead Press']);
});

test('a link to a split that’s gone says so and stays on Home', async ({ page }) => {
  const { d } = data();
  await login(page, new FakeSupabase(d), 'A');
  await page.goto(`/go/${crypto.randomUUID()}/0`);
  await expect(page.locator('#toast')).toContainText('That split isn’t in your account any more');
  await expect(page).toHaveURL(/\/$/);
});
