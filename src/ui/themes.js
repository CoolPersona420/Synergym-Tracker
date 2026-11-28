/* Colour themes. Auto follows the system; the rest are named palettes. */
import { $$ } from '../lib/util.js';
import { ICON } from './brand.js';

/* themes: Auto follows the system (mono light / mono dark); the rest are named palettes */
export const THEMES = [
  { id: 'auto', name: 'Auto', note: 'Mono, follows your device', dark: null, c: ['#EEEDE9', '#FBFAF7', '#0E0E0F', '#D9241A', '#080808'] },
  { id: 'light', name: 'Mono Light', note: 'Ink on paper, red for Start', dark: false, pair: 'dark', c: ['#EEEDE9', '#FBFAF7', '#0E0E0F', '#D9241A', '#0E0E0F'] },
  { id: 'dark', name: 'Mono Dark', note: 'Paper on sumi black, red for Start', dark: true, pair: 'light', c: ['#080808', '#161616', '#F3F1EC', '#E8261A', '#1F1F1F'] },
  { id: 'solarized-light', name: 'Solarized Light', note: 'Warm paper, blue ink', dark: false, pair: 'solarized-dark', c: ['#FDF6E3', '#FFFCF2', '#073642', '#268BD2', '#073642'] },
  { id: 'solarized-dark', name: 'Solarized Dark', note: 'Deep teal, cool text', dark: true, pair: 'solarized-light', c: ['#002B36', '#073642', '#EEE8D5', '#268BD2', '#073642'] },
  { id: 'gruvbox-light', name: 'Gruvbox Light', note: 'Retro cream and rust', dark: false, pair: 'gruvbox-dark', c: ['#FBF1C7', '#F9F5D7', '#3C3836', '#AF3A03', '#3C3836'] },
  { id: 'gruvbox-dark', name: 'Gruvbox Dark', note: 'Retro charcoal and amber', dark: true, pair: 'gruvbox-light', c: ['#282828', '#32302F', '#EBDBB2', '#FABD2F', '#1D2021'] },
  { id: 'nord', name: 'Nord', note: 'Arctic blue-grey', dark: true, pair: 'light', c: ['#2E3440', '#3B4252', '#ECEFF4', '#88C0D0', '#3B4252'] },
  { id: 'dracula', name: 'Dracula', note: 'Night with violet', dark: true, pair: 'light', c: ['#282A36', '#303341', '#F8F8F2', '#BD93F9', '#21222C'] },
  { id: 'sage', name: 'Sage', note: 'Olive with terracotta', dark: false, pair: 'volt', c: ['#C3C6B1', '#CED1BD', '#1F241D', '#C9583A', '#DE6F4E'] },
  { id: 'volt', name: 'Volt', note: 'Black with electric lime', dark: true, pair: 'sage', c: ['#0A0A0A', '#161616', '#F2F2F2', '#D4F25A', '#161616'] },
  /* Wada: from Sanzo Wada's A Dictionary of Color Combinations (1933): Indigo/Ivory are combinations 006 and 190, Tyrian/Glaucous 002 and 007, Naples/Slate Olive 303 */
  { id: 'wada-indigo', name: 'Indigo', note: 'Deep indigo and vermilion', dark: true, pair: 'wada-ivory', art: 'wada', c: ['#060F26', '#0E1A38', '#F5ECDB', '#F48067', '#13244C'] },
  { id: 'wada-ivory', name: 'Ivory', note: 'Ivory, English red and black', dark: false, pair: 'wada-indigo', art: 'wada', c: ['#F1E6CF', '#FBF5E9', '#111314', '#D96629', '#111314'] },
  { id: 'wada-tyrian', name: 'Tyrian', note: 'Navy and yellow orange', dark: true, pair: 'wada-glaucous', art: 'wada', c: ['#0C2638', '#123349', '#F2F5F3', '#F99D1B', '#12354E'] },
  { id: 'wada-glaucous', name: 'Glaucous', note: 'Sea green and orange', dark: false, pair: 'wada-tyrian', art: 'wada', c: ['#D3E2DB', '#EEF5F1', '#12354E', '#F37420', '#12354E'] },
  { id: 'wada-naples', name: 'Naples', note: 'Naples yellow, peach red, olive', dark: false, pair: 'wada-olive', art: 'wada', c: ['#F6EBC4', '#FDF7E2', '#253122', '#F15A30', '#253122'] },
  { id: 'wada-olive', name: 'Slate Olive', note: 'Deep olive and peach red', dark: true, pair: 'wada-naples', art: 'wada', c: ['#161D15', '#202A1F', '#F6ECCB', '#F15A30', '#253122'] },
  /* Hokusai: The Great Wave off Kanagawa, through the Kanagawa palette (rebelot/kanagawa.nvim, MIT) */
  { id: 'kanagawa', name: 'Great Wave', note: 'Sumi ink, wave blue, seal red', dark: true, pair: 'lotus', art: 'hokusai', c: ['#1F1F28', '#2A2A37', '#DCD7BA', '#E46876', '#223249'] },
  { id: 'lotus', name: 'Lotus', note: 'Washi paper, indigo ink, seal red', dark: false, pair: 'kanagawa', art: 'hokusai', c: ['#F2ECBC', '#F8F4D8', '#43436C', '#C84053', '#223249'] }
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
  for (const m of $$('meta[name="theme-color"]')) m.content = bg || (isDark() ? '#080808' : '#EEEDE9');
}
/* the theme picker: a button with the theme in use and its colours, which opens a popup of every theme in one list,
   each with its colours on the side (page, card, ink, accent). Picking one applies it and closes the popup. */
const swatch = t => `<span class="th-sw" aria-hidden="true">${[t.c[0], t.c[1], t.c[2], t.c[3]].map(c => `<i style="background:${c}"></i>`).join('')}</span>`;
const thName = t => `<span class="th-n">${t.name}<small>${t.note}</small></span>`;
export const themePicker = (act = 'd-theme') => {
  const cur = THEMES.find(t => t.id === themePref()) || THEMES[0];
  return `<button class="th-cur" data-act="th-pop" data-pick="${act}" aria-haspopup="dialog" aria-label="Theme: ${cur.name}. Change">${thName(cur)}${swatch(cur)}<span class="th-ch">${ICON.down}</span></button>`;
};
/* the popup's list; act is what a pick does (d-theme in Settings, ob-theme in onboarding) */
export const themeList = (act = 'd-theme') => {
  const cur = themePref();
  return `<div class="th-list" role="listbox" aria-label="Themes">${THEMES.map(t => `<button class="th-o${t.id === cur ? ' on' : ''}" role="option" aria-selected="${t.id === cur}" data-act="${act}" data-t="${t.id}">${thName(t)}${swatch(t)}</button>`).join('')}</div>`;
};
export const themeBtn = () => `<button class="theme-btn" data-act="theme-flip" aria-label="Switch to ${isDark() ? 'light' : 'dark'} mode" title="Switch to ${isDark() ? 'light' : 'dark'} mode">${isDark() ? ICON.sun : ICON.moon}</button>`;
