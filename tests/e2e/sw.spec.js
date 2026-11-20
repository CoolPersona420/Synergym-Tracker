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
  /* the page itself is kept last, once its files are (sw.js) */
  await expect.poll(() => page.evaluate(async () => (await (await caches.open('sg-shell-v1')).match('/')) ? 1 : 0), { timeout: 10000 }).toBe(1);
  await context.setOffline(true);
  await page.reload();
  await page.waitForSelector('#f-auth', { timeout: 15000 });
  await page.goto('/history');
  await page.waitForSelector('#f-auth', { timeout: 15000 });
  await context.setOffline(false);
});

/* a release's page can arrive a few seconds before its build files: the app keeps opening on the last good
   version until the new files are there, then switches */
test('a new release whose files are not there yet opens the last good version, then switches once they are', async ({ page, context }) => {
  await page.route(/\.supabase\.co\//, r => r.abort());
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.goto('/');
  await page.waitForSelector('#f-auth');
  await page.waitForFunction(async () => { const r = await navigator.serviceWorker.getRegistration(); return !!(r && r.active); }, null, { timeout: 15000 });
  await expect.poll(() => page.evaluate(async () => (await (await caches.open('sg-shell-v1')).match('/')) ? 1 : 0), { timeout: 10000 }).toBe(1);
  const old = await page.evaluate(() => document.querySelector('script[type="module"][src*="/assets/"]').getAttribute('src'));
  const real = await (await page.request.get(old)).body();
  /* the "release": the page now asks for index-NEXT.js, which isn't deployed yet */
  let deployed = false;
  await context.route(u => u.pathname === '/' || u.pathname === '/history', async r => {
    try { const res = await r.fetch(); const html = (await res.text()).replace(old, '/assets/index-NEXT.js'); await r.fulfill({ response: res, body: html }); } catch {}
  });
  await context.route('**/assets/index-NEXT.js', r => deployed ? r.fulfill({ status: 200, contentType: 'text/javascript', body: real }) : r.fulfill({ status: 404, body: 'not found' }));
  await page.reload();
  await page.waitForSelector('#f-auth', { timeout: 15000 });
  expect(await page.evaluate(() => document.querySelector('script[type="module"][src*="/assets/"]').getAttribute('src'))).toBe(old);
  /* the files arrive: the next open uses the new version */
  deployed = true;
  await expect.poll(async () => { await page.reload(); await page.waitForSelector('#f-auth', { timeout: 15000 });
    return page.evaluate(() => document.querySelector('script[type="module"][src*="/assets/"]').getAttribute('src')); }, { timeout: 30000, intervals: [500, 1000, 2000] }).toBe('/assets/index-NEXT.js');
  await context.unrouteAll({ behavior: 'ignoreErrors' });
});

test('without a service worker yet, a build file that fails to load is retried instead of leaving a blank page', async ({ page }) => {
  await page.route(/\.supabase\.co\//, r => r.abort());
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  let fails = 1;
  await page.route(/\/assets\/index-[^/]+\.js$/, r => fails-- > 0 ? r.fulfill({ status: 404, body: '' }) : r.continue());
  await page.goto('/');
  await page.waitForSelector('#f-auth', { timeout: 15000 });
  expect(await page.evaluate(() => sessionStorage.getItem('sg-retry'))).toBeNull();
});
