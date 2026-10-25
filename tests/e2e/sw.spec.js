import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'allow' });

test('the app opens with no connection once it has been loaded', async ({ page, context }) => {
  await page.route(/\.supabase\.co\//, r => r.abort());
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.goto('/');
  await page.waitForSelector('#f-auth');
  await page.waitForFunction(async () => { const r = await navigator.serviceWorker.getRegistration(); return !!(r && r.active); }, null, { timeout: 15000 });
  /* the shell and its build files are cached */
  await expect.poll(() => page.evaluate(async () => (await caches.keys()).sort().join(',')), { timeout: 10000 }).toContain('sg-assets-v1');
  await expect.poll(() => page.evaluate(async () => (await (await caches.open('sg-assets-v1')).keys()).length), { timeout: 10000 }).toBeGreaterThanOrEqual(2);
  await context.setOffline(true);
  await page.reload();
  await page.waitForSelector('#f-auth', { timeout: 15000 });
  await page.goto('/history');
  await page.waitForSelector('#f-auth', { timeout: 15000 });
  await context.setOffline(false);
});
