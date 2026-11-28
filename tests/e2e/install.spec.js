/* The login page offers "Install the app": the browser's own install prompt when it has one, else two or three steps
   for this device. Installed (opened from the Home Screen), the button isn't there. */
import { test, expect } from '@playwright/test';
import { FakeSupabase } from './fake-supabase.js';

test('the login page shows Install the app, with the steps for this device', async ({ page }, info) => {
  await new FakeSupabase().attach(page, 'A');
  await page.goto('/');
  await expect(page.locator('#f-auth')).toBeVisible();
  const btn = page.locator('.auth-inst');
  await expect(btn).toHaveText('Install the app');
  await btn.click();
  if (info.project.name === 'phone') {
    await expect(page.locator('#sheet h3')).toHaveText('Add Synergym to your Home Screen');
    await expect(page.locator('.ins-steps li')).toHaveCount(3);
    await expect(page.locator('.ins-steps li').nth(1)).toContainText('Install app');
    await expect(page.locator('.ins-steps .ins-k')).toHaveText('⋮');
    await expect(page.locator('.ins-note')).toContainText('Already installed?');
  } else {
    await expect(page.locator('#sheet h3')).toHaveText('Install Synergym');
    await expect(page.locator('.ins-steps li').first()).toContainText('install icon');
  }
  await page.locator('#sheet-body .btn', { hasText: 'Got it' }).click();
  await expect(page.locator('#sheet')).toBeHidden();
});

test('when the browser offers its own install prompt, the button opens that instead', async ({ page }) => {
  await new FakeSupabase().attach(page, 'A');
  await page.goto('/');
  await expect(page.locator('.auth-inst')).toBeVisible();
  await page.evaluate(() => { const e = new Event('beforeinstallprompt'); e.prompt = () => { window.__prompted = true; }; e.userChoice = Promise.resolve({ outcome: 'accepted' }); dispatchEvent(e); });
  await page.locator('.auth-inst').click();
  await expect.poll(() => page.evaluate(() => window.__prompted === true)).toBe(true);
  await expect(page.locator('#toast')).toContainText('Synergym is on your home screen');
  await expect(page.locator('.ins-steps')).toHaveCount(0);
});

test('opened as the installed app, the login page has no install button', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'standalone', { get: () => true }));
  await new FakeSupabase().attach(page, 'A');
  await page.goto('/');
  await expect(page.locator('#f-auth')).toBeVisible();
  await expect(page.locator('.auth-inst')).toHaveCount(0);
});
