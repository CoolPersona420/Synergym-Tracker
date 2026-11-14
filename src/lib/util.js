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
let toastT, toastLeft = 0, toastAt = 0, toastWired = false;
const hideToast = () => { clearTimeout(toastT); $('#toast').classList.remove('show'); };
const armToast = ms => { clearTimeout(toastT); toastAt = Date.now(); toastLeft = ms; toastT = setTimeout(hideToast, ms); };
/* act: an optional { label, fn } button, such as Undo; the toast then stays a little longer */
export function toast(msg, act) {
  const t = $('#toast'); if (!toastWired) { toastWired = true; toastSwipe(t); }
  const tx = document.createElement('span'); tx.className = 'tx'; tx.textContent = msg;
  t.replaceChildren(tx); t.classList.toggle('act', !!act); t.classList.remove('drag');
  if (act) { const b = document.createElement('button'); b.className = 'toast-act'; b.textContent = act.label; b.onclick = () => { hideToast(); act.fn(); }; t.append(b); }
  t.style.translate = ''; t.classList.add('show'); armToast(act ? 5000 : 2800);
}
/* swipe the toast up to send it away: it follows the finger (pulling down gives a little), goes on a long or quick
   swipe and springs back otherwise. Its time stops while it's held. A tap clears one without a button. */
function toastSwipe(t) {
  let y0 = null, dy = 0, t0 = 0, moved = false;
  t.addEventListener('pointerdown', e => {
    if (!t.classList.contains('show') || (e.pointerType === 'mouse' && e.button !== 0)) return;
    y0 = e.clientY; dy = 0; t0 = performance.now(); moved = false;
    clearTimeout(toastT); toastLeft = Math.max(1500, toastLeft - (Date.now() - toastAt));
  });
  t.addEventListener('pointermove', e => {
    if (y0 == null) return; dy = e.clientY - y0;
    if (!moved && Math.abs(dy) > 6) { moved = true; t.classList.add('drag'); try { t.setPointerCapture(e.pointerId); } catch {} }
    if (moved) t.style.translate = `0 ${dy < 0 ? dy : Math.sqrt(dy) * 3}px`;
  });
  const end = () => {
    if (y0 == null) return; y0 = null;
    const v = dy / Math.max(1, performance.now() - t0);
    if (moved && (dy < -28 || v < -0.4)) { hideToast(); return; }
    t.classList.remove('drag'); t.style.translate = '';
    if (!moved && !t.classList.contains('act')) return hideToast();
    armToast(toastLeft);
  };
  t.addEventListener('pointerup', end); t.addEventListener('pointercancel', end);
  /* the click that ends a swipe isn't a press on Undo */
  t.addEventListener('click', e => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true);
}
