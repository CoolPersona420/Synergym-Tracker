import { createClient } from '@supabase/supabase-js';
import './style.css';

/* ================= config ================= */
// The project URL and publishable key are public by design (every browser receives them; Row Level
// Security protects the data). They're the defaults here so a deploy works without extra setup;
// VITE_SUPABASE_URL / VITE_SUPABASE_KEY in the environment override them, e.g. for a staging project.
const SB_URL = (import.meta.env.VITE_SUPABASE_URL || 'https://dqpxqinejgovkhwvsqem.supabase.co').trim();
const SB_KEY = (import.meta.env.VITE_SUPABASE_KEY || 'sb_publishable_jTBU_Y-1T3ouNej7YUsCIQ_E5ceELbu').trim();
const sb = SB_URL && SB_KEY
  ? createClient(SB_URL, SB_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' } })
  : null;

/* ================= constants ================= */
const MUSCLES = ['Chest','Back','Shoulders','Biceps','Triceps','Quads','Hamstrings','Glutes','Calves','Core','Full body'];
const DAY_TYPES = ['Push','Pull','Legs','Upper','Lower','Full body','Chest & Back','Arms','Shoulders','Glutes','Cardio','Rest'];
const DAYS = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const KG_LB = 2.2046226;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;


const ICON={
 today:'<svg class="ico" viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>',
 hist:'<svg class="ico" viewBox="0 0 24 24"><path d="M5 7h14M5 12h14M5 17h8"/></svg>',
 ex:'<svg class="ico" viewBox="0 0 24 24"><path d="M3 10v4M6.5 7.5v9M17.5 7.5v9M21 10v4M6.5 12h11"/></svg>',
 split:'<svg class="ico" viewBox="0 0 24 24"><rect x="3.5" y="5" width="4" height="14" rx="1.2"/><rect x="10" y="5" width="4" height="14" rx="1.2"/><rect x="16.5" y="5" width="4" height="14" rx="1.2"/></svg>',
 prefs:'<svg class="ico" viewBox="0 0 24 24"><path d="M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9z"/><circle cx="12" cy="12" r="2.8"/></svg>',
 plus:'<svg class="ico" viewBox="0 0 24 24"><path d="M12 4v16M4 12h16"/></svg>',
 play:'<svg class="ico" viewBox="0 0 24 24"><path d="M8 5.5l10.5 6.5L8 18.5z" fill="currentColor"/></svg>',
 back:'<svg class="ico" viewBox="0 0 24 24"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>',
 dots:'<svg class="ico" viewBox="0 0 24 24"><circle cx="6" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="18" cy="12" r="1.3" fill="currentColor"/></svg>',
 check:'<svg class="ico" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
 link:'<svg class="ico" viewBox="0 0 24 24"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
 x:'<svg class="ico" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
 sun:'<svg class="ico" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/></svg>',
 moon:'<svg class="ico" viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>',
 share:'<svg class="ico" viewBox="0 0 24 24"><path d="M12 15V4M8 8l4-4 4 4M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/></svg>'
};

/* ================= state ================= */
const DEFAULT_PROFILE = { username: null, name: '', exp: null, goal: null, onboarded: false, unit: 'kg', target: 3, rest: 90, restOn: true, sound: true, bw: 75 };
const S = {
  authReady: false, user: null, loaded: false, loadError: null,
  profile: { ...DEFAULT_PROFILE }, library: [], sessions: new Map(), splits: new Map(), shared: [], recipients: new Map(),
  view: 'today', arg: null, link: null, rest: null, q: '', exq: '', exm: '', showArchived: false, A: null, animate: false,
  ob: { step: 2, name: '', username: '', unit: 'kg', bw: 75, exp: null, goal: null, days: 3, tpl: null },
  pk: {}, authMode: 'signin', authMsg: null, recover: false, pub: null, lastFetch: 0
};

/* ================= utils ================= */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uuid = () => crypto.randomUUID();
const sid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const pad = n => String(n).padStart(2, '0');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const clone = o => JSON.parse(JSON.stringify(o));
const fmtDate = t => { const d = new Date(t); return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${String(d.getFullYear()).slice(2)}`; };
const fmtTime = t => { const d = new Date(t); return `${pad(d.getHours())}.${pad(d.getMinutes())}`; };
const mmss = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`; };
const unit = () => S.profile.unit === 'lb' ? 'lb' : 'kg';
const toU = kg => S.profile.unit === 'lb' ? kg * KG_LB : kg;
const fromU = v => S.profile.unit === 'lb' ? v / KG_LB : v;
const fmtW = kg => { if (kg == null || !isFinite(kg)) return ''; return String(Math.round(toU(kg) * 10) / 10); };
const fmtVol = kg => { const v = toU(kg || 0); if (v >= 10000) return (v / 1000).toFixed(1) + (unit() === 'lb' ? 'k lb' : ' t'); return Math.round(v).toLocaleString('en-US') + ' ' + unit(); };
const dayKey = t => { const d = new Date(t); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
function weekStart(t) { const d = new Date(t); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); }
function shiftWeek(t, n) { const d = new Date(t); d.setDate(d.getDate() + 7 * n); return weekStart(d.getTime()); }
function roll(t) { return `<span class="roll"><span data-t="${esc(t)}">${esc(t)}</span></span>`; }
let toastT; function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2800); }

/* brand, contour lines, big numerals */
const MARK = '<svg class="mark" viewBox="0 0 32 32" aria-hidden="true"><rect class="m-bg" width="32" height="32" rx="9"/><path class="m-s" d="M21.2 11.4c-.9-1.7-2.8-2.7-5.1-2.7-3 0-5.1 1.6-5.1 4 0 5.3 10.6 2.7 10.6 8.1 0 2.4-2.3 4.1-5.4 4.1-2.4 0-4.5-1.1-5.4-3" fill="none" stroke-width="2.6" stroke-linecap="round"/><circle class="m-d" cx="24.6" cy="7.6" r="2.3"/></svg>';
const brand = (cls = '') => `<span class="brand ${cls}">${MARK}<span>Synergym</span></span>`;
const orbs = () => '<div class="orbs" aria-hidden="true"><i class="solid"></i><i class="glass"></i></div>';
function big(v) {
  const s = String(v), n = parseFloat(s);
  return s.trim() !== '' && isFinite(n) && /^-?\d+(\.\d+)?$/.test(s) ? `<span class="n count" data-to="${n}" data-dec="${s.includes('.') ? 1 : 0}">${esc(s)}</span>` : `<span class="n">${esc(s)}</span>`;
}
const disp = lines => `<h1 class="display">${lines.map((l, k) => `<span class="ln"><span style="--k:${k}">${l}</span></span>`).join('')}</h1>`;
function countUp(root) {
  if (reduced) return;
  for (const el of $$('.count', root)) {
    const to = +el.dataset.to, dec = +el.dataset.dec, t0 = performance.now(), dur = 1100;
    if (!isFinite(to) || to === 0) continue;
    const step = t => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = (to * e).toFixed(dec); if (k < 1) requestAnimationFrame(step); };
    el.textContent = (0).toFixed(dec); requestAnimationFrame(step);
  }
}
/* themes: Auto follows the system (mono light / mono dark); the rest are named palettes */
const THEMES = [
  { id: 'auto', name: 'Auto', note: 'Mono, follows your device', dark: null, c: ['#EDEDED', '#FFFFFF', '#0E0E0E', '#0E0E0E', '#050505'] },
  { id: 'light', name: 'Mono Light', note: 'Black on white', dark: false, pair: 'dark', c: ['#EDEDED', '#FFFFFF', '#0E0E0E', '#0E0E0E', '#0E0E0E'] },
  { id: 'dark', name: 'Mono Dark', note: 'White on black', dark: true, pair: 'light', c: ['#050505', '#151515', '#F4F4F4', '#F4F4F4', '#1F1F1F'] },
  { id: 'solarized-light', name: 'Solarized Light', note: 'Warm paper, blue ink', dark: false, pair: 'solarized-dark', c: ['#FDF6E3', '#FFFCF2', '#073642', '#268BD2', '#073642'] },
  { id: 'solarized-dark', name: 'Solarized Dark', note: 'Deep teal, cool text', dark: true, pair: 'solarized-light', c: ['#002B36', '#073642', '#EEE8D5', '#268BD2', '#073642'] },
  { id: 'gruvbox-light', name: 'Gruvbox Light', note: 'Retro cream and rust', dark: false, pair: 'gruvbox-dark', c: ['#FBF1C7', '#F9F5D7', '#3C3836', '#AF3A03', '#3C3836'] },
  { id: 'gruvbox-dark', name: 'Gruvbox Dark', note: 'Retro charcoal and amber', dark: true, pair: 'gruvbox-light', c: ['#282828', '#32302F', '#EBDBB2', '#FABD2F', '#1D2021'] },
  { id: 'nord', name: 'Nord', note: 'Arctic blue-grey', dark: true, pair: 'light', c: ['#2E3440', '#3B4252', '#ECEFF4', '#88C0D0', '#3B4252'] },
  { id: 'dracula', name: 'Dracula', note: 'Night with violet', dark: true, pair: 'light', c: ['#282A36', '#303341', '#F8F8F2', '#BD93F9', '#21222C'] },
  { id: 'ocean', name: 'Ocean', note: 'The deep blue original', dark: true, pair: 'light', c: ['#073F6F', '#0E4C7E', '#FFFFFF', '#8CDDF2', '#0A5690'] },
  { id: 'sage', name: 'Sage', note: 'Olive with terracotta', dark: false, pair: 'volt', c: ['#C3C6B1', '#CED1BD', '#1F241D', '#C9583A', '#DE6F4E'] },
  { id: 'volt', name: 'Volt', note: 'Black with electric lime', dark: true, pair: 'sage', c: ['#0A0A0A', '#161616', '#F2F2F2', '#D4F25A', '#161616'] }
];
const themePref = () => document.documentElement.dataset.theme || 'auto';
const isDark = () => { const t = THEMES.find(x => x.id === themePref()); return t && t.dark != null ? t.dark : matchMedia('(prefers-color-scheme: dark)').matches; };
function setTheme(t) {
  if (!THEMES.some(x => x.id === t)) t = 'auto';
  if (t === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
  try { t === 'auto' ? localStorage.removeItem('sg-theme') : localStorage.setItem('sg-theme', t); } catch {}
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  for (const m of $$('meta[name="theme-color"]')) m.content = bg || (isDark() ? '#050505' : '#EDEDED');
  render(false);
}
function flipTheme() {
  const t = THEMES.find(x => x.id === themePref());
  setTheme(t && t.pair ? t.pair : (isDark() ? 'light' : 'dark'));
}
const themePicker = () => `<div class="themes">${THEMES.map(t => `<button class="theme-card${themePref() === t.id ? ' on' : ''}" data-act="theme" data-t="${t.id}" aria-pressed="${themePref() === t.id}">
  <span class="tp" style="background:${t.c[0]}"><b style="background:${t.c[4]}"></b><em style="background:${t.c[1]}"></em><i style="background:${t.c[2]}"></i><u style="background:${t.c[3]}"></u></span>
  <span>${t.name}<small>${t.note}</small></span></button>`).join('')}</div>`;
const themeBtn = () => `<button class="theme-btn" data-act="theme-flip" aria-label="Switch to ${isDark() ? 'light' : 'dark'} mode" title="Switch to ${isDark() ? 'light' : 'dark'} mode">${isDark() ? ICON.sun : ICON.moon}</button>`;

/* ================= sanitising ================= */
const num = v => { v = +v; return isFinite(v) ? v : null; };
const safeId = v => String(v || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40) || sid();
function cleanSet(o) { if (!o || typeof o !== 'object') return null; const w = num(o.w), r = num(o.r), pw = num(o.pw), pr = num(o.pr); return { id: safeId(o.id), w: w == null ? null : Math.max(0, w), r: r == null ? null : Math.max(0, Math.round(r)), pw, pr, done: !!o.done, g: o.g ? safeId(o.g) : null }; }
function cleanItem(o) { if (!o || typeof o !== 'object' || !o.exId) return null; return { id: safeId(o.id), exId: safeId(o.exId), sets: Array.isArray(o.sets) ? o.sets.slice(0, 40).map(cleanSet).filter(Boolean) : [] }; }
function cleanSession(o) {
  if (!o || typeof o !== 'object') return null;
  return { id: String(o.id), name: typeof o.name === 'string' && o.name ? o.name.slice(0, 80) : null, startedAt: num(o.startedAt) || Date.now(), endedAt: num(o.endedAt) || null,
    notes: typeof o.notes === 'string' ? o.notes.slice(0, 4000) : '', items: Array.isArray(o.items) ? o.items.slice(0, 60).map(cleanItem).filter(Boolean) : [],
    splitId: o.splitId || null, splitDay: o.splitDay == null ? null : num(o.splitDay) };
}
function cleanDays(d) {
  if (!Array.isArray(d)) return [];
  return d.slice(0, 14).map(x => ({
    id: safeId(x && x.id), type: String(x?.type || '').slice(0, 40), rest: !!x?.rest,
    exercises: Array.isArray(x?.exercises) ? x.exercises.slice(0, 30).map(e => ({
      id: safeId(e?.id), exId: e?.exId ? String(e.exId).slice(0, 40) : null, name: String(e?.name || 'Exercise').slice(0, 60),
      muscle: MUSCLES.includes(e?.muscle) ? e.muscle : 'Full body', kind: e?.kind === 'bw' ? 'bw' : 'w',
      sets: Math.min(20, Math.max(1, parseInt(e?.sets) || 3)), reps: String(e?.reps ?? '8-12').slice(0, 12)
    })) : []
  }));
}

/* ================= db mapping ================= */
const profFromDb = r => ({ username: r.username || null, name: r.display_name || '', exp: r.experience || null, goal: r.goal || null, onboarded: !!r.onboarded, unit: r.unit === 'lb' ? 'lb' : 'kg', target: r.weekly_target || 3, rest: r.rest_seconds || 90, restOn: r.rest_enabled !== false, sound: r.rest_sound !== false, bw: +r.bodyweight || 75 });
const profToDb = p => ({ display_name: (p.name || '').slice(0, 40) || null, experience: p.exp || null, goal: p.goal || null, onboarded: !!p.onboarded, unit: p.unit, weekly_target: p.target, rest_seconds: p.rest, rest_enabled: p.restOn, rest_sound: p.sound, bodyweight: Math.round(p.bw * 100) / 100 });
const exFromDb = r => ({ id: r.id, name: r.name, muscle: r.muscle, kind: r.kind === 'bw' ? 'bw' : 'w', archived: !!r.archived, isDefault: !!r.is_default });
const exToDb = e => ({ id: e.id, user_id: S.user.id, name: e.name.trim(), muscle: e.muscle, kind: e.kind, archived: !!e.archived, is_default: !!e.isDefault });
const sessFromDb = r => cleanSession({ id: r.id, name: r.name, startedAt: Date.parse(r.started_at), endedAt: r.ended_at ? Date.parse(r.ended_at) : null, notes: r.notes, items: r.items, splitId: r.split_id, splitDay: r.split_day });
const sessToDb = s => ({ id: s.id, user_id: S.user.id, name: s.name, started_at: new Date(s.startedAt).toISOString(), ended_at: s.endedAt ? new Date(s.endedAt).toISOString() : null, notes: s.notes || '', items: s.items, split_id: s.splitId || null, split_day: s.splitDay ?? null, updated_at: new Date().toISOString() });
const splitFromDb = r => ({ id: r.id, name: r.name, description: r.description || '', days: cleanDays(r.days), shareToken: r.share_token || null, copiedFrom: r.copied_from || null, updatedAt: Date.parse(r.updated_at) || 0 });
const splitToDb = p => ({ id: p.id, user_id: S.user.id, name: p.name.trim() || 'Untitled split', description: p.description || '', days: p.days, share_token: p.shareToken, copied_from: p.copiedFrom, updated_at: new Date().toISOString() });

/* ================= save queue (survives reloads and dropped connections) ================= */
const OB = { pending: new Set(), timers: new Map(), inflight: new Set(), again: new Set(), failing: false, backoff: 2000, retryT: null };
const obKey = () => S.user ? 'sg-outbox-' + S.user.id : null;
function snapshot(key) {
  const i = key.indexOf(':'), t = key.slice(0, i), id = key.slice(i + 1);
  if (t === 's') return S.sessions.get(id) || null;
  if (t === 'x') return S.library.find(e => e.id === id) || null;
  if (t === 'sp') return S.splits.get(id) || null;
  if (t === 'p') return S.profile;
  return null;
}
function persistOutbox() {
  const k = obKey(); if (!k) return;
  try { if (!OB.pending.size) localStorage.removeItem(k); else { const o = {}; for (const key of OB.pending) o[key] = snapshot(key); localStorage.setItem(k, JSON.stringify(o)); } } catch {}
}
function restoreOutbox() {
  const k = obKey(); let o = null; try { o = JSON.parse(localStorage.getItem(k) || 'null'); } catch {}
  if (!o || typeof o !== 'object') return;
  for (const [key, val] of Object.entries(o)) {
    const i = key.indexOf(':'), t = key.slice(0, i), id = key.slice(i + 1);
    if (t === 's') { if (val) { const s = cleanSession(val); if (s) S.sessions.set(id, s); } else S.sessions.delete(id); }
    else if (t === 'x') { S.library = S.library.filter(e => e.id !== id); if (val && val.name) S.library.push({ id, name: String(val.name).slice(0, 60), muscle: val.muscle || 'Full body', kind: val.kind === 'bw' ? 'bw' : 'w', archived: !!val.archived, isDefault: !!val.isDefault }); }
    else if (t === 'sp') { if (val) S.splits.set(id, { ...val, days: cleanDays(val.days) }); else S.splits.delete(id); }
    else if (t === 'p' && val) S.profile = { ...S.profile, ...val, username: S.profile.username, onboarded: S.profile.onboarded };
    else continue;
    queue(key, 300);
  }
}
function queue(key, delay = 600) {
  if (!S.user) return;
  OB.pending.add(key); persistOutbox();
  clearTimeout(OB.timers.get(key)); OB.timers.set(key, setTimeout(() => flush(key), delay)); syncUI();
}
async function runJob(key) {
  const i = key.indexOf(':'), t = key.slice(0, i), id = key.slice(i + 1);
  if (t === 's') { const s = S.sessions.get(id); return s ? sb.from('sessions').upsert(sessToDb(s)) : sb.from('sessions').delete().eq('id', id); }
  if (t === 'x') { const e = S.library.find(x => x.id === id); return e ? sb.from('exercises').upsert(exToDb(e)) : sb.from('exercises').delete().eq('id', id); }
  if (t === 'sp') { const p = S.splits.get(id); return p ? sb.from('splits').upsert(splitToDb(p)) : sb.from('splits').delete().eq('id', id); }
  if (t === 'p') return sb.from('profiles').update(profToDb(S.profile)).eq('id', S.user.id);
  return { error: null };
}
const isPermanent = e => !!e && (/^\d{5}$/.test(e.code || '') || /^PGRST/.test(e.code || ''));
async function flush(key) {
  clearTimeout(OB.timers.get(key));
  if (!OB.pending.has(key) || !S.user) return;
  if (OB.inflight.has(key)) { OB.again.add(key); return; }
  OB.inflight.add(key); OB.pending.delete(key); syncUI();
  let ok = false;
  try {
    const r = await runJob(key);
    if (r.error) throw r.error;
    ok = true; OB.failing = false; OB.backoff = 2000;
  } catch (e) {
    if (isPermanent(e)) { saveError(key, e); }
    else { OB.pending.add(key); OB.failing = true; scheduleRetry(); }
  } finally {
    OB.inflight.delete(key); persistOutbox(); syncUI();
    if (OB.again.has(key)) { OB.again.delete(key); if (ok || !OB.failing) { OB.pending.add(key); flush(key); } }
  }
}
function scheduleRetry() { clearTimeout(OB.retryT); OB.retryT = setTimeout(flushAll, OB.backoff); OB.backoff = Math.min(30000, OB.backoff * 2); }
function flushAll() { for (const k of [...OB.pending]) flush(k); }
async function flushNow(key) { if (OB.pending.has(key)) await flush(key); while (OB.inflight.has(key)) await sleep(80); return !OB.pending.has(key); }
function saveError(key, e) {
  console.error('Save failed', key, e);
  if (e.code === '23505' && key.startsWith('x:')) { toast('You already have an exercise with that name'); reloadLibrary(); return; }
  if (e.code === '23514') { toast('That value isn’t allowed. Check lengths and limits.'); return; }
  toast('Couldn’t save a change: ' + (e.message || 'unknown error'));
}
addEventListener('online', flushAll);
addEventListener('pagehide', flushAll);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flushAll();
  else if (S.loaded && Date.now() - S.lastFetch > 120000 && !OB.pending.size && !OB.inflight.size) refresh();
});
function syncUI() {
  const busy = OB.pending.size || OB.inflight.size;
  let cls = 'sync', txt = 'Synced';
  if (OB.failing) { cls += ' err'; txt = navigator.onLine ? 'Retrying' : 'Offline · saved here'; }
  else if (busy) { cls += ' busy'; txt = 'Saving'; }
  for (const el of $$('[data-sync]')) { el.className = 'lbl ' + cls; el.textContent = txt; }
}

/* ================= loading ================= */
async function fetchAll(make) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await make().range(from, from + 999);
    if (error) throw error; out.push(...data); if (data.length < 1000) break;
  }
  return out;
}
async function loadAll() {
  const uid = S.user.id;
  let [pr, ex, ss, sp, sh] = await Promise.all([
    sb.from('profiles').select('*').eq('id', uid).maybeSingle(),
    fetchAll(() => sb.from('exercises').select('*').order('name')),
    fetchAll(() => sb.from('sessions').select('*').order('started_at', { ascending: false })),
    fetchAll(() => sb.from('splits').select('*').order('updated_at', { ascending: false })),
    sb.rpc('shared_with_me')
  ]);
  if (pr.error) throw pr.error;
  if (!pr.data) {
    const ins = await sb.from('profiles').insert({ id: uid }).select().single();
    if (ins.error) throw ins.error; pr = ins;
    await sb.rpc('restore_default_exercises');
    ex = await fetchAll(() => sb.from('exercises').select('*').order('name'));
  }
  const keep = k => OB.pending.has(k) || OB.inflight.has(k);
  const prof = profFromDb(pr.data);
  S.profile = keep('p') ? { ...S.profile, username: prof.username } : prof;
  const lib = new Map(ex.map(r => [r.id, exFromDb(r)]));
  for (const e of S.library) if (keep('x:' + e.id)) lib.set(e.id, e);
  for (const id of [...lib.keys()]) if (keep('x:' + id) && !S.library.some(e => e.id === id)) lib.delete(id);
  S.library = [...lib.values()];
  const sess = new Map(ss.map(r => { const s = sessFromDb(r); return [s.id, s]; }));
  for (const [id] of sess) if (keep('s:' + id) && !S.sessions.has(id)) sess.delete(id);
  for (const [id, s] of S.sessions) if (keep('s:' + id)) sess.set(id, s);
  S.sessions = sess;
  const spl = new Map(sp.map(r => [r.id, splitFromDb(r)]));
  for (const [id] of spl) if (keep('sp:' + id) && !S.splits.has(id)) spl.delete(id);
  for (const [id, p] of S.splits) if (keep('sp:' + id)) spl.set(id, p);
  S.splits = spl;
  S.shared = (sh.error ? [] : sh.data || []).map(r => ({ id: r.split_id, name: r.name, description: r.description || '', days: cleanDays(r.days), from: r.from_username, sharedAt: Date.parse(r.shared_at) }));
  S.lastFetch = S.sharedAt = Date.now();
}
async function refresh() { try { await loadAll(); soft(); } catch (e) { console.warn(e); } }
async function reloadLibrary() { try { const ex = await fetchAll(() => sb.from('exercises').select('*').order('name')); S.library = ex.map(exFromDb); render(false); } catch {} }

/* ================= metrics ================= */
const exOf = id => S.library.find(e => e.id === id);
const loadOf = (st, ex) => { const w = +st.w || 0; return ex?.kind === 'bw' ? (+S.profile.bw || 75) + w : w; };
const e1rm = (l, r) => (!(l > 0) || !(r > 0)) ? 0 : r === 1 ? l : l * (1 + r / 30);
const sorted = () => [...S.sessions.values()].sort((a, b) => b.startedAt - a.startedAt);
const activeSession = () => sorted().find(s => !s.endedAt);
const cur = () => S.sessions.get(S.arg);
function compute() {
  const exMap = new Map(S.library.map(e => [e.id, e]));
  const list = [...S.sessions.values()].sort((a, b) => a.startedAt - b.startedAt);
  const best = new Map(), seen = new Map(), A = { sess: new Map(), set: new Map(), ex: new Map() };
  for (const s of list) {
    const sb_ = new Map(), sbSet = new Map(), exVol = new Map();
    for (const it of s.items) { const ex = exMap.get(it.exId); for (const st of it.sets) { const sc = e1rm(loadOf(st, ex), +st.r || 0); if (sc > (sb_.get(it.exId) || 0)) { sb_.set(it.exId, sc); sbSet.set(it.exId, st); } } }
    const prs = []; let calib = false;
    for (const [ex, sc] of sb_) { const prev = best.get(ex) || 0; if (prev > 0 && sc > prev * 1.0001) prs.push(ex); if (sc > prev) best.set(ex, sc); if ((seen.get(ex) || 0) < 2) calib = true; }
    let vol = 0, wsum = 0, isum = 0, sets = 0;
    for (const it of s.items) {
      const ex = exMap.get(it.exId), ref = best.get(it.exId) || 0;
      for (const st of it.sets) {
        const r = +st.r || 0; if (r <= 0) continue; sets++;
        const v = (+st.w || 0) * r; vol += v; exVol.set(it.exId, (exVol.get(it.exId) || 0) + v);
        const l = loadOf(st, ex), sc = e1rm(l, r); if (!(sc > 0) || !(ref > 0)) continue;
        const pct = sc / ref * 100; A.set.set(st.id, pct); const wt = l * r; wsum += wt; isum += pct * wt;
      }
    }
    for (const [ex, top] of sb_) {
      if (!(top > 0)) continue; seen.set(ex, (seen.get(ex) || 0) + 1);
      let e = A.ex.get(ex); if (!e) { e = { pts: [], best: 0, bestSet: null, bestT: 0, last: 0, n: 0, vol: 0 }; A.ex.set(ex, e); }
      e.pts.push({ t: s.startedAt, sid: s.id, v: top, pr: prs.includes(ex) });
      if (top > e.best) { e.best = top; e.bestSet = sbSet.get(ex); e.bestT = s.startedAt; }
      e.last = s.startedAt; e.n++; e.vol += exVol.get(ex) || 0;
    }
    A.sess.set(s.id, { vol, sets, int: wsum ? isum / wsum : 0, prs, calib: calib && sets > 0, ex: s.items.length });
  }
  S.A = A; return A;
}
const tier = v => v >= 88 ? 'Max effort' : v >= 75 ? 'Hard' : v >= 60 ? 'Moderate' : v > 0 ? 'Easy' : 'No working sets yet';
const tierShort = v => v >= 88 ? 'MAX' : v >= 75 ? 'HARD' : v >= 60 ? 'MOD' : v > 0 ? 'EASY' : '—';
function sessName(s) {
  if (s.name) return s.name; const cnt = new Map();
  for (const it of s.items) { const m = exOf(it.exId)?.muscle; if (m) cnt.set(m, (cnt.get(m) || 0) + Math.max(1, it.sets.length)); }
  const top = [...cnt].sort((a, b) => b[1] - a[1]).slice(0, 2).map(x => x[0]); return top.length ? top.join(' + ') : 'Session';
}
function groupsOf(s) {
  const map = new Map();
  s.items.forEach((it, ii) => it.sets.forEach((st, si) => { if (st.g) { if (!map.has(st.g)) map.set(st.g, []); map.get(st.g).push({ it, st, ii, si }); } }));
  const out = []; let n = 0;
  for (const [g, m] of map) { if (m.length < 2) continue; m.sort((a, b) => a.ii - b.ii || a.si - b.si); out.push({ g, letter: String.fromCharCode(65 + (n++ % 26)), ...classify(m), m }); }
  return out;
}
function classify(m) {
  const exs = [...new Set(m.map(x => x.it.exId))];
  if (exs.length >= 3) return { type: 'Giant set', ab: 'GS' };
  if (exs.length === 2) return { type: 'Superset', ab: 'SS' };
  const w = m.map(x => +(x.st.w ?? x.st.pw) || 0); let down = false, up = false;
  for (let i = 1; i < w.length; i++) { if (w[i] < w[i - 1] - 1e-6) down = true; else if (w[i] > w[i - 1] + 1e-6) up = true; }
  if (down && !up) return { type: 'Drop set', ab: 'DS' };
  if (!down && !up) return { type: 'Rest-pause', ab: 'RP' };
  return { type: 'Pyramid', ab: 'PY' };
}
function cleanGroups(s) { const c = new Map(); for (const it of s.items) for (const st of it.sets) if (st.g) c.set(st.g, (c.get(st.g) || 0) + 1); for (const it of s.items) for (const st of it.sets) if (st.g && c.get(st.g) < 2) st.g = null; }
function consistency() {
  const target = S.profile.target || 3, list = sorted().filter(s => s.items.length), cw = weekStart(Date.now()), counts = new Map();
  for (const s of list) { const k = weekStart(s.startedAt); counts.set(k, (counts.get(k) || 0) + 1); }
  const thisWeek = counts.get(cw) || 0;
  if (!list.length) return { score: null, thisWeek, target, streak: 0 };
  const firstW = weekStart(list[list.length - 1].startedAt); let sum = 0, n = 0;
  for (let i = 1; i <= 8; i++) { const w = shiftWeek(cw, -i); if (w < firstW) break; sum += Math.min(1, (counts.get(w) || 0) / target); n++; }
  const score = n ? sum / n * 100 : Math.min(1, thisWeek / target) * 100;
  let streak = thisWeek >= target ? 1 : 0; for (let i = 1; i < 520; i++) { if ((counts.get(shiftWeek(cw, -i)) || 0) >= target) streak++; else break; }
  return { score, thisWeek, target, streak };
}
function dayIntensity() { const m = new Map(); for (const s of S.sessions.values()) { if (!s.items.length) continue; const k = dayKey(s.startedAt), v = S.A.sess.get(s.id)?.int || 0; m.set(k, Math.max(m.get(k) ?? 0, v)); } return m; }
function lastSetsFor(exId, excludeId) {
  for (const s of sorted()) { if (s.id === excludeId) continue; const it = s.items.find(i => i.exId === exId && i.sets.some(x => +x.r > 0)); if (it) return it.sets.filter(x => +x.r > 0); }
  return null;
}
const isRestDay = d => d.rest || /^rest$/i.test(d.type.trim());
function nextSplitDay() {
  if (!S.splits.size) return null;
  const last = sorted().find(s => s.splitId && S.splits.has(s.splitId));
  const sp = last ? S.splits.get(last.splitId) : [...S.splits.values()].sort((a, b) => b.updatedAt - a.updatedAt)[0];
  if (!sp || !sp.days.length || sp.days.every(isRestDay)) return null;
  const used = last && last.splitId === sp.id ? last.splitDay : -1;
  let i = ((used ?? -1) + 1) % sp.days.length;
  for (let k = 0; k < sp.days.length && isRestDay(sp.days[i]); k++) i = (i + 1) % sp.days.length;
  return { sp, i };
}

/* ================= router ================= */
let depth = 0;
function parsePath() {
  const seg = location.pathname.split('/').filter(Boolean);
  switch (seg[0]) {
    case undefined: return ['today'];
    case 'history': return ['history'];
    case 'exercises': return seg[1] ? ['exercise', seg[1]] : ['exercises'];
    case 'splits': if (seg[1] === 'shared' && seg[2]) return ['shared', seg[2]]; return seg[1] ? ['split', seg[1]] : ['splits'];
    case 'session': return seg[1] ? ['session', seg[1]] : ['today'];
    case 'settings': return ['prefs'];
    case 's': return seg[1] ? ['public', seg[1]] : ['today'];
    default: return ['today'];
  }
}
const pathOf = (v, a) => ({ today: '/', history: '/history', exercises: '/exercises', exercise: '/exercises/' + a, splits: '/splits', split: '/splits/' + a, shared: '/splits/shared/' + a, session: '/session/' + a, prefs: '/settings', public: '/s/' + a })[v] || '/';
function go(v, a = null, { replace = false } = {}) {
  const path = pathOf(v, a);
  if (replace) history.replaceState({ d: depth }, '', path); else { depth++; history.pushState({ d: depth }, '', path); }
  route(true);
}
function back() {
  if (depth > 0) return history.back();
  const up = { exercise: 'exercises', split: 'splits', shared: 'splits' }[S.view] || 'today';
  go(up, null, { replace: true });
}
addEventListener('popstate', e => { depth = e.state?.d || 0; route(true); });
function route(enter = true) { const [v, a] = parsePath(); S.view = v; S.arg = a ? decodeURIComponent(a) : null; S.link = null; render(enter); }

/* ================= rendering ================= */
let rT;
const isTyping = () => { const a = document.activeElement; return !!(a && /^(INPUT|TEXTAREA)$/.test(a.tagName) && a.closest('#view')); };
function soft() { clearTimeout(rT); rT = setTimeout(() => { if (isTyping()) { S.pendingRender = true; return; } render(false); }, 60); }
document.addEventListener('focusout', () => setTimeout(() => { if (S.pendingRender && !isTyping()) { S.pendingRender = false; render(false); } }, 320));

function render(enter) {
  const v = $('#view'), y = scrollY, nav = $('#nav');
  let html = '', app = false, bare = false;
  S.animate = !!enter;
  try {
    if (!sb) { html = vNoConfig(); bare = true; }
    else if (S.recover) { html = vRecover(); bare = true; }
    else if (S.view === 'public') { html = vPublic(); app = !!(S.user && S.loaded && S.profile.onboarded); }
    else if (!S.authReady || (S.user && !S.loaded && !S.loadError)) html = `<div class="boot">${brand()}</div>`;
    else if (!S.user) { html = vAuth(); bare = true; }
    else if (S.loadError) { html = vLoadError(); bare = true; }
    else if (!S.profile.onboarded) { html = vWizard(); bare = true; }
    else {
      app = true; compute();
      switch (S.view) {
        case 'session': html = cur() ? vSession() : vMissing('That session doesn’t exist any more.'); break;
        case 'history': html = vHistory(); break;
        case 'exercises': html = vExercises(); break;
        case 'exercise': html = exOf(S.arg) ? vExercise() : vMissing('That exercise doesn’t exist any more.'); break;
        case 'splits': html = vSplits(); break;
        case 'split': html = S.splits.has(S.arg) ? vSplit() : vMissing('That split doesn’t exist any more.'); break;
        case 'shared': html = vShared(); break;
        case 'prefs': html = vPrefs(); break;
        default: html = vToday();
      }
    }
  } catch (err) { console.error(err); html = `<div class="empty"><b>Something went wrong drawing this view.</b>Reload the page. Your data is safe.</div>`; }
  S.animate = false;
  v.innerHTML = html;
  v.classList.toggle('linking', !!S.link);
  nav.hidden = !app;
  document.body.classList.toggle('no-nav', !app);
  document.body.classList.toggle('bare', bare);
  document.body.classList.toggle('in-session', app && S.view === 'session');
  if (enter) { $$('.rv', v).forEach((el, i) => el.style.setProperty('--i', Math.min(i, 10))); v.classList.remove('enter'); void v.offsetWidth; v.classList.add('enter'); scrollTo(0, 0); countUp(v); }
  else { v.classList.remove('enter'); scrollTo(0, y); }
  if (app) renderNav();
  syncUI(); tick();
  wake(app && S.view === 'session' && cur() && !cur().endedAt);
  afterRender(enter);
}
function afterRender(entered) {
  if (S.view === 'split' && S.splits.has(S.arg) && !S.recipients.has(S.arg)) loadRecipients(S.arg);
  if (S.view === 'public' && (!S.pub || S.pub.token !== S.arg)) loadPublic(S.arg);
  if (S.view === 'splits' && S.loaded && entered && Date.now() - (S.sharedAt || 0) > 3000) loadShared();
}
async function loadShared() {
  S.sharedAt = Date.now();
  const { data, error } = await sb.rpc('shared_with_me');
  if (error) return;
  S.shared = (data || []).map(r => ({ id: r.split_id, name: r.name, description: r.description || '', days: cleanDays(r.days), from: r.from_username, sharedAt: Date.parse(r.shared_at) }));
  if (S.view === 'splits' || S.view === 'shared') soft();
}
function renderNav() {
  const a = activeSession(), on = v => S.view === v || (v === 'exercises' && S.view === 'exercise') || (v === 'splits' && (S.view === 'split' || S.view === 'shared'));
  const it = (v, l, i) => `<button class="nav-i${on(v) ? ' on' : ''}" data-act="nav" data-v="${v}">${i}${roll(l)}</button>`;
  $('#nav').innerHTML = `<div class="nav-brand">${brand()}</div>
  ${it('today', 'Today', ICON.today)}${it('splits', 'Splits', ICON.split)}
  <button class="nav-train${a ? ' live' : ''}" data-act="${a ? 'resume' : 'start-menu'}" data-id="${a ? a.id : ''}" aria-label="${a ? 'Resume session' : 'Start session'}"><span class="ring">${a ? ICON.play : ICON.plus}</span><span class="nl">${a ? roll('Resume session') : roll('Start session')}</span></button>
  ${it('exercises', 'Exercises', ICON.ex)}${it('history', 'History', ICON.hist)}
  <button class="nav-i nav-desk${on('prefs') ? ' on' : ''}" data-act="nav" data-v="prefs">${ICON.prefs}${roll('Settings')}</button>
  <div class="nav-foot"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span data-sync class="lbl sync"></span>${themeBtn()}</div></div>`;
}
function pageTop(title, extra = '') {
  const now = new Date();
  return `<header class="top rv"><div class="ttl"><b>${esc(title)}</b><span class="muted">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][now.getDay()]} ${now.getDate()} ${MONTHS[now.getMonth()].slice(0, 3)}</span></div><div style="display:flex;gap:8px;align-items:center">${extra}<span data-sync class="lbl sync"></span><span class="nav-mob" style="display:flex;gap:6px">${themeBtn()}<button class="iconbtn" data-act="nav" data-v="prefs" aria-label="Settings">${ICON.prefs}</button></span></div></header>`;
}
const vMissing = msg => `<header class="s-top rv"><button class="iconbtn" data-act="back" aria-label="Back">${ICON.back}</button></header><div class="empty rv"><b>${esc(msg)}</b>It may have been deleted on another device.</div>`;
const shell = inner => `<div class="ob"><div class="ob-in"><div class="ob-top">${brand()}${themeBtn()}</div>${inner}</div></div>`;
const vNoConfig = () => shell(`<div class="msg err">This deployment is missing its Supabase settings. Set VITE_SUPABASE_URL and VITE_SUPABASE_KEY in Vercel, then redeploy.</div>`);
const vLoadError = () => shell(`<h1>Couldn’t load <em>your log</em>.</h1><p class="lead">${esc(S.loadError)}</p><button class="btn lg" data-act="retry-load">Try again</button><button class="linkbtn" data-act="signout">Sign out</button>`);

/* ---------- auth ---------- */
function authSide() {
  return `<aside class="auth-side">${orbs()}
    <div>${brand('on-hero')}</div>
    <div><span class="lbl" style="color:var(--sea-ink-2)">Strength training log</span>
    ${disp(['Every set', 'builds you,', '<em>session by session</em>.'])}</div>
    <div class="statgrid">
      <div class="stat"><span class="n">100</span><span class="l">point intensity score on every set</span></div>
      <div class="stat"><span class="n">5</span><span class="l">set types it spots for you</span></div>
      <div class="stat"><span class="n">43</span><span class="l">exercises ready on day one</span></div>
      <div class="stat"><span class="n">2</span><span class="l">ways to share your split</span></div>
    </div></aside>`;
}
function obBar(step) { return `<div class="ob-bar" aria-label="Step ${step} of 5">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= step ? 'on' : ''}"></i>`).join('')}</div>`; }
function vAuth() {
  const m = S.authMode, msg = S.authMsg;
  const msgHTML = msg ? `<div class="msg${msg.err ? ' err' : ''}" role="alert">${esc(msg.text)}</div>` : '';
  let box;
  if (m === 'forgot') box = `<div><h2>Reset your password</h2><p class="muted" style="margin-top:6px">We’ll email you a link to set a new one.</p></div>
    <form id="f-forgot" novalidate><label>Email<input class="field" type="email" name="email" autocomplete="email" required></label>${msgHTML}<button class="btn lg" type="submit">Send reset link</button></form>
    <button class="linkbtn" data-act="auth-mode" data-m="signin">Back to log in</button>`;
  else if (m === 'check') box = `${obBar(1)}<div><span class="lbl">Step 1 of 5</span><h2 style="margin-top:6px">Check your inbox</h2><p class="muted" style="margin-top:6px">We sent a confirmation link to <b style="color:var(--ink)">${esc(S.pendingEmail || 'your email')}</b>. Tap it to confirm your account, and you’ll come straight back here to finish setting up.</p></div>
    ${msgHTML}<button class="btn line lg" data-act="resend">Resend the email</button><button class="linkbtn" data-act="auth-mode" data-m="signin">I’ve confirmed, log in</button>`;
  else if (m === 'signup') box = `${obBar(1)}<div><span class="lbl">Step 1 of 5 · Account</span><h2 style="margin-top:6px">Create your account</h2><p class="muted" style="margin-top:6px">Free. Your log stays private to you.</p></div>
    <div class="auth-tabs"><button data-act="auth-mode" data-m="signin">Log in</button><button class="on">Register</button></div>
    <form id="f-auth" novalidate>
      <label>Email<input class="field" type="email" name="email" autocomplete="email" required></label>
      <label>Password<input class="field" type="password" name="password" data-f="pw" autocomplete="new-password" minlength="8" required></label>
      <div class="pw-meter" aria-hidden="true"><i id="pwm"></i></div><span class="muted" id="pwt" style="font-size:.78rem;margin-top:-8px">At least 8 characters. A passphrase is best.</span>
      <label>Confirm password<input class="field" type="password" name="password2" autocomplete="new-password" minlength="8" required></label>
      ${msgHTML}<button class="btn lg" type="submit">Create account</button>
    </form><p class="muted" style="font-size:.78rem">Passwords are handled by Supabase Auth and stored hashed. We never see them.</p>`;
  else box = `<div><h2>Welcome back</h2><p class="muted" style="margin-top:6px">Log in to pick up where you left off.</p></div>
    <div class="auth-tabs"><button class="on">Log in</button><button data-act="auth-mode" data-m="signup">Register</button></div>
    <form id="f-auth" novalidate>
      <label>Email<input class="field" type="email" name="email" autocomplete="email" required></label>
      <label>Password<input class="field" type="password" name="password" autocomplete="current-password" required></label>
      ${msgHTML}<button class="btn lg" type="submit">Log in</button>
    </form><button class="linkbtn" data-act="auth-mode" data-m="forgot" style="align-self:flex-start">Forgot password?</button>`;
  return `<div class="auth">${authSide()}<main class="auth-main"><div class="auth-box">${box}</div></main></div>`;
}
function vRecover() {
  return shell(`<h1>Set a <em>new password</em>.</h1>
  <form id="f-recover" novalidate><label>New password<input class="field" type="password" name="password" data-f="pw" autocomplete="new-password" minlength="8" required></label><div class="pw-meter" aria-hidden="true"><i id="pwm"></i></div>${S.authMsg ? `<div class="msg${S.authMsg.err ? ' err' : ''}">${esc(S.authMsg.text)}</div>` : ''}<button class="btn lg wide" type="submit">Save password</button></form>`);
}
const GOALS = [['strength', 'Get stronger', 'Heavier lifts, lower reps'], ['muscle', 'Build muscle', 'More volume, moderate reps'], ['fitness', 'General fitness', 'Feel good, stay consistent'], ['fat_loss', 'Lose fat', 'Keep strength while you cut']];
const LEVELS = [['beginner', 'Beginner', 'Under a year of lifting'], ['intermediate', 'Intermediate', 'One to three years'], ['advanced', 'Advanced', 'Three years or more']];
function vWizard() {
  const o = S.ob, step = o.step, msg = S.authMsg ? `<div class="msg${S.authMsg.err ? ' err' : ''}" role="alert">${esc(S.authMsg.text)}</div>` : '';
  const head = (t, lead) => `${obBar(step)}<div><span class="lbl">Step ${step} of 5</span><h1 style="margin-top:8px">${t}</h1>${lead ? `<p class="lead" style="margin-top:10px">${lead}</p>` : ''}</div>`;
  const nav = (next, label = 'Continue') => `<div class="ob-nav">${step > 2 ? `<button class="btn line" data-act="ob-back">Back</button>` : '<span></span>'}<button class="btn lg" ${next}>${label}</button></div>`;
  let body = '';
  if (step === 2) body = head('Who’s <em>lifting</em>?', 'Your name is just for you. Your username is how other lifters share splits with you.') + `
    <form id="f-ob2" novalidate>
      <label>Your name<input class="field" name="name" value="${esc(o.name)}" maxlength="40" autocomplete="given-name" placeholder="e.g. Alex"></label>
      <label>Username<input class="field" name="username" value="${esc(o.username)}" maxlength="20" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="e.g. heavy_alex"></label>
      <span class="muted" style="font-size:.78rem;margin-top:-6px">Lowercase letters, numbers and underscores, 3 to 20 characters.</span>
      ${msg}<div class="ob-nav"><span></span><button class="btn lg" type="submit">Continue</button></div></form>`;
  else if (step === 3) body = head('Your body, <em>your units</em>.', 'Bodyweight counts toward pull-ups, dips and other bodyweight moves.') + `
    <div class="pref" style="border:0;padding:0"><span class="k">Units</span><span class="seg"><button class="${o.unit === 'kg' ? 'on' : ''}" data-act="ob-unit" data-u="kg">kg</button><button class="${o.unit === 'lb' ? 'on' : ''}" data-act="ob-unit" data-u="lb">lb</button></span></div>
    <label style="display:grid;gap:6px;font-size:.82rem;font-weight:600;color:var(--ink-2)">Bodyweight (${o.unit})<input class="field" data-f="obbw" inputmode="decimal" value="${o.bw ? Math.round((o.unit === 'lb' ? o.bw * KG_LB : o.bw) * 10) / 10 : ''}" placeholder="${o.unit === 'lb' ? '165' : '75'}"></label>
    <div><span class="lbl">Experience</span><div class="choice" style="margin-top:8px">${LEVELS.map(([k, t, d]) => `<button class="opt${o.exp === k ? ' on' : ''}" data-act="ob-pick" data-k="exp" data-v="${k}"><b>${t}</b><span>${d}</span></button>`).join('')}</div></div>
    ${msg}${nav('data-act="ob-next"')}`;
  else if (step === 4) body = head('What are you <em>training for</em>?', 'This shapes the split we suggest next. You can change everything later.') + `
    <div class="choice two">${GOALS.map(([k, t, d]) => `<button class="opt${o.goal === k ? ' on' : ''}" data-act="ob-pick" data-k="goal" data-v="${k}"><b>${t}</b><span>${d}</span></button>`).join('')}</div>
    <div><span class="lbl">Days a week you can train</span><div class="daysel" style="margin-top:8px">${[1, 2, 3, 4, 5, 6, 7].map(n => `<button class="${o.days === n ? 'on' : ''}" data-act="ob-pick" data-k="days" data-v="${n}" aria-label="${n} days">${n}</button>`).join('')}</div>
    <p class="muted" style="font-size:.82rem;margin-top:8px">This becomes your weekly target for the consistency score.</p></div>
    ${msg}${nav('data-act="ob-next"')}`;
  else {
    const rec = recommendTemplate(o.days, o.exp);
    const list = [rec, ...TEMPLATES.filter(t => t.id !== rec.id)];
    body = head('Pick a <em>starting split</em>.', `Based on ${o.days} day${o.days === 1 ? '' : 's'} a week. It’s yours to edit in the Splits tab.`) + `
    <div class="choice">${list.map(t => `<button class="opt${o.tpl === t.id ? ' on' : ''}" data-act="ob-pick" data-k="tpl" data-v="${t.id}"><b>${esc(t.name)}${t.id === rec.id ? ' <span class="badge acc">recommended</span>' : ''}</b><span>${esc(t.desc)}</span><span style="margin-top:6px">${t.plan.map(d => esc(d[0])).join(' · ')}</span></button>`).join('')}
    <button class="opt${o.tpl === 'none' ? ' on' : ''}" data-act="ob-pick" data-k="tpl" data-v="none"><b>I’ll build my own</b><span>Start with an empty Splits tab</span></button></div>
    ${msg}${nav('data-act="ob-finish"' + (o.tpl ? '' : ' disabled'), 'Finish setup')}`;
  }
  return `<div class="ob"><div class="ob-in"><div class="ob-top">${brand()}<div style="display:flex;gap:8px;align-items:center">${themeBtn()}<button class="linkbtn" data-act="signout">Sign out</button></div></div>${body}</div></div>`;
}

/* starter splits (exercise names match the default list) */
const R = ['Rest'];
const FB_A = ['Full body A', [['Back Squat', 3, '5'], ['Bench Press', 3, '5'], ['Barbell Row', 3, '8'], ['Hanging Leg Raise', 3, '10-12']]];
const FB_B = ['Full body B', [['Deadlift', 3, '5'], ['Overhead Press', 3, '6-8'], ['Pull-up', 3, '6-10'], ['Walking Lunge', 3, '10']]];
const FB_C = ['Full body C', [['Front Squat', 3, '6-8'], ['Incline Dumbbell Press', 3, '8-10'], ['Seated Cable Row', 3, '10'], ['Cable Crunch', 3, '12']]];
const UP_A = ['Upper A', [['Bench Press', 4, '5-6'], ['Barbell Row', 4, '6-8'], ['Overhead Press', 3, '8'], ['Lat Pulldown', 3, '10'], ['Barbell Curl', 2, '10-12'], ['Tricep Pushdown', 2, '10-12']]];
const LO_A = ['Lower A', [['Back Squat', 4, '5'], ['Romanian Deadlift', 3, '8'], ['Leg Press', 3, '10'], ['Leg Curl', 3, '10-12'], ['Calf Raise', 3, '12']]];
const UP_B = ['Upper B', [['Incline Dumbbell Press', 4, '8-10'], ['Pull-up', 4, '6-10'], ['Arnold Press', 3, '10'], ['Seated Cable Row', 3, '10'], ['Hammer Curl', 2, '12'], ['Skull Crusher', 2, '12']]];
const LO_B = ['Lower B', [['Deadlift', 3, '5'], ['Front Squat', 3, '6-8'], ['Bulgarian Split Squat', 3, '10'], ['Hip Thrust', 3, '10'], ['Hanging Leg Raise', 3, '12']]];
const PUSH = ['Push', [['Bench Press', 4, '6-8'], ['Overhead Press', 3, '8'], ['Incline Dumbbell Press', 3, '10'], ['Lateral Raise', 3, '12-15'], ['Tricep Pushdown', 3, '12']]];
const PULL = ['Pull', [['Deadlift', 3, '5'], ['Pull-up', 3, '8'], ['Barbell Row', 3, '8-10'], ['Face Pull', 3, '15'], ['Barbell Curl', 3, '10']]];
const LEGS = ['Legs', [['Back Squat', 4, '6-8'], ['Romanian Deadlift', 3, '8-10'], ['Leg Press', 3, '12'], ['Leg Curl', 3, '12'], ['Calf Raise', 4, '12']]];
const TEMPLATES = [
  { id: 'fb2', name: 'Full Body ×2', days: 2, desc: 'Two full-body days a week. Ideal when time is tight.', plan: [FB_A, R, R, FB_B, R, R, R] },
  { id: 'fb3', name: 'Full Body ×3', days: 3, desc: 'Three full-body sessions with a rest day between each.', plan: [FB_A, R, FB_B, R, FB_C, R, R] },
  { id: 'ul4', name: 'Upper / Lower', days: 4, desc: 'Each muscle twice a week across four sessions.', plan: [UP_A, LO_A, R, UP_B, LO_B, R, R] },
  { id: 'ppl5', name: 'Push / Pull / Legs + Upper / Lower', days: 5, desc: 'Five days mixing PPL with an upper and a lower day.', plan: [PUSH, PULL, LEGS, R, UP_A, LO_A, R] },
  { id: 'ppl6', name: 'Push / Pull / Legs ×2', days: 6, desc: 'The classic six-day split for building muscle.', plan: [PUSH, PULL, LEGS, PUSH, PULL, LEGS, R] }
];
function recommendTemplate(days, exp) {
  let d = days || 3; if (exp === 'beginner') d = Math.min(d, 4);
  const id = d <= 2 ? 'fb2' : d === 3 ? 'fb3' : d === 4 ? 'ul4' : d === 5 ? 'ppl5' : 'ppl6';
  return TEMPLATES.find(t => t.id === id);
}
function splitFromTemplate(t) {
  const days = t.plan.map(([type, exs]) => ({ id: sid(), type, rest: !exs, exercises: (exs || []).map(([name, sets, reps]) => {
    const lib = S.library.find(e => e.name.toLowerCase() === name.toLowerCase());
    const e = ensureExercise({ exId: lib?.id, name, muscle: lib?.muscle || 'Full body', kind: lib?.kind || 'w' });
    if (e.archived) { e.archived = false; queue('x:' + e.id, 0); }
    return { id: sid(), exId: e.id, name: e.name, muscle: e.muscle, kind: e.kind, sets, reps };
  }) }));
  const sp = { id: uuid(), name: t.name, description: t.desc, days, shareToken: null, copiedFrom: null, updatedAt: Date.now() };
  S.splits.set(sp.id, sp); queue('sp:' + sp.id, 0); return sp;
}
const authErr = e => {
  const m = (e && e.message) || 'Something went wrong. Try again.';
  if (/invalid login/i.test(m)) return 'That email and password don’t match.';
  if (/email not confirmed/i.test(m)) return 'Confirm your email first. Check your inbox for the link.';
  if (/rate limit|too many/i.test(m)) return 'Too many attempts. Wait a minute and try again.';
  return m;
};
document.addEventListener('submit', async e => {
  const f = e.target; if (!f.id || !f.id.startsWith('f-')) return; e.preventDefault();
  const fd = new FormData(f), btn = f.querySelector('button[type=submit]'); btn.disabled = true; btn.style.opacity = .5;
  const done = (text, err) => { S.authMsg = text ? { text, err } : null; render(false); };
  try {
    if (f.id === 'f-auth') {
      const email = String(fd.get('email') || '').trim(), password = String(fd.get('password') || '');
      if (!/^\S+@\S+\.\S+$/.test(email)) return done('Enter a valid email address.', true);
      if (S.authMode === 'signup') {
        if (password.length < 8) return done('Use at least 8 characters for your password.', true);
        if (password !== String(fd.get('password2') || '')) return done('The two passwords don’t match.', true);
        const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: location.origin } });
        if (error) return done(authErr(error), true);
        if (!data.session) { S.pendingEmail = email; S.authMode = 'check'; return done(null); }
      } else {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) return done(authErr(error), true);
      }
      S.authMsg = null;
    } else if (f.id === 'f-forgot') {
      const email = String(fd.get('email') || '').trim();
      if (!/^\S+@\S+\.\S+$/.test(email)) return done('Enter a valid email address.', true);
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + '/settings' });
      if (error) return done(authErr(error), true);
      done('If that email has an account, a reset link is on its way.', false);
    } else if (f.id === 'f-recover') {
      const password = String(fd.get('password') || '');
      if (password.length < 8) return done('Use at least 8 characters.', true);
      const { error } = await sb.auth.updateUser({ password });
      if (error) return done(authErr(error), true);
      S.recover = false; S.authMsg = null; toast('Password updated'); go('today', null, { replace: true });
    } else if (f.id === 'f-ob2') {
      const name = String(fd.get('name') || '').trim().slice(0, 40);
      S.ob.name = name; S.ob.username = String(fd.get('username') || '');
      if (!name) return done('Tell us what to call you.', true);
      if (!(await setUsername(S.ob.username))) return;
      S.profile.name = name;
      const { error } = await sb.from('profiles').update({ display_name: name }).eq('id', S.user.id);
      if (error) return done('Couldn’t save your name. Try again.', true);
      S.authMsg = null; S.ob.step = 3; render(true);
    }
  } finally { btn.disabled = false; btn.style.opacity = ''; }
});
async function setUsername(raw) {
  const u = raw.trim().toLowerCase().replace(/^@/, '');
  const bad = t => { S.authMsg = { text: t, err: true }; render(false); toast(t); return false; };
  if (!/^[a-z0-9_]{3,20}$/.test(u)) return bad('Use 3–20 lowercase letters, numbers or underscores.');
  const { error } = await sb.from('profiles').update({ username: u }).eq('id', S.user.id);
  if (error) return bad(error.code === '23505' ? `@${u} is taken. Try another.` : 'Couldn’t save that username. Try again.');
  S.profile.username = u; return true;
}
const pendingPublic = () => { try { const t = localStorage.getItem('sg-open-split'); localStorage.removeItem('sg-open-split'); return t; } catch { return null; } };

/* ---------- Today ---------- */
function vToday() {
  const now = new Date(), C = consistency(), a = activeSession(), list = sorted();
  const total = [...S.A.sess.values()].reduce((x, s) => x + s.vol, 0);
  const done = list.filter(s => s.endedAt);
  const avg = done.length ? done.slice(0, 10).reduce((x, s) => x + (S.A.sess.get(s.id)?.int || 0), 0) / Math.min(10, done.length) : 0;
  const d30 = Date.now() - 30 * 864e5, prs30 = list.filter(s => s.startedAt >= d30).reduce((x, s) => x + (S.A.sess.get(s.id)?.prs.length || 0), 0);
  const last = done[0], nx = !a && nextSplitDay(), hi = esc(S.profile.name || S.profile.username);
  let lines, cta;
  if (a) {
    const sa = S.A.sess.get(a.id);
    lines = [`Hey ${hi},`, 'your session', '<em>is live</em>.'];
    cta = `<div class="what"><span>In progress</span><b>${esc(sessName(a))}</b><span>${plural(a.items.length, 'exercise')} · ${plural(sa.sets, 'set')} logged</span></div><button class="fab magnet" data-act="resume" data-id="${a.id}" aria-label="Resume session">${ICON.play}</button>`;
  } else if (nx) {
    const d = nx.sp.days[nx.i];
    lines = [`Hey ${hi},`, d.type ? esc(d.type) : 'training day', '<em>is up next</em>.'];
    cta = `<div class="what"><span>${esc(nx.sp.name)} · day ${nx.i + 1}</span><b>${esc(d.type || 'Training')}</b><span>${d.exercises.slice(0, 3).map(x => esc(x.name)).join(' · ') || 'No exercises planned yet'}${d.exercises.length > 3 ? ` +${d.exercises.length - 3}` : ''}</span></div>
      <div style="display:flex;gap:8px;align-items:center"><button class="btn line sm" data-act="start">Empty</button><button class="fab magnet" data-act="start-day" data-sp="${nx.sp.id}" data-day="${nx.i}" aria-label="Start this day">${ICON.plus}</button></div>`;
  } else {
    lines = list.length ? [`Hey ${hi},`, 'every set', '<em>adds up</em>.'] : [`Hey ${hi},`, 'let’s log your', '<em>first session</em>.'];
    cta = `<div class="what"><span>Next session</span><b>Start a session</b><span>${last ? `or repeat ${esc(sessName(last))}` : 'Log sets as you go. Intensity updates live.'}</span></div>
      <div style="display:flex;gap:8px;align-items:center">${last ? `<button class="btn line sm" data-act="repeat" data-id="${last.id}">Repeat</button>` : ''}<button class="fab magnet" data-act="start" aria-label="Start session">${ICON.plus}</button></div>`;
  }
  return pageTop('Synergym') + `
  <section class="hero rv">${orbs()}
    <div><span class="lbl eyebrow">${DAYS[now.getDay()].toLowerCase()} · ${fmtDate(now)} · <span data-now="t">${fmtTime(now)}</span></span>${disp(lines)}</div>
    <div class="statgrid">
      <div class="stat">${big(C.thisWeek)}<span class="l">Sessions this week <small>of ${C.target}</small></span></div>
      <div class="stat">${big(C.score == null ? '–' : Math.round(C.score))}<span class="l">Consistency score</span></div>
      <div class="stat">${big(C.streak)}<span class="l">Week streak</span></div>
      <div class="stat">${big(prs30)}<span class="l">Records this month</span></div>
    </div>
    <div class="hero-cta">${cta}</div>
  </section>
  <div class="dash">
    <div class="card rv">
      <div class="card-h"><span class="lbl">Intensity · 30 days</span><span class="lbl">avg ${Math.round(avg)}</span></div>
      ${chart30()}
    </div>
    <div class="card rv">
      <div class="card-h"><span class="lbl">Consistency · 18 weeks</span><span class="lbl">target ${C.target}/week</span></div>
      ${heat()}
      <div class="heat-f"><span class="lbl">less</span><span class="lbl">more intense</span></div>
    </div>
    <section class="card span rv">
      <div class="card-h"><span class="lbl">Recent sessions</span><button class="lbl" data-act="nav" data-v="history">${roll('All history')}</button></div>
      <div class="list">${list.length ? list.slice(0, 6).map(rowSession).join('') : `<div class="empty"><b>No sessions yet.</b>Tap + to start, or open Splits to plan your week. Intensity calibrates once each exercise has a couple of sessions.</div>`}</div>
    </section>
    <section class="panel stats span rv">
      <div class="term">${plural(list.length, 'session')} · ${fmtVol(total)} lifted</div>
      <div class="seg" role="group" aria-label="Units"><button class="${unit() === 'kg' ? 'on' : ''}" data-act="unit" data-u="kg">kg</button><button class="${unit() === 'lb' ? 'on' : ''}" data-act="unit" data-u="lb">lb</button></div>
      <div class="term">avg intensity ${Math.round(avg)} · ${prs30} record${prs30 === 1 ? '' : 's'} / 30d</div>
      ${S.profile.restOn ? `<label class="restctl"><span class="lbl" id="restv">rest ${mmss(S.profile.rest * 1000)}</span><input type="range" class="range" data-f="restr" min="15" max="300" step="15" value="${S.profile.rest}" aria-label="Rest between sets"></label>` : `<span class="lbl" style="justify-self:end">rest timer off</span>`}
    </section>
  </div>`;
}
function rowSession(s) {
  const a = S.A.sess.get(s.id) || { ex: 0, sets: 0, vol: 0, prs: [], int: 0 };
  const sp = s.splitId && S.splits.get(s.splitId);
  return `<button class="row" data-act="open" data-id="${s.id}"><span class="tri"></span>
  <span class="row-m"><span class="t">${esc(sessName(s))}</span><span class="sub">${fmtDate(s.startedAt)}${sp ? ` · ${esc(sp.name)} day ${(s.splitDay ?? 0) + 1}` : ''} · ${a.sets} sets · ${fmtVol(a.vol)}${a.prs.length ? ` · <em class="pr">${a.prs.length} PR</em>` : ''}</span></span>
  <span class="row-r"><span class="d">${Math.round(a.int)}</span><span class="ichip${s.endedAt ? (a.int >= 75 ? ' hot' : '') : ' hot'}">${s.endedAt ? tierShort(a.int) : 'LIVE'}</span></span></button>`;
}
function heat() {
  const weeks = 18, cw = weekStart(Date.now()), start = shiftWeek(cw, -(weeks - 1)), di = dayIntensity(), tk = dayKey(Date.now()), now = Date.now();
  let h = '';
  for (let w = 0; w < weeks; w++) { const ws = shiftWeek(start, w); for (let d = 0; d < 7; d++) { const dt = new Date(ws); dt.setDate(dt.getDate() + d); const k = dayKey(dt);
    let c = ''; if (dt.getTime() > now) c = 'fut'; else if (di.has(k)) { const v = di.get(k); c = v >= 85 ? 'l4' : v >= 72 ? 'l3' : v >= 55 ? 'l2' : 'l1'; }
    if (k === tk) c += ' today'; h += `<i class="${c}" title="${fmtDate(dt)}${di.has(k) ? ' · int ' + Math.round(di.get(k)) : ''}"></i>`; } }
  return `<div class="heat" aria-label="Training days, last 18 weeks">${h}</div>`;
}
function chart30() {
  const di = dayIntensity(), days = 30, W = 300, H = 100, step = W / days, t0 = new Date(); t0.setHours(12, 0, 0, 0);
  let g = '', f = '';
  for (let i = 0; i < days; i++) {
    const d = new Date(t0); d.setDate(d.getDate() - (days - 1 - i)); const v = di.get(dayKey(d)); const x = (i * step + step / 2).toFixed(2);
    for (const off of [-step / 3, 0, step / 3]) g += `<line class="gl" x1="${(+x + off).toFixed(2)}" x2="${(+x + off).toFixed(2)}" y1="2" y2="${H}"/>`;
    if (v != null) { const hh = Math.max(4, Math.min(100, v) / 100 * (H - 6)); f += `<line class="${i === days - 1 ? 'al' : 'fl'}" x1="${x}" x2="${x}" y1="${H}" y2="${(H - hh).toFixed(1)}"/>`; }
  }
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-label="Daily session intensity, last 30 days">${g}${f}</svg>
  <div class="axis"><span class="lbl">30d</span><span class="lbl">20d</span><span class="lbl">10d</span><span class="lbl">today</span></div></div>`;
}

/* ---------- Session ---------- */
function vSession() {
  const s = cur(), a = S.A.sess.get(s.id), live = !s.endedAt, groups = groupsOf(s), gmap = new Map();
  for (const g of groups) for (const x of g.m) gmap.set(x.st.id, g);
  const sp = s.splitId && S.splits.get(s.splitId);
  return `<header class="s-top rv"><button class="iconbtn" data-act="back" aria-label="Back">${ICON.back}</button>
    <input class="s-name" data-f="sname" value="${esc(s.name || '')}" placeholder="${esc(sessName({ ...s, name: null }))}" aria-label="Session name" maxlength="80">
    <button class="iconbtn" data-act="sess-menu" aria-label="Session options">${ICON.dots}</button></header>
  <div class="s-meta lbl rv">${fmtDate(s.startedAt)} · ${fmtTime(s.startedAt)}${sp ? ` · ${esc(sp.name)} day ${(s.splitDay ?? 0) + 1}` : ''} · ${live ? 'live' : 'completed'} <span data-sync class="lbl sync" style="margin-left:8px"></span></div>
  <section class="s-hero rv"><div><div class="lbl">Session intensity</div>
    <div class="bignum" id="sint" style="margin-top:10px">${big(Math.round(a.int))}<span class="dot${live ? ' live' : ''}"></span></div>
    <div class="tier" id="stier">${tierText(a)}</div></div>
    <button class="fab magnet" data-act="add-ex" aria-label="Add exercise">${ICON.plus}</button></section>
  <div class="wave rv" id="wave">${wave(s)}</div>
  <div class="strip rv" id="strip">${stripHTML(a)}</div>
  <div class="items">${s.items.map(it => exCard(it, gmap)).join('') || `<div class="empty rv"><b>No exercises yet.</b>Tap + to add one from your library.</div>`}</div>
  <div class="groups" id="gsum">${groupsHTML(groups)}</div>
  <textarea class="notes rv" data-f="notes" placeholder="Notes: how it felt, sleep, anything worth remembering" maxlength="4000">${esc(s.notes || '')}</textarea>
  ${live ? '' : `<div class="done-bar rv"><button class="btn" data-act="repeat" data-id="${s.id}">${roll('Repeat this session')}</button><button class="btn ghost" data-act="edit-date">${roll('Change date')}</button></div>`}
  ${transport(s)}`;
}
const tierText = a => `${tier(a.int)}${a.prs.length ? ` · <em class="pr">${a.prs.length} PR</em>` : ''}${a.calib ? ' · calibrating' : ''}`;
const stripHTML = a => `<span><b>${fmtVol(a.vol)}</b></span><span><b>${a.sets}</b> set${a.sets === 1 ? '' : 's'}</span><span><b>${a.ex}</b> exercise${a.ex === 1 ? '' : 's'}</span>${a.prs.length ? `<span class="pr">${a.prs.length} record${a.prs.length === 1 ? '' : 's'}</span>` : ''}`;
function wave(s) {
  const bars = []; for (const it of s.items) for (const st of it.sets) bars.push({ p: S.A.set.get(st.id) || 0, d: st.done || !!s.endedAt });
  const n = Math.max(bars.length, 24), W = n * 6, H = 54, ticks = [];
  for (let i = 0; i < n; i++) ticks.push(`<rect class="tk" x="${i * 6 + 2.5}" y="${H / 2 - 0.5}" width="1" height="1"/>`);
  const b = bars.map((x, i) => { if (!x.p) return ''; const h = Math.max(3, Math.min(100, x.p) / 100 * (H - 4)); return `<rect class="wb${x.d ? '' : ' o'}" x="${i * 6 + 1.5}" y="${(H - h) / 2}" width="3" height="${h}" rx="1.5"/>`; }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMinYMid meet" aria-label="Set intensity, in order">${ticks.join('')}${b}</svg>`;
}
const setInt = st => { const p = S.A.set.get(st.id); return p ? Math.round(p) : '·'; };
function exCard(it, gmap) {
  const ex = exOf(it.exId) || { name: 'Deleted exercise', muscle: '', kind: 'w' }, e = S.A.ex.get(it.exId), bw = ex.kind === 'bw';
  return `<article class="ex rv" data-item="${it.id}">
  <div class="ex-h"><button class="nm" data-act="open-ex" data-id="${esc(it.exId)}"><h3>${esc(ex.name)}</h3><div class="sub">${esc(ex.muscle)}${e ? ` · best e1RM ${fmtW(e.best)} ${unit()}` : ' · first log'}</div></button>
  <button class="iconbtn" data-act="item-menu" data-item="${it.id}" aria-label="Exercise options">${ICON.dots}</button></div>
  <div class="set-head lbl"><span>Set</span><span>${bw ? '+' + unit() : unit()}</span><span>Reps</span><span>Int</span><span></span></div>
  <div class="sets">${it.sets.map((st, i) => setRow(st, i, gmap)).join('')}</div>
  <div class="ex-f"><button class="btn ghost sm" data-act="add-set" data-item="${it.id}">${roll('+ Set')}</button>${it.sets.length ? `<button class="btn line sm" data-act="add-drop" data-set="${it.sets[it.sets.length - 1].id}">${roll('+ Drop')}</button>` : ''}</div></article>`;
}
function setRow(st, i, gmap) {
  const g = gmap.get(st.id), p = S.A.set.get(st.id), sel = S.link && S.link.has(st.id);
  return `<div class="set${st.done ? ' done' : ''}${sel ? ' sel' : ''}"${S.link ? ` data-act="link-pick" data-set="${st.id}"` : ''}>
  <button class="sno" data-act="set-menu" data-set="${st.id}" aria-label="Set ${i + 1} options">${i + 1}<span data-gtag="${st.id}">${g ? `<span class="gtag">${g.ab}·${g.letter}</span>` : ''}</span></button>
  <input data-f="w" data-set="${st.id}" inputmode="decimal" enterkeyhint="next" value="${fmtW(st.w)}" placeholder="${st.pw != null ? fmtW(st.pw) : '0'}" aria-label="Weight, set ${i + 1}" autocomplete="off">
  <input data-f="r" data-set="${st.id}" inputmode="numeric" enterkeyhint="next" value="${st.r ?? ''}" placeholder="${st.pr ?? '0'}" aria-label="Reps, set ${i + 1}" autocomplete="off">
  <span class="int${p >= 99.5 ? ' top' : ''}" data-int="${st.id}">${setInt(st)}</span>
  <button class="chk" data-act="done" data-set="${st.id}" aria-label="${st.done ? 'Mark set not done' : 'Mark set done'}" aria-pressed="${!!st.done}">${ICON.check}</button></div>`;
}
function groupsHTML(groups) {
  return groups.map(g => { const names = [...new Set(g.m.map(x => exOf(x.it.exId)?.name || '?'))];
    return `<div class="grp"><span class="gtag">${g.ab}·${g.letter}</span><span><b style="font-weight:500">${g.type}</b> <span class="muted">· ${g.m.length} sets · ${esc(names.join(' + '))}</span></span><button class="gx lbl" data-act="unlink" data-g="${g.g}">${roll('Unlink')}</button></div>`; }).join('');
}
function transport(s) {
  if (S.link) {
    const sel = [...S.link], prev = sel.length >= 2 ? previewGroup(s, sel) : null;
    return `<div class="transport"><button class="tb on" data-act="link-cancel" aria-label="Cancel linking">${ICON.x}</button>
    <div class="tlink"><b>${sel.length < 2 ? 'Select sets to link' : prev.type}</b><span class="muted">${sel.length} selected${sel.length < 2 ? ' · tap 2 or more' : ''}</span></div>
    <button class="tfin" data-act="link-do"${sel.length < 2 ? ' disabled style="opacity:.4"' : ''}>Link</button></div>`;
  }
  const live = !s.endedAt;
  return `<div class="transport"><button class="tb" data-act="link-toggle" aria-label="Link sets into a superset, giant set or drop set" title="Link sets">${ICON.link}</button><span class="tdiv"></span>
  <div class="tsum" id="tsum" data-act="rest-tap"></div>
  <span id="trest" hidden style="display:flex;gap:2px"><button class="tb" data-act="rest-add" data-d="-15" aria-label="15 seconds less">−15</button><button class="tb" data-act="rest-add" data-d="15" aria-label="15 seconds more">+15</button></span>
  ${live ? `<button class="tfin" data-act="finish"><i></i>Finish</button>` : `<button class="tfin" data-act="back">Done</button>`}</div>`;
}
function previewGroup(s, ids) { const m = []; s.items.forEach((it, ii) => it.sets.forEach((st, si) => { if (ids.includes(st.id)) m.push({ it, st, ii, si }); })); m.sort((a, b) => a.ii - b.ii || a.si - b.si); return classify(m); }
function liveRefresh() {
  const s = cur(); if (!s || S.view !== 'session') return; compute(); const a = S.A.sess.get(s.id);
  const si = $('#sint'); if (si) { const n = si.querySelector('.n'); if (n) n.textContent = Math.round(a.int); }
  const t = $('#stier'); if (t) t.innerHTML = tierText(a);
  const w = $('#wave'); if (w) w.innerHTML = wave(s);
  const sp = $('#strip'); if (sp) sp.innerHTML = stripHTML(a);
  const groups = groupsOf(s), gmap = new Map(); for (const g of groups) for (const x of g.m) gmap.set(x.st.id, g);
  for (const it of s.items) for (const st of it.sets) {
    const el = $(`[data-int="${st.id}"]`); if (el) { el.textContent = setInt(st); el.classList.toggle('top', (S.A.set.get(st.id) || 0) >= 99.5); }
    const gt = $(`[data-gtag="${st.id}"]`); if (gt) { const g = gmap.get(st.id); gt.innerHTML = g ? `<span class="gtag">${g.ab}·${g.letter}</span>` : ''; }
  }
  const gs = $('#gsum'); if (gs) gs.innerHTML = groupsHTML(groups);
  tick();
}

/* ---------- History ---------- */
function vHistory() {
  return pageTop('History', `<span class="lbl">${plural(S.sessions.size, 'session')}</span>`) + `<h1 class="h1 rv" style="margin:10px 0 16px">History</h1>
  <input class="search rv" data-f="q" placeholder="Search by session, exercise or note" value="${esc(S.q)}" autocomplete="off">
  <div id="hlist" class="rv">${historyList()}</div>`;
}
function historyList() {
  const q = S.q.trim().toLowerCase(); let list = sorted();
  if (q) list = list.filter(s => sessName(s).toLowerCase().includes(q) || s.items.some(it => (exOf(it.exId)?.name || '').toLowerCase().includes(q)) || (s.notes || '').toLowerCase().includes(q));
  if (!list.length) return `<div class="empty"><b>${q ? 'No sessions match.' : 'Nothing logged yet.'}</b>${q ? 'Try an exercise name, like “squat”.' : 'Your sessions will collect here, grouped by month.'}</div>`;
  const by = new Map(); for (const s of list) { const d = new Date(s.startedAt), k = d.getFullYear() * 12 + d.getMonth(); if (!by.has(k)) by.set(k, []); by.get(k).push(s); }
  let h = ''; for (const [k, ss] of by) { const vol = ss.reduce((x, s) => x + (S.A.sess.get(s.id)?.vol || 0), 0);
    h += `<div class="month"><span class="lbl">${MONTHS[k % 12]} ${Math.floor(k / 12)}</span><span class="lbl">${plural(ss.length, 'session')} · ${fmtVol(vol)}</span></div><div class="list">${ss.map(rowSession).join('')}</div>`; }
  return h;
}

/* ---------- Exercises ---------- */
function vExercises() {
  const active = S.library.filter(e => !e.archived), custom = active.filter(e => !e.isDefault).length;
  return pageTop('Exercises', `<span class="lbl">${active.length} total · ${custom} custom</span>`) + `
  <div class="rv" style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin:10px 0 6px"><h1 class="h1">Exercises</h1>
  <div style="display:flex;gap:8px"><button class="btn" data-act="new-ex">${roll('Add exercise')}</button><button class="iconbtn" data-act="lib-menu" aria-label="Library options">${ICON.dots}</button></div></div>
  <p class="muted rv" style="font-size:13px;max-width:60ch">Your own copy of the list. Edit, add or remove anything; changes are private to your account.</p>
  <div class="toolbar rv"><input class="search" data-f="exq" placeholder="Search exercises" value="${esc(S.exq)}" autocomplete="off"></div>
  <div class="hscroll rv" id="exm">${muscleChips()}</div>
  <div id="exlist" class="rv">${exList()}</div>`;
}
const muscleChips = () => ['', ...MUSCLES, 'Custom'].map(m => `<button class="chip${S.exm === m ? ' on' : ''}" data-act="exm" data-m="${esc(m)}">${m || 'All'}</button>`).join('');
function exList() {
  const q = S.exq.trim().toLowerCase(), m = S.exm;
  const match = e => (!q || e.name.toLowerCase().includes(q) || e.muscle.toLowerCase().includes(q)) && (!m || (m === 'Custom' ? !e.isDefault : e.muscle === m));
  const lib = S.library.filter(e => !e.archived && match(e)).sort((a, b) => a.name.localeCompare(b.name));
  const arch = S.library.filter(e => e.archived && match(e)).sort((a, b) => a.name.localeCompare(b.name));
  let h = '';
  if (!lib.length) h = `<div class="empty"><b>${q || m ? 'No exercises match.' : 'Your list is empty.'}</b>${q ? `Add “${esc(S.exq.trim())}” as a new exercise with the button above.` : 'Add one with the button above, or restore the default list from the menu.'}</div>`;
  const groups = new Map(); for (const e of lib) { if (!groups.has(e.muscle)) groups.set(e.muscle, []); groups.get(e.muscle).push(e); }
  const order = [...MUSCLES, ...[...groups.keys()].filter(k => !MUSCLES.includes(k))];
  for (const mg of order) { const es = groups.get(mg); if (!es) continue;
    h += `<div class="mgroup"><span class="lbl">${esc(mg)}</span><span class="lbl">${es.length}</span></div><div class="list">${es.map(exRow).join('')}</div>`; }
  if (arch.length) h += `<div class="mgroup"><button class="lbl" data-act="toggle-arch">${roll((S.showArchived ? 'Hide' : 'Show') + ' removed (' + arch.length + ')')}</button><span class="lbl">kept for history</span></div>${S.showArchived ? `<div class="list">${arch.map(exRow).join('')}</div>` : ''}`;
  return h;
}
function exRow(e) {
  const x = S.A.ex.get(e.id);
  return `<div class="exrow" style="grid-template-columns:minmax(0,1fr) auto auto"><button data-act="open-ex" data-id="${e.id}" style="min-width:0"><span class="n">${esc(e.name)}</span>${e.isDefault ? '' : '<span class="badge acc">custom</span>'}${e.archived ? '<span class="badge">removed</span>' : ''}<br><span class="sub">${e.kind === 'bw' ? 'Bodyweight' : 'Weighted'}${x ? ` · ${plural(x.n, 'session')} · last ${fmtDate(x.last)}` : ''}</span></button>
  <span class="v">${x ? fmtW(x.best) : '—'}<br><span class="lbl">e1RM</span></span>
  <button class="iconbtn" data-act="edit-ex" data-id="${e.id}" aria-label="Edit ${esc(e.name)}">${ICON.dots}</button></div>`;
}
function vExercise() {
  const ex = exOf(S.arg), x = S.A.ex.get(ex.id);
  const hist = []; for (const s of sorted()) { for (const it of s.items) if (it.exId === ex.id) { const sets = it.sets.filter(st => +st.r > 0); if (sets.length) hist.push({ s, sets }); } if (hist.length >= 12) break; }
  const bs = x?.bestSet;
  return `<header class="s-top rv"><button class="iconbtn" data-act="back" aria-label="Back">${ICON.back}</button><span class="lbl" style="flex:1">Exercise</span><button class="btn ghost sm" data-act="edit-ex" data-id="${ex.id}">${roll('Edit')}</button></header>
  <h1 class="h1 rv" style="margin:14px 0 4px">${esc(ex.name)}${ex.isDefault ? '' : ' <span class="badge acc">custom</span>'}</h1><p class="muted rv">${esc(ex.muscle)} · ${ex.kind === 'bw' ? 'Bodyweight (load = bodyweight + added)' : 'Weighted'}${ex.archived ? ' · removed from list' : ''}</p>
  <div class="dash" style="margin-top:18px">
    <div class="card rv"><div class="card-h"><span class="lbl">Best estimated 1RM</span><span class="lbl">${unit()}</span></div>
      <div class="bignum md">${big(x ? fmtW(x.best) : '–')}<span class="dot"></span></div>
      <p class="muted" style="margin-top:14px;font-size:13px">${bs ? `From ${fmtW(loadOf(bs, ex))} ${unit()} × ${bs.r} on ${fmtDate(x.bestT)}` : 'Log a set to see your estimate.'}</p></div>
    <div class="card rv"><div class="card-h"><span class="lbl">e1RM by session</span><span class="lbl">${x ? x.pts.length : 0} logged</span></div>${trend(x)}</div>
    <div class="kv span rv"><div><span class="lbl">Sessions</span><div class="term">${x ? x.n : 0}</div></div><div><span class="lbl">Volume</span><div class="term">${fmtVol(x ? x.vol : 0)}</div></div><div><span class="lbl">Records</span><div class="term">${x ? x.pts.filter(p => p.pr).length : 0}</div></div><div><span class="lbl">Last</span><div class="term">${x ? fmtDate(x.last) : '—'}</div></div></div>
    <section class="card span rv"><div class="card-h"><span class="lbl">Recent sets</span></div>
    ${hist.length ? hist.map(h => `<button class="hist-s" data-act="open" data-id="${h.s.id}" style="width:100%"><span class="term">${fmtDate(h.s.startedAt)}</span><span class="sl">${h.sets.map(st => `${fmtW(+st.w || 0)}×${st.r}`).join(' · ')}</span></button>`).join('') : `<div class="empty">No sets logged for this exercise yet.</div>`}</section>
  </div>`;
}
function trend(x) {
  if (!x || !x.pts.length) return `<div class="empty">Your trend appears after the first session.</div>`;
  const pts = x.pts.slice(-40), vals = pts.map(p => p.v), hi = Math.max(...vals), lo = Math.min(...vals) * 0.85, W = 300, H = 110, n = Math.max(pts.length, 12), step = W / n;
  let g = '', f = '';
  for (let i = 0; i < n; i++) { const xx = (i * step + step / 2).toFixed(2); g += `<line class="gl" x1="${xx}" x2="${xx}" y1="4" y2="${H}"/>`; }
  pts.forEach((p, i) => { const xx = (i * step + step / 2).toFixed(2), h = hi === lo ? H * 0.7 : Math.max(4, (p.v - lo) / (hi - lo) * (H - 12)); f += `<line class="${p.pr ? 'al' : 'fl'}" x1="${xx}" x2="${xx}" y1="${H}" y2="${(H - h).toFixed(1)}"/>`; if (i === pts.length - 1) f += `<circle class="ad" cx="${xx}" cy="${(H - h).toFixed(1)}" r="2.6"/>`; });
  return `<div class="chart"><span class="yl" style="top:0">${fmtW(hi)}</span><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-label="Estimated 1RM per session">${g}${f}</svg>
  <div class="axis"><span class="lbl">${fmtDate(pts[0].t)}</span><span class="lbl"><span class="pr">|</span> record</span><span class="lbl">${fmtDate(pts[pts.length - 1].t)}</span></div></div>`;
}

/* ---------- Splits ---------- */
function dayBar(days, next = -1) {
  return `<div class="daybar">${days.map((d, i) => `<span class="${isRestDay(d) ? '' : 'on'}${i === next ? ' next' : ''}" title="Day ${i + 1}: ${esc(d.type || 'Untitled')}">${esc(isRestDay(d) ? 'rest' : (d.type || 'day ' + (i + 1)).slice(0, 6))}</span>`).join('')}</div>`;
}
function vSplits() {
  const mine = [...S.splits.values()].sort((a, b) => b.updatedAt - a.updatedAt), nx = nextSplitDay();
  const card = sp => { const tr = sp.days.filter(d => !isRestDay(d)), exn = tr.reduce((x, d) => x + d.exercises.length, 0);
    return `<button class="split-card rv" data-act="open-split" data-id="${sp.id}"><div><h3>${esc(sp.name)}</h3><div class="muted" style="font-size:13px;margin-top:2px">${plural(sp.days.length, 'day')} · ${tr.length} training · ${plural(exn, 'exercise')}${sp.copiedFrom ? ` · from ${esc(sp.copiedFrom)}` : ''}</div></div>
    ${dayBar(sp.days, nx && nx.sp.id === sp.id ? nx.i : -1)}<div class="lbl">${sp.shareToken ? 'link on · ' : ''}${(S.recipients.get(sp.id) || []).length ? plural(S.recipients.get(sp.id).length, 'person') + ' · ' : ''}edit ↗</div></button>`; };
  const shcard = sp => `<button class="split-card rv" data-act="open-shared" data-id="${sp.id}"><div><h3>${esc(sp.name)}</h3><div class="from" style="margin-top:4px">from @${esc(sp.from || 'someone')} · ${fmtDate(sp.sharedAt)}</div></div>${dayBar(sp.days)}<div class="lbl">view ↗</div></button>`;
  return pageTop('Splits') + `
  <div class="rv" style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin:10px 0 6px"><h1 class="h1">Splits</h1><button class="btn" data-act="new-split">${roll('New split')}</button></div>
  <p class="muted rv" style="font-size:13px;max-width:60ch">Plan your week: how many days, what each day trains, and the exercises with sets and reps. Start any day as a session, and share the plan with other lifters.</p>
  <div class="mgroup rv"><span class="lbl">Your splits</span><span class="lbl">${mine.length}</span></div>
  <div class="split-grid" style="margin-top:12px">${mine.map(card).join('') || `<div class="empty rv"><b>No splits yet.</b>Create one to plan your training days. Push / Pull / Legs is a good place to start.</div>`}</div>
  <div class="mgroup rv" style="margin-top:18px"><span class="lbl">Shared with you</span><span class="lbl">${S.shared.length}</span></div>
  <div class="split-grid" style="margin-top:12px">${S.shared.map(shcard).join('') || `<div class="empty rv">When someone shares a split with @${esc(S.profile.username)}, it shows up here.</div>`}</div>`;
}
function vSplit() {
  const sp = S.splits.get(S.arg), rec = S.recipients.get(sp.id), tr = sp.days.filter(d => !isRestDay(d)).length;
  return `<header class="s-top rv"><button class="iconbtn" data-act="back" aria-label="Back">${ICON.back}</button><span class="lbl" style="flex:1">Split <span data-sync class="lbl sync" style="margin-left:8px"></span></span>
    <button class="btn ghost sm" data-act="share-split" data-id="${sp.id}">${ICON.share}${roll('Share')}</button><button class="iconbtn" data-act="split-menu" data-id="${sp.id}" aria-label="Split options">${ICON.dots}</button></header>
  <div class="rv" style="margin-top:12px"><input class="sp-name" data-f="spname" value="${esc(sp.name)}" maxlength="60" aria-label="Split name" placeholder="Split name">
  <textarea class="sp-desc" data-f="spdesc" maxlength="1000" placeholder="Describe it: goal, who it suits, how to progress" aria-label="Description">${esc(sp.description)}</textarea></div>
  <div class="toolbar rv" style="justify-content:space-between"><div style="display:flex;align-items:center;gap:12px"><span class="lbl">Days</span><span class="stepper" style="background:var(--surface)"><button data-act="days-step" data-d="-1" aria-label="Remove last day">−</button><span>${sp.days.length}</span><button data-act="days-step" data-d="1" aria-label="Add a day">+</button></span></div>
  <span class="lbl">${tr} training · ${sp.days.length - tr} rest${rec && rec.length ? ` · shared with ${rec.length}` : ''}${sp.shareToken ? ' · link on' : ''}</span></div>
  ${dayBar(sp.days)}
  <div class="days">${sp.days.map((d, i) => dayCard(d, i, false)).join('')}</div>`;
}
function dayCard(d, i, ro) {
  const rest = isRestDay(d);
  const head = ro
    ? `<div class="day-h"><span class="day-n">DAY ${i + 1}</span><span class="day-type" style="display:flex;align-items:center">${esc(d.type || (rest ? 'Rest' : 'Training'))}</span></div>`
    : `<div class="day-h"><span class="day-n">DAY ${i + 1}</span><input class="day-type" data-f="dtype" data-day="${i}" value="${esc(d.type)}" maxlength="40" placeholder="Session type" aria-label="Day ${i + 1} session type">${rest ? '' : `<button class="iconbtn" data-act="start-day" data-sp="${S.arg}" data-day="${i}" aria-label="Start day ${i + 1} as a session" title="Start this day">${ICON.play}</button>`}</div>
      <div class="types">${DAY_TYPES.map(t => `<button class="chip${d.type === t ? ' on' : ''}" data-act="dtype-pick" data-day="${i}" data-t="${esc(t)}">${t}</button>`).join('')}</div>`;
  if (rest) return `<div class="day rest${ro ? ' ro' : ''} rv">${head}<p class="muted" style="font-size:13px">Rest day. Recovery is part of the plan.</p>${ro ? '' : `<div class="day-f"><button class="btn line sm" data-act="day-train" data-day="${i}">${roll('Make it a training day')}</button></div>`}</div>`;
  const rows = d.exercises.map((x, j) => {
    const e = !ro && x.exId && exOf(x.exId), name = e ? e.name : x.name, muscle = e ? e.muscle : x.muscle;
    return ro ? `<div class="dex"><div class="nm"><b>${esc(name)}</b><small>${esc(muscle)}</small></div><span class="ro">${x.sets}</span><span class="ro">${esc(x.reps)}</span><span></span></div>`
      : `<div class="dex"><div class="nm"><b>${esc(name)}</b><small>${esc(muscle)}</small></div>
        <input data-f="dsets" data-day="${i}" data-x="${j}" inputmode="numeric" value="${x.sets}" aria-label="Sets for ${esc(name)}">
        <input data-f="dreps" data-day="${i}" data-x="${j}" value="${esc(x.reps)}" maxlength="12" aria-label="Reps for ${esc(name)}">
        <button class="iconbtn" data-act="dex-menu" data-day="${i}" data-x="${j}" aria-label="Options for ${esc(name)}">${ICON.dots}</button></div>`;
  }).join('');
  return `<div class="day${ro ? ' ro' : ''} rv">${head}
    ${d.exercises.length ? `<div class="dex-h lbl"><span>Exercise</span><span>Sets</span><span>Reps</span><span></span></div>${rows}` : `<p class="muted" style="font-size:13px">No exercises yet.</p>`}
    ${ro ? '' : `<div class="day-f"><button class="btn ghost sm" data-act="dex-add" data-day="${i}">${roll('+ Exercise')}</button><button class="btn line sm" data-act="day-rest" data-day="${i}">${roll('Make it a rest day')}</button></div>`}</div>`;
}
function vShared() {
  const sp = S.shared.find(x => x.id === S.arg);
  if (!sp) return vMissing('This split isn’t shared with you any more.');
  return `<header class="s-top rv"><button class="iconbtn" data-act="back" aria-label="Back">${ICON.back}</button><span class="lbl" style="flex:1">Shared split</span><button class="btn ghost sm" data-act="remove-shared" data-id="${sp.id}">${roll('Remove')}</button></header>
  ${splitReadOnly(sp, `from @${sp.from || 'someone'} · shared ${fmtDate(sp.sharedAt)}`)}
  <div class="done-bar rv"><button class="btn" data-act="copy-shared" data-id="${sp.id}">${roll('Save a copy to my splits')}</button></div>`;
}
function splitReadOnly(sp, sub) {
  const tr = sp.days.filter(d => !isRestDay(d)).length;
  return `<h1 class="h1 rv" style="margin:14px 0 4px">${esc(sp.name)}</h1><p class="from rv">${esc(sub)}</p>
  ${sp.description ? `<p class="rv" style="margin-top:12px;max-width:65ch;color:var(--ink-2);white-space:pre-wrap">${esc(sp.description)}</p>` : ''}
  <div class="toolbar rv"><span class="lbl">${plural(sp.days.length, 'day')} · ${tr} training · ${sp.days.length - tr} rest</span></div>
  ${dayBar(sp.days)}<div class="days">${sp.days.map((d, i) => dayCard(d, i, true)).join('')}</div>`;
}
function vPublic() {
  const p = S.pub && S.pub.token === S.arg ? S.pub : null;
  const signed = S.user && S.loaded && S.profile.onboarded;
  const topbar = `<header class="top rv"><div>${brand()}</div>${signed ? `<button class="btn ghost sm" data-act="nav" data-v="splits">${roll('My splits')}</button>` : `<button class="btn sm" data-act="public-signin">${roll('Sign in')}</button>`}</header>`;
  if (!p || p.loading) return topbar + `<div class="empty rv">Loading split…</div>`;
  if (p.error || !p.data) return topbar + `<div class="empty rv"><b>This link doesn’t work.</b>The owner may have turned off link sharing.</div>`;
  const sp = { ...p.data, days: cleanDays(p.data.days) };
  return topbar + splitReadOnly(sp, `by @${sp.owner_username || 'a lifter'} · updated ${fmtDate(Date.parse(sp.updated_at))}`) +
    `<div class="done-bar rv">${signed ? `<button class="btn" data-act="copy-public">${roll('Save a copy to my splits')}</button>` : `<button class="btn" data-act="public-signin">${roll('Create a free account to save it')}</button>`}</div>`;
}
async function loadPublic(token) {
  S.pub = { token, loading: true };
  if (!/^[0-9a-f-]{36}$/i.test(token)) { S.pub = { token, error: true }; return render(false); }
  const { data, error } = await sb.rpc('get_public_split', { p_token: token });
  S.pub = { token, data: data && data[0], error: !!error };
  render(false);
}
async function loadRecipients(id) {
  S.recipients.set(id, []);
  if (!(await flushNow('sp:' + id))) return;
  const { data, error } = await sb.rpc('split_recipients', { p_split: id });
  if (!error) { S.recipients.set(id, data || []); if (S.view === 'split' || S.view === 'splits') soft(); }
}

/* ---------- Settings ---------- */
function vPrefs() {
  const p = S.profile;
  return pageTop('Settings') + `<h1 class="h1 rv" style="margin:10px 0 16px">Settings</h1>
  <div class="dash">
  <section class="card rv">
    <div class="pref"><span class="k">Units<small>Stored precisely; switch any time</small></span><span class="seg"><button class="${p.unit === 'kg' ? 'on' : ''}" data-act="unit" data-u="kg">kg</button><button class="${p.unit === 'lb' ? 'on' : ''}" data-act="unit" data-u="lb">lb</button></span></div>
    <div class="pref"><span class="k">Weekly target<small>Sessions per week for consistency</small></span><span class="stepper"><button data-act="step" data-k="target" data-d="-1" aria-label="Fewer">−</button><span>${p.target}</span><button data-act="step" data-k="target" data-d="1" aria-label="More">+</button></span></div>
    <div class="pref"><span class="k">Rest timer<small>Counts down after you tick a set</small></span><button class="toggle${p.restOn ? ' on' : ''}" data-act="toggle" data-k="restOn" aria-pressed="${p.restOn}" aria-label="Rest timer"></button></div>
    ${p.restOn ? `<div class="pref"><span class="k">Rest length</span><span class="stepper"><button data-act="step" data-k="rest" data-d="-15" aria-label="Shorter">−</button><span>${mmss(p.rest * 1000)}</span><button data-act="step" data-k="rest" data-d="15" aria-label="Longer">+</button></span></div>
    <div class="pref"><span class="k">Rest sound<small>A short beep when rest ends</small></span><button class="toggle${p.sound ? ' on' : ''}" data-act="toggle" data-k="sound" aria-pressed="${p.sound}" aria-label="Rest sound"></button></div>` : ''}
    <div class="pref"><span class="k">Bodyweight<small>Used for bodyweight exercises</small></span><span style="display:flex;align-items:center;gap:8px"><input class="field" style="width:96px;text-align:center" data-f="bw" inputmode="decimal" value="${fmtW(p.bw)}" aria-label="Bodyweight"><span class="lbl">${unit()}</span></span></div>
  </section>
  <section class="card rv" style="display:flex;flex-direction:column;gap:14px">
    <span class="lbl">Account</span>
    <div class="pref" style="padding-top:0"><span class="k">Name<small>Shown in your greeting</small></span><input class="field" style="width:11rem" data-f="dname" value="${esc(p.name)}" maxlength="40" aria-label="Your name"></div>
    <div class="pref"><span class="k">@${esc(p.username)}<small>${esc(S.user.email || '')}</small></span><button class="btn ghost sm" data-act="change-username">${roll('Change')}</button></div>
    <p class="muted" style="font-size:13px">Your sessions, exercises and splits are private to your account. Others only see a split when you share it.</p>
    <span class="lbl" style="margin-top:6px">Your data</span>
    <div style="display:flex;flex-wrap:wrap;gap:8px"><button class="btn sm" data-act="export" data-f="json">${roll('Export JSON')}</button><button class="btn ghost sm" data-act="export" data-f="csv">${roll('Export CSV')}</button><button class="btn line sm" data-act="import">${roll('Import JSON')}</button></div>
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:6px"><button class="btn ghost sm" data-act="signout">${roll('Sign out')}</button><button class="btn line sm" data-act="delete-account" style="color:var(--bad)">${roll('Delete account')}</button></div>
  </section>
  <section class="card span rv"><div class="card-h"><span class="lbl">Theme</span><span class="lbl">${esc((THEMES.find(t => t.id === themePref()) || THEMES[0]).name)}</span></div>${themePicker()}</section>
  <section class="card span rv"><div class="card-h"><span class="lbl">How the numbers work</span></div><div class="how">
    <p><b>Set intensity.</b> Each set’s estimated one-rep max (weight × (1 + reps ÷ 30)) as a percentage of your best estimate on that exercise up to that day. 100 means you matched or beat your best. Bodyweight exercises use your bodyweight plus any added load.</p>
    <p><b>Session intensity.</b> The average of your set intensities, weighted by load × reps, so heavy working sets count more than light ones. Easy under 60, moderate to 75, hard to 88, then max effort. It reads “calibrating” until each exercise has a couple of sessions behind it.</p>
    <p><b>Linked sets.</b> Link two or more sets and Synergym names the structure: two exercises make a superset, three or more a giant set. On one exercise, falling weight is a drop set, the same weight a rest-pause set, anything else a pyramid. Rest starts after the last set of a group.</p>
    <p><b>Consistency.</b> Sessions per week against your weekly target, averaged over the last 8 full weeks (or since your first session). A week at or above target scores 100. The streak counts consecutive weeks on target.</p>
    <p><b>Splits.</b> The Today screen suggests the next training day of the split you used last, skipping rest days.</p>
  </div></section></div>`;
}

/* ================= sheets ================= */
function openSheet(html, mount) { const sh = $('#sheet'); $('#sheet-body').innerHTML = html; sh.hidden = false; document.body.style.overflow = 'hidden'; mount && mount($('#sheet-body')); const f = $('#sheet-body').querySelector('input:not([type=hidden]),button'); if (f && matchMedia('(pointer:fine)').matches) f.focus(); }
function closeSheet() { $('#sheet').hidden = true; $('#sheet-body').innerHTML = ''; document.body.style.overflow = ''; }
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#sheet').hidden) closeSheet(); });
function confirmSheet(title, body, yes, fn, no = 'Cancel') {
  openSheet(`<div class="sh-h"><h3>${esc(title)}</h3></div><p class="muted">${esc(body)}</p><div class="btns"><button class="btn ghost" data-act="close">${esc(no)}</button><button class="btn danger" id="cf-yes">${esc(yes)}</button></div>`, r => { r.querySelector('#cf-yes').onclick = () => { closeSheet(); fn(); }; });
}
function menuSheet(title, items) {
  openSheet(`<div class="sh-h"><h3>${esc(title)}</h3><button class="btn ghost sm" data-act="close">Close</button></div><div class="menu">${items.map((it, i) => `<button data-mi="${i}" class="${it.warn ? 'warn' : ''}">${esc(it.label)}<span class="muted" style="font-size:13px">${esc(it.hint || '')}</span></button>`).join('')}</div>`,
    r => r.querySelectorAll('[data-mi]').forEach(b => b.onclick = () => { const it = items[+b.dataset.mi]; closeSheet(); it.fn(); }));
}
function exerciseForm(title, ex, onSave, extra = '') {
  let m = ex.muscle || '', k = ex.kind || 'w';
  openSheet(`<div class="sh-h"><h3>${esc(title)}</h3><button class="btn ghost sm" data-act="close">Close</button></div><div class="form">
  <label>Name<input class="field" id="ef-n" value="${esc(ex.name || '')}" maxlength="60" autocomplete="off"></label>
  <div><span class="lbl">Muscle group</span><div class="chips" id="ef-m" style="margin-top:8px">${MUSCLES.map(x => `<button class="chip${x === m ? ' on' : ''}" data-m="${x}">${x}</button>`).join('')}</div></div>
  <div><span class="lbl">Type</span><div class="chips" id="ef-k" style="margin-top:8px"><button class="chip${k === 'w' ? ' on' : ''}" data-k="w">Weighted</button><button class="chip${k === 'bw' ? ' on' : ''}" data-k="bw">Bodyweight</button></div></div></div>
  <div class="btns">${extra}<button class="btn" id="ef-save">Save</button></div>`, r => {
    r.querySelector('#ef-m').onclick = e => { const b = e.target.closest('[data-m]'); if (!b) return; m = b.dataset.m; r.querySelectorAll('#ef-m .chip').forEach(c => c.classList.toggle('on', c === b)); };
    r.querySelector('#ef-k').onclick = e => { const b = e.target.closest('[data-k]'); if (!b) return; k = b.dataset.k; r.querySelectorAll('#ef-k .chip').forEach(c => c.classList.toggle('on', c === b)); };
    r.querySelector('#ef-save').onclick = () => {
      const n = r.querySelector('#ef-n').value.trim().replace(/\s+/g, ' ');
      if (!n) return toast('Give it a name');
      if (!m) return toast('Pick a muscle group');
      if (S.library.some(e => e.id !== ex.id && e.name.toLowerCase() === n.toLowerCase())) return toast('You already have an exercise with that name');
      closeSheet(); onSave({ name: n.slice(0, 60), muscle: m, kind: k });
    };
    r.querySelector('#ef-del')?.addEventListener('click', () => { closeSheet(); removeExercise(ex.id); });
  });
}
function newExercise(prefill = {}, then) {
  exerciseForm('Add exercise', { name: prefill.name || '', muscle: prefill.muscle || '', kind: 'w' }, v => {
    const ex = { id: uuid(), ...v, archived: false, isDefault: false };
    S.library.push(ex); queue('x:' + ex.id, 0);
    if (then) then(ex); else { render(false); toast(`${ex.name} added`); }
  });
}
function editExercise(id) {
  const ex = exOf(id); if (!ex) return;
  exerciseForm('Edit exercise', ex, v => { Object.assign(ex, v); queue('x:' + ex.id, 0); render(false); toast('Saved'); },
    `<button class="btn line" id="ef-del" style="margin-right:auto;color:var(--bad)">${ex.archived ? 'Restore to list' : 'Remove'}</button>`);
}
function removeExercise(id) {
  const ex = exOf(id); if (!ex) return;
  if (ex.archived) { ex.archived = false; queue('x:' + id, 0); render(false); return toast(`${ex.name} is back in your list`); }
  const used = [...S.sessions.values()].some(s => s.items.some(i => i.exId === id));
  if (used) confirmSheet(`Remove ${ex.name}?`, 'It has logged sets, so its history is kept. It disappears from your list and the picker; you can restore it later.', 'Remove', () => { ex.archived = true; queue('x:' + id, 0); if (S.view === 'exercise') back(); else render(false); toast('Removed from your list'); });
  else confirmSheet(`Delete ${ex.name}?`, 'It has no logged sets, so it is deleted from your list.', 'Delete', () => { S.library = S.library.filter(e => e.id !== id); queue('x:' + id, 0); if (S.view === 'exercise') back(); else render(false); toast('Deleted'); });
}

/* exercise picker (session / split) */
function openPicker(mode, extra = {}) {
  S.pk = { mode, m: '', q: '', added: 0, ...extra };
  openSheet(`<div class="sh-h"><h3>${mode === 'session' ? 'Add exercise' : `Add to day ${extra.day + 1}`}</h3><button class="btn ghost sm" data-act="close">${mode === 'split' ? 'Done' : 'Close'}</button></div>
  <input class="search" id="pkq" placeholder="Search your exercises" autocomplete="off" maxlength="60">
  <div class="hscroll" id="pkm" style="margin-top:12px"></div><div id="pkl" class="pk-list"></div>`, r => {
    r.querySelector('#pkq').addEventListener('input', e => { S.pk.q = e.target.value; pickerList(); });
    pickerList();
  });
}
function pickerList() {
  const q = S.pk.q.trim(), ql = q.toLowerCase(), m = S.pk.m;
  $('#pkm').innerHTML = ['', ...MUSCLES].map(x => `<button class="chip${m === x ? ' on' : ''}" data-act="pk-m" data-m="${esc(x)}">${x || 'All'}</button>`).join('');
  const lib = S.library.filter(e => !e.archived && (!m || e.muscle === m) && (!ql || e.name.toLowerCase().includes(ql)))
    .sort((a, b) => (S.A.ex.get(b.id)?.n || 0) - (S.A.ex.get(a.id)?.n || 0) || a.name.localeCompare(b.name));
  const exact = q && S.library.some(e => e.name.toLowerCase() === ql);
  let h = '';
  if (q && !exact) h += `<button class="pk" data-act="pk-new"><span><span class="n">Add “${esc(q)}”</span><br><span class="sub">New exercise in your list</span></span><span class="lbl">new</span></button>`;
  h += lib.map(e => {
    const last = lastSetsFor(e.id, S.pk.mode === 'session' ? S.arg : null);
    const t = last ? last.reduce((b, st) => e1rm(loadOf(st, e), st.r) > e1rm(loadOf(b, e), b.r) ? st : b, last[0]) : null;
    return `<button class="pk" data-act="pk-pick" data-id="${e.id}"><span><span class="n">${esc(e.name)}</span>${e.isDefault ? '' : '<span class="badge acc">custom</span>'}<br><span class="sub">${esc(e.muscle)}${e.kind === 'bw' ? ' · bodyweight' : ''}</span></span><span class="last">${t ? `${fmtW(+t.w || 0)}×${t.r}` : ''}</span></button>`;
  }).join('');
  if (!h) h = `<div class="empty">No exercises match. Type a name to add a new one.</div>`;
  $('#pkl').innerHTML = h;
}
function picked(ex) {
  if (S.pk.mode === 'session') { closeSheet(); addExercise(ex.id); }
  else if (S.pk.mode === 'split') {
    const sp = S.splits.get(S.pk.split), d = sp && sp.days[S.pk.day]; if (!d) return closeSheet();
    if (d.exercises.length >= 30) return toast('A day holds up to 30 exercises');
    d.exercises.push({ id: sid(), exId: ex.id, name: ex.name, muscle: ex.muscle, kind: ex.kind, sets: 3, reps: '8-12' });
    queue('sp:' + sp.id); render(false); S.pk.added++; toast(`${ex.name} added to day ${S.pk.day + 1}`);
  }
}

/* ================= actions: sessions ================= */
function newSession(extra = {}) {
  const s = { id: uuid(), name: null, startedAt: Date.now(), endedAt: null, notes: '', items: [], splitId: null, splitDay: null, ...extra };
  S.sessions.set(s.id, s); queue('s:' + s.id, 0); go('session', s.id);
}
function startSession() { const a = activeSession(); if (a) return go('session', a.id); newSession(); }
function startMenu() {
  const a = activeSession(); if (a) return go('session', a.id);
  const nx = nextSplitDay();
  if (!nx) return startSession();
  const items = [{ label: `Day ${nx.i + 1} · ${nx.sp.days[nx.i].type || 'Training'}`, hint: nx.sp.name, fn: () => startFromSplit(nx.sp.id, nx.i) }, { label: 'Empty session', fn: startSession }];
  for (const sp of S.splits.values()) if (sp.id !== nx.sp.id && sp.days.some(d => !isRestDay(d))) items.push({ label: `Pick a day from ${sp.name}`, fn: () => go('split', sp.id) });
  menuSheet('Start a session', items);
}
function ensureExercise(x) {
  let e = x.exId && exOf(x.exId);
  if (!e) e = S.library.find(y => y.name.toLowerCase() === x.name.toLowerCase());
  if (!e) { e = { id: uuid(), name: x.name, muscle: x.muscle, kind: x.kind, archived: false, isDefault: false }; S.library.push(e); queue('x:' + e.id, 0); }
  return e;
}
function startFromSplit(spid, di) {
  const a = activeSession(); if (a) { toast('Finish your current session first'); return go('session', a.id); }
  const sp = S.splits.get(spid), d = sp && sp.days[di]; if (!d) return;
  const items = d.exercises.map(x => {
    const e = ensureExercise(x), last = lastSetsFor(e.id), r0 = parseInt(String(x.reps)) || null;
    return { id: sid(), exId: e.id, sets: Array.from({ length: x.sets }, (_, i) => { const l = last && last[Math.min(i, last.length - 1)]; return { id: sid(), w: null, r: null, pw: l ? l.w : null, pr: r0 ?? (l ? l.r : null), done: false, g: null }; }) };
  });
  newSession({ name: d.type || null, items, splitId: spid, splitDay: di });
  toast(`Day ${di + 1} loaded. Last weights show as hints.`);
}
function repeatSession(id) {
  const src = S.sessions.get(id); if (!src) return;
  const a = activeSession(); if (a) { toast('Finish your current session first'); return go('session', a.id); }
  const gm = new Map();
  newSession({ name: src.name, splitId: src.splitId, splitDay: src.splitDay,
    items: src.items.map(it => ({ id: sid(), exId: it.exId, sets: it.sets.map(st => { let g = null; if (st.g) { if (!gm.has(st.g)) gm.set(st.g, sid()); g = gm.get(st.g); } return { id: sid(), w: null, r: null, pw: st.w ?? st.pw ?? null, pr: st.r ?? st.pr ?? null, done: false, g }; }) })) });
  toast('Last time’s numbers are filled in as hints');
}
function addExercise(exId) {
  const s = cur(); if (!s) return; const last = lastSetsFor(exId, s.id);
  const sets = last ? last.slice(0, 8).map(st => ({ id: sid(), w: null, r: null, pw: st.w ?? null, pr: st.r ?? null, done: false, g: null })) : [{ id: sid(), w: null, r: null, pw: null, pr: null, done: false, g: null }];
  const it = { id: sid(), exId, sets }; s.items.push(it); queue('s:' + s.id, 0); render(false);
  requestAnimationFrame(() => { const el = $(`[data-item="${it.id}"]`); if (el) el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' }); });
}
function findSet(s, id) { for (const it of s.items) { const i = it.sets.findIndex(x => x.id === id); if (i >= 0) return { it, st: it.sets[i], i }; } return null; }
function addSet(itemId) {
  const s = cur(), it = s && s.items.find(x => x.id === itemId); if (!it) return; const p = it.sets[it.sets.length - 1];
  if (it.sets.length >= 40) return toast('That’s the maximum number of sets');
  it.sets.push({ id: sid(), w: null, r: null, pw: p ? (p.w ?? p.pw) : null, pr: p ? (p.r ?? p.pr) : null, done: false, g: null }); queue('s:' + s.id, 300); render(false);
}
function roundStep(kg) { const st = unit() === 'lb' ? 5 : 2.5; const v = Math.max(st, Math.round(toU(kg) / st) * st); return fromU(v); }
function addDrop(setId) {
  const s = cur(), f = s && findSet(s, setId); if (!f) return; const p = f.st, w = p.w ?? p.pw;
  if (!(w > 0)) return toast('Enter a weight first, then add a drop');
  if (!p.g) p.g = sid();
  f.it.sets.splice(f.i + 1, 0, { id: sid(), w: null, r: null, pw: roundStep(w * 0.8), pr: p.r ?? p.pr ?? null, done: false, g: p.g });
  queue('s:' + s.id, 300); render(false); toast('Drop set added at 80%');
}
function toggleDone(setId) {
  const s = cur(), f = s && findSet(s, setId); if (!f) return; const st = f.st;
  if (st.done) { st.done = false; queue('s:' + s.id, 300); render(false); return; }
  if (st.w == null && st.pw != null) st.w = st.pw;
  if (st.r == null && st.pr != null) st.r = st.pr;
  if (!(+st.r > 0)) { render(false); return toast('Add reps first'); }
  st.done = true; queue('s:' + s.id, 300);
  let nextName = null;
  if (st.g && !s.endedAt) { const g = groupsOf(s).find(x => x.g === st.g); if (g) { const idx = g.m.findIndex(x => x.st.id === st.id); const nxt = g.m.slice(idx + 1).find(x => !x.st.done); if (nxt) nextName = exOf(nxt.it.exId)?.name; } }
  render(false);
  if (s.endedAt) return;
  if (nextName) { toast('Next in group: ' + nextName); S.rest = null; tick(); } else if (S.profile.restOn) startRest();
}
let AC = null;
function startRest() { try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); AC.resume && AC.resume(); } catch {} S.rest = { end: Date.now() + S.profile.rest * 1000, beeped: false }; tick(); }
function beep() { if (!S.profile.sound || !AC) return; try { const o = AC.createOscillator(), g = AC.createGain(), t = AC.currentTime; o.frequency.value = 880; g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.25, t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + .4); o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + .45); } catch {} }
function finish() {
  const s = cur(); if (!s) return;
  const any = s.items.some(it => it.sets.some(st => +st.r > 0 || (st.done && +st.pr > 0)));
  if (!any) return confirmSheet('Nothing logged', 'This session has no sets with reps. Delete it instead?', 'Delete session', () => delSession(s.id), 'Keep logging');
  for (const it of s.items) { for (const st of it.sets) { if (st.done && st.r == null && st.pr != null) st.r = st.pr; if (st.done && st.w == null && st.pw != null) st.w = st.pw; } it.sets = it.sets.filter(st => +st.r > 0); }
  s.items = s.items.filter(it => it.sets.length); cleanGroups(s); s.endedAt = Date.now(); S.rest = null; S.link = null;
  queue('s:' + s.id, 0); compute(); const a = S.A.sess.get(s.id);
  render(true); toast(`Saved · intensity ${Math.round(a.int)}${a.prs.length ? ` · ${a.prs.length} record${a.prs.length > 1 ? 's' : ''}` : ''}`);
}
function delSession(id) { S.sessions.delete(id); queue('s:' + id, 0); S.rest = null; go('today', null, { replace: true }); toast('Session deleted'); }
function editDate() {
  const s = cur(); if (!s) return; const d = new Date(s.startedAt);
  const v = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  openSheet(`<div class="sh-h"><h3>Session date</h3><button class="btn ghost sm" data-act="close">Close</button></div><div class="form">
  <label>Date and time<input class="field" type="datetime-local" id="ed-start" value="${v}"></label>
  <p class="muted" style="font-size:13px">Use this to back-date a session you forgot to log live.</p></div><div class="btns"><button class="btn" id="ed-save">Save</button></div>`, r => {
    r.querySelector('#ed-save').onclick = () => { const t = new Date(r.querySelector('#ed-start').value).getTime(); if (!isFinite(t)) return toast('Pick a valid date');
      const len = s.endedAt ? s.endedAt - s.startedAt : 0; s.startedAt = t; if (s.endedAt) s.endedAt = t + Math.max(60000, len);
      queue('s:' + s.id, 0); closeSheet(); render(false); toast('Updated'); };
  });
}
function setMenu(setId) {
  const s = cur(), f = s && findSet(s, setId); if (!f) return; const st = f.st;
  const items = [{ label: 'Add drop set after this', hint: '80% weight', fn: () => addDrop(setId) },
    { label: 'Duplicate set', fn: () => { f.it.sets.splice(f.i + 1, 0, { ...clone(st), id: sid(), done: false, g: null }); queue('s:' + s.id, 300); render(false); } }];
  if (st.g) items.push({ label: 'Unlink from group', fn: () => { st.g = null; cleanGroups(s); queue('s:' + s.id, 300); render(false); } });
  items.push({ label: 'Delete set', warn: true, fn: () => { f.it.sets.splice(f.i, 1); cleanGroups(s); queue('s:' + s.id, 300); render(false); } });
  menuSheet(`${exOf(f.it.exId)?.name || 'Set'} · set ${f.i + 1}`, items);
}
function itemMenu(itemId) {
  const s = cur(); if (!s) return; const i = s.items.findIndex(x => x.id === itemId); if (i < 0) return; const it = s.items[i];
  const mv = d => { const j = i + d; if (j < 0 || j >= s.items.length) return; [s.items[i], s.items[j]] = [s.items[j], s.items[i]]; queue('s:' + s.id, 300); render(false); };
  const items = []; if (i > 0) items.push({ label: 'Move up', fn: () => mv(-1) }); if (i < s.items.length - 1) items.push({ label: 'Move down', fn: () => mv(1) });
  items.push({ label: 'Exercise history', fn: () => go('exercise', it.exId) });
  items.push({ label: 'Remove from session', warn: true, fn: () => { const rm = () => { s.items.splice(s.items.indexOf(it), 1); cleanGroups(s); queue('s:' + s.id, 0); render(false); };
    if (it.sets.some(x => +x.r > 0)) confirmSheet('Remove exercise?', 'Its logged sets in this session will be deleted.', 'Remove', rm); else rm(); } });
  menuSheet(exOf(it.exId)?.name || 'Exercise', items);
}
function sessMenu() {
  const s = cur(); if (!s) return;
  menuSheet(sessName(s), [
    { label: 'Change date', fn: editDate },
    ...(s.endedAt ? [{ label: 'Repeat this session', fn: () => repeatSession(s.id) }, { label: 'Reopen as live', hint: 'resume logging', fn: () => { if (activeSession()) return toast('Another session is live'); s.endedAt = null; queue('s:' + s.id, 0); render(false); } }] : []),
    { label: 'Delete session', warn: true, fn: () => confirmSheet('Delete session?', 'This removes the session and all its sets. It can’t be undone.', 'Delete', () => delSession(s.id)) }
  ]);
}

/* ================= actions: splits ================= */
function newSplit() {
  const sp = { id: uuid(), name: 'My split', description: '', days: ['Push', 'Pull', 'Legs'].map(t => ({ id: sid(), type: t, rest: false, exercises: [] })), shareToken: null, copiedFrom: null, updatedAt: Date.now() };
  S.splits.set(sp.id, sp); queue('sp:' + sp.id, 0); go('split', sp.id);
  setTimeout(() => { const n = $('.sp-name'); if (n) { n.focus(); n.select(); } }, 400);
}
const curSplit = () => S.splits.get(S.arg);
function touchSplit(sp, delay = 800) { sp.updatedAt = Date.now(); queue('sp:' + sp.id, delay); }
function splitMenu(id) {
  const sp = S.splits.get(id); if (!sp) return;
  menuSheet(sp.name, [
    { label: 'Share', fn: () => shareSheet(id) },
    { label: 'Duplicate', fn: () => { const c = { ...clone(sp), id: uuid(), name: (sp.name + ' copy').slice(0, 60), shareToken: null, copiedFrom: null, updatedAt: Date.now() }; S.splits.set(c.id, c); queue('sp:' + c.id, 0); go('split', c.id); } },
    { label: 'Delete split', warn: true, fn: () => confirmSheet('Delete split?', 'This deletes the plan and stops sharing it. Sessions you logged from it are kept.', 'Delete', () => { S.splits.delete(id); queue('sp:' + id, 0); go('splits', null, { replace: true }); toast('Split deleted'); }) }
  ]);
}
function dexMenu(di, xi) {
  const sp = curSplit(), d = sp && sp.days[di], x = d && d.exercises[xi]; if (!x) return;
  const mv = k => { const j = xi + k; if (j < 0 || j >= d.exercises.length) return; [d.exercises[xi], d.exercises[j]] = [d.exercises[j], d.exercises[xi]]; touchSplit(sp, 300); render(false); };
  const items = [];
  if (xi > 0) items.push({ label: 'Move up', fn: () => mv(-1) });
  if (xi < d.exercises.length - 1) items.push({ label: 'Move down', fn: () => mv(1) });
  for (let k = 0; k < sp.days.length; k++) if (k !== di && !isRestDay(sp.days[k])) items.push({ label: `Copy to day ${k + 1}`, hint: sp.days[k].type, fn: () => { sp.days[k].exercises.push({ ...clone(x), id: sid() }); touchSplit(sp, 300); render(false); toast(`Copied to day ${k + 1}`); } });
  items.push({ label: 'Remove from this day', warn: true, fn: () => { d.exercises.splice(xi, 1); touchSplit(sp, 300); render(false); } });
  menuSheet(x.name, items);
}
async function shareSheet(id) {
  const sp = S.splits.get(id); if (!sp) return;
  const draw = () => {
    const rec = S.recipients.get(id) || [], link = sp.shareToken ? `${location.origin}/s/${sp.shareToken}` : '';
    $('#sheet-body').innerHTML = `<div class="sh-h"><h3>Share ${esc(sp.name)}</h3><button class="btn ghost sm" data-act="close">Close</button></div>
    <div class="form">
      <div><span class="lbl">Send to a Synergym user</span>
      <form id="sh-form" class="share-row" style="margin-top:8px"><input class="field" id="sh-u" placeholder="@username" autocapitalize="none" spellcheck="false" maxlength="21" autocomplete="off"><button class="btn" type="submit">Share</button></form>
      <p class="muted" style="font-size:12px;margin-top:6px">They’ll find it under Splits › Shared with you, and can save a copy. Later edits you make show up for them too.</p></div>
      ${rec.length ? `<div><span class="lbl">Shared with</span><div class="people" style="margin-top:8px">${rec.map(r => `<span class="person">@${esc(r.username)}<button data-unshare="${esc(r.username)}" aria-label="Stop sharing with ${esc(r.username)}">${ICON.x}</button></span>`).join('')}</div></div>` : ''}
      <div><span class="lbl">Anyone with the link</span>
      ${link ? `<div class="share-row" style="margin-top:8px"><input class="field" id="sh-link" value="${esc(link)}" readonly><button class="btn" id="sh-copy">Copy</button></div>
        <div class="btns" style="justify-content:flex-start;margin-top:8px">${navigator.share ? '<button class="btn ghost sm" id="sh-native">Share via…</button>' : ''}<button class="btn line sm" id="sh-off" style="color:var(--bad)">Turn off link</button></div>`
        : `<p class="muted" style="font-size:12px;margin:6px 0 8px">Creates a read-only page anyone can open, even without an account.</p><button class="btn ghost sm" id="sh-on">Create link</button>`}</div>
    </div>`;
    const r = $('#sheet-body');
    r.querySelector('#sh-form').onsubmit = async e => {
      e.preventDefault(); const u = r.querySelector('#sh-u').value.trim(); if (!u) return;
      if (!(await flushNow('sp:' + id))) return toast('Couldn’t save the split first. Check your connection.');
      const { data, error } = await sb.rpc('share_split', { p_split: id, p_username: u });
      if (error) return toast(error.message || 'Couldn’t share');
      toast(`Shared with @${data}`); await loadRecipients(id); draw();
    };
    r.querySelectorAll('[data-unshare]').forEach(b => b.onclick = async () => { const { error } = await sb.rpc('unshare_split', { p_split: id, p_username: b.dataset.unshare }); if (error) return toast('Couldn’t update sharing'); await loadRecipients(id); draw(); });
    r.querySelector('#sh-on')?.addEventListener('click', async () => { sp.shareToken = uuid(); touchSplit(sp, 0); await flushNow('sp:' + id); draw(); soft(); });
    r.querySelector('#sh-off')?.addEventListener('click', async () => { sp.shareToken = null; touchSplit(sp, 0); await flushNow('sp:' + id); draw(); soft(); toast('Link turned off'); });
    r.querySelector('#sh-copy')?.addEventListener('click', async () => { const i = r.querySelector('#sh-link'); try { await navigator.clipboard.writeText(i.value); toast('Link copied'); } catch { i.select(); } });
    r.querySelector('#sh-native')?.addEventListener('click', () => navigator.share({ title: sp.name, text: `My training split: ${sp.name}`, url: link }).catch(() => {}));
  };
  openSheet('', null); draw();
  if (!S.recipients.has(id)) { await loadRecipients(id); if (!$('#sheet').hidden) draw(); }
}
function copySplit(src, from) {
  const days = cleanDays(src.days).map(d => ({ ...d, id: sid(), exercises: d.exercises.map(x => { const e = ensureExercise({ ...x, exId: null }); if (e.archived) { e.archived = false; queue('x:' + e.id, 0); } return { ...x, id: sid(), exId: e.id, name: e.name, muscle: e.muscle, kind: e.kind }; }) }));
  const sp = { id: uuid(), name: String(src.name || 'Shared split').slice(0, 60), description: String(src.description || '').slice(0, 1000), days, shareToken: null, copiedFrom: from ? ('@' + from).slice(0, 40) : null, updatedAt: Date.now() };
  S.splits.set(sp.id, sp); queue('sp:' + sp.id, 0); go('split', sp.id, { replace: S.view === 'public' }); toast('Saved to your splits. Exercises you didn’t have were added to your list.');
}

/* ================= export / import ================= */
function download(name, data, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); }
function exportData(fmt) {
  const stamp = new Date().toISOString().slice(0, 10);
  if (fmt === 'csv') {
    const rows = [['date', 'session', 'exercise', 'muscle', 'set', 'weight_' + unit(), 'reps', 'e1rm_' + unit(), 'intensity', 'group']];
    for (const s of sorted().reverse()) { const gm = new Map(); for (const g of groupsOf(s)) for (const x of g.m) gm.set(x.st.id, g.type);
      for (const it of s.items) { const ex = exOf(it.exId); it.sets.forEach((st, i) => { if (!(+st.r > 0)) return; rows.push([new Date(s.startedAt).toISOString().slice(0, 16), sessName(s), ex?.name || '', ex?.muscle || '', i + 1, fmtW(+st.w || 0), st.r, fmtW(e1rm(loadOf(st, ex), st.r)), Math.round(S.A.set.get(st.id) || 0), gm.get(st.id) || '']); }); } }
    const csv = rows.map(r => r.map(c => { c = String(c); if (/^[=+\-@]/.test(c)) c = "'" + c; return /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(',')).join('\n');
    return download(`synergym-${stamp}.csv`, csv, 'text/csv');
  }
  download(`synergym-${stamp}.json`, JSON.stringify({ app: 'Synergym', version: 3, exportedAt: new Date().toISOString(), profile: S.profile, library: S.library, sessions: sorted(), splits: [...S.splits.values()] }, null, 1), 'application/json');
}
$('#imp').addEventListener('change', async e => {
  const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
  if (f.size > 20e6) return toast('That file is too large');
  try {
    const d = JSON.parse(await f.text());
    const lib = Array.isArray(d.library) ? d.library : [], ss = Array.isArray(d.sessions) ? d.sessions : [];
    if (!lib.length && !ss.length) return toast('No workout data found in that file');
    const remap = new Map(); let addedL = 0, addedS = 0, delay = 0;
    for (const x of lib) {
      if (!x || !x.name) continue; const name = String(x.name).trim().slice(0, 60); if (!name) continue;
      let e = S.library.find(y => y.name.toLowerCase() === name.toLowerCase());
      if (!e) { e = { id: uuid(), name, muscle: MUSCLES.includes(x.muscle) ? x.muscle : 'Full body', kind: x.kind === 'bw' ? 'bw' : 'w', archived: false, isDefault: false }; S.library.push(e); queue('x:' + e.id, delay += 120); addedL++; }
      remap.set(String(x.id), e.id);
    }
    const starts = new Set([...S.sessions.values()].map(s => s.startedAt));
    for (const raw of ss) {
      const s = cleanSession(raw); if (!s || starts.has(s.startedAt)) continue;
      s.id = uuid(); s.splitId = null; s.splitDay = null;
      for (const it of s.items) it.exId = remap.get(String(it.exId)) || it.exId;
      s.items = s.items.filter(it => exOf(it.exId)); if (!s.items.length) continue;
      if (!s.endedAt) s.endedAt = s.startedAt + 3600000;
      S.sessions.set(s.id, s); queue('s:' + s.id, delay += 120); addedS++;
    }
    render(false); toast(`Imported ${plural(addedS, 'session')} and ${plural(addedL, 'new exercise')}`);
  } catch { toast('That file isn’t a valid Synergym export'); }
});

/* ================= account ================= */
async function signOut() {
  flushAll(); const t0 = Date.now();
  while ((OB.pending.size || OB.inflight.size) && Date.now() - t0 < 5000) await sleep(150);
  if (OB.pending.size && !confirmLeave) { confirmLeave = true; return toast('Some changes haven’t saved yet. They’ll sync when you sign back in. Tap Sign out again to leave.'); }
  confirmLeave = false; await sb.auth.signOut();
}
let confirmLeave = false;
function deleteAccount() {
  openSheet(`<div class="sh-h"><h3>Delete your account?</h3><button class="btn ghost sm" data-act="close">Close</button></div>
  <p class="muted">This permanently deletes your sessions, exercises, splits and shares. Export your data first if you want a copy. Type DELETE to confirm.</p>
  <div class="form" style="margin-top:14px"><input class="field" id="del-c" autocomplete="off" placeholder="DELETE"></div>
  <div class="btns"><button class="btn danger" id="del-go">Delete account</button></div>`, r => {
    r.querySelector('#del-go').onclick = async () => {
      if (r.querySelector('#del-c').value.trim() !== 'DELETE') return toast('Type DELETE to confirm');
      const { error } = await sb.rpc('delete_account'); if (error) return toast('Couldn’t delete the account. Try again.');
      OB.pending.clear(); persistOutbox(); closeSheet(); await sb.auth.signOut(); toast('Account deleted');
    };
  });
}
function changeUsername() {
  openSheet(`<div class="sh-h"><h3>Change username</h3><button class="btn ghost sm" data-act="close">Close</button></div>
  <div class="form"><label>New username<input class="field" id="un" value="${esc(S.profile.username)}" autocapitalize="none" spellcheck="false" maxlength="20"></label><p class="muted" style="font-size:12px">Splits already shared with you stay. People will need the new name to share with you.</p></div>
  <div class="btns"><button class="btn" id="un-save">Save</button></div>`, r => {
    r.querySelector('#un-save').onclick = async () => { if (await setUsername(r.querySelector('#un').value)) { closeSheet(); render(false); toast('Username updated'); } };
  });
}

/* ================= event wiring ================= */
const ACT = {
  nav: el => go(el.dataset.v),
  'auth-mode': el => { S.authMode = el.dataset.m; S.authMsg = null; render(false); },
  signout: signOut,
  'retry-load': () => startApp(),
  start: startSession,
  'start-menu': startMenu,
  'start-day': el => startFromSplit(el.dataset.sp, +el.dataset.day),
  resume: el => go('session', el.dataset.id || activeSession()?.id),
  open: el => go('session', el.dataset.id),
  back,
  repeat: el => repeatSession(el.dataset.id),
  'add-ex': () => { if (!S.link) openPicker('session'); },
  'new-ex': () => newExercise({ name: S.exq.trim() }),
  'edit-ex': el => editExercise(el.dataset.id),
  'open-ex': el => { if (!S.link) go('exercise', el.dataset.id); },
  'exm': el => { S.exm = el.dataset.m; $('#exm').innerHTML = muscleChips(); $('#exlist').innerHTML = exList(); },
  'toggle-arch': () => { S.showArchived = !S.showArchived; $('#exlist').innerHTML = exList(); },
  'lib-menu': () => menuSheet('Exercise list', [
    { label: 'Restore default list', hint: 'adds back removed defaults', fn: async () => { const { data, error } = await sb.rpc('restore_default_exercises'); if (error) return toast('Couldn’t restore. Try again.'); await reloadLibrary(); toast(data ? `Restored ${plural(data, 'exercise')}` : 'Your default list is complete'); } },
    { label: S.showArchived ? 'Hide removed exercises' : 'Show removed exercises', fn: () => { S.showArchived = !S.showArchived; render(false); } }
  ]),
  'pk-m': el => { S.pk.m = el.dataset.m; pickerList(); },
  'pk-pick': el => picked(exOf(el.dataset.id)),
  'pk-new': () => { const q = S.pk.q.trim(), pk = { ...S.pk }; closeSheet(); newExercise({ name: q, muscle: pk.m }, ex => { S.pk = pk; picked(ex); if (pk.mode === 'split') openPicker('split', { split: pk.split, day: pk.day }); }); },
  'add-set': el => addSet(el.dataset.item),
  'add-drop': el => addDrop(el.dataset.set),
  done: el => toggleDone(el.dataset.set),
  'set-menu': el => setMenu(el.dataset.set),
  'item-menu': el => itemMenu(el.dataset.item),
  'sess-menu': sessMenu,
  'edit-date': editDate,
  finish,
  'link-toggle': () => { S.link = new Set(); render(false); toast('Tap the sets you want to link'); },
  'link-cancel': () => { S.link = null; render(false); },
  'link-pick': el => { const id = el.dataset.set; S.link.has(id) ? S.link.delete(id) : S.link.add(id); render(false); },
  'link-do': () => { const s = cur(); if (!s || !S.link || S.link.size < 2) return; const g = sid(); for (const it of s.items) for (const st of it.sets) if (S.link.has(st.id)) st.g = g; cleanGroups(s);
    const t = previewGroup(s, [...S.link]).type; S.link = null; queue('s:' + s.id, 0); render(false); toast(t + ' linked'); },
  unlink: el => { const s = cur(); if (!s) return; for (const it of s.items) for (const st of it.sets) if (st.g === el.dataset.g) st.g = null; queue('s:' + s.id, 300); render(false); },
  'rest-add': el => { if (S.rest) { S.rest.end += (+el.dataset.d) * 1000; tick(); } },
  'rest-tap': () => { if (S.rest) { S.rest = null; tick(); toast('Rest skipped'); } },
  'new-split': () => menuSheet('New split', [{ label: 'Blank split', hint: '3 empty days', fn: newSplit }, ...TEMPLATES.map(t => ({ label: t.name, hint: plural(t.days, 'day') + ' a week', fn: () => { const sp = splitFromTemplate(t); go('split', sp.id); toast('Template added. Make it yours.'); } }))]),
  'open-split': el => go('split', el.dataset.id),
  'open-shared': el => go('shared', el.dataset.id),
  'split-menu': el => splitMenu(el.dataset.id),
  'share-split': el => shareSheet(el.dataset.id),
  'days-step': el => { const sp = curSplit(); if (!sp) return; const d = +el.dataset.d;
    if (d > 0) { if (sp.days.length >= 14) return toast('A split can have up to 14 days'); sp.days.push({ id: sid(), type: '', rest: false, exercises: [] }); touchSplit(sp, 300); render(false); }
    else { if (sp.days.length <= 1) return; const last = sp.days[sp.days.length - 1]; const rm = () => { sp.days.pop(); touchSplit(sp, 300); render(false); };
      if (last.exercises.length) confirmSheet(`Remove day ${sp.days.length}?`, `Its ${plural(last.exercises.length, 'exercise')} will be removed from the plan.`, 'Remove day', rm); else rm(); } },
  'dtype-pick': el => { const sp = curSplit(), d = sp && sp.days[+el.dataset.day]; if (!d) return; d.type = el.dataset.t; d.rest = el.dataset.t === 'Rest'; touchSplit(sp, 300); render(false); },
  'day-rest': el => { const sp = curSplit(), d = sp && sp.days[+el.dataset.day]; if (!d) return; d.rest = true; if (!d.type || DAY_TYPES.includes(d.type)) d.type = 'Rest'; touchSplit(sp, 300); render(false); },
  'day-train': el => { const sp = curSplit(), d = sp && sp.days[+el.dataset.day]; if (!d) return; d.rest = false; if (/^rest$/i.test(d.type)) d.type = ''; touchSplit(sp, 300); render(false); },
  'dex-add': el => openPicker('split', { split: S.arg, day: +el.dataset.day }),
  'dex-menu': el => dexMenu(+el.dataset.day, +el.dataset.x),
  'copy-shared': el => { const sp = S.shared.find(x => x.id === el.dataset.id); if (sp) copySplit(sp, sp.from); },
  'remove-shared': el => confirmSheet('Remove shared split?', 'It disappears from your list. The owner keeps it.', 'Remove', async () => {
    const { error } = await sb.from('split_shares').delete().eq('split_id', el.dataset.id).eq('to_user', S.user.id);
    if (error) return toast('Couldn’t remove it. Try again.'); S.shared = S.shared.filter(x => x.id !== el.dataset.id); go('splits', null, { replace: true }); }),
  'copy-public': () => { if (S.pub?.data) copySplit(S.pub.data, S.pub.data.owner_username); },
  'public-signin': () => { try { localStorage.setItem('sg-open-split', S.arg); } catch {} S.authMode = 'signup'; go('today', null, { replace: true }); },
  unit: el => { S.profile.unit = el.dataset.u; queue('p'); render(false); },
  step: el => { const k = el.dataset.k, d = +el.dataset.d; S.profile[k] = k === 'target' ? Math.min(7, Math.max(1, S.profile.target + d)) : Math.min(600, Math.max(15, S.profile.rest + d)); queue('p'); render(false); },
  toggle: el => { const k = el.dataset.k; S.profile[k] = !S.profile[k]; if (k === 'restOn' && !S.profile.restOn) S.rest = null; queue('p'); render(false); },
  'change-username': changeUsername,
  'delete-account': deleteAccount,
  export: el => exportData(el.dataset.f),
  import: () => $('#imp').click(),
  close: closeSheet,
  'theme-flip': flipTheme,
  theme: el => setTheme(el.dataset.t),
  resend: async () => { if (!S.pendingEmail) return; const { error } = await sb.auth.resend({ type: 'signup', email: S.pendingEmail, options: { emailRedirectTo: location.origin } }); S.authMsg = error ? { text: authErr(error), err: true } : { text: 'Sent again. It can take a minute to arrive.', err: false }; render(false); },
  'ob-unit': el => { S.ob.unit = S.profile.unit = el.dataset.u; render(false); },
  'ob-pick': el => { const k = el.dataset.k, v = el.dataset.v; S.ob[k] = k === 'days' ? +v : v; S.authMsg = null; render(false); },
  'ob-back': () => { S.ob.step = Math.max(2, S.ob.step - 1); S.authMsg = null; render(true); },
  'ob-next': () => {
    const o = S.ob, bad = t => { S.authMsg = { text: t, err: true }; render(false); };
    if (o.step === 3) { if (!(o.bw >= 30 && o.bw <= 300)) return bad('Enter your bodyweight so bodyweight exercises are scored correctly.'); if (!o.exp) return bad('Pick your experience level.'); }
    if (o.step === 4) { if (!o.goal) return bad('Pick a goal.'); o.tpl = o.tpl || recommendTemplate(o.days, o.exp).id; }
    S.authMsg = null; o.step++; render(true);
  },
  'ob-finish': async el => {
    const o = S.ob, p = S.profile; el.disabled = true;
    Object.assign(p, { unit: o.unit, bw: o.bw, exp: o.exp, goal: o.goal, target: o.days, onboarded: true });
    const { error } = await sb.from('profiles').update(profToDb(p)).eq('id', S.user.id);
    if (error) { p.onboarded = false; el.disabled = false; S.authMsg = { text: 'Couldn’t finish setup. Check your connection and try again.', err: true }; return render(false); }
    if (o.tpl && o.tpl !== 'none') splitFromTemplate(TEMPLATES.find(t => t.id === o.tpl));
    S.authMsg = null; const t = pendingPublic();
    if (t) go('public', t, { replace: true }); else go('today', null, { replace: true });
    toast(`Welcome to Synergym${p.name ? ', ' + p.name : ''}`);
  }
};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el || el.disabled) return;
  const fn = ACT[el.dataset.act]; if (fn) { e.preventDefault(); fn(el, e); }
});
document.addEventListener('input', e => {
  const el = e.target, f = el.dataset && el.dataset.f; if (!f) return; const s = cur();
  switch (f) {
    case 'w': case 'r': { if (!s) return; const x = findSet(s, el.dataset.set); if (!x) return; const raw = el.value.trim().replace(',', '.');
      if (f === 'w') { const v = parseFloat(raw); x.st.w = raw === '' || !isFinite(v) ? null : Math.min(2000, Math.max(0, fromU(v))); }
      else { const v = parseInt(raw, 10); x.st.r = raw === '' || !isFinite(v) ? null : Math.min(999, Math.max(0, v)); }
      queue('s:' + s.id); liveRefresh(); break; }
    case 'sname': if (s) { s.name = el.value.trim() ? el.value.slice(0, 80) : null; queue('s:' + s.id, 900); } break;
    case 'notes': if (s) { s.notes = el.value.slice(0, 4000); queue('s:' + s.id, 1200); } break;
    case 'q': S.q = el.value; $('#hlist').innerHTML = historyList(); break;
    case 'exq': S.exq = el.value; $('#exlist').innerHTML = exList(); break;
    case 'bw': { const v = parseFloat(el.value.replace(',', '.')); if (isFinite(v) && v > 0) { S.profile.bw = Math.min(300, Math.max(30, fromU(v))); queue('p', 900); } break; }
    case 'pw': { const v = el.value; let sc = 0; if (v.length >= 8) sc++; if (v.length >= 12) sc++; if (/[a-z]/.test(v) && /[A-Z]/.test(v)) sc++; if (/\d/.test(v)) sc++; if (/[^A-Za-z0-9]/.test(v)) sc++;
      const m = $('#pwm'), t = $('#pwt'); if (m) { m.style.width = (sc * 20) + '%'; m.style.background = sc <= 1 ? 'var(--bad)' : sc <= 3 ? 'var(--accent)' : 'var(--good)'; }
      if (t) t.textContent = !v ? 'At least 8 characters. A passphrase is best.' : v.length < 8 ? `${8 - v.length} more character${8 - v.length === 1 ? '' : 's'}` : ['Weak', 'Weak', 'Okay', 'Good', 'Strong', 'Very strong'][sc];
      break; }
    case 'obbw': { const v = parseFloat(el.value.replace(',', '.')); S.ob.bw = isFinite(v) && v > 0 ? (S.ob.unit === 'lb' ? v / KG_LB : v) : null; break; }
    case 'dname': S.profile.name = el.value.trim().slice(0, 40); queue('p', 900); break;
    case 'restr': S.profile.rest = +el.value; $('#restv').textContent = 'rest ' + mmss(S.profile.rest * 1000); queue('p', 900); break;
    case 'spname': { const sp = curSplit(); if (sp) { sp.name = el.value.slice(0, 60) || 'Untitled split'; touchSplit(sp); } break; }
    case 'spdesc': { const sp = curSplit(); if (sp) { sp.description = el.value.slice(0, 1000); touchSplit(sp, 1200); } break; }
    case 'dtype': { const sp = curSplit(), d = sp && sp.days[+el.dataset.day]; if (d) { d.type = el.value.slice(0, 40); d.rest = /^rest$/i.test(d.type.trim()); touchSplit(sp); } break; }
    case 'dsets': { const sp = curSplit(), x = sp && sp.days[+el.dataset.day]?.exercises[+el.dataset.x]; const v = parseInt(el.value, 10); if (x && v > 0) { x.sets = Math.min(20, v); touchSplit(sp); } break; }
    case 'dreps': { const sp = curSplit(), x = sp && sp.days[+el.dataset.day]?.exercises[+el.dataset.x]; if (x) { x.reps = el.value.trim().slice(0, 12) || '8-12'; touchSplit(sp); } break; }
  }
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return; const el = e.target; if (!(el.dataset && (el.dataset.f === 'w' || el.dataset.f === 'r'))) return;
  e.preventDefault(); const all = $$('#view [data-f="w"],#view [data-f="r"]'); const i = all.indexOf(el); if (all[i + 1]) all[i + 1].focus(); else el.blur();
});

/* ================= rest timer / wake lock / motion ================= */
function tick() {
  const now = Date.now();
  const nd = $('[data-now="t"]'); if (nd) { const t = fmtTime(now); if (nd.textContent !== t) nd.textContent = t; }
  const s = cur(), ts = $('#tsum'); if (!s || !ts || S.view !== 'session') return;
  const tr = $('#trest');
  if (S.rest && !s.endedAt) {
    const left = S.rest.end - now;
    if (left <= 0 && !S.rest.beeped) { S.rest.beeped = true; beep(); try { navigator.vibrate && navigator.vibrate([120, 60, 120]); } catch {} setTimeout(() => { S.rest = null; tick(); }, 2200); }
    ts.className = 'tsum rest'; ts.title = 'Tap to skip rest'; ts.innerHTML = `<small>${left > 0 ? 'rest' : 'go'}</small>${mmss(left)}`; if (tr) tr.hidden = false;
  } else {
    const a = S.A?.sess.get(s.id); ts.className = 'tsum'; ts.innerHTML = a ? `${a.sets} set${a.sets === 1 ? '' : 's'} · ${fmtVol(a.vol)}` : ''; if (tr) tr.hidden = true;
  }
}
setInterval(() => { if (S.rest || $('[data-now="t"]')) tick(); }, 1000);
let wl = null;
async function wake(on) { try { if (on && !wl && navigator.wakeLock && document.visibilityState === 'visible') { wl = await navigator.wakeLock.request('screen'); wl.addEventListener('release', () => { wl = null; }); } else if (!on && wl) { await wl.release(); wl = null; } } catch { wl = null; } }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.view === 'session' && cur() && !cur().endedAt) wake(true); });
let mq = null;
addEventListener('pointermove', e => {
  if (reduced || e.pointerType !== 'mouse') return; mq = e;
  requestAnimationFrame(() => { if (!mq) return; const p = mq; mq = null; for (const b of $$('.magnet')) { const r = b.getBoundingClientRect(), dx = p.clientX - (r.left + r.width / 2), dy = p.clientY - (r.top + r.height / 2), d = Math.hypot(dx, dy); b.style.transform = d < 130 ? `translate(${dx * .28}px,${dy * .28}px) scale(1.06)` : ''; } });
}, { passive: true });

/* ================= boot ================= */
function resetState() {
  Object.assign(S, { user: null, loaded: false, loadError: null, profile: { ...DEFAULT_PROFILE }, library: [], sessions: new Map(), splits: new Map(), shared: [], recipients: new Map(), rest: null, link: null, q: '', exq: '', exm: '' });
  OB.pending.clear(); OB.inflight.clear(); for (const t of OB.timers.values()) clearTimeout(t); OB.timers.clear(); OB.failing = false;
}
async function startApp() {
  S.loaded = false; S.loadError = null; render(false);
  restoreOutbox();
  try { await loadAll(); }
  catch (e) { console.error(e); S.loadError = navigator.onLine ? (e.message || 'The server didn’t respond.') : 'You’re offline. Connect and try again.'; return render(true); }
  S.loaded = true; flushAll();
  const p = S.profile;
  S.ob = { step: p.username ? 3 : 2, name: p.name, username: p.username || '', unit: p.unit, bw: p.bw, exp: p.exp, goal: p.goal, days: p.target || 3, tpl: null };
  const t = S.profile.onboarded && pendingPublic();
  if (t) return go('public', t, { replace: true });
  route(true);
}
function boot() {
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { if (themePref() === 'auto') render(false); });
  history.replaceState({ d: 0 }, '', location.pathname + location.search + location.hash);
  route(true);
  if (!sb) return;
  sb.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') { S.recover = true; S.authMsg = null; render(false); }
    const u = session?.user || null;
    setTimeout(() => {
      S.authReady = true;
      if (u && (!S.user || S.user.id !== u.id)) { resetState(); S.user = u; startApp(); }
      else if (u) { S.user = u; }
      else if (!u && S.user) { resetState(); S.recover = false; go('today', null, { replace: true }); }
      else render(false);
    }, 0);
  });
}
boot();
