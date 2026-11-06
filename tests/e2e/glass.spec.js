/* The glass finish: light on the edges of cards, the dock and the + button, in every theme, without changing a
   theme's colours. */
import { test, expect } from '@playwright/test';
import { FakeSupabase, login, benchHistory } from './fake-supabase.js';

const look = page => page.evaluate(() => {
  const card = [...document.querySelectorAll('.card')].find(c => c.offsetWidth > 0), cs = getComputedStyle(card);
  /* the theme's own surface colour, read through a probe */
  const p = document.createElement('i'); p.style.background = 'var(--surface)'; document.body.append(p);
  const surface = getComputedStyle(p).backgroundColor; p.remove();
  const ring = getComputedStyle(document.querySelector('.nav-train .ring'));
  p.style.background = 'var(--solid)'; document.body.append(p);
  const solid = getComputedStyle(p).backgroundColor; p.remove();
  return { bg: cs.backgroundColor, surface, img: cs.backgroundImage, shadow: cs.boxShadow, ring: ring.boxShadow,
    ringBg: ring.backgroundColor, solid, pill: getComputedStyle(document.querySelector('.nav'), '::before').boxShadow };
});

for (const [theme, rim] of [['volt', 'rgba(255, 255, 255, 0.6)'], ['auto', 'rgb(255, 255, 255)']]) {
  test(`${theme}: cards catch light on their top edge and keep the theme's colour`, async ({ page }, info) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await login(page, new FakeSupabase({ ...benchHistory(), profile: theme === 'auto' ? {} : { theme } }), 'A');
    const l = await look(page);
    expect(l.bg).toBe(l.surface);
    expect(l.img).toContain('linear-gradient');
    expect(l.img).toContain('radial-gradient');
    expect(l.shadow).toContain(`${rim} 0px 1px 0px 0px inset`);
    /* the + keeps its colour, with a gloss on top */
    expect(l.ringBg).toBe(l.solid);
    expect(l.ring).toContain('inset');
    if (info.project.name === 'phone') expect(l.pill).toContain(`${rim} 0px 1px 0px 0px inset`);
  });
}
