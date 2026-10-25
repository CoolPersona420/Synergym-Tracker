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
export function weekStart(t) { const d = new Date(t); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); }
export function shiftWeek(t, n) { const d = new Date(t); d.setDate(d.getDate() + 7 * n); return weekStart(d.getTime()); }
export function roll(t) { return `<span class="roll"><span data-t="${esc(t)}">${esc(t)}</span></span>`; }
let toastT;
export function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2800); }
