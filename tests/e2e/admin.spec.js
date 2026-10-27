/* Account approval and the admin console. */
import { test, expect } from '@playwright/test';
import { FakeSupabase, login, benchHistory } from './fake-supabase.js';

const day = n => new Date(Date.now() - n * 864e5).toISOString();
function admin(extra = {}) {
  return new FakeSupabase({ ...benchHistory(), access: { status: 'active', admin: true },
    others: [
      { email: 'new.lifter@example.com', username: 'newbie', display_name: 'Nina', status: 'pending', created_at: day(0) },
      { email: 'regular@example.com', username: 'regular', display_name: 'Rafa', status: 'active', created_at: day(20), sessions: 14, last_session_at: day(1) },
      { email: 'gone@example.com', username: 'gone', status: 'deactivated', created_at: day(40) }
    ], ...extra });
}

test('a new account waits for approval, then carries on to set-up once approved', async ({ page }) => {
  const fake = new FakeSupabase({ registered: false, access: { status: 'pending', admin: false } });
  await fake.attach(page, 'A');
  await page.goto('/');
  await page.click('[data-act="auth-mode"][data-m="signup"]');
  await page.fill('#f-auth [name=email]', 'wait@example.com');
  await page.fill('#f-auth [name=password]', 'Lift1234x');
  await page.fill('#f-auth [name=password2]', 'Lift1234x');
  await page.click('#f-auth button[type=submit]');
  await expect(page.locator('#view')).toContainText('waiting for approval', { timeout: 15000 });
  await expect(page.locator('#f-ob2')).toHaveCount(0);
  /* nothing was loaded or saved while waiting */
  expect(fake.calls.some(c => /\/rest\/v1\/(sessions|splits)/.test(c))).toBe(false);
  await page.click('[data-act="gate-check"]');
  await expect(page.locator('#toast')).toContainText('Still waiting');
  fake.access.status = 'active';
  await page.click('[data-act="gate-check"]');
  await page.waitForSelector('#f-ob2');
});

test('a deactivated account is stopped, and a blocked sign-in says why', async ({ page }) => {
  const fake = new FakeSupabase({ ...benchHistory(), access: { status: 'deactivated', admin: false } });
  await fake.attach(page, 'A');
  await page.goto('/');
  await page.fill('#f-auth [name=email]', fake.email); await page.fill('#f-auth [name=password]', fake.password);
  await page.click('#f-auth button[type=submit]');
  await expect(page.locator('#view')).toContainText('deactivated', { timeout: 15000 });
  await expect(page.locator('#nav')).toBeHidden();
  await page.click('[data-act="signout"]');
  await page.waitForSelector('#f-auth');
  fake.banned = true;
  await page.fill('#f-auth [name=email]', fake.email); await page.fill('#f-auth [name=password]', fake.password);
  await page.click('#f-auth button[type=submit]');
  await expect(page.locator('#f-auth .msg')).toContainText('deactivated by an admin');
});

test('people who aren’t admins have no way in', async ({ page }) => {
  const fake = new FakeSupabase(benchHistory());
  await login(page, fake, 'A');
  await page.goto('/settings');
  await expect(page.locator('[data-v="admin"]')).toHaveCount(0);
  await page.goto('/admin');
  await expect(page.locator('#view')).toContainText('This page doesn’t exist.');
  expect(fake.calls.some(c => c.includes('/rpc/admin_'))).toBe(false);
});

test('admin overview: accounts, activity and who is waiting', async ({ page }) => {
  const fake = admin();
  await login(page, fake, 'A');
  await page.goto('/settings');
  await page.locator('.srow[data-act="nav"][data-v="admin"]').click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.locator('.adm-kpi').first()).toContainText('4');
  await expect(page.locator('.adm-callout')).toContainText('1 account is waiting for approval');
  await expect(page.locator('.adm-chart')).toHaveCount(2);
  await expect(page.locator('.adm-tabs .adm-count')).toHaveText('1');
});

test('admin users: approve, deactivate, reactivate and delete, all logged', async ({ page }) => {
  const fake = admin();
  await login(page, fake, 'A');
  await page.goto('/admin');
  await page.locator('.adm-callout').click();
  /* the pending filter, with Approve on the row */
  const nina = page.locator('.adm-u', { hasText: 'Nina' });
  await expect(page.locator('.adm-u')).toHaveCount(1);
  await nina.locator('[data-adm="approve"]').click();
  await expect(page.locator('#toast')).toContainText('Approved');
  await expect.poll(() => fake.others[0].status).toBe('active');

  /* all accounts, search */
  await page.locator('[data-adm="filter"][data-f=""]').click();
  await expect(page.locator('.adm-u')).toHaveCount(4);
  await page.fill('[data-adm-in="q"]', 'rafa');
  await expect(page.locator('.adm-u')).toHaveCount(1);

  /* one account: deactivate, then reactivate */
  await page.locator('.adm-u', { hasText: 'Rafa' }).click();
  await expect(page.locator('#sheet-body h3')).toHaveText('Rafa');
  await expect(page.locator('.adm-facts')).toContainText('14');
  await page.locator('#sheet-body [data-adm-s="deactivate"]').click();
  await page.click('#cf-yes');
  await expect.poll(() => fake.others[1].status).toBe('deactivated');
  await page.locator('.adm-u', { hasText: 'Rafa' }).click();
  await page.locator('#sheet-body [data-adm-s="reactivate"]').click();
  await expect.poll(() => fake.others[1].status).toBe('active');

  /* delete needs the email typed */
  await page.fill('[data-adm-in="q"]', '');
  await page.locator('.adm-u', { hasText: 'gone@example.com' }).click();
  await page.locator('#sheet-body [data-adm-s="delete"]').click();
  await expect(page.locator('#adm-del-go')).toBeDisabled();
  await page.fill('#adm-del', 'gone@example.com');
  await page.click('#adm-del-go');
  await expect.poll(() => fake.others.length).toBe(2);

  /* the activity log has every action */
  await page.locator('.adm-tabs [data-t="log"]').click();
  await expect(page.locator('.adm-log')).toHaveCount(4);
  await expect(page.locator('.adm-log').first()).toContainText('Deleted');
});

test('admin can’t act on their own account or another admin', async ({ page }) => {
  const fake = admin();
  fake.others.push({ id: 'aaaaaaaa-0000-4000-8000-000000000001', email: 'co.admin@example.com', display_name: 'Cora', status: 'active', is_admin: true, created_at: day(5), sessions: 0, last_session_at: null, splits: 0 });
  await login(page, fake, 'A');
  await page.goto('/admin');
  await page.locator('.adm-tabs [data-t="users"]').click();
  await page.locator('.adm-u', { hasText: fake.email }).click();
  await expect(page.locator('#sheet-body')).toContainText('This is your account');
  await expect(page.locator('#sheet-body [data-adm-s]')).toHaveCount(0);
  await page.locator('#sheet-body [data-act="close"]').first().click();
  await page.locator('.adm-u', { hasText: 'Cora' }).click();
  await expect(page.locator('#sheet-body [data-adm-s]')).toHaveCount(1);
  await expect(page.locator('#sheet-body [data-adm-s="unadmin"]')).toBeVisible();
});

test('admin settings and errors: require approval, see and clear errors', async ({ page }) => {
  const fake = admin();
  fake.errors.push({ p_message: 'TypeError: x is undefined', p_path: '/', p_build: '0.0.7-alpha+abc' }, { p_message: 'TypeError: x is undefined', p_path: '/', p_build: '0.0.7-alpha+abc' });
  await login(page, fake, 'A');
  await page.goto('/admin');
  await page.locator('.adm-tabs [data-t="settings"]').click();
  const sw = page.locator('[data-adm="approval"]');
  await expect(sw).toHaveAttribute('aria-pressed', 'true');
  await sw.click();
  await expect.poll(() => fake.requireApproval).toBe(false);
  await expect(page.locator('[data-adm="approval"]')).toHaveAttribute('aria-pressed', 'false');
  await page.locator('.adm-tabs [data-t="errors"]').click();
  await expect(page.locator('.adm-err')).toHaveCount(1);
  await expect(page.locator('.adm-err')).toContainText('2 times');
  await page.locator('[data-adm="clear-errors"]').click();
  await page.click('#cf-yes');
  await expect(page.locator('.adm-body')).toContainText('No errors');
});
