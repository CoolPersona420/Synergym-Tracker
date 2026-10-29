/* Small helpers with no app state. */
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const uuid = () => crypto.randomUUID();
export const sid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export const pad = n => String(n).padStart(2, '0');
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const clone = o => JSON.parse(JSON.stringify(o));
export const fmtDate = t => { const d = new Date(t); return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${String(d.getFullYear()).slice(2)}`; };
export const fmtTime = t => { const d = new Date(t); return `${pad(d.getHours())}.${pad(d.getMinutes())}`; };
export const mmss = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`; };
export const dayKey = t => { const d = new Date(t); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
export const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
/* the day weeks start on (Settings › Training): 1 Monday (the default), 0 Sunday or 6 Saturday, as Date.getDay() */
export const WEEK_DAYS = [1, 0, 6];
let week0 = 1;
export const setWeekStart = d => { week0 = WEEK_DAYS.includes(+d) ? +d : 1; };
export const weekStartDay = () => week0;
export function weekStart(t) { const d = new Date(t); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() - week0 + 7) % 7)); return d.getTime(); }
export function shiftWeek(t, n) { const d = new Date(t); d.setDate(d.getDate() + 7 * n); return weekStart(d.getTime()); }
/* a shuffled deck of 0..n-1: each comes up once before any comes round again, and a reshuffle never
   starts with the one just shown */
export function deck(n, rand = Math.random) {
  let order = [], at = 0;
  const shuffle = last => {
    order = [...Array(n).keys()]; at = 0;
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    if (n > 1 && order[0] === last) [order[0], order[n - 1]] = [order[n - 1], order[0]];
  };
  shuffle(-1);
  return { current: () => order[at], next() { if (++at >= n) shuffle(order[n - 1]); return order[at]; } };
}
export function roll(t) { return `<span class="roll"><span data-t="${esc(t)}">${esc(t)}</span></span>`; }
let toastT;
export function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2800); }
