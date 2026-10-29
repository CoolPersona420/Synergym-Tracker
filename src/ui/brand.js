/* Icons, the wolf mark, the wordmark lockup and the big display type. */
import { $$, esc } from '../lib/util.js';
import { reduced } from '../lib/env.js';

export const ICON={
 home:'<svg class="ico" viewBox="0 0 24 24"><path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z"/></svg>',
 today:'<svg class="ico" viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>',
 hist:'<svg class="ico" viewBox="0 0 24 24"><path d="M5 7h14M5 12h14M5 17h8"/></svg>',
 ex:'<svg class="ico" viewBox="0 0 24 24"><path d="M3 10v4M6.5 7.5v9M17.5 7.5v9M21 10v4M6.5 12h11"/></svg>',
 split:'<svg class="ico" viewBox="0 0 24 24"><rect x="3.5" y="5" width="4" height="14" rx="1.2"/><rect x="10" y="5" width="4" height="14" rx="1.2"/><rect x="16.5" y="5" width="4" height="14" rx="1.2"/></svg>',
 prefs:'<svg class="ico" viewBox="0 0 24 24"><path d="M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9z"/><circle cx="12" cy="12" r="2.8"/></svg>',
 plus:'<svg class="ico" viewBox="0 0 24 24"><path d="M12 4v16M4 12h16"/></svg>',
 shuffle:'<svg class="ico" viewBox="0 0 24 24"><path d="M3 7h3.5c2.5 0 4 1.5 5.5 5s3 5 5.5 5H21M3 17h3.5c1.2 0 2.2-.4 3-1.1M14.5 8.1c.8-.7 1.8-1.1 3-1.1H21M18 4l3 3-3 3M18 14l3 3-3 3"/></svg>',
 play:'<svg class="ico" viewBox="0 0 24 24"><path d="M8 5.5l10.5 6.5L8 18.5z" fill="currentColor"/></svg>',
 back:'<svg class="ico" viewBox="0 0 24 24"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>',
 dots:'<svg class="ico" viewBox="0 0 24 24"><circle cx="6" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="18" cy="12" r="1.3" fill="currentColor"/></svg>',
 check:'<svg class="ico" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
 link:'<svg class="ico" viewBox="0 0 24 24"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
 x:'<svg class="ico" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
 expand:'<svg class="ico" viewBox="0 0 24 24"><path d="M14 4h6v6M10 20H4v-6M20 4l-6.5 6.5M4 20l6.5-6.5"/></svg>',
 pen:'<svg class="ico" viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
 up:'<svg class="ico" viewBox="0 0 24 24"><path d="M6 15l6-6 6 6"/></svg>',
 down:'<svg class="ico" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>',
 sun:'<svg class="ico" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/></svg>',
 moon:'<svg class="ico" viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>',
 rest:'<svg class="ico" viewBox="0 0 24 24"><path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z"/><path d="M17.5 3v3M16 4.5h3M21 9v2M20 10h2"/></svg>',
 coach:'<svg class="ico" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><path d="M12 12l6.5-6.5M16 5.5h2.5V8"/></svg>',
 share:'<svg class="ico" viewBox="0 0 24 24"><path d="M12 15V4M8 8l4-4 4 4M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/></svg>'
};

/* brand, contour lines, big numerals */
export const WOLF = '<path class="w-body" d="M200 142 L258 128 L292 56 L312 162 L340 196 L318 204 L330 232 L252 304 L200 358 L148 304 L70 232 L82 204 L60 196 L88 162 L108 56 L142 128 Z" stroke-width="16" stroke-linejoin="miter"/><path class="w-eyes" d="M212 220 L280 188 L268 212 Z M188 220 L120 188 L132 212 Z"/><path class="w-nose" d="M186 290 L214 290 L200 304 Z"/>';
export const MARK = `<svg class="mark wolf-t" viewBox="44 40 312 330" aria-hidden="true">${WOLF}</svg>`;
export const brand = (cls = '') => `<span class="brand ${cls}" aria-label="Synergym">${MARK}<span class="wordmark" aria-hidden="true">SYNERGYM</span></span>`;
export const lockup = () => `<div class="lockup" aria-label="Synergym"><svg class="wolf wolf-t" viewBox="44 40 312 330" aria-hidden="true">${WOLF}</svg><span class="wordmark">SYNERGYM</span></div>`;
export function big(v) {
  const s = String(v), n = parseFloat(s);
  return s.trim() !== '' && isFinite(n) && /^-?\d+(\.\d+)?$/.test(s) ? `<span class="n count" data-to="${n}" data-dec="${s.includes('.') ? 1 : 0}">${esc(s)}</span>` : `<span class="n">${esc(s)}</span>`;
}
export const slantWords = html => html.replace(/(^|>)([^<]+)/g, (m, a, t) => a + t.split(/(\s+)/).map(w => w.trim() ? `<span class="w">${w}</span>` : w).join(''));
export const disp = lines => `<h1 class="display">${lines.map((l, k) => `<span class="ln"><span style="--k:${k}">${slantWords(l)}</span></span>`).join('')}</h1>`;
export function countUp(root) {
  if (reduced) return;
  for (const el of $$('.count', root)) {
    const to = +el.dataset.to, dec = +el.dataset.dec, t0 = performance.now(), dur = 1100;
    if (!isFinite(to) || to === 0) continue;
    const step = t => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = (to * e).toFixed(dec); if (k < 1) requestAnimationFrame(step); };
    el.textContent = (0).toFixed(dec); requestAnimationFrame(step);
  }
}
