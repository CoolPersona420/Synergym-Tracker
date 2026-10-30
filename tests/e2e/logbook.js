import { expect } from '@playwright/test';

/* the way in: hold the session button (+ on a phone, Start session on a computer), slide up into the capsule, let go */
export async function openLogbook(page) {
  /* the app has loaded and the button has settled (it springs in on a phone) */
  await page.waitForFunction(() => !document.getElementById('splash') && document.querySelector('#nav .nav-train .ring') && document.querySelector('#view .hero, #view h1, #view .wfull'));
  await page.waitForTimeout(700);
  const b = await page.locator('#nav .nav-train .ring').boundingBox(), x = b.x + b.width / 2, y = b.y + b.height / 2;
  await page.mouse.move(x, y); await page.mouse.down();
  await expect(page.locator('.holdcap.in')).toBeVisible();
  /* up on a phone, right beside a computer's sidebar */
  const side = await page.evaluate(() => !matchMedia('(max-width:47.99rem)').matches);
  for (let i = 1; i <= 16; i++) await page.mouse.move(side ? x + i * 16 : x, side ? y : y - i * 11);
  await page.mouse.up();
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
