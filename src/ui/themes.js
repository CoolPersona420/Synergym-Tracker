/* Colour themes. Auto follows the system; the rest are named palettes. */
import { $$ } from '../lib/util.js';
import { ICON } from './brand.js';
import { THEMES } from '../data/themes.js';

export { THEMES };

export const themePref = () => document.documentElement.dataset.theme || 'auto';
export const isDark = () => { const t = THEMES.find(x => x.id === themePref()); return t && t.dark != null ? t.dark : matchMedia('(prefers-color-scheme: dark)').matches; };
export function applyTheme(t) {
  if (!THEMES.some(x => x.id === t)) t = 'auto';
  if (t === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
  try { t === 'auto' ? localStorage.removeItem('sg-theme') : localStorage.setItem('sg-theme', t); } catch {}
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  for (const m of $$('meta[name="theme-color"]')) m.content = bg || (isDark() ? '#050505' : '#EDEDED');
  /* the Home Screen icon follows the theme unless Settings fixed it (public/theme.js) */
  window.sgAppIcon?.();
}
export const themePicker = (act = 'd-theme') => `<div class="themes">${THEMES.map(t => `<button class="theme-card${themePref() === t.id ? ' on' : ''}" data-act="${act}" data-t="${t.id}" aria-pressed="${themePref() === t.id}">
  <span class="tp" style="background:${t.c[0]}"><b style="background:${t.c[4]}"></b><em style="background:${t.c[1]}"></em><i style="background:${t.c[2]}"></i><u style="background:${t.c[3]}"></u></span>
  <span>${t.name}<small>${t.note}</small></span></button>`).join('')}</div>`;
export const themeBtn = () => `<button class="theme-btn" data-act="theme-flip" aria-label="Switch to ${isDark() ? 'light' : 'dark'} mode" title="Switch to ${isDark() ? 'light' : 'dark'} mode">${isDark() ? ICON.sun : ICON.moon}</button>`;
