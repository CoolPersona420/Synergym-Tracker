import { test, expect } from '@playwright/test';
import { FakeSupabase, login, benchHistory } from './fake-supabase.js';
import { QUOTES } from '../../src/data/quotes.js';

const phoneOnly = info => test.skip(info.project.name !== 'phone', 'phone only');
const LONGEST = QUOTES.reduce((a, b) => b[0].length > a[0].length ? b : a)[0];

test('online onboarding: six steps, theme choice saved, then the tour', async ({ page }) => {
  const fake = new FakeSupabase({ profile: { onboarded: false, username: null, display_name: null } });
  await fake.attach(page, 'A');
  await page.goto('/');
  await page.fill('#f-auth [name=email]', fake.email); await page.fill('#f-auth [name=password]', fake.password);
  await page.click('#f-auth button[type=submit]');
  await page.waitForSelector('#f-ob2');
  await expect(page.locator('.ob-head .lbl')).toContainText('Step 2 of 6');
  await page.fill('#f-ob2 [name=name]', 'Robin'); await page.fill('#f-ob2 [name=username]', 'robin_lifts');
  await page.click('#f-ob2 button[type=submit]');
  await page.click('[data-act="ob-pick"][data-k="exp"][data-v="intermediate"]'); await page.click('[data-act="ob-next"]');
  await page.click('[data-act="ob-pick"][data-k="goal"][data-v="muscle"]'); await page.click('[data-act="ob-pick"][data-k="days"][data-v="4"]'); await page.click('[data-act="ob-next"]');
  await expect(page.locator('.opt.on')).toContainText('Upper / Lower');
  await page.click('[data-act="ob-next"]');
  await expect(page.locator('.ob-head .lbl')).toContainText('Step 6 of 6');
  await page.click('[data-act="ob-theme"][data-t="volt"]');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'volt');
  await page.click('[data-act="ob-finish"]');
  await expect(page.locator('.tour')).toBeVisible();
  await expect.poll(() => fake.profiles[0].theme).toBe('volt');
  expect(fake.profiles[0].onboarded).toBe(true);
  expect(fake.profiles[0].weekly_target).toBe(4);
  await page.locator('#sheet-body [data-act="close"]', { hasText: 'Skip' }).click();
});

test('the user guide opens from Settings and switches between phone and desktop', async ({ page }) => {
  const fake = new FakeSupabase(benchHistory());
  await login(page, fake, 'A');
  await page.goto('/settings');
  await page.locator('[data-act="nav"][data-v="guide"]').click();
  await expect(page).toHaveURL(/\/guide$/);
  await page.waitForSelector('.guide-sec');
  expect(await page.locator('.guide-sec').count()).toBeGreaterThanOrEqual(8);
  await page.click('[data-act="guide-dev"][data-v="desktop"]');
  await expect(page.locator('#g-around')).toContainText('sidebar');
  await page.click('[data-act="guide-dev"][data-v="phone"]');
  await expect(page.locator('#g-around')).toContainText('dock');
  await page.click('[data-act="guide-jump"][data-id="plates"]');
  await expect(page.locator('#g-plates')).toHaveAttribute('open', '');
  await page.click('[data-act="tour"]');
  await expect(page.locator('.tour')).toBeVisible();
});

test('phone: a compact icon dock with the session button beside it; on Settings the dock stretches into its place', async ({ page }, info) => {
  phoneOnly(info);
  const fake = new FakeSupabase(benchHistory());
  await login(page, fake, 'A');
  await page.waitForTimeout(700);
  const geo = () => page.evaluate(() => { const n = document.querySelector('#nav'), r = n.getBoundingClientRect(), f = n.querySelector('.nav-train .ring').getBoundingClientRect(), g = n.querySelector('.nav-glow').getBoundingClientRect(), on = n.querySelector('.nav-i.on').getBoundingClientRect();
    /* the pill is the dock's ::before and its right end (.nav-end), which slides out on Settings */
    const end = n.querySelector('.nav-end > i').getBoundingClientRect();
    return { left: r.left, right: innerWidth - r.right, dockRight: end.right, fabRight: f.right, radius: parseFloat(getComputedStyle(n, '::before').borderTopLeftRadius), bottom: innerHeight - r.bottom, fabLeft: f.left, fabMid: f.top + f.height / 2, mid: r.top + r.height / 2, glow: g.left + g.width / 2, onMid: on.left + on.width / 2, label: getComputedStyle(n.querySelector('.nav-i .roll')).width }; });
  const home = await geo();
  /* centred as a group, a pill, floating; the button sits just right of it, level with it; names hidden */
  expect(home.left).toBeGreaterThan(10); expect(home.radius).toBeGreaterThan(20); expect(home.bottom).toBeGreaterThanOrEqual(10);
  expect(home.fabLeft).toBeGreaterThan(home.dockRight); expect(Math.abs(home.fabMid - home.mid)).toBeLessThan(2);
  expect(Math.abs(home.glow - home.onMid)).toBeLessThan(2); expect(home.label).toBe('1px');
  await page.locator('.nav-train').evaluate(el => { el.dataset.mark = 'same'; });
  /* the tabs are the same buttons on every page, so they can glide apart */
  await page.locator('#nav [data-v="history"]').evaluate(el => { el.dataset.mark = 'kept'; });
  await page.click('#nav [data-act="nav"][data-v="prefs"]');
  const mid = await page.waitForFunction(() => { const o = +getComputedStyle(document.querySelector('.nav-train')).opacity; return o > 0 && o < 1 ? o : null; }, null, { timeout: 2000 }).then(h => h.jsonValue(), () => null);
  await page.waitForTimeout(1300);
  const after = await page.locator('.nav-train').evaluate(el => ({ mark: el.dataset.mark, op: getComputedStyle(el).opacity, vis: getComputedStyle(el).visibility }));
  expect(after.mark).toBe('same');
  expect(await page.locator('#nav [data-v="history"]').getAttribute('data-mark')).toBe('kept');
  expect(after.op).toBe('0'); expect(after.vis).toBe('hidden');
  expect(mid).not.toBeNull();
  /* on Settings the left edge stays and the right end takes the +'s place; the raised circle follows the tab */
  const prefs = await geo();
  expect(Math.abs(prefs.left - home.left)).toBeLessThan(1); expect(Math.abs(prefs.dockRight - home.fabRight)).toBeLessThan(1.5);
  expect(Math.abs(prefs.glow - prefs.onMid)).toBeLessThan(2);
  await page.click('#nav [data-act="nav"][data-v="today"]');
  await page.waitForTimeout(1100);
  expect(await page.locator('.nav-train').evaluate(el => getComputedStyle(el).opacity)).toBe('1');
  expect((await geo()).left).toBeGreaterThan(10);
});

test('phone: Home widgets are all the same size and fill down to the dock and its floating button', async ({ page }, info) => {
  phoneOnly(info);
  const fake = new FakeSupabase({ ...benchHistory(), profile: { widgets: ['week:s', 'intensity:l', 'recent:m', 'bw:s'] } });
  await login(page, fake, 'A');
  await page.waitForTimeout(800);
  const r = await page.evaluate(() => { const cards = [...document.querySelectorAll('#dash > .w')].map(c => ({ width: c.offsetWidth, height: c.offsetHeight })); const edit = document.querySelector('#view .home-edit').getBoundingClientRect(), nav = document.querySelector('#nav').getBoundingClientRect(); return { w: cards.map(c => Math.round(c.width)), h: cards.map(c => Math.round(c.height)), gap: Math.round(Math.min(nav.top, document.querySelector('#nav .nav-train').getBoundingClientRect().top) - edit.bottom) }; });
  expect(new Set(r.w).size).toBe(1);
  expect(new Set(r.h).size).toBe(1);
  expect(r.h[0]).toBeGreaterThanOrEqual(240);
  /* down to the new-session button floating above the dock, and not under it */
  expect(r.gap).toBeLessThan(60);
  expect(r.gap).toBeGreaterThanOrEqual(0);
});

test('quick splash on phones only', async ({ page }, info) => {
  await page.route(/\.supabase\.co\//, r => r.abort());
  await page.goto('/');
  if (info.project.name === 'phone') {
    await expect(page.locator('#qsplash')).toHaveCount(1);
    await expect(page.locator('#qsplash')).toHaveCount(0, { timeout: 4000 });
  } else {
    await page.waitForTimeout(400);
    await expect(page.locator('#qsplash')).toHaveCount(0);
  }
  await expect(page.locator('#f-auth')).toBeVisible();
});

test('Settings › About shows the version from package.json, marked as alpha', async ({ page }) => {
  const { readFileSync } = await import('node:fs');
  const { version } = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
  const fake = new FakeSupabase(benchHistory());
  await login(page, fake, 'A');
  await page.goto('/settings');
  const row = page.locator('.srow', { hasText: 'Version' });
  await expect(row.locator('.ver')).toContainText('v' + version.split('-')[0]);
  if (version.includes('alpha')) { await expect(row.locator('.badge')).toHaveText('alpha'); await expect(page.locator('.sg', { hasText: 'Source code on GitHub' })).toContainText('early alpha'); }
  await expect(row).toContainText('Build ');
});

test('widget sizes are offered on wider screens only', async ({ page }, info) => {
  const fake = new FakeSupabase(benchHistory());
  await login(page, fake, 'A');
  await page.click('[data-act="edit-home"]');
  await page.waitForSelector('.wrow');
  const phone = info.project.name === 'phone';
  await expect(page.locator('.wrow .wsz')).toHaveCount(phone ? 0 : 5);
  await page.keyboard.press('Escape');
  await page.goto('/w/week');
  await expect(page.locator('.wf-size')).toHaveCount(phone ? 0 : 1);
});

test('in the Ocean theme the phone dock is solid, not see-through', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'phone only');
  await login(page, new FakeSupabase({ ...benchHistory(), profile: { theme: 'ocean' } }), 'A');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'ocean');
  for (const part of ['::before', '.nav-end > i']) {
    const bg = await page.evaluate(part => { const c = part[0] === ':' ? getComputedStyle(document.querySelector('#nav'), part) : getComputedStyle(document.querySelector('#nav ' + part)); return { color: c.backgroundColor, image: c.backgroundImage }; }, part);
    expect(bg.color).toBe('rgb(5, 41, 76)');
    expect(bg.image).toContain('linear-gradient');
  }
});

test('every theme paints its page background on one fixed layer, so the safe areas and scroll bounce match it', async ({ page }) => {
  await login(page, new FakeSupabase(benchHistory()), 'A');
  const themes = ['light', 'dark', 'solarized-light', 'solarized-dark', 'gruvbox-light', 'gruvbox-dark', 'nord', 'dracula', 'ocean', 'sage', 'volt'];
  for (const t of themes) {
    const r = await page.evaluate(t => {
      document.documentElement.setAttribute('data-theme', t);
      const html = getComputedStyle(document.documentElement), layer = getComputedStyle(document.documentElement, '::after'), body = getComputedStyle(document.body);
      return { bodyColor: body.backgroundColor, bodyImage: body.backgroundImage, pos: layer.position, z: layer.zIndex, color: layer.backgroundColor, image: layer.backgroundImage, canvas: html.backgroundColor };
    }, t);
    expect(r.bodyColor, t).toBe('rgba(0, 0, 0, 0)');
    expect(r.bodyImage, t).toBe('none');
    expect(r.pos, t).toBe('fixed');
    expect(r.z, t).toBe('-1');
    expect(r.color, t).toBe(r.canvas);
    if (t === 'ocean') expect(r.image, t).toContain('linear-gradient'); else expect(r.image, t).toBe('none');
  }
});

test('phone: a compact greeting, so the first widget starts in the top 40% of the screen, and Edit home stays clear of the Start button', async ({ browser }, info) => {
  phoneOnly(info);
  for (const [width, height] of [[412, 915], [390, 844], [375, 667]]) {
    const page = await (await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })).newPage();
    await login(page, new FakeSupabase(benchHistory()), 'A');
    await page.waitForTimeout(900);
    /* measured with the longest quote, wherever the shuffle starts */
    await page.evaluate(t => { const b = document.querySelector('.hero .quote blockquote'); if (b) b.textContent = t; }, LONGEST);
    const m = await page.evaluate(() => {
      const r = el => el.getBoundingClientRect(), q = s => document.querySelector(s);
      const fab = [r(q('.nav-train')), ...(q('.nav-train .nl') ? [r(q('.nav-train .nl'))] : [])];
      return { font: parseFloat(getComputedStyle(q('.hero .display')).fontSize), top: r(q('#dash > .w')).top, vh: innerHeight, e: r(q('.home-edit .btn')).toJSON(), f: fab.map(x => x.toJSON()) };
    });
    const at = `${width}×${height}`;
    expect(m.font, at).toBeGreaterThanOrEqual(24); expect(m.font, at).toBeLessThan(34);
    expect(m.top / m.vh, at).toBeLessThan(0.4);
    for (const f of m.f) expect(m.e.right <= f.left || f.right <= m.e.left || m.e.bottom <= f.top || f.bottom <= m.e.top, at).toBe(true);
    await page.context().close();
  }
});

test('Ocean: a widget opened full screen and the today panel show the page’s gradient, not a flat block', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem('sg-theme', 'ocean'); } catch {} });
  await login(page, new FakeSupabase({ ...benchHistory(), profile: { theme: 'ocean' } }), 'A');
  await page.goto('/w/week');
  await expect(page.locator('.wfull')).toBeVisible();
  expect(await page.locator('.wfull').evaluate(e => { const c = getComputedStyle(e); return [c.backgroundColor, c.backgroundImage]; })).toEqual(['rgba(0, 0, 0, 0)', 'none']);
  await page.goto('/');
  await page.locator('.ts-open').click();
  expect(await page.locator('.tsh-panel').evaluate(e => getComputedStyle(e).backgroundImage)).toContain('linear-gradient');
});

test('tapping the Home quote deals another: each quote once before any repeats, with its own author, by key too', async ({ page }, info) => {
  await login(page, new FakeSupabase({ ...benchHistory(), profile: { widgets: ['week:s', 'intensity:l', 'recent:m', 'bw:s'] } }), 'A');
  const q = page.locator('.hero .quote'), by = new Map(QUOTES), phone = info.project.name === 'phone';
  await expect(q).toBeVisible();
  await expect(q).toHaveAttribute('role', 'button');
  const now = async () => [await q.locator('blockquote').textContent(), await q.locator('.q-a').textContent()];
  /* on phones the widgets refit as the quote changes height: Edit home stays just above the + button */
  const gap = () => page.evaluate(() => { const e = document.querySelector('#view .home-edit').getBoundingClientRect(), n = document.querySelector('#nav'); return Math.round(Math.min(n.getBoundingClientRect().top, n.querySelector('.nav-train').getBoundingClientRect().top) - e.bottom); });
  const seen = [await now()];
  for (let i = 1; i < QUOTES.length; i++) {
    await q.click();
    await expect.poll(async () => (await now())[0]).not.toBe(seen[i - 1][0]);
    seen.push(await now());
    if (phone) { await page.waitForTimeout(350); const g = await gap(); expect(g, seen[i][0]).toBeGreaterThanOrEqual(0); expect(g, seen[i][0]).toBeLessThan(60); }
  }
  expect(new Set(seen.map(s => s[0])).size).toBe(QUOTES.length);
  for (const [t, a] of seen) expect(a, t).toBe(by.get(t));
  /* round two starts with a different quote from the last one shown */
  await q.focus(); await page.keyboard.press('Enter');
  await expect.poll(async () => (await now())[0]).not.toBe(seen.at(-1)[0]);
  /* the quote stays put while the page redraws */
  const kept = (await now())[0];
  await page.click('[data-act="rest-today"]');
  await expect(page.locator('[data-act="rest-undo"]')).toBeVisible();
  expect((await now())[0]).toBe(kept);
});

test('switching theme updates the dock at once: the dark marker follows the theme just chosen', async ({ page }, info) => {
  phoneOnly(info);
  await login(page, new FakeSupabase(benchHistory()), 'A');
  await page.goto('/settings'); await page.waitForTimeout(600);
  const dark = () => page.evaluate(() => document.documentElement.classList.contains('is-dark'));
  await page.click('[data-act="d-theme"][data-t="volt"]'); await expect.poll(dark).toBe(true);
  await page.click('[data-act="d-theme"][data-t="light"]'); await expect.poll(dark).toBe(false);
  await page.click('[data-act="d-theme"][data-t="nord"]'); await expect.poll(dark).toBe(true);
});

test('phone: the + minimizes before the dock stretches; back, the dock shrinks before the + returns', async ({ page }, info) => {
  phoneOnly(info);
  await login(page, new FakeSupabase(benchHistory()), 'A');
  await page.waitForTimeout(800);
  /* sample the + (scale) and the pill's end (its room for the +) every frame across the switch, and what is
     animating: everything that moves goes by transform, which phones run smoothly even when the page is busy */
  const sample = () => page.evaluate(async () => {
    const n = document.querySelector('#nav'), f = n.querySelector('.nav-train'), end = n.querySelector('.nav-end > i'), out = [], t0 = performance.now(), props = new Set();
    await new Promise(r => { const step = () => {
      const m = new DOMMatrix(getComputedStyle(f).transform);
      out.push({ t: performance.now() - t0, s: Math.hypot(m.a, m.b), pr: n.getBoundingClientRect().right - end.getBoundingClientRect().right });
      for (const a of n.getAnimations({ subtree: true })) props.add(a.transitionProperty || a.animationName);
      if (performance.now() - t0 < 1500) requestAnimationFrame(step); else r(); }; requestAnimationFrame(step); });
    return { out, props: [...props] };
  });
  const going = page.evaluate(() => new Promise(r => setTimeout(r, 30))).then(() => page.click('#nav [data-v="prefs"]'));
  const { out, props } = await sample(); await going;
  expect(props.length).toBeGreaterThan(0);
  for (const p of props) expect(['transform', 'translate', 'opacity', 'visibility', 'color', 'scale', 'box-shadow']).toContain(p);
  /* the pill hasn't moved while the + is still more than half its size */
  for (const x of out) if (x.s > 0.5) expect(x.pr).toBeGreaterThan(65);
  expect(out[out.length - 1].pr).toBeLessThan(1);
  const back = page.evaluate(() => new Promise(r => setTimeout(r, 30))).then(() => page.click('#nav [data-v="today"]'));
  const ret = (await sample()).out; await back;
  /* the + only grows once the pill has made its room again */
  for (const x of ret) if (x.s > 0.3) expect(x.pr).toBeGreaterThan(60);
  expect(ret[ret.length - 1].s).toBeGreaterThan(0.95);
});

test('phone: drag along the dock: the circle follows, the tab you let go on opens; a tap still opens too', async ({ page }, info) => {
  phoneOnly(info);
  await login(page, new FakeSupabase(benchHistory()), 'A');
  await page.waitForTimeout(800);
  const box = async v => page.locator(`#nav [data-v="${v}"]`).boundingBox();
  const home = await box('today'), hist = await box('history'), y = home.y + home.height / 2;
  await page.mouse.move(home.x + home.width / 2, y); await page.mouse.down();
  const steps = 12; for (let i = 1; i <= steps; i++) await page.mouse.move(home.x + home.width / 2 + (hist.x - home.x) * i / steps, y);
  /* mid-drag: the dock is in its drag state and the tab under the finger is lit */
  await expect(page.locator('#nav')).toHaveClass(/drag/);
  await expect(page.locator('#nav [data-v="history"]')).toHaveClass(/hot/);
  const glow = await page.locator('#nav .nav-glow').boundingBox();
  expect(Math.abs(glow.x + glow.width / 2 - (hist.x + hist.width / 2))).toBeLessThan(8);
  await page.mouse.up();
  await expect(page).toHaveURL(/\/history$/);
  await expect(page.locator('#nav')).not.toHaveClass(/drag/);
  /* a plain tap */
  await page.click('#nav [data-v="splits"]');
  await expect(page).toHaveURL(/\/splits$/);
});
