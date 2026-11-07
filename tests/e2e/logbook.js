import { expect } from '@playwright/test';

/* the way in: the Logbook tab (History's place on the dock or in the sidebar), then its Calendar */
export async function openLogbook(page) {
  /* the app has loaded and the dock has settled */
  await page.waitForFunction(() => !document.getElementById('splash') && document.querySelector('#nav .nav-i[data-v="history"]') && document.querySelector('#view .hero, #view h1, #view .wfull'));
  await page.waitForTimeout(500);
  await page.locator('#nav .nav-i[data-v="history"]').click();
  await expect(page).toHaveURL(/\/(history|logbook)$/);
  if (!/\/logbook$/.test(page.url())) await page.locator('[data-act="lb-mode"][data-v="logbook"]').click();
  await expect(page).toHaveURL(/\/logbook$/);
  await expect(page.locator('#lb-cal')).toBeVisible();
}
/* the calendar cell for a time, going back a month when it isn't in the one showing */
export async function pickDay(page, t) {
  const k = await page.evaluate(t => { const d = new Date(t); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }, t);
  const cell = page.locator(`.lb-d[data-k="${k}"]`);
  if (!(await cell.count())) await page.click('.lb-prev');
  await cell.click();
  await expect(cell).toHaveClass(/sel/);
  return k;
}
/* a finished session, opened from its day in the Logbook so it can be changed */
export async function openInLogbook(page, s) {
  await openLogbook(page);
  await pickDay(page, Date.parse(s.started_at));
  await page.locator(`#lb-day [data-act="lb-open"][data-id="${s.id}"]`).click();
  await expect(page.locator('.s-edit')).toBeVisible();
}
