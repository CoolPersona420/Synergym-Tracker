import { test, expect } from '@playwright/test';
import crypto from 'node:crypto';
import { FakeSupabase, login, benchHistory } from './fake-supabase.js';

/* every screen fits the phone it's on: nothing wider than the screen (which would make it zoom out), and no
   text box under 16px (which makes iPhones zoom in when it gets focus) */
const audit = () => {
  const W = innerWidth, over = [];
  const clipped = el => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) if (getComputedStyle(p).overflowX !== 'visible') return true; return false; };
  for (const el of document.querySelectorAll('body *')) { const r = el.getBoundingClientRect(); if (r.width && r.height && r.right > W + 1 && el.id !== 'toast' && !clipped(el)) over.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')}`); }
  const small = [...document.querySelectorAll('input:not([type=file]):not([type=checkbox]):not([type=range]),textarea,select')].filter(i => i.getBoundingClientRect().width && parseFloat(getComputedStyle(i).fontSize) < 16).map(i => i.dataset.f || i.name || i.className);
  return { scroll: document.documentElement.scrollWidth - W, over: over.slice(0, 5), small };
};
const clean = { scroll: 0, over: [], small: [] };

for (const [w, h] of [[320, 568], [390, 844], [844, 390]]) {
  test(`phone ${w}×${h}: every screen fits`, async ({ browser }, info) => {
    test.skip(info.project.name !== 'phone', 'phone sizes');
    test.setTimeout(180000);
    const opts = { viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
    const page = await (await browser.newContext(opts)).newPage();
    const hist = benchHistory();
    const fake = new FakeSupabase({ ...hist, splits: [{ id: crypto.randomUUID(), name: 'A split with a fairly long name', days: [{ id: 'd1', type: 'Push', exercises: [{ id: 'x1', exId: hist.exercises[0].id, name: 'Bench Press', muscle: 'Chest', kind: 'w', sets: 3, reps: '8-12' }] }] }] });
    await login(page, fake, 'A');
    const check = async name => { await page.waitForTimeout(500); expect(await page.evaluate(audit), name).toEqual(clean); };
    await check('home');
    for (const p of ['/splits', '/splits/' + fake.splits[0].id, '/exercises', '/history', '/settings', '/guide', '/w/week', '/w/bw', '/w/consistency']) { await page.goto(p); await check(p); }
    await page.goto('/'); await page.locator('[data-act="start-menu"]:visible').first().click(); await page.locator('[data-st-foot]', { hasText: 'Empty session' }).click();
    await page.waitForSelector('.s-top'); await page.click('[data-act="add-ex"]'); await page.locator('[data-act="pk-pick"]', { hasText: 'Bench Press' }).click();
    await check('session');
    await page.click('.ex [data-act="plates"]'); await check('plates');
    const p2 = await (await browser.newContext(opts)).newPage();
    const f2 = new FakeSupabase({ profile: { onboarded: false, username: null, display_name: null } });
    await f2.attach(p2, 'B'); await p2.goto('/'); await p2.waitForSelector('#f-auth');
    expect(await p2.evaluate(audit), 'login').toEqual(clean);
    await p2.fill('#f-auth [name=email]', f2.email); await p2.fill('#f-auth [name=password]', f2.password); await p2.click('#f-auth button[type=submit]');
    await p2.waitForSelector('#f-ob2', { timeout: 15000 }); await p2.waitForTimeout(3000);
    await p2.fill('#f-ob2 [name=name]', 'Al'); await p2.fill('#f-ob2 [name=username]', 'al_lifts'); await p2.click('#f-ob2 button[type=submit]');
    await p2.waitForTimeout(600); expect(await p2.evaluate(audit), 'onboarding body').toEqual(clean);
    await p2.click('[data-act="ob-pick"][data-k="exp"][data-v="beginner"]'); await p2.click('[data-act="ob-next"]');
    await p2.click('[data-act="ob-pick"][data-k="goal"][data-v="muscle"]'); await p2.click('[data-act="ob-next"]'); await p2.click('[data-act="ob-next"]');
    await p2.waitForTimeout(600); expect(await p2.evaluate(audit), 'onboarding theme').toEqual(clean);
  });
}

test('the installed phone app cannot be zoomed; a browser tab still can', async ({ browser }, info) => {
  test.skip(info.project.name !== 'phone', 'phone only');
  const { devices } = await import('@playwright/test');
  const tab = await (await browser.newContext(devices['Pixel 7'])).newPage();
  await tab.route(/\.supabase\.co\//, r => r.abort()); await tab.goto('/'); await tab.waitForSelector('#f-auth');
  expect(await tab.evaluate(() => [document.documentElement.classList.contains('app-mode'), document.querySelector('meta[name=viewport]').content])).toEqual([false, 'width=device-width,initial-scale=1,viewport-fit=cover']);
  const app = await (await browser.newContext(devices['Pixel 7'])).newPage();
  await app.addInitScript(() => Object.defineProperty(navigator, 'standalone', { get: () => true }));
  await app.route(/\.supabase\.co\//, r => r.abort()); await app.goto('/'); await app.waitForSelector('#f-auth');
  const r = await app.evaluate(() => ({ mode: document.documentElement.classList.contains('app-mode'), meta: document.querySelector('meta[name=viewport]').content, touch: getComputedStyle(document.documentElement).touchAction, pinch: (() => { const e = new Event('gesturestart', { cancelable: true }); document.dispatchEvent(e); return e.defaultPrevented; })() }));
  expect(r.mode).toBe(true);
  expect(r.meta).toContain('user-scalable=no'); expect(r.meta).toContain('maximum-scale=1');
  expect(r.touch).toBe('pan-x pan-y');
  expect(r.pinch).toBe(true);
});
