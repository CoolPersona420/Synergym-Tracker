/* Superset with… from a set's menu: pick the exact set of another exercise to link with. */
import { test, expect } from '@playwright/test';
import crypto from 'node:crypto';
import { FakeSupabase, login, benchHistory } from './fake-supabase.js';

test('a set’s menu links it with a set of another exercise, a new one, or a superset already there', async ({ page }) => {
  const data = benchHistory(), curl = { id: crypto.randomUUID(), name: 'Leg Curl', muscle: 'Hamstrings', kind: 'w' };
  data.exercises.push(curl);
  const fake = new FakeSupabase(data);
  await login(page, fake, 'A');
  await page.locator('[data-act="start-menu"]:visible').first().click();
  await page.locator('[data-st-foot]', { hasText: 'Empty session' }).click();
  await expect(page).toHaveURL(/\/session\//);
  const id = page.url().split('/').pop();
  for (const name of ['Bench Press', 'Leg Curl']) { await page.click('[data-act="add-ex"]'); await page.locator('[data-act="pk-pick"]', { hasText: name }).click(); }
  const bench = page.locator('.ex').filter({ hasText: 'Bench Press' }), legs = page.locator('.ex').filter({ hasText: 'Leg Curl' });
  await expect(bench.locator('.set')).toHaveCount(3);
  const menu = async (card, n) => { await card.locator('[data-act="set-menu"]').nth(n).click(); await page.locator('#sheet button', { hasText: 'Superset with…' }).click(); };
  /* bench set 2 with leg curl set 1 */
  await menu(bench, 1);
  await expect(page.locator('#sheet h3')).toHaveText('Superset with…');
  await expect(page.locator('#sheet .ss-ex')).toHaveCount(1);
  await page.locator('#sheet .ss-ex [data-ss]').first().click();
  await expect(bench.locator('.set').nth(1).locator('.gtag')).toHaveText('SS·A');
  await expect(legs.locator('.set').first().locator('.gtag')).toHaveText('SS·A');
  await expect(page.locator('#toast')).toContainText('Superset A');
  /* bench set 3 with a new leg curl set */
  await menu(bench, 2);
  await page.locator('#sheet [data-ss-new]').click();
  await expect(legs.locator('.set')).toHaveCount(2);
  await expect(bench.locator('.set').nth(2).locator('.gtag')).toHaveText('SS·B');
  await expect(legs.locator('.set').nth(1).locator('.gtag')).toHaveText('SS·B');
  /* bench set 1 joins the superset leg curl set 1 is already in */
  await menu(bench, 0);
  await expect(page.locator('#sheet .ss-set.in')).toHaveCount(2);
  await page.locator('#sheet .ss-ex [data-ss]').first().click();
  await expect(bench.locator('.set').first().locator('.gtag')).toHaveText('SS·A');
  /* saved: three sets share one group, two share another */
  await expect.poll(() => {
    const s = fake.sessions.find(x => x.id === id); if (!s) return null;
    const c = new Map(); for (const it of s.items) for (const st of it.sets) if (st.g) c.set(st.g, (c.get(st.g) || 0) + 1);
    return [...c.values()].sort().join(',');
  }).toBe('2,3');
});

test('with no other exercise in the session, Superset with… says to add one', async ({ page }) => {
  const fake = new FakeSupabase(benchHistory());
  await login(page, fake, 'A');
  await page.locator('[data-act="start-menu"]:visible').first().click();
  await page.locator('[data-st-foot]', { hasText: 'Empty session' }).click();
  await page.click('[data-act="add-ex"]'); await page.locator('[data-act="pk-pick"]', { hasText: 'Bench Press' }).click();
  await page.locator('[data-act="set-menu"]').first().click();
  await page.locator('#sheet button', { hasText: 'Superset with…' }).click();
  await expect(page.locator('#toast')).toContainText('Add another exercise');
});
