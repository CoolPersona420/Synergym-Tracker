/* Colour themes. Auto follows the system; the rest are named palettes. */
import { $$ } from '../lib/util.js';
import { ICON } from './brand.js';

/* themes: Auto follows the system (mono light / mono dark); the rest are named palettes */
export const THEMES = [
  { id: 'auto', name: 'Auto', note: 'Mono, follows your device', dark: null, c: ['#EDEDED', '#FFFFFF', '#0E0E0E', '#0E0E0E', '#050505'] },
  { id: 'light', name: 'Mono Light', note: 'Black on white', dark: false, pair: 'dark', c: ['#EDEDED', '#FFFFFF', '#0E0E0E', '#0E0E0E', '#0E0E0E'] },
  { id: 'dark', name: 'Mono Dark', note: 'White on black', dark: true, pair: 'light', c: ['#050505', '#151515', '#F4F4F4', '#F4F4F4', '#1F1F1F'] },
  { id: 'solarized-light', name: 'Solarized Light', note: 'Warm paper, blue ink', dark: false, pair: 'solarized-dark', c: ['#FDF6E3', '#FFFCF2', '#073642', '#268BD2', '#073642'] },
  { id: 'solarized-dark', name: 'Solarized Dark', note: 'Deep teal, cool text', dark: true, pair: 'solarized-light', c: ['#002B36', '#073642', '#EEE8D5', '#268BD2', '#073642'] },
  { id: 'gruvbox-light', name: 'Gruvbox Light', note: 'Retro cream and rust', dark: false, pair: 'gruvbox-dark', c: ['#FBF1C7', '#F9F5D7', '#3C3836', '#AF3A03', '#3C3836'] },
  { id: 'gruvbox-dark', name: 'Gruvbox Dark', note: 'Retro charcoal and amber', dark: true, pair: 'gruvbox-light', c: ['#282828', '#32302F', '#EBDBB2', '#FABD2F', '#1D2021'] },
  { id: 'nord', name: 'Nord', note: 'Arctic blue-grey', dark: true, pair: 'light', c: ['#2E3440', '#3B4252', '#ECEFF4', '#88C0D0', '#3B4252'] },
  { id: 'dracula', name: 'Dracula', note: 'Night with violet', dark: true, pair: 'light', c: ['#282A36', '#303341', '#F8F8F2', '#BD93F9', '#21222C'] },
  { id: 'sage', name: 'Sage', note: 'Olive with terracotta', dark: false, pair: 'volt', c: ['#C3C6B1', '#CED1BD', '#1F241D', '#C9583A', '#DE6F4E'] },
  { id: 'volt', name: 'Volt', note: 'Black with electric lime', dark: true, pair: 'sage', c: ['#0A0A0A', '#161616', '#F2F2F2', '#D4F25A', '#161616'] },
  /* Wada: Sanzo Wada's A Dictionary of Color Combinations (1933); the number is the combination in the book */
  { id: 'wada-indigo', name: 'Indigo', note: 'Deep indigo and vermilion · Wada 006', dark: true, pair: 'wada-ivory', wada: true, c: ['#060F26', '#0E1A38', '#F5ECDB', '#F48067', '#13244C'] },
  { id: 'wada-ivory', name: 'Ivory', note: 'Ivory, English red and black · Wada 190', dark: false, pair: 'wada-indigo', wada: true, c: ['#F1E6CF', '#FBF5E9', '#111314', '#D96629', '#111314'] },
  { id: 'wada-tyrian', name: 'Tyrian', note: 'Navy and yellow orange · Wada 002', dark: true, pair: 'wada-glaucous', wada: true, c: ['#0C2638', '#123349', '#F2F5F3', '#F99D1B', '#12354E'] },
  { id: 'wada-glaucous', name: 'Glaucous', note: 'Sea green and orange · Wada 007', dark: false, pair: 'wada-tyrian', wada: true, c: ['#D3E2DB', '#EEF5F1', '#12354E', '#F37420', '#12354E'] },
  { id: 'wada-naples', name: 'Naples', note: 'Naples yellow, peach red, olive · Wada 303', dark: false, pair: 'wada-olive', wada: true, c: ['#F6EBC4', '#FDF7E2', '#253122', '#F15A30', '#253122'] },
  { id: 'wada-olive', name: 'Slate Olive', note: 'Deep olive and peach red · Wada 303', dark: true, pair: 'wada-naples', wada: true, c: ['#161D15', '#202A1F', '#F6ECCB', '#F15A30', '#253122'] }
];
export const themePref = () => document.documentElement.dataset.theme || 'auto';
export const isDark = () => { const t = THEMES.find(x => x.id === themePref()); return t && t.dark != null ? t.dark : matchMedia('(prefers-color-scheme: dark)').matches; };
/* html.is-dark: the theme in use is dark (Auto follows the device). Given the theme being applied, it doesn't
   depend on the saved choice, which is written after */
export const markDark = (id = themePref()) => { const t = THEMES.find(x => x.id === id); document.documentElement.classList.toggle('is-dark', t && t.dark != null ? t.dark : matchMedia('(prefers-color-scheme: dark)').matches); };
export function applyTheme(t) {
  /* a theme that no longer exists (Ocean, retired in 0.1.36) falls back to Auto */
  if (!THEMES.some(x => x.id === t)) t = 'auto';
  if (t === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
  markDark(t);
  try { t === 'auto' ? localStorage.removeItem('sg-theme') : localStorage.setItem('sg-theme', t); } catch {}
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  for (const m of $$('meta[name="theme-color"]')) m.content = bg || (isDark() ? '#050505' : '#EDEDED');
}
const themeCard = act => t => `<button class="theme-card${themePref() === t.id ? ' on' : ''}" data-act="${act}" data-t="${t.id}" aria-pressed="${themePref() === t.id}">
  <span class="tp" style="background:${t.c[0]}"><b style="background:${t.c[4]}"></b><em style="background:${t.c[1]}"></em><i style="background:${t.c[2]}"></i><u style="background:${t.c[3]}"></u></span>
  <span>${t.name}<small>${t.note}</small></span></button>`;
/* the Wada palettes get their own group under the rest */
export const themePicker = (act = 'd-theme') => `<div class="themes">${THEMES.filter(t => !t.wada).map(themeCard(act)).join('')}</div>
  <p class="themes-h">From Sanzo Wada’s <i>Dictionary of Color Combinations</i></p>
  <div class="themes">${THEMES.filter(t => t.wada).map(themeCard(act)).join('')}</div>`;
export const themeBtn = () => `<button class="theme-btn" data-act="theme-flip" aria-label="Switch to ${isDark() ? 'light' : 'dark'} mode" title="Switch to ${isDark() ? 'light' : 'dark'} mode">${isDark() ? ICON.sun : ICON.moon}</button>`;
