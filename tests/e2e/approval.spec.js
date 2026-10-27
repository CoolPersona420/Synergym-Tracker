/* Account approval: pending and deactivated accounts. Approving them happens on the separate admin site. */
import { test, expect } from '@playwright/test';
import { FakeSupabase, login, benchHistory } from './fake-supabase.js';

test('a new account waits for approval, then carries on to set-up once approved', async ({ page }) => {
  const fake = new FakeSupabase({ registered: false, access: { status: 'pending' } });
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
  const fake = new FakeSupabase({ ...benchHistory(), access: { status: 'deactivated' } });
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

test('the app has no admin console, not even for admins (that lives on its own site)', async ({ page }) => {
  const fake = new FakeSupabase({ ...benchHistory(), access: { status: 'active', admin: true } });
  await login(page, fake, 'A');
  await page.goto('/settings');
  await expect(page.locator('[data-v="admin"]')).toHaveCount(0);
  /* an old /admin link just lands on Home */
  await page.goto('/admin');
  await page.waitForFunction(() => document.querySelector('#nav') && !document.querySelector('#nav').hidden);
  await expect(page.locator('#admin, .adm, .adm-tabs')).toHaveCount(0);
  expect(fake.calls.some(c => c.includes('/rpc/admin_'))).toBe(false);
});
