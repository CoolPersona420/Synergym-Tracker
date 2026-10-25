import { createClient } from '@supabase/supabase-js';
import './style.css';
import { suggestNext } from './lib/progress.js';
import * as ldb from './lib/localdb.js';
import { planSync } from './lib/sync.js';
import { DEFAULT_EXERCISES } from './data/exercises.js';
import { reduced, LITE } from './lib/env.js';
import { $, $$, esc, uuid, sid, pad, sleep, clone, fmtDate, fmtTime, mmss, dayKey, plural, weekStart, shiftWeek, roll, toast } from './lib/util.js';
import { num, cleanSession, cleanDays } from './lib/sanitize.js';
import { DEFAULT_PROFILE, profFromDb, profToDb } from './lib/profile.js';
import { parseImport } from './lib/importer.js';
import { ICON, brand, lockup, big, disp, countUp } from './ui/brand.js';
import { THEMES, themePref, isDark, applyTheme, themePicker } from './ui/themes.js';
import { SPL, QS, setSplashHooks, splashIn, splashOut, quickIn, quickOut } from './ui/splash.js';
import { TEMPLATES, recommendTemplate } from './data/templates.js';
import { QUOTES } from './data/quotes.js';
import { guideSections, tourSlides } from './ui/guide.js';
import { PLATES, BARS, platesFor, sideText } from './lib/plates.js';
import { logBw, unlogBw, bwSeries, bwChange, weekSummary } from './lib/body.js';
import { trackErrors, startAnalytics } from './lib/telemetry.js';
import { pushSupported, isIOS, subscribe as pushSubscribe, unsubscribe as pushUnsubscribe, DAY_LETTERS, DAY_NAMES, daysText, timeText } from './lib/push.js';

/* ================= config ================= */
// The project URL and publishable key are public by design (every browser receives them; Row Level
// Security protects the data). They're the defaults here so a deploy works without extra setup;
// VITE_SUPABASE_URL / VITE_SUPABASE_KEY in the environment override them, e.g. for a staging project.
const SB_URL = (import.meta.env.VITE_SUPABASE_URL || 'https://dqpxqinejgovkhwvsqem.supabase.co').trim();
const SB_KEY = (import.meta.env.VITE_SUPABASE_KEY || 'sb_publishable_jTBU_Y-1T3ouNej7YUsCIQ_E5ceELbu').trim();
const sb = SB_URL && SB_KEY
  ? createClient(SB_URL, SB_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' } })
  : null;

/* errors reach the database only for a signed-in user (S is defined below; this runs later, on an error) */
const BUILD = (document.querySelector('script[type="module"][src*="/assets/index-"]')?.getAttribute('src') || 'dev').replace(/^.*\//, '');
const reportError = trackErrors(e => { if (sb && S.user && !S.local) sb.rpc('report_error', { p_message: e.message, p_stack: e.stack, p_path: e.path, p_build: BUILD, p_ua: navigator.userAgent.slice(0, 300) }).then(() => {}, () => {}); });
if (import.meta.env.PROD) startAnalytics();

/* ================= constants ================= */
const DEFAULT_MUSCLES = ['Chest','Back','Shoulders','Biceps','Triceps','Quads','Hamstrings','Glutes','Calves','Core','Full body'];
const muscles = () => (Array.isArray(S.profile.muscles) && S.profile.muscles.length ? S.profile.muscles : DEFAULT_MUSCLES);
const DAY_TYPES = ['Push','Pull','Legs','Upper','Lower','Full body','Chest & Back','Arms','Shoulders','Glutes','Cardio','Rest'];
const DAYS = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const KG_LB = 2.2046226;


/* ================= state ================= */
const S = {
  authReady: false, user: null, loaded: false, loadError: null,
  profile: { ...DEFAULT_PROFILE }, library: [], sessions: new Map(), splits: new Map(), shared: [], recipients: new Map(),
  view: 'today', arg: null, link: null, rest: null, q: '', exq: '', exm: '', showArchived: false, A: null, animate: false,
  ob: { step: 2, name: '', username: '', unit: 'kg', bw: 75, exp: null, goal: null, days: 3, tpl: null },
  pk: {}, authMode: 'signin', authMsg: null, recover: false, pub: null, lastFetch: 0
};

/* ================= utils ================= */
const unit = () => S.profile.unit === 'lb' ? 'lb' : 'kg';
const toU = kg => S.profile.unit === 'lb' ? kg * KG_LB : kg;
const fromU = v => S.profile.unit === 'lb' ? v / KG_LB : v;
const fmtW = kg => { if (kg == null || !isFinite(kg)) return ''; return String(Math.round(toU(kg) * 10) / 10); };
const fmtVol = kg => { const v = toU(kg || 0); if (v >= 10000) return (v / 1000).toFixed(1) + (unit() === 'lb' ? 'k lb' : ' t'); return Math.round(v).toLocaleString('en-US') + ' ' + unit(); };

/* ================= themes ================= */
function flipTheme() {
  const t = THEMES.find(x => x.id === themePref());
  const next = t && t.pair ? t.pair : (isDark() ? 'light' : 'dark');
  applyTheme(next);
  if (S.user && S.loaded && S.profile.onboarded) { S.profile.theme = next; queue('p', 300); }
  render(false);
}

/* ================= sanitising ================= */

/* ================= db mapping ================= */
const exFromDb = r => ({ id: r.id, name: r.name, muscle: r.muscle, kind: r.kind === 'bw' ? 'bw' : 'w', archived: !!r.archived, isDefault: !!r.is_default, oneRm: r.one_rm != null ? +r.one_rm : null, oneRmAt: r.one_rm_at ? Date.parse(r.one_rm_at) : null });
const exToDb = e => ({ id: e.id, user_id: S.user.id, name: e.name.trim(), muscle: e.muscle, kind: e.kind, archived: !!e.archived, is_default: !!e.isDefault, one_rm: e.oneRm > 0 ? Math.round(e.oneRm * 100) / 100 : null, one_rm_at: e.oneRm > 0 && e.oneRmAt ? new Date(e.oneRmAt).toISOString() : null });
const sessFromDb = r => cleanSession({ id: r.id, name: r.name, startedAt: Date.parse(r.started_at), endedAt: r.ended_at ? Date.parse(r.ended_at) : null, notes: r.notes, items: r.items, splitId: r.split_id, splitDay: r.split_day });
const sessToDb = s => ({ id: s.id, user_id: S.user.id, name: s.name, started_at: new Date(s.startedAt).toISOString(), ended_at: s.endedAt ? new Date(s.endedAt).toISOString() : null, notes: s.notes || '', items: s.items, split_id: s.splitId || null, split_day: s.splitDay ?? null, updated_at: new Date().toISOString() });
const splitFromDb = r => ({ id: r.id, name: r.name, description: r.description || '', days: cleanDays(r.days), shareToken: r.share_token || null, copiedFrom: r.copied_from || null, updatedAt: Date.parse(r.updated_at) || 0 });
const splitToDb = p => ({ id: p.id, user_id: S.user.id, name: p.name.trim() || 'Untitled split', description: p.description || '', days: p.days, share_token: p.shareToken, copied_from: p.copiedFrom, updated_at: new Date().toISOString() });

/* ================= save queue (survives reloads and dropped connections) ================= */
const OB = { lastOk: new Map(), pending: new Set(), timers: new Map(), inflight: new Set(), again: new Set(), failing: false, backoff: 2000, retryT: null };
const obKey = () => S.user ? 'sg-outbox-' + S.user.id : null;
/* outbox keys are "s:<id>", "x:<id>", "sp:<id>", or plain "p" for the profile */
const splitKey = key => { const i = key.indexOf(':'); return i < 0 ? [key, ''] : [key.slice(0, i), key.slice(i + 1)]; };
function snapshot(key) {
  const [t, id] = splitKey(key);
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
    const [t, id] = splitKey(key);
    if (t === 's') { if (val) { const s = cleanSession(val); if (s) S.sessions.set(id, s); } else S.sessions.delete(id); }
    else if (t === 'x') { S.library = S.library.filter(e => e.id !== id); if (val && val.name) S.library.push({ id, name: String(val.name).slice(0, 60), muscle: val.muscle || 'Full body', kind: val.kind === 'bw' ? 'bw' : 'w', archived: !!val.archived, isDefault: !!val.isDefault, oneRm: num(val.oneRm), oneRmAt: num(val.oneRmAt) }); }
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
  if (S.local) return runLocal(key);
  const [t, id] = splitKey(key);
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
    ok = true; OB.failing = false; OB.backoff = 2000; OB.lastOk.set(key, Date.now());
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
  /* while going online, a rejected record stops the sync so the phone keeps its copy */
  if (S.syncing) { SYNC_FAILED.push(key); console.error('Sync rejected', key, e); return; }
  console.error('Save failed', key, e); reportError(`Save failed (${splitKey(key)[0]}): ${e.code || ''} ${e.message || ''}`, null);
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
const autosaveText = () => OB.pending.has('p') || OB.inflight.has('p') ? 'Saving…' : S.local ? (OB.failing ? 'Couldn’t save on this phone · retrying' : 'Saved on this phone') : OB.failing ? 'Saved on this device · syncs when online' : 'Changes save automatically';
function syncUI() {
  const busy = OB.pending.size || OB.inflight.size;
  let txt = 'Synced';
  if (OB.failing) txt = S.local ? 'Couldn’t save on this phone · retrying' : navigator.onLine ? 'Couldn’t save · retrying' : 'Offline · saved on this device';
  else if (busy) txt = 'Saving';
  const net = $('#net'); if (net && !net.classList.contains('upd')) { net.hidden = !OB.failing; if (OB.failing) net.textContent = txt; }
  const as = $('#autosave'); if (as) as.textContent = autosaveText();
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
  const uid = S.user.id, t0 = Date.now();
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
  const keep = k => OB.pending.has(k) || OB.inflight.has(k) || (OB.lastOk.get(k) || 0) >= t0;
  const prof = profFromDb(pr.data);
  /* a profile change still waiting to save wins, but the account's own facts (set-up done, username, device)
     always come from the server: the waiting copy was built before they were known */
  S.profile = keep('p') ? { ...S.profile, username: prof.username, onboarded: prof.onboarded || S.profile.onboarded, activeSession: prof.activeSession } : prof;
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
async function refresh() { if (S.local || S.syncing) return; try { await loadAll(); soft(); } catch (e) { console.warn(e); } }
async function reloadLibrary() { if (S.local) return render(false); try { const ex = await fetchAll(() => sb.from('exercises').select('*').order('name')); S.library = ex.map(exFromDb); render(false); } catch {} }

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
      const ex = exMap.get(it.exId), orm = ex && ex.oneRm > 0 && ex.oneRmAt && ex.oneRmAt <= (s.endedAt || Date.now()) ? ex.oneRm : 0, ref = Math.max(best.get(it.exId) || 0, orm);
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
/* 1RM: the confirmed value if the user saved one, otherwise the best estimate from finished sessions */
function prevBestE1rm(exId, excludeSid) {
  const ex = exOf(exId); let b = 0;
  for (const s of S.sessions.values()) { if (s.id === excludeSid) continue; for (const it of s.items) if (it.exId === exId) for (const st of it.sets) { const v = e1rm(loadOf(st, ex), +st.r || 0); if (v > b) b = v; } }
  return b;
}
const oneRmOf = (exId, excludeSid) => { const ex = exOf(exId); return ex && ex.oneRm > 0 ? ex.oneRm : prevBestE1rm(exId, excludeSid); };
const roundW = kg => { const st = unit() === 'lb' ? 1 : 0.5; return fromU(Math.round(toU(kg) / st) * st); };
function liveTop(s, it) { const ex = exOf(it.exId); let b = 0, bs = null; for (const st of it.sets) { const v = e1rm(loadOf(st, ex), +st.r || 0); if (v > b) { b = v; bs = st; } } return { v: b, st: bs }; }
function ormLine(s, it) {
  const ex = exOf(it.exId); if (!ex) return '';
  const base = oneRmOf(it.exId, s.id), top = liveTop(s, it).v, saved = ex.oneRm > 0;
  if (!base && !top) return `${esc(ex.muscle)} · first log`;
  let t = `${esc(ex.muscle)} · ${saved ? '1RM' : 'est. 1RM'} ${base ? fmtW(roundW(base)) + ' ' + unit() : '—'}`;
  if (top > base * 1.0001 && base > 0) t += ` · <em class="pr">today ${fmtW(roundW(top))} ↑</em>`;
  else if (top > 0 && !base) t += ` · today ${fmtW(roundW(top))}`;
  return t;
}
const declined1rm = new Map();
function maybePromptOneRm(s, it, st) {
  const ex = exOf(it.exId); if (!ex || s.endedAt) return;
  const v = e1rm(loadOf(st, ex), +st.r || 0), base = oneRmOf(it.exId, s.id);
  if (!(v > 0) || !(base > 0) || v <= base * 1.0001) return;
  const val = roundW(v); if (val <= base) return;
  if ((declined1rm.get(ex.id) || 0) >= val) return;
  const u = unit(), single = (+st.r || 0) === 1;
  openSheet(`<div class="sh-h"><h3>New 1RM PR?</h3><button class="btn ghost sm" data-act="close">Close</button></div>
  <div class="pr-hero"><span class="lbl">${esc(ex.name)}</span><div class="bignum md"><span class="n">${fmtW(val)}</span><span class="pr-u">${u}</span></div>
  <p class="muted">${single ? 'A true single' : `Estimated from ${fmtW(loadOf(st, ex))} ${u} × ${st.r}`}. Your ${ex.oneRm > 0 ? 'saved 1RM is' : 'best estimate so far is'} ${fmtW(roundW(base))} ${u} (+${fmtW(val - roundW(base)) || 0} ${u}).</p></div>
  <div class="btns"><button class="btn ghost" id="orm-no">Not now</button><button class="btn" id="orm-yes">Update my 1RM</button></div>`, r => {
    r.querySelector('#orm-no').onclick = () => { declined1rm.set(ex.id, val); closeSheet(); };
    r.querySelector('#orm-yes').onclick = () => { ex.oneRm = val; ex.oneRmAt = Date.now(); queue('x:' + ex.id, 0); closeSheet(); render(false); toast(`${ex.name} 1RM is now ${fmtW(val)} ${u}`); };
  });
}
function editOneRm(id) {
  const ex = exOf(id); if (!ex) return; const est = prevBestE1rm(id), u = unit();
  openSheet(`<div class="sh-h"><h3>${esc(ex.name)} 1RM</h3><button class="btn ghost sm" data-act="close">Close</button></div><div class="form">
  <label>One-rep max (${u})<input class="field" id="orm-v" inputmode="decimal" value="${ex.oneRm > 0 ? fmtW(ex.oneRm) : ''}" placeholder="${est ? fmtW(roundW(est)) : '0'}"></label>
  <p class="muted" style="font-size:13px">${est ? `Your best estimate from logged sets is ${fmtW(roundW(est))} ${u}.` : 'Log a few sets and Synergym will estimate it for you.'} Synergym asks to update this whenever a set beats it.</p></div>
  <div class="btns">${ex.oneRm > 0 ? '<button class="btn line" id="orm-clear" style="margin-right:auto">Use estimate instead</button>' : ''}${est ? `<button class="btn ghost" id="orm-est">Use ${fmtW(roundW(est))}</button>` : ''}<button class="btn" id="orm-save">Save</button></div>`, r => {
    const save = v => { if (!(v > 0 && v < 2000)) return toast('Enter a weight above 0'); ex.oneRm = v; ex.oneRmAt = Date.now(); queue('x:' + ex.id, 0); closeSheet(); render(false); toast(`1RM saved: ${fmtW(v)} ${u}`); };
    r.querySelector('#orm-save').onclick = () => save(fromU(parseFloat(r.querySelector('#orm-v').value.replace(',', '.'))));
    r.querySelector('#orm-est')?.addEventListener('click', () => save(roundW(est)));
    r.querySelector('#orm-clear')?.addEventListener('click', () => { ex.oneRm = null; ex.oneRmAt = null; queue('x:' + ex.id, 0); closeSheet(); render(false); toast('Using your best estimate'); });
  });
}
/* muscle groups: the user's own list (falls back to the defaults) */
function editMuscles() {
  const rows = muscles().map(m => ({ orig: m, name: m }));
  const count = m => S.library.filter(e => !e.archived && e.muscle === m).length;
  const draw = () => {
    $('#sheet-body').innerHTML = `<div class="sh-h"><h3>Muscle groups</h3><button class="btn ghost sm" data-act="close">Close</button></div>
    <p class="muted" style="font-size:13px;margin-bottom:var(--s0)">Rename a group and its exercises move with it. A group can be removed once no exercises use it.</p>
    <div class="share-row" style="margin-bottom:var(--s0)"><input class="field" id="mg-new" placeholder="New muscle group, e.g. Forearms" maxlength="30"><button class="btn ghost" id="mg-add">Add</button></div>
    <div class="mg-list">${rows.map((r, i) => `<div class="mg-row"><input class="field" data-mg="${i}" value="${esc(r.name)}" maxlength="30" aria-label="Muscle group name"><span class="lbl mg-n">${r.orig ? count(r.orig) : 0} ex</span>
      <button class="iconbtn" data-mg-del="${i}" aria-label="Remove ${esc(r.name)}"${r.orig && count(r.orig) ? ' disabled title="Move or remove its exercises first" style="opacity:.35"' : ''}>${ICON.x}</button></div>`).join('')}</div>
    <div class="btns sheet-foot"><button class="btn line" id="mg-reset" style="margin-right:auto">Reset</button><button class="btn" id="mg-save">Save</button></div>`;
    const r = $('#sheet-body');
    r.querySelectorAll('[data-mg]').forEach(inp => inp.oninput = () => { rows[+inp.dataset.mg].name = inp.value; });
    r.querySelectorAll('[data-mg-del]').forEach(b => b.onclick = () => { if (b.disabled) return; rows.splice(+b.dataset.mgDel, 1); draw(); });
    const add = () => { const v = r.querySelector('#mg-new').value.trim().slice(0, 30); if (!v) return; if (rows.some(x => x.name.trim().toLowerCase() === v.toLowerCase())) return toast('That group already exists'); if (rows.length >= 40) return toast('Up to 40 groups'); rows.push({ orig: null, name: v }); draw(); setTimeout(() => $('#mg-new')?.focus(), 0); };
    r.querySelector('#mg-add').onclick = add;
    r.querySelector('#mg-new').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); add(); } };
    r.querySelector('#mg-reset').onclick = () => { const used = new Set(S.library.filter(e => !e.archived).map(e => e.muscle)); rows.length = 0; for (const m of DEFAULT_MUSCLES) rows.push({ orig: muscles().includes(m) ? m : null, name: m }); for (const m of used) if (!DEFAULT_MUSCLES.includes(m)) rows.push({ orig: m, name: m }); draw(); };
    r.querySelector('#mg-save').onclick = () => {
      const names = rows.map(x => x.name.trim().slice(0, 30));
      if (names.some(n => !n)) return toast('Muscle groups need a name');
      if (new Set(names.map(n => n.toLowerCase())).size !== names.length) return toast('Two groups have the same name');
      let moved = 0;
      for (const row of rows) if (row.orig && row.orig !== row.name.trim()) {
        const to = row.name.trim();
        for (const e of S.library) if (e.muscle === row.orig) { e.muscle = to; queue('x:' + e.id, 200); moved++; }
        for (const sp of S.splits.values()) { let ch = false; for (const d of sp.days) for (const x of d.exercises) if (x.muscle === row.orig) { x.muscle = to; ch = true; } if (ch) queue('sp:' + sp.id, 400); }
      }
      S.profile.muscles = names; queue('p', 0); closeSheet(); render(false);
      toast(moved ? `Muscle groups saved · ${plural(moved, 'exercise')} moved` : 'Muscle groups saved');
    };
  };
  openSheet('', null); draw();
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
/* the last n sessions' logged sets for an exercise, newest first */
function historyFor(exId, excludeId, n = 2) {
  const out = [];
  for (const s of sorted()) { if (s.id === excludeId) continue; const it = s.items.find(i => i.exId === exId && i.sets.some(x => +x.r > 0)); if (it) { out.push(it.sets.filter(x => +x.r > 0)); if (out.length >= n) break; } }
  return out;
}
/* weights snap to what you can load: 2.5 kg or 5 lb steps */
const loadStep = () => unit() === 'lb' ? 5 : 2.5;
const snapW = kg => fromU(Math.round(toU(kg) / loadStep()) * loadStep());
const suggestFor = (s, it) => { const ex = exOf(it.exId); return ex ? suggestNext(historyFor(it.exId, s.id), { bw: ex.kind === 'bw', step: fromU(loadStep()), round: snapW }) : null; };
const bwNow = () => { const l = S.profile.bwLog; return l && l.length ? l[l.length - 1].kg : S.profile.bw; };
const isRestDay = d => d.rest || /^rest$/i.test(d.type.trim());
function nextSplitDay() {
  if (!S.splits.size) return null;
  /* a day the user picked by hand wins until they start their next session */
  const pk = S.profile.nextDay, newest = sorted()[0];
  if (pk && (!newest || newest.startedAt < pk.at)) { const sp = S.splits.get(pk.sp), d = sp && sp.days[pk.i]; if (d && !isRestDay(d)) return { sp, i: pk.i, picked: true }; }
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
    case 'guide': return ['guide'];
    case 'w': return seg[1] ? ['widget', seg[1]] : ['today'];
    case 's': return seg[1] ? ['public', seg[1]] : ['today'];
    default: return ['today'];
  }
}
const pathOf = (v, a) => ({ today: '/', history: '/history', exercises: '/exercises', exercise: '/exercises/' + a, splits: '/splits', split: '/splits/' + a, shared: '/splits/shared/' + a, session: '/session/' + a, prefs: '/settings', guide: '/guide', public: '/s/' + a, widget: '/w/' + a })[v] || '/';
function go(v, a = null, { replace = false } = {}) {
  const path = pathOf(v, a);
  if (replace) history.replaceState({ d: depth }, '', path); else { depth++; history.pushState({ d: depth }, '', path); }
  route(true);
}
function back() {
  if (depth > 0) return history.back();
  const up = { exercise: 'exercises', split: 'splits', shared: 'splits', guide: 'prefs' }[S.view] || 'today';
  navDir = 'back'; go(up, null, { replace: true });
}
addEventListener('popstate', e => { const d = e.state?.d || 0; navDir = d < depth ? 'back' : 'fwd'; depth = d; route(true); });
/* page change: a curtain wipe through the View Transitions API where the browser has it
   (old page lifts away, new page is revealed from below; reversed when going back). */
let navDir = 'fwd';
const TABS = ['today', 'splits', 'exercises', 'history', 'prefs'];
function route(enter = true) {
  const [v, a] = parsePath();
  const arg = a ? decodeURIComponent(a) : null, changed = v !== S.view || arg !== S.arg, from = S.view, fromArg = S.arg;
  S.view = v; S.arg = arg; S.link = null; S.spLink = null;
  let dir = navDir; navDir = 'fwd';
  /* tab to tab: a sideways slide in the direction of the tab bar */
  const ti = TABS.indexOf(from), tj = TABS.indexOf(v);
  if (ti >= 0 && tj >= 0 && ti !== tj) dir = tj > ti ? 'tab-fwd' : 'tab-back';
  /* a widget card grows into its full view, and shrinks back on close */
  let morph = null;
  if (v === 'widget' && from === 'today') { dir = 'widget'; morph = document.querySelector(`#view [data-w="${CSS.escape(arg || '')}"]`); }
  else if (from === 'widget' && v === 'today') { dir = 'widget'; S.morphW = fromArg; }
  if (v !== 'today' && v !== 'widget') S.homeRestore = null;
  if (enter && changed && !SPL.el && document.startViewTransition && S.loaded && !document.hidden) {
    document.documentElement.dataset.nav = dir;
    if (morph) morph.style.viewTransitionName = 'wfocus';
    const t = document.startViewTransition(() => render(true));
    t.finished.finally(() => { if (S.morphW) { S.morphW = null; const c = document.querySelector('#view [data-w][style*="wfocus"]'); if (c) c.style.viewTransitionName = ''; } });
  } else { S.morphW = null; render(enter); }
}

/* ================= rendering ================= */
let rT;
const isTyping = () => { const a = document.activeElement; return !!(a && /^(INPUT|TEXTAREA)$/.test(a.tagName) && a.closest('#view')); };
function soft() { clearTimeout(rT); rT = setTimeout(() => { if (isTyping()) { S.pendingRender = true; return; } render(false); }, 60); }
document.addEventListener('focusout', () => setTimeout(() => { if (S.pendingRender && !isTyping()) { S.pendingRender = false; render(false); } }, 320));

const KEEPX = ['#dash', '.hscroll', '.themes'];
/* fluid controls: segmented pills slide, switches glide, chips pop, even though views re-render */
const POPSEL = '.chip,.daysel button,.opt,.theme-card';
function fluidCapture(root) {
  return {
    seg: $$('.seg, .auth-tabs', root).map(s => { const b = s.querySelector('button.on'); return b ? [b.offsetLeft, b.offsetWidth] : null; }),
    tog: $$('.toggle', root).map(t => t.classList.contains('on')),
    pop: $$(POPSEL, root).map(e => e.classList.contains('on'))
  };
}
/* text boxes that wrap and grow instead of cutting long text off */
const grow = el => { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; };
function wireScrollers(root) {
  for (const t of $$('textarea.autosize', root)) { grow(t); if (!t._ag) { t._ag = 1; t.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); t.blur(); } }); } }
  for (const el of $$('.hscroll, .types', root)) {
    const upd = () => { const max = el.scrollWidth - el.clientWidth; el.classList.toggle('more-l', el.scrollLeft > 4); el.classList.toggle('more-r', max - el.scrollLeft > 4); };
    upd(); if (!el._sw) { el._sw = 1; el.addEventListener('scroll', upd, { passive: true }); }
  }
}
function fluidApply(root, prev) {
  wireScrollers(root);
  $$('.seg, .auth-tabs', root).forEach((s, i) => {
    const b = s.querySelector('button.on'); s.classList.add('pill');
    if (!b) { s.style.setProperty('--w', '0px'); return; }
    const x = b.offsetLeft, w = b.offsetWidth, p = prev && prev.seg[i];
    if (p && (p[0] !== x || p[1] !== w)) { s.classList.add('nt'); s.style.setProperty('--x', p[0] + 'px'); s.style.setProperty('--w', p[1] + 'px'); void s.offsetWidth; s.classList.remove('nt'); }
    s.style.setProperty('--x', x + 'px'); s.style.setProperty('--w', w + 'px');
  });
  if (!prev) return;
  $$('.toggle', root).forEach((t, i) => {
    const was = prev.tog[i], now = t.classList.contains('on'); if (was == null || was === now) return;
    t.classList.add('nt'); t.classList.toggle('on', was); void t.offsetWidth; t.classList.remove('nt'); t.classList.toggle('on', now);
  });
  $$(POPSEL, root).forEach((e, i) => { if (prev.pop[i] === false && e.classList.contains('on')) e.classList.add('pop-on'); });
}
let fluidT = 0;
addEventListener('resize', () => { clearTimeout(fluidT); fluidT = setTimeout(() => { fluidApply($('#view'), null); wireScrollers($('#sheet-body')); }, 150); }, { passive: true });
document.fonts?.ready.then(() => fluidApply($('#view'), null));
function render(enter) {
  /* while the login mascot glides into the splash, the login page stays put underneath; the render runs when it lands */
  if (SPL.hold) { SPL.dirty = true; SPL.dirtyEnter = SPL.dirtyEnter || !!enter; return; }
  const v = $('#view'), y = scrollY, nav = $('#nav');
  let html = '', app = false, bare = false;
  S.animate = !!enter;
  try {
    if (!sb) { html = vNoConfig(); bare = true; }
    else if (S.recover) { html = vRecover(); bare = true; }
    else if (S.syncFlow) { html = vAuth(); bare = true; }
    else if (S.view === 'public') { html = vPublic(); app = !!(S.user && S.loaded && S.profile.onboarded); }
    else if (!S.authReady || (S.user && !S.loaded && !S.loadError)) html = '<div class="boot"></div>';
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
        case 'guide': html = vGuide(); break;
        case 'widget': html = vWidget(); break;
        default: html = vToday();
      }
    }
  } catch (err) { console.error(err); reportError(`Render ${S.view}: ${err && err.message}`, err && err.stack); html = `<div class="empty"><b>Something went wrong drawing this view.</b>Reload the page. Your data is safe.</div>`; }
  S.animate = false;
  const keepX = enter ? null : KEEPX.map(q => $$(q, v).map(el => el.scrollLeft)), fprev = enter ? null : fluidCapture(v);
  v.innerHTML = html;
  fluidApply(v, fprev);
  if (keepX) KEEPX.forEach((q, i) => $$(q, v).forEach((el, j) => { if (keepX[i][j]) el.scrollLeft = keepX[i][j]; }));
  v.classList.toggle('linking', !!S.link);
  nav.hidden = !app;
  document.body.classList.toggle('no-nav', !app);
  document.body.classList.toggle('bare', bare);
  document.body.classList.toggle('in-session', app && S.view === 'session');
  document.body.classList.toggle('on-prefs', app && (S.view === 'prefs' || S.view === 'guide'));
  document.body.classList.toggle('in-full', app && S.view === 'widget');
  if (enter) {
    const hr = S.view === 'today' && S.homeRestore;
    if (hr) { const d = $('#dash', v); if (d) d.scrollLeft = hr.x; scrollTo(0, hr.y); S.homeRestore = null; } else scrollTo(0, 0);
    if (!SPL.el && !QS.el) playEnter(v);
  }
  else { v.classList.remove('enter'); scrollTo(0, y); }
  if (app) renderNav();
  syncUI(); tick();
  wake(app && S.view === 'session' && cur() && !cur().endedAt);
  afterRender(enter);
  const ready = !(sb && (!S.authReady || (S.user && !S.loaded && !S.loadError)));
  if (SPL.el && ready) splashOut();
  if (QS.el && ready) quickOut();
}
let rvObs = null;
function playEnter(v) {
  if (rvObs) { rvObs.disconnect(); rvObs = null; }
  const vh = innerHeight, late = [], io = 'IntersectionObserver' in window && !reduced;
  let i = 0;
  for (const el of $$('.rv', v)) {
    if (io && el.getBoundingClientRect().top > vh * .9) { el.classList.add('rv-wait'); late.push(el); }
    else el.style.setProperty('--i', Math.min(i++, LITE ? 5 : 10));
  }
  if (io) for (const el of $$('.list > .row, .exrow', v)) if (!el.closest('.rv-wait') && el.getBoundingClientRect().top > vh) { el.classList.add('rv-wait'); late.push(el); }
  v.classList.remove('enter'); void v.offsetWidth; v.classList.add('enter'); countUp(v);
  if (!late.length) return;
  rvObs = new IntersectionObserver(es => { for (const e of es) if (e.isIntersecting) { e.target.classList.replace('rv-wait', 'rv-in'); rvObs.unobserve(e.target); } }, { rootMargin: '0px 0px -6% 0px' });
  late.forEach(el => rvObs.observe(el));
}

function wireCarousel() {
  const d = $('#dash'), dots = $$('#dash-dots button'); if (!d || !dots.length) return;
  let raf = 0;
  d.addEventListener('scroll', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => {
    const kids = [...d.children], mid = d.scrollLeft + d.clientWidth / 2;
    let best = 0, bd = Infinity; kids.forEach((k, i) => { const c = k.offsetLeft + k.offsetWidth / 2, dd = Math.abs(c - mid); if (dd < bd) { bd = dd; best = i; } });
    dots.forEach((b, i) => { b.classList.toggle('on', i === best); b.setAttribute('aria-selected', i === best); });
  }); }, { passive: true });
}
/* phones: the widget carousel is one card size, tall enough to fill the screen down to the dock */
const phoneDash = () => matchMedia('(max-width:47.99rem)').matches;
function sizeDash() {
  const d = $('#dash'); if (!d) return;
  if (!phoneDash()) return d.style.removeProperty('--dash-h');
  const dots = $('#dash-dots'), edit = $('#view .home-edit'), nav = $('#nav');
  const below = (dots ? dots.offsetHeight + 14 : 0) + (edit ? edit.offsetHeight + 22 : 0);
  const dock = nav && !nav.hidden ? innerHeight - nav.getBoundingClientRect().top + 12 : 24;
  d.style.setProperty('--dash-h', Math.max(15 * 16, Math.floor(innerHeight - (d.getBoundingClientRect().top + scrollY) - below - dock)) + 'px');
}
addEventListener('resize', () => { if (S.view === 'today') sizeDash(); });
function afterRender(entered) {
  if (S.view === 'today') { sizeDash(); wireCarousel(); }
  if (S.view === 'today' && S.loaded && !S.hinted && coarse.matches && !reduced) {
    S.hinted = true;
    let n = 0; try { n = +localStorage.getItem('sg-fab-hint') || 0; localStorage.setItem('sg-fab-hint', n + 1); } catch {}
    if (n < 3)
    setTimeout(() => { document.body.classList.add('fab-hint'); setTimeout(() => document.body.classList.remove('fab-hint'), 2400); }, SPL.el ? 2300 : 800);
  }
  if (S.view === 'split' && S.splits.has(S.arg) && !S.recipients.has(S.arg)) loadRecipients(S.arg);
  if (S.view === 'public' && (!S.pub || S.pub.token !== S.arg)) loadPublic(S.arg);
  if (S.view === 'splits' && S.loaded && entered && Date.now() - (S.sharedAt || 0) > 3000) loadShared();
}
async function loadShared() {
  if (S.local) return;
  S.sharedAt = Date.now();
  const { data, error } = await sb.rpc('shared_with_me');
  if (error) return;
  S.shared = (data || []).map(r => ({ id: r.split_id, name: r.name, description: r.description || '', days: cleanDays(r.days), from: r.from_username, sharedAt: Date.parse(r.shared_at) }));
  if (S.view === 'splits' || S.view === 'shared') soft();
}
let navKey = null;
function renderNav() {
  const a = activeSession(), on = v => S.view === v || (v === 'exercises' && S.view === 'exercise') || (v === 'splits' && (S.view === 'split' || S.view === 'shared')) || (v === 'prefs' && S.view === 'guide');
  const key = ['today', 'splits', 'exercises', 'history', 'prefs'].find(on) || '', pop = key !== navKey; navKey = key;
  const it = (v, l, i) => `<button class="nav-i${on(v) ? ' on' + (pop ? ' pop' : '') : ''}" data-act="nav" data-v="${v}">${i}${roll(l)}</button>`;
  /* the session button is kept across renders (only its contents change), so hiding and showing it can animate */
  const nav = $('#nav'); let fab = nav.querySelector(':scope > .nav-train');
  if (!fab) { nav.innerHTML = ''; fab = document.createElement('button'); fab.className = 'nav-train'; nav.appendChild(fab); }
  for (const c of [...nav.children]) if (c !== fab) c.remove();
  const mode = a ? 'live:' + a.id : 'idle';
  if (fab.dataset.mode !== mode) {
    fab.dataset.mode = mode; fab.classList.toggle('live', !!a);
    fab.dataset.act = a ? 'resume' : 'start-menu'; fab.dataset.id = a ? a.id : ''; fab.setAttribute('aria-label', a ? 'Resume session' : 'Start session');
    fab.innerHTML = `<span class="ring">${a ? ICON.play : ICON.plus}</span><span class="nl">${a ? roll('Resume session') : roll('Start session')}</span>`;
  }
  fab.insertAdjacentHTML('beforebegin', `<div class="nav-brand">${brand()}</div>${it('today', 'Home', ICON.home)}${it('splits', 'Splits', ICON.split)}`);
  fab.insertAdjacentHTML('afterend', `${it('exercises', 'Exercises', ICON.ex)}${it('history', 'History', ICON.hist)}<button class="nav-i nav-desk${on('prefs') ? ' on' : ''}" data-act="nav" data-v="prefs">${ICON.prefs}${roll('Settings')}</button>`);
}
function pageTop(title, extra = '', logo = false) {
  return `<header class="top rv"><div class="ttl${logo ? '' : ' no-logo'}" aria-label="${esc(title)}">${logo ? brand() : ''}<span class="ttl-c" aria-hidden="true">${esc(title)}</span></div>${extra ? `<div class="hx">${extra}</div>` : ''}</header>`;
}
const vMissing = msg => `<header class="s-top rv"><button class="iconbtn" data-act="back" aria-label="Back">${ICON.back}</button></header><div class="empty rv"><b>${esc(msg)}</b>It may have been deleted on another device.</div>`;
const shell = inner => `<div class="ob ob-plain"><div class="ob-main"><div class="ob-top">${brand()}</div><div class="ob-in">${inner}</div></div></div>`;
const vNoConfig = () => shell(`<div class="msg err">This deployment is missing its Supabase settings. Set VITE_SUPABASE_URL and VITE_SUPABASE_KEY in Vercel, then redeploy.</div>`);
const vLoadError = () => shell(`<h1>Couldn’t load <em>your log</em>.</h1><p class="lead">${esc(S.loadError)}</p><button class="btn lg" data-act="retry-load">Try again</button><button class="linkbtn" data-act="signout">Sign out</button>`);

/* ---------- auth ---------- */
function obBar(step) { return `<div class="ob-bar" style="--n:${OB_N}" aria-label="Step ${step} of ${OB_N}">${OB_STEPS.map((_, i) => `<i class="${i < step ? 'on' : ''}"></i>`).join('')}</div>`; }
function vAuth() {
  const m = S.authMode, msg = S.authMsg;
  const msgHTML = msg ? `<div class="msg${msg.err ? ' err' : ''}" role="alert">${esc(msg.text)}</div>` : '';
  let box;
  if (m === 'forgot') box = `<div><h2>Reset your password</h2><p class="muted" style="margin-top:6px">We’ll email you a link to set a new one.</p></div>
    <form id="f-forgot" novalidate><label>Email<input class="field" type="email" name="email" autocomplete="email" required></label>${msgHTML}<button class="btn lg" type="submit">Send reset link</button></form>
    <button class="linkbtn" data-act="auth-mode" data-m="signin">Back to log in</button>`;
  else if (m === 'check') box = `${obBar(1)}<div><span class="lbl">Step 1 of ${OB_N}</span><h2 style="margin-top:6px">Check your inbox</h2><p class="muted" style="margin-top:6px">We sent a confirmation link to <b style="color:var(--ink)">${esc(S.pendingEmail || 'your email')}</b>. Tap it to confirm your account, and you’ll come straight back here to finish setting up.</p></div>
    ${msgHTML}<button class="btn line lg" data-act="resend">Resend the email</button><button class="linkbtn" data-act="auth-mode" data-m="signin">I’ve confirmed, log in</button>`;
  else if (m === 'signup') box = `${S.syncFlow ? '' : obBar(1)}<div>${S.syncFlow ? '' : `<span class="lbl">Step 1 of ${OB_N} · Account</span>`}<h2 style="margin-top:6px">Create your account</h2><p class="muted" style="margin-top:6px">Free. Your log stays private to you.</p></div>
    <div class="auth-tabs"><button data-act="auth-mode" data-m="signin">Log in</button><button class="on">Register</button></div>
    <form id="f-auth" novalidate>
      <label>Email<input class="field" type="email" name="email" autocomplete="email" required></label>
      <label>Password<input class="field" type="password" name="password" data-f="pw" autocomplete="new-password" minlength="8" required></label>
      <div class="pw-meter" aria-hidden="true"><i id="pwm"></i></div><span class="muted" id="pwt" style="font-size:.78rem;margin-top:-8px">${PW_HINT}</span>
      <label>Confirm password<input class="field" type="password" name="password2" autocomplete="new-password" minlength="8" required></label>
      ${msgHTML}<button class="btn lg" type="submit">Create account</button>
    </form><p class="muted" style="font-size:.78rem">Passwords are handled by Supabase Auth and stored hashed. We never see them.</p>`;
  else box = `<div><h2>Welcome back</h2><p class="muted" style="margin-top:6px">Log in to pick up where you left off.</p></div>
    <div class="auth-tabs"><button class="on">Log in</button><button data-act="auth-mode" data-m="signup">Register</button></div>
    <form id="f-auth" novalidate>
      <label>Email<input class="field" type="email" name="email" autocomplete="email" required value="${esc(S.syncFlow ? S.authEmail || '' : '')}"></label>
      <label>Password<input class="field" type="password" name="password" autocomplete="current-password" required></label>
      ${msgHTML}<button class="btn lg" type="submit">Log in</button>
    </form><button class="linkbtn" data-act="auth-mode" data-m="forgot" style="align-self:flex-start">Forgot password?</button>`;
  const swap = S.authSwap; S.authSwap = false;
  /* going online from offline: same forms, with what will happen spelled out and a way back */
  const sync = S.syncFlow ? `<div class="sync-note"><b>Go online</b><span>${m === 'signup' ? 'Create an account' : 'Log in'} and everything on this phone is uploaded to ${m === 'signup' ? 'it' : 'that account'}. Nothing on the phone is removed until the upload finishes.</span></div>` : '';
  const back = S.syncFlow ? `<button class="linkbtn" data-act="sync-cancel" style="align-self:center">Stay offline</button>` : '';
  /* offline is for the installed app on a phone; in a phone browser, say how to get it */
  const off = S.syncFlow || m === 'forgot' || m === 'check' ? '' : canGoLocal()
    ? `<div class="auth-or"><span>or</span></div><button class="btn line lg auth-off" data-act="go-local-new">Use offline without an account</button><p class="muted auth-off-n">Everything stays on this phone. Create an account later to sync.</p>`
    : coarse.matches && !standalone() ? `<p class="muted auth-off-n">Want to use Synergym without an account? Add it to your Home Screen and open it from there.</p>` : '';
  return `<div class="auth"><main class="auth-main"><div class="auth-box${swap ? ' swap' : ''}"><div class="auth-logo">${lockup()}</div>${sync}${box}${off}${back}</div></main></div>`;
}
function vRecover() {
  return shell(`<h1>Set a <em>new password</em>.</h1>
  <form id="f-recover" novalidate><label>New password<input class="field" type="password" name="password" data-f="pw" autocomplete="new-password" minlength="8" required></label><div class="pw-meter" aria-hidden="true"><i id="pwm"></i></div><span class="muted" id="pwt" style="font-size:.78rem;margin-top:-8px">${PW_HINT}</span>${S.authMsg ? `<div class="msg${S.authMsg.err ? ' err' : ''}">${esc(S.authMsg.text)}</div>` : ''}<button class="btn lg wide" type="submit">Save password</button></form>`);
}
const GOALS = [['strength', 'Get stronger', 'Heavier lifts, lower reps'], ['muscle', 'Build muscle', 'More volume, moderate reps'], ['fitness', 'General fitness', 'Feel good, stay consistent'], ['fat_loss', 'Lose fat', 'Keep strength while you cut']];
const LEVELS = [['beginner', 'Beginner', 'Under a year of lifting'], ['intermediate', 'Intermediate', 'One to three years'], ['advanced', 'Advanced', 'Three years or more']];
/* onboarding: six steps. Phones get a progress bar and Back / Continue pinned to the bottom; wider screens get a
   side rail with every step named */
const OB_STEPS = ['Account', 'You', 'Body', 'Goal', 'Split', 'Look'], OB_N = OB_STEPS.length;
function obRail(step) {
  return `<aside class="ob-rail" aria-hidden="true"><div class="ob-rail-in">${lockup()}
    <ol class="ob-steps">${OB_STEPS.map((t, i) => `<li class="${i + 1 < step ? 'done' : i + 1 === step ? 'now' : ''}"><span class="n">${i + 1 < step ? ICON.check : i + 1}</span><span class="t">${i === 0 && S.local ? 'Offline' : t}</span></li>`).join('')}</ol>
    <p class="ob-rail-f">Every answer can be changed later in Settings.</p></div></aside>`;
}
function vWizard() {
  const o = S.ob, step = Math.min(Math.max(o.step, 2), OB_N), msg = S.authMsg ? `<div class="msg${S.authMsg.err ? ' err' : ''}" role="alert">${esc(S.authMsg.text)}</div>` : '';
  const head = (t, lead) => `<div class="ob-head">${obBar(step)}<span class="lbl">Step ${step} of ${OB_N} · ${OB_STEPS[step - 1]}</span><h1>${t}</h1>${lead ? `<p class="lead">${lead}</p>` : ''}</div>`;
  const nav = (next, label = 'Continue') => `<div class="ob-nav">${step > 2 ? `<button class="btn line lg" data-act="ob-back">Back</button>` : '<span></span>'}<button class="btn lg" ${next}>${label}</button></div>`;
  const card = (k, v, on, t, d, extra = '') => `<button class="opt${on ? ' on' : ''}" data-act="ob-pick" data-k="${k}" data-v="${v}" aria-pressed="${on}"><span class="opt-t"><b>${t}</b>${extra}</span><span>${d}</span><i class="opt-c" aria-hidden="true">${ICON.check}</i></button>`;
  let body = '';
  if (step === 2) body = head('Who’s <em>lifting</em>?', S.local ? 'Your name is just for you. It’s used in your greeting.' : 'Your name is just for you. Your username is how other lifters share splits with you.') + `
    <form id="f-ob2" class="ob-form" novalidate>
      <label>Your name<input class="field" name="name" value="${esc(o.name)}" maxlength="40" autocomplete="given-name" placeholder="e.g. Alex"></label>
      ${S.local ? '' : `<label>Username<input class="field" name="username" value="${esc(o.username)}" maxlength="20" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="e.g. heavy_alex"><span class="hint">Lowercase letters, numbers and underscores, 3 to 20 characters.</span></label>`}
      ${msg}<div class="ob-nav"><span></span><button class="btn lg" type="submit">Continue</button></div></form>`;
  else if (step === 3) body = head('Your body, <em>your units</em>.', 'Bodyweight counts toward pull-ups, dips and other bodyweight moves.') + `
    <div class="ob-form">
      <div class="ob-row"><span class="k">Units</span><span class="seg"><button class="${o.unit === 'kg' ? 'on' : ''}" data-act="ob-unit" data-u="kg">kg</button><button class="${o.unit === 'lb' ? 'on' : ''}" data-act="ob-unit" data-u="lb">lb</button></span></div>
      <label>Bodyweight<span class="unitin"><input class="field" data-f="obbw" inputmode="decimal" value="${o.bw ? Math.round((o.unit === 'lb' ? o.bw * KG_LB : o.bw) * 10) / 10 : ''}" placeholder="${o.unit === 'lb' ? '165' : '75'}"><span class="lbl">${o.unit}</span></span></label>
      <div><span class="lbl">Experience</span><div class="choice">${LEVELS.map(([k, t, d]) => card('exp', k, o.exp === k, t, d)).join('')}</div></div>
    </div>${msg}${nav('data-act="ob-next"')}`;
  else if (step === 4) body = head('What are you <em>training for</em>?', 'This shapes the split we suggest next. You can change everything later.') + `
    <div class="ob-form">
      <div class="choice two">${GOALS.map(([k, t, d]) => card('goal', k, o.goal === k, t, d)).join('')}</div>
      <div><span class="lbl">Days a week you can train</span><div class="daysel">${[1, 2, 3, 4, 5, 6, 7].map(n => `<button class="${o.days === n ? 'on' : ''}" data-act="ob-pick" data-k="days" data-v="${n}" aria-label="${n} days" aria-pressed="${o.days === n}">${n}</button>`).join('')}</div>
      <p class="hint">This becomes your weekly target for the consistency score.</p></div>
    </div>${msg}${nav('data-act="ob-next"')}`;
  else if (step === 5) {
    const rec = recommendTemplate(o.days, o.exp), list = [rec, ...TEMPLATES.filter(t => t.id !== rec.id)];
    const days = t => `<span class="tpl-days">${t.plan.map(d => (d[1] ? `<i>${esc(d[0].replace(/^Full body /, 'FB '))}</i>` : '<i class="r" title="Rest"></i>')).join('')}</span>`;
    body = head('Pick a <em>starting split</em>.', `Based on ${o.days} day${o.days === 1 ? '' : 's'} a week. It’s yours to edit in the Splits tab.`) + `
    <div class="choice">${list.map(t => card('tpl', t.id, o.tpl === t.id, esc(t.name), esc(t.desc) + days(t), t.id === rec.id ? '<span class="badge acc">recommended</span>' : '')).join('')}
    ${card('tpl', 'none', o.tpl === 'none', 'I’ll build my own', 'Start with an empty Splits tab')}</div>
    ${msg}${nav('data-act="ob-next"' + (o.tpl ? '' : ' disabled'))}`;
  } else body = head('Make it <em>yours</em>.', 'Pick a look. It changes right away, and you can switch any time in Settings.') + `
    <div class="ob-themes">${themePicker('ob-theme')}</div>
    ${msg}${nav('data-act="ob-finish"', 'Finish setup')}`;
  const exit = S.local ? `<button class="linkbtn" data-act="leave-local">Use an account instead</button>` : `<button class="linkbtn" data-act="signout">Sign out</button>`;
  return `<div class="ob ob-step-${step}">${obRail(step)}<div class="ob-main"><div class="ob-top">${brand()}${exit}</div><div class="ob-in">${body}</div></div></div>`;
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
/* the same rule the auth server enforces: 8+ characters with a lowercase letter, a capital and a number */
const PW_HINT = 'At least 8 characters, with a capital letter and a number.';
const pwIssue = v => v.length < 8 ? 'Use at least 8 characters for your password.' : !/[a-z]/.test(v) || !/[A-Z]/.test(v) ? 'Add both a capital and a lowercase letter to your password.' : !/\d/.test(v) ? 'Add a number to your password.' : null;
const authErr = e => {
  const m = (e && e.message) || 'Something went wrong. Try again.';
  if ((e && e.code === 'weak_password') || /password should/i.test(m)) return PW_HINT;
  if (/failed to fetch|networkerror|load failed/i.test(m)) return navigator.onLine ? 'Couldn’t reach the server. Try again in a moment.' : 'You’re offline. Connect and try again.';
  if ((e && e.code === 'user_already_exists') || /already registered/i.test(m)) return 'There’s already an account with that email. Log in instead.';
  if (/invalid login/i.test(m)) return 'That email and password don’t match.';
  if (/email not confirmed/i.test(m)) return 'Confirm your email first. Check your inbox for the link.';
  /* the project-wide cap on outgoing auth emails, not this person's attempts */
  if ((e && e.code === 'over_email_send_rate_limit') || /email rate limit/i.test(m)) return 'We can’t send emails right now because too many went out recently. Try again in an hour.';
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
        const bad = pwIssue(password); if (bad) return done(bad, true);
        if (password !== String(fd.get('password2') || '')) return done('The two passwords don’t match.', true);
        const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: location.origin } });
        if (error) return done(authErr(error), true);
        if (!data.session) { S.pendingEmail = email; S.authMode = 'check'; return done(null); }
      } else {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) return done(authErr(error), true);
      }
      S.authMsg = null;
    } else if (f.id === 'f-bw') {
      const v = parseFloat(String(fd.get('bw') || '').replace(',', '.')), kg = fromU(v);
      if (!(kg >= 30 && kg <= 300)) return toast(`Enter a weight between ${fmtW(30)} and ${fmtW(300)} ${unit()}`);
      S.profile.bw = kg; S.profile.bwLog = logBw(S.profile.bwLog, kg); queue('p', 0); buzz(); render(false); toast('Weight logged');
    } else if (f.id === 'f-forgot') {
      const email = String(fd.get('email') || '').trim();
      if (!/^\S+@\S+\.\S+$/.test(email)) return done('Enter a valid email address.', true);
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + '/settings' });
      if (error) return done(authErr(error), true);
      done('If that email has an account, a reset link is on its way.', false);
    } else if (f.id === 'f-recover') {
      const password = String(fd.get('password') || '');
      const bad = pwIssue(password); if (bad) return done(bad, true);
      const { error } = await sb.auth.updateUser({ password });
      if (error) return done(authErr(error), true);
      S.recover = false; S.authMsg = null; claimDevice(); toast('Password updated'); go('today', null, { replace: true });
    } else if (f.id === 'f-ob2') {
      const name = String(fd.get('name') || '').trim().slice(0, 40);
      S.ob.name = name; S.ob.username = String(fd.get('username') || '');
      if (!name) return done('Tell us what to call you.', true);
      if (!S.local && !(await setUsername(S.ob.username))) return;
      S.profile.name = name;
      const { error } = S.local ? (queue('p', 0), { error: null }) : await sb.from('profiles').update({ display_name: name }).eq('id', S.user.id);
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

/* greeting and quote vary per visit, but stay put while you use the app */
const SEED = Math.random();
const pick = (arr, salt = 0) => arr[Math.floor(((SEED * 9301 + salt * 49297) % 1) * arr.length)];
/* up-next dropdown: desktop shows a small pill over the day name; phones show one outlined field holding both */
const pickBtn = (label, day, sub, o = {}) => `<button class="what what-pick${o.cls ? ' ' + o.cls : ''}" ${o.attrs || 'data-act="next-pick" aria-haspopup="dialog" aria-expanded="false"'} aria-label="${o.aria || 'Change what’s up next'}">
  <span class="wp-d" aria-hidden="true"><span class="wp-chip"><span class="wp-t">${label}</span>${o.deskIcon === false ? '' : `<i class="dd">${o.icon || ICON.down}</i>`}</span><b>${day}</b></span>
  <span class="wp-m" aria-hidden="true"><span class="wp-chip"><span class="wp-txt"><span class="wp-t">${label}</span><b>${day}</b></span><i class="dd">${o.icon || ICON.down}</i></span></span>
  <span class="wp-sub">${sub}</span></button>`;
/* rest days are chosen by hand from Home */
const isRestToday = () => (S.profile.restDays || []).includes(dayKey(Date.now()));
function setRestToday(on) {
  const k = dayKey(Date.now()), cur = (S.profile.restDays || []).filter(d => d !== k);
  S.profile.restDays = on ? [...cur, k].slice(-400) : cur; queue('p', 200); buzz(); render(false);
  toast(on ? 'Rest day logged. Recover well.' : 'Rest day removed');
}
function greet(hi) {
  const h = new Date().getHours(), tod = h < 5 || h >= 22 ? 'Up late' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  return pick([`Hey ${hi},`, `${tod}, ${hi},`, `Welcome back, ${hi},`, `Let’s go, ${hi},`, `Ready, ${hi}?`], 1);
}

/* ---------- Home ---------- */
function vToday() {
  const now = new Date(), a = activeSession(), list = sorted();
  const nx = !a && nextSplitDay(), hi = esc(((S.profile.name || '').trim().split(/\s+/)[0] || S.profile.username || '').slice(0, 24));
  let lines, cta;
  if (a) {
    const sa = S.A.sess.get(a.id);
    lines = [greet(hi), ...pick([['your session', '<em>is live</em>.'], ['the bar is', '<em>waiting</em>.'], ['finish what', '<em>you started</em>.']], 2)];
    cta = `${pickBtn(`In progress · ${plural(sa.sets, 'set')} logged`, esc(sessName(a)), '', { cls: 'live', attrs: `data-act="resume" data-id="${a.id}"`, aria: 'Resume session', icon: ICON.play, deskIcon: false })}<button class="fab magnet" data-act="resume" data-id="${a.id}" aria-label="Resume session"><span class="fab-l" aria-hidden="true">Resume session</span>${ICON.play}</button>`;
  } else if (isRestToday()) {
    lines = [greet(hi), ...pick([['today is a', '<em>rest day</em>.'], ['recovery is', '<em>training too</em>.'], ['rest up,', '<em>come back stronger</em>.']], 6)];
    cta = nx ? `${pickBtn(`Rest day · up next${nx.picked ? ' · your pick' : ''}`, `${esc(nx.sp.days[nx.i].type || 'Training')}`, `${esc(nx.sp.name)} · day ${nx.i + 1} · waits for tomorrow`)}`
      : `<div class="what"><span>Rest day</span><b>Recovery counts</b><span>Logged for today</span></div>`;
    cta += `
      <div style="display:flex;gap:8px;align-items:center"><button class="btn line sm" data-act="rest-undo">Undo rest day</button><button class="fab magnet" data-act="start-menu" aria-label="Train anyway"><span class="fab-l" aria-hidden="true">Train anyway</span>${ICON.plus}</button></div>`;
  } else if (nx) {
    const d = nx.sp.days[nx.i], ty = d.type ? esc(d.type) : 'training day';
    lines = [greet(hi), ty, pick(['<em>is up next</em>.', '<em>is on deck</em>.', '<em>is calling</em>.'], 3)];
    cta = `${pickBtn(`${esc(nx.sp.name)} · day ${nx.i + 1}${nx.picked ? ' · your pick' : ''}`, `${esc(d.type || 'Training')}`, `${d.exercises.slice(0, 3).map(x => esc(x.name)).join(' · ') || 'No exercises planned yet'}${d.exercises.length > 3 ? ` +${d.exercises.length - 3}` : ''}`)}
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><button class="btn line sm" data-act="rest-today">${ICON.moon}Rest day</button><button class="btn line sm" data-act="start">Empty</button><button class="fab magnet" data-act="start-day" data-sp="${nx.sp.id}" data-day="${nx.i}" aria-label="Start session"><span class="fab-l" aria-hidden="true">Start session</span>${ICON.plus}</button></div>`;
  } else {
    lines = [greet(hi), ...(list.length
      ? pick([['every set', '<em>adds up</em>.'], ['show up,', '<em>stack wins</em>.'], ['strength is', '<em>built weekly</em>.'], ['one more', '<em>good session</em>.']], 4)
      : pick([['let’s log your', '<em>first session</em>.'], ['your first', '<em>session awaits</em>.'], ['day one', '<em>starts now</em>.']], 4))];
    cta = `<div class="what"></div>
      <div style="display:flex;gap:8px;align-items:center"><button class="btn line sm" data-act="rest-today">${ICON.moon}Rest day</button><button class="fab magnet" data-act="start-menu" aria-label="Start session"><span class="fab-l" aria-hidden="true">Start session</span>${ICON.plus}</button></div>`;
  }
  const [qt, qa] = pick(QUOTES, 5), ents = homeEntries(), spans = packSpans(ents.map(e => WSPAN[e.size])), ws = ents.map(e => e.id);
  return pageTop('Home', '', false) + `
  <section class="hero rv">
    <div class="hero-top"><div><span class="lbl eyebrow">${DAYS[now.getDay()].toLowerCase()} · ${fmtDate(now)} · <span data-now="t">${fmtTime(now)}</span></span>${disp(lines)}</div>
      <figure class="quote"><blockquote>${esc(qt)}</blockquote><figcaption>${esc(qa)}</figcaption></figure></div>
    <div class="hero-cta">${cta}</div>
  </section>
  ${ws.length ? `<div class="dash" id="dash">${ents.map((e, i) => wCard(e.id, phoneDash() ? 'm' : e.size, spans[i])).join('')}</div>
  <div class="dash-dots" id="dash-dots" role="tablist" aria-label="Home widgets">${ws.map((id, i) => `<button role="tab" data-act="dash-go" data-i="${i}" aria-label="${esc(WIDGETS[id].title)}"${i ? '' : ' class="on" aria-selected="true"'}></button>`).join('')}</div>`
    : `<div class="empty rv"><b>Your home screen is empty.</b>Add widgets to see your training at a glance.</div>`}
  <div class="home-edit rv"><button class="btn ghost sm" data-act="edit-home">${ICON.pen}${roll('Edit home')}</button></div>`;
}

/* ---------- Home widgets ---------- */
const DEFAULT_WIDGETS = ['week', 'intensity', 'consistency', 'recent'];
/* stored as "id:size" (size s, m or l); older plain ids get the widget's default size */
const WSIZES = [['s', 'S', 'Small'], ['m', 'M', 'Medium'], ['l', 'L', 'Large']], WSPAN = { s: 2, m: 3, l: 6 };
function homeEntries() {
  const raw = Array.isArray(S.profile.widgets) ? S.profile.widgets : DEFAULT_WIDGETS, out = [], seen = new Set();
  for (const r of raw) { const [id, z] = String(r).split(':'); if (!WIDGETS[id] || seen.has(id)) continue; seen.add(id); out.push({ id, size: WSPAN[z] ? z : (WIDGETS[id].size || 'm') }); }
  return out;
}
const homeWidgets = () => homeEntries().map(e => e.id);
const saveEntries = list => { S.profile.widgets = list.map(e => e.id + ':' + e.size); queue('p', 400); };
/* desktop grid is 6 columns: small 2, medium 3, large 6. Rows are packed in order and the last widget in a
   row stretches to close any gap, so the layout always fits edge to edge. */
function packSpans(spans) {
  const out = [...spans]; let used = 0, last = -1;
  for (let i = 0; i < out.length; i++) {
    if (used + out[i] > 6) { if (last >= 0) out[last] += 6 - used; used = 0; }
    used += out[i]; last = i; if (used === 6) used = 0;
  }
  if (used && last >= 0) out[last] += 6 - used;
  return out;
}
const WOPT = (() => { try { return JSON.parse(localStorage.getItem('sg-wopt') || '{}') || {}; } catch { return {}; } })();
const wopt = id => { const o = WIDGETS[id].opts; if (!o) return null; return o.some(x => x[0] === WOPT[id]) ? WOPT[id] : o[0][0]; };
const sessIn = days => { const t = days ? Date.now() - days * 864e5 : 0; return sorted().filter(s => s.items.length && s.startedAt >= t); };
const avgInt = list => { const d = list.filter(s => s.endedAt); return d.length ? d.reduce((x, s) => x + (S.A.sess.get(s.id)?.int || 0), 0) / d.length : 0; };
const wHead = (l, r, open) => `<div class="card-h"><span class="lbl">${l}</span><span class="w-r"><span class="lbl">${r}</span>${open ? `<span class="w-ex" aria-hidden="true">${ICON.expand}</span>` : ''}</span></div>`;
const kvs = pairs => `<div class="kv wf-kv">${pairs.map(([k, v]) => `<div><span class="lbl">${k}</span><div class="term">${v}</div></div>`).join('')}</div>`;
const wSect = (t, html) => `<section class="card wf-sec"><div class="card-h"><span class="lbl">${t}</span></div>${html}</section>`;
const nothing = t => `<div class="empty">${t}</div>`;
function wCard(id, size = 'm', span = WSPAN[size]) {
  const W = WIDGETS[id], open = !!W.full, focus = S.morphW === id;
  return `<section class="card w w-${size}${focus ? '' : ' rv'}" data-w="${id}"${open ? ` data-act="w-open" data-id="${id}" role="button" tabindex="0" aria-label="Open ${esc(W.title)}"` : ''} style="--span:${span}${focus ? ';view-transition-name:wfocus' : ''}">${W.card(open, size)}</section>`;
}
function vWidget() {
  const id = S.arg, W = WIDGETS[id]; if (!W || !W.full) return vMissing('That widget doesn’t exist.');
  const o = wopt(id), ent = homeEntries().find(e => e.id === id);
  return `<div class="wfull" style="view-transition-name:wfocus">
    <header class="wf-top"><div><span class="lbl">${esc(W.desc)}</span><h1 class="h1">${esc(W.title)}</h1></div><button class="iconbtn" data-act="w-close" aria-label="Close">${ICON.x}</button></header>
    <div class="wf-opts">${W.opts ? `<span class="seg" role="group" aria-label="Range">${W.opts.map(([v, l]) => `<button class="${o === v ? 'on' : ''}" data-act="w-opt" data-id="${id}" data-v="${v}">${l}</button>`).join('')}</span>` : ''}
    ${ent ? `<span class="wf-size"><span class="lbl">Size on home</span><span class="seg" role="group" aria-label="Size on home">${WSIZES.map(([z, l, t]) => `<button class="${ent.size === z ? 'on' : ''}" data-act="w-size" data-id="${id}" data-v="${z}" aria-label="${t}">${l}</button>`).join('')}</span></span>` : ''}</div>
    <div class="wf-body">${W.full(o)}</div></div>`;
}
function chartDays(days) {
  const di = dayIntensity(), W = 300, H = 100, step = W / days, t0 = new Date(), grid = days <= 45; t0.setHours(12, 0, 0, 0);
  let g = '', f = '';
  for (let i = 0; i < days; i++) {
    const d = new Date(t0); d.setDate(d.getDate() - (days - 1 - i)); const v = di.get(dayKey(d)); const x = (i * step + step / 2).toFixed(2);
    if (grid) for (const off of [-step / 3, 0, step / 3]) g += `<line class="gl" x1="${(+x + off).toFixed(2)}" x2="${(+x + off).toFixed(2)}" y1="2" y2="${H}"/>`;
    else if (i % 7 === 0) g += `<line class="gl" x1="${x}" x2="${x}" y1="2" y2="${H}"/>`;
    if (v != null) { const hh = Math.max(4, Math.min(100, v) / 100 * (H - 6)); f += `<line class="${i === days - 1 ? 'al' : 'fl'}" x1="${x}" x2="${x}" y1="${H}" y2="${(H - hh).toFixed(1)}"/>`; }
  }
  const lab = n => n >= 365 ? '1y' : n + 'd';
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-label="Daily session intensity, last ${lab(days)}">${g}${f}</svg>
  <div class="axis"><span class="lbl">${lab(days)}</span><span class="lbl">${Math.round(days * 2 / 3)}d</span><span class="lbl">${Math.round(days / 3)}d</span><span class="lbl">today</span></div></div>`;
}
function heatWeeks(weeks) {
  const cw = weekStart(Date.now()), start = shiftWeek(cw, -(weeks - 1)), di = dayIntensity(), tk = dayKey(Date.now()), now = Date.now(), rd = new Set(S.profile.restDays || []);
  let h = '';
  for (let w = 0; w < weeks; w++) { const ws = shiftWeek(start, w); for (let d = 0; d < 7; d++) { const dt = new Date(ws); dt.setDate(dt.getDate() + d); const k = dayKey(dt);
    let c = ''; if (dt.getTime() > now) c = 'fut'; else if (di.has(k)) { const v = di.get(k); c = v >= 85 ? 'l4' : v >= 72 ? 'l3' : v >= 55 ? 'l2' : 'l1'; } else if (rd.has(k)) c = 'rd';
    if (k === tk) c += ' today'; h += `<i class="${c}" title="${fmtDate(dt)}${di.has(k) ? ' · int ' + Math.round(di.get(k)) : rd.has(k) ? ' · rest day' : ''}"></i>`; } }
  return `<div class="heat${weeks > 30 ? ' dense' : ''}" aria-label="Training days, last ${weeks} weeks">${h}</div>`;
}
const heatKey = `<div class="heat-f"><span class="lbl">less</span><span class="lbl"><i class="rd-key"></i>rest</span><span class="lbl">more intense</span></div>`;
const restIn = days => { const t = Date.now() - days * 864e5; return (S.profile.restDays || []).filter(k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d).getTime() >= t; }).length; };
function weekCounts() { const m = new Map(); for (const s of S.sessions.values()) if (s.items.length) { const k = weekStart(s.startedAt); m.set(k, (m.get(k) || 0) + 1); } return m; }
function bestStreak() {
  const m = weekCounts(), target = S.profile.target || 3; if (!m.size) return 0;
  let w = Math.min(...m.keys()), best = 0, run = 0; const end = weekStart(Date.now());
  for (; w <= end; w = shiftWeek(w, 1)) { if ((m.get(w) || 0) >= target) { run++; best = Math.max(best, run); } else run = 0; }
  return best;
}
function weeklyVol(weeks) {
  const cw = weekStart(Date.now()), out = []; for (let i = weeks - 1; i >= 0; i--) out.push({ w: shiftWeek(cw, -i), v: 0, n: 0 });
  const idx = new Map(out.map((o, i) => [o.w, i]));
  for (const s of S.sessions.values()) { const k = idx.get(weekStart(s.startedAt)); if (k != null) { out[k].v += S.A.sess.get(s.id)?.vol || 0; out[k].n++; } }
  return out;
}
function volBars(weeks) {
  const data = weeklyVol(weeks), max = Math.max(1, ...data.map(d => d.v)), W = 300, H = 100, bw = W / weeks;
  const bars = data.map((d, i) => { const h = d.v ? Math.max(3, d.v / max * (H - 8)) : 2, x = (i * bw + bw * .18).toFixed(1); return `<rect class="${d.v ? (i === weeks - 1 ? 'vb now' : 'vb') : 'vb0'}" x="${x}" y="${(H - h).toFixed(1)}" width="${(bw * .64).toFixed(1)}" height="${h.toFixed(1)}"/>`; }).join('');
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-label="Weekly volume, last ${weeks} weeks">${bars}</svg><div class="axis"><span class="lbl">${weeks}w ago</span><span class="lbl">this week</span></div></div>`;
}
function exVolIn(days) { const t = Date.now() - days * 864e5, m = new Map(); for (const s of S.sessions.values()) { if (s.startedAt < t) continue; for (const it of s.items) { const v = it.sets.reduce((x, st) => x + (+st.r > 0 ? (+st.w || 0) * +st.r : 0), 0); if (v) m.set(it.exId, (m.get(it.exId) || 0) + v); } } return [...m].map(([id, v]) => [exOf(id)?.name || 'Exercise', v]).sort((a, b) => b[1] - a[1]); }
function muscleSets(days) {
  const t = Date.now() - days * 864e5, m = new Map();
  for (const s of S.sessions.values()) { if (s.startedAt < t) continue; for (const it of s.items) { const n = it.sets.filter(x => +x.r > 0).length; if (n) { const k = exOf(it.exId)?.muscle || 'Other'; m.set(k, (m.get(k) || 0) + n); } } }
  return [...m].sort((a, b) => b[1] - a[1]);
}
function hbars(rows, fmt = v => v) {
  if (!rows.length) return ''; const max = Math.max(...rows.map(r => r[1])) || 1;
  return `<div class="hbars">${rows.map(([k, v]) => `<div class="hb"><span class="hb-k">${esc(k)}</span><span class="hb-t"><i style="width:${(v / max * 100).toFixed(1)}%"></i></span><span class="hb-v">${fmt(v)}</span></div>`).join('')}</div>`;
}
function prEvents(days) { const t = days ? Date.now() - days * 864e5 : 0, out = []; for (const [exId, e] of S.A.ex) for (const p of e.pts) if (p.pr && p.t >= t) out.push({ exId, ...p }); return out.sort((a, b) => b.t - a.t); }
const prRow = p => `<button class="row" data-act="open" data-id="${p.sid}"><span class="tri"></span><span class="row-m"><span class="t">${esc(exOf(p.exId)?.name || 'Exercise')}</span><span class="sub">${fmtDate(p.t)} · new best estimate</span></span><span class="row-r"><span class="d">${fmtW(roundW(p.v))}</span><span class="ichip hot">${unit()}</span></span></button>`;
const topLifts = () => [...S.A.ex].map(([id, e]) => ({ ex: exOf(id), e })).filter(x => x.ex && !x.ex.archived).sort((a, b) => b.e.n - a.e.n || b.e.best - a.e.best);
const liftRow = ({ ex, e }) => `<button class="row" data-act="open-ex" data-id="${ex.id}"><span class="tri"></span><span class="row-m"><span class="t">${esc(ex.name)}</span><span class="sub">${plural(e.n, 'session')} · ${ex.oneRm > 0 ? 'saved 1RM' : 'est. 1RM'}</span></span><span class="row-r"><span class="d">${fmtW(roundW(ex.oneRm > 0 ? ex.oneRm : e.best))}</span><span class="ichip">${unit()}</span></span></button>`;
const planDays = (nx, full) => `<div class="plan${full ? ' full' : ''}">${nx.sp.days.map((d, i) => `<div class="pd${i === nx.i ? ' next' : ''}${isRestDay(d) ? ' rest' : ''}"><span class="lbl">Day ${i + 1}${i === nx.i ? ' · next' : ''}</span><b>${esc(isRestDay(d) ? 'Rest' : d.type || 'Training')}</b>${full && !isRestDay(d) ? `<span class="sub">${d.exercises.map(x => esc(x.name)).join(' · ') || 'No exercises yet'}</span>` : ''}</div>`).join('')}</div>`;

const wTile = (label, value, caption, open) => `<div class="card-h"><span class="lbl">${label}</span>${open ? `<span class="w-ex" aria-hidden="true">${ICON.expand}</span>` : ''}</div><div class="tile"><span class="tile-n">${value}</span><span class="tile-c">${caption}</span></div>`;
const mkv = pairs => `<div class="mkv">${pairs.map(([k, v]) => `<div><b>${v}</b><span class="lbl">${k}</span></div>`).join('')}</div>`;
const thisWeek = () => weekSummary(sorted(), weekStart(Date.now()));
const gainText = g => `+${fmtW(g.by)} ${unit()} on ${esc(exOf(g.exId)?.name || 'a lift')}`;
const volDelta = W => W.lastVol ? `${W.vol >= W.lastVol ? '+' : '−'}${Math.round(Math.abs(W.vol - W.lastVol) / W.lastVol * 100)}%` : '–';
const bwDelta = ch => ch == null ? '–' : `${ch > 0 ? '+' : ch < 0 ? '−' : '±'}${fmtW(Math.abs(ch))} ${unit()}`;
/* a line through the logged weights; the y-axis fits the range with a little headroom */
function bwChart(days) {
  const pts = bwSeries(S.profile.bwLog, days); if (pts.length < 2) return `<div class="empty bw-empty">${pts.length ? 'One entry so far. Log again on another day to see a trend.' : 'Log your weight to start a trend.'}</div>`;
  const W = 300, H = 100, t0 = days ? Date.now() - days * 864e5 : pts[0].t, t1 = Date.now(), lo = Math.min(...pts.map(p => p.kg)), hi = Math.max(...pts.map(p => p.kg)), pad = Math.max(.5, (hi - lo) * .2);
  const X = t => ((t - t0) / Math.max(1, t1 - t0) * (W - 8) + 4).toFixed(1), Y = kg => (H - 6 - (kg - lo + pad) / (hi - lo + 2 * pad) * (H - 12)).toFixed(1);
  const line = pts.map(p => `${X(p.t)},${Y(p.kg)}`).join(' '), last = pts[pts.length - 1];
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-label="Bodyweight trend"><polygon class="bw-area" points="${X(pts[0].t)},${H} ${line} ${X(last.t)},${H}"/><polyline class="bw-line" points="${line}" vector-effect="non-scaling-stroke"/></svg>
  <div class="axis"><span class="lbl">${days ? days + 'd' : fmtDate(pts[0].t)}</span><span class="lbl">${fmtW(lo)}–${fmtW(hi)} ${unit()}</span><span class="lbl">today</span></div></div>`;
}
const WIDGETS = {
  intensity: {
    title: 'Intensity', desc: 'How hard each training day was', opts: [[30, '30d'], [90, '90d'], [365, '1y']],
    card: (open, z) => { const L = sessIn(30), av = avgInt(L);
      if (z === 's') return wTile('Intensity', L.some(s => s.endedAt) ? Math.round(av) : '–', '30-day average', open);
      const base = wHead('Intensity · 30d', `avg ${Math.round(av)}`, open) + chartDays(30);
      if (z !== 'l') return base;
      const iv = s => S.A.sess.get(s.id)?.int || 0, hard = L.filter(s => s.endedAt).reduce((m, s) => Math.max(m, iv(s)), 0);
      return base + mkv([['sessions', L.length], ['hardest', hard ? Math.round(hard) : '–'], ['records', L.reduce((x, s) => x + (S.A.sess.get(s.id)?.prs.length || 0), 0)]]); },
    full: d => {
      const L = sessIn(d), done = L.filter(s => s.endedAt), iv = s => S.A.sess.get(s.id)?.int || 0;
      const tiers = [['Max effort', 88, 1e9], ['Hard', 75, 88], ['Moderate', 60, 75], ['Easy', 0.001, 60]].map(([k, lo, hi]) => [k, done.filter(s => iv(s) >= lo && iv(s) < hi).length]).filter(t => t[1]);
      const top = [...done].sort((a, b) => iv(b) - iv(a)).slice(0, 5);
      return `<section class="card">${chartDays(d)}</section>` + kvs([['Average', Math.round(avgInt(L))], ['Sessions', L.length], ['Hardest', top.length ? Math.round(iv(top[0])) : '–'], ['Records', L.reduce((x, s) => x + (S.A.sess.get(s.id)?.prs.length || 0), 0)]])
        + wSect('By effort', hbars(tiers) || nothing('No finished sessions in this range.')) + wSect('Hardest sessions', top.length ? `<div class="list">${top.map(rowSession).join('')}</div>` : nothing('Nothing logged in this range yet.'));
    }
  },
  consistency: {
    title: 'Consistency', desc: 'Training days against your weekly target', opts: [[18, '18w'], [52, '52w']],
    card: (open, z) => { const C = consistency();
      if (z === 's') return wTile('Consistency', C.score == null ? '–' : Math.round(C.score), `${plural(C.streak, 'week')} streak`, open);
      const wk = z === 'l' ? 26 : 18, base = wHead(`Consistency · ${wk}w`, `${C.target}/wk target`, open) + heatWeeks(wk) + heatKey;
      return z === 'l' ? base + mkv([['this week', `${C.thisWeek}/${C.target}`], ['streak', plural(C.streak, 'wk')], ['best streak', plural(bestStreak(), 'wk')]]) : base; },
    full: w => {
      const C = consistency(), m = weekCounts(), cw = weekStart(Date.now()); let hit = 0; for (let i = 0; i < w; i++) if ((m.get(shiftWeek(cw, -i)) || 0) >= C.target) hit++;
      return `<section class="card">${heatWeeks(w)}${heatKey}</section>`
        + kvs([['Score', C.score == null ? '–' : Math.round(C.score)], ['This week', `${C.thisWeek}/${C.target}`], ['Streak', plural(C.streak, 'wk')], ['Best streak', plural(bestStreak(), 'wk')], ['Weeks on target', `${hit}/${w}`], ['Rest days', restIn(w * 7)]])
        + `<p class="muted wf-note">Your weekly target is in Settings. A week at or above target scores 100; the score averages your last 8 full weeks.</p>`;
    }
  },
  recent: {
    title: 'Recent sessions', desc: 'Your latest workouts', size: 'l',
    card: (open, z) => { const list = sorted();
      if (z === 's') { const s = list[0], a = s && S.A.sess.get(s.id);
        return s ? `<div class="card-h"><span class="lbl">Last session</span></div><button class="tile tile-btn" data-act="open" data-id="${s.id}"><span class="tile-n">${a && a.int ? Math.round(a.int) : '–'}</span><span class="tile-c">${esc(sessName(s))} · ${fmtDate(s.startedAt)}</span></button>`
          : wTile('Last session', '–', 'Nothing logged yet', false); }
      return `<div class="card-h"><span class="lbl">Recent sessions</span><button class="lbl" data-act="nav" data-v="history">${roll('All history')}</button></div>
      <div class="list">${list.length ? list.slice(0, z === 'l' ? 8 : 4).map(rowSession).join('') : `<div class="empty"><b>No sessions yet.</b>Tap + to start, or open Splits to plan your week. Intensity calibrates once each exercise has a couple of sessions.</div>`}</div>`; }
  },
  volume: {
    title: 'Weekly volume', desc: 'Weight × reps, week by week', opts: [[8, '8w'], [26, '26w'], [52, '52w']],
    card: (open, z) => { const n = z === 'l' ? 12 : 8, v = weeklyVol(n), now = v[v.length - 1].v;
      if (z === 's') return wTile('Volume', now ? fmtVol(now) : '–', 'this week', open);
      const base = wHead(`Volume · ${n}w`, `${fmtVol(now)} this wk`, open) + volBars(n);
      if (z !== 'l') return base;
      const tot = v.reduce((x, d) => x + d.v, 0), best = v.reduce((b, d) => Math.max(b, d.v), 0);
      return base + mkv([['12-week total', fmtVol(tot)], ['best week', best ? fmtVol(best) : '–'], ['sessions', v.reduce((x, d) => x + d.n, 0)]]); },
    full: w => {
      const v = weeklyVol(w), tot = v.reduce((x, d) => x + d.v, 0), best = v.reduce((b, d) => d.v > b.v ? d : b, v[0]), act = v.filter(d => d.v).length;
      return `<section class="card">${volBars(w)}</section>` + kvs([['Total', fmtVol(tot)], ['Per active week', fmtVol(act ? tot / act : 0)], ['Best week', best.v ? fmtVol(best.v) : '–'], ['Sessions', v.reduce((x, d) => x + d.n, 0)]])
        + wSect('Top exercises by volume', hbars(exVolIn(w * 7).slice(0, 10), fmtVol) || nothing('No volume logged in this range.'));
    }
  },
  muscles: {
    title: 'Muscle focus', desc: 'Working sets per muscle group', opts: [[7, '7d'], [30, '30d'], [90, '90d']],
    card: (open, z) => { const r = muscleSets(30), tot = r.reduce((x, y) => x + y[1], 0);
      if (z === 's') return wTile('Muscles', r.length ? esc(r[0][0]) : '–', r.length ? `${plural(r[0][1], 'set')} · top of 30d` : 'Nothing logged yet', open);
      return wHead('Muscles · 30d', plural(tot, 'set'), open) + (hbars(r.slice(0, z === 'l' ? 8 : 5)) || nothing('Log a session to see which muscles you train most.')); },
    full: d => { const r = muscleSets(d), tot = r.reduce((x, y) => x + y[1], 0); return kvs([['Working sets', tot], ['Groups trained', r.length], ['Most trained', r.length ? esc(r[0][0]) : '–']]) + wSect('Sets per muscle group', hbars(r) || nothing('No sets logged in this range.')); }
  },
  prs: {
    title: 'Records', desc: 'New best estimated 1RMs', opts: [[30, '30d'], [90, '90d'], [0, 'All']],
    card: (open, z) => { const e = prEvents(30);
      if (z === 's') return wTile('Records', e.length, 'last 30 days', open);
      return wHead('Records · 30d', plural(e.length, 'PR'), open) + (e.length ? `<div class="list">${e.slice(0, z === 'l' ? 6 : 3).map(prRow).join('')}</div>` : nothing('Beat a previous best and it lands here.')); },
    full: d => { const e = prEvents(d); return kvs([['Records', e.length], ['Exercises', new Set(e.map(x => x.exId)).size]]) + wSect('All records', e.length ? `<div class="list">${e.map(prRow).join('')}</div>` : nothing('No records in this range yet.')); }
  },
  lifts: {
    title: 'Top lifts', desc: 'Your 1RM on the lifts you train most',
    card: (open, z) => { const t = topLifts();
      if (z === 's') { const x = t[0]; return wTile('Top lift', x ? `${fmtW(roundW(x.ex.oneRm > 0 ? x.ex.oneRm : x.e.best))}<small>${unit()}</small>` : '–', x ? esc(x.ex.name) : 'Nothing logged yet', open); }
      return wHead('Top lifts', `1RM · ${unit()}`, open) + (t.length ? `<div class="list">${t.slice(0, z === 'l' ? 7 : 4).map(liftRow).join('')}</div>` : nothing('Your best lifts show up after your first session.')); },
    full: () => { const t = topLifts(); return wSect('Every exercise you’ve logged', t.length ? `<div class="list">${t.map(liftRow).join('')}</div>` : nothing('Nothing logged yet.')); }
  },
  week: {
    title: 'This week', desc: 'Sessions so far and the lifts that went up',
    card: (open, z) => { const W = thisWeek(), g = W.gains[0], tgt = S.profile.target || 3;
      if (z === 's') return wTile('This week', `${W.count}<small>/${tgt}</small>`, g ? gainText(g) : W.count ? plural(W.count, 'session') : 'Nothing logged yet', open);
      const lines = W.gains.slice(0, z === 'l' ? 5 : 2).map(x => `<div class="wk-g"><span>${esc(exOf(x.exId)?.name || 'Exercise')}</span><b>+${fmtW(x.by)} ${unit()}</b></div>`).join('');
      return wHead('This week', `${W.count}/${tgt} sessions`, open) + `<div class="wk-h"><b>${plural(W.count, 'session')}</b>${g ? ` · ${gainText(g)}` : ''}</div>`
        + (lines ? `<div class="wk-gs">${lines}</div>` : `<p class="muted wk-none">${W.count ? 'Beat a recent top weight and it shows up here.' : 'Your first session this week starts the count.'}</p>`)
        + (z === 'l' ? mkv([['volume', W.vol ? fmtVol(W.vol) : '–'], ['vs last week', volDelta(W)], ['lifts up', W.gains.length]]) : ''); },
    full: () => { const W = thisWeek(), from = weekStart(Date.now()), list = sorted().filter(s => s.items.length && s.startedAt >= from);
      return kvs([['Sessions', `${W.count}/${S.profile.target || 3}`], ['Volume', W.vol ? fmtVol(W.vol) : '–'], ['vs last week', volDelta(W)], ['Lifts up', W.gains.length]])
        + wSect('Lifts that went up', W.gains.length ? `<div class="wk-gs">${W.gains.map(x => `<div class="wk-g"><span>${esc(exOf(x.exId)?.name || 'Exercise')}</span><span class="muted">${fmtW(x.from)} → ${fmtW(x.to)}</span><b>+${fmtW(x.by)} ${unit()}</b></div>`).join('')}</div>` : nothing('Compared with your best in the four weeks before. Nothing has gone up yet this week.'))
        + wSect('Sessions this week', list.length ? `<div class="list">${list.map(rowSession).join('')}</div>` : nothing('Nothing logged yet this week.')); }
  },
  bw: {
    title: 'Bodyweight', desc: 'Your weight over time', opts: [[90, '90d'], [30, '30d'], [365, '1y'], [0, 'All']],
    card: (open, z) => { const ch = bwChange(S.profile.bwLog, 30), now = `${fmtW(bwNow())}<small>${unit()}</small>`;
      if (z === 's') return wTile('Bodyweight', now, ch == null ? 'Log it in Settings or here' : `${bwDelta(ch)} · 30d`, open);
      const base = wHead('Bodyweight · 90d', `${fmtW(bwNow())} ${unit()}`, open) + bwChart(90);
      return z === 'l' ? base + mkv([['30 days', bwDelta(bwChange(S.profile.bwLog, 30))], ['90 days', bwDelta(bwChange(S.profile.bwLog, 90))], ['entries', (S.profile.bwLog || []).length]]) : base; },
    full: d => { const pts = bwSeries(S.profile.bwLog, d), ks = pts.map(p => p.kg), log = [...(S.profile.bwLog || [])].reverse();
      return `<form id="f-bw" class="bw-log" novalidate><label>Today’s weight<span class="unitin"><input class="field" name="bw" inputmode="decimal" placeholder="${fmtW(bwNow())}" aria-label="Today’s weight"><span class="lbl">${unit()}</span></span></label><button class="btn" type="submit">Log</button></form>`
        + `<section class="card">${bwChart(d)}</section>`
        + kvs([['Now', `${fmtW(bwNow())} ${unit()}`], ['Change', bwDelta(bwChange(S.profile.bwLog, d))], ['Lowest', ks.length ? `${fmtW(Math.min(...ks))} ${unit()}` : '–'], ['Highest', ks.length ? `${fmtW(Math.max(...ks))} ${unit()}` : '–']])
        + wSect('Entries', log.length ? `<div class="bw-list">${log.slice(0, 30).map(e => `<div class="bw-e"><span>${esc(fmtDate(new Date(e.d + 'T12:00').getTime()))}</span><b>${fmtW(e.kg)} ${unit()}</b><button class="iconbtn sm" data-act="bw-del" data-d="${e.d}" aria-label="Delete ${esc(e.d)}">${ICON.x}</button></div>`).join('')}</div>` : nothing('No entries yet. Log your weight above.')); }
  },
  plan: {
    title: 'Your week', desc: 'The split you’re following', size: 'l',
    card: (open, z) => { const nx = nextSplitDay();
      if (!nx) return (z === 's' ? wTile('Next up', '–', 'No split yet', false) : wHead('Your week', '', false) + `<div class="empty">No split yet. <button class="linkbtn" data-act="nav" data-v="splits">Plan one in Splits</button></div>`);
      const d = nx.sp.days[nx.i];
      if (z === 's') return wTile('Next up', esc(d.type || 'Training'), `${esc(nx.sp.name)} · day ${nx.i + 1}`, open);
      return wHead('Your week', esc(nx.sp.name), open) + planDays(nx, z === 'l'); },
    full: () => { const nx = nextSplitDay(); if (!nx) return nothing('No split yet. Plan one in the Splits tab.'); return planDays(nx, true) + `<div class="wf-actions"><button class="btn line" data-act="open-split" data-id="${nx.sp.id}">${roll('Open split')}</button><button class="btn" data-act="start-day" data-sp="${nx.sp.id}" data-day="${nx.i}">${roll('Start day ' + (nx.i + 1))}</button></div>`; }
  }
};

/* edit home: pick widgets and their order; saves as you go */
function editHome() {
  const body = $('#sheet-body');
  const draw = () => {
    const rects = new Map($$('.wrow', body).map(r => [r.dataset.id, r.getBoundingClientRect().top])), prev = fluidCapture(body);
    const ents = homeEntries(), on = ents.map(e => e.id), sizes = new Map(ents.map(e => [e.id, e.size])), all = [...on, ...Object.keys(WIDGETS).filter(id => !on.includes(id))];
    body.innerHTML = `<div class="sh-h"><h3>Edit home</h3><button class="btn sm" data-act="close">Done</button></div>
    <p class="muted" style="font-size:13px;margin-bottom:var(--s0)">Choose your widgets, their order and size (S, M, L). Home fits them to your screen. Tap a widget on Home to open it full screen. Changes save automatically.</p>
    <div class="sg-b wlist">${all.map(id => { const W = WIDGETS[id], i = on.indexOf(id), shown = i >= 0;
      const z = shown ? sizes.get(id) : null;
      return `<div class="srow wrow${shown ? '' : ' off'}" data-id="${id}"><span class="k">${esc(W.title)}<small>${esc(W.desc)}</small>${shown ? `<span class="seg wsz" role="group" aria-label="${esc(W.title)} size">${WSIZES.map(([v, l, t]) => `<button class="${z === v ? 'on' : ''}" data-wsz="${id}" data-v="${v}" aria-label="${t}">${l}</button>`).join('')}</span>` : ''}</span><span class="wctl">${shown ? `<button class="iconbtn sm" data-wmv="${id}" data-d="-1"${i === 0 ? ' disabled' : ''} aria-label="Move ${esc(W.title)} up">${ICON.up}</button><button class="iconbtn sm" data-wmv="${id}" data-d="1"${i === on.length - 1 ? ' disabled' : ''} aria-label="Move ${esc(W.title)} down">${ICON.down}</button>` : ''}<button class="toggle${shown ? ' on' : ''}" data-wtg="${id}" aria-pressed="${shown}" aria-label="Show ${esc(W.title)}"></button></span></div>`; }).join('')}</div>
    <div class="btns" style="margin-top:var(--s0)"><button class="btn line" id="wh-reset">Reset to default</button></div>`;
    fluidApply(body, prev);
    for (const r of $$('.wrow', body)) { const y = rects.get(r.dataset.id); if (y == null) continue; const dy = y - r.getBoundingClientRect().top; if (!dy || reduced) continue; r.style.transform = `translateY(${dy}px)`; r.style.transition = 'none'; requestAnimationFrame(() => { r.style.transition = 'transform .5s var(--spring)'; r.style.transform = ''; }); }
    body.querySelectorAll('[data-wtg]').forEach(b => b.onclick = () => { const id = b.dataset.wtg, cur = homeWidgets(); save(cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id]); });
    body.querySelectorAll('[data-wmv]').forEach(b => b.onclick = () => { const cur = [...homeWidgets()], i = cur.indexOf(b.dataset.wmv), j = i + +b.dataset.d; if (j < 0 || j >= cur.length) return; [cur[i], cur[j]] = [cur[j], cur[i]]; save(cur); });
    body.querySelector('#wh-reset').onclick = () => { S.profile.widgets = null; save([...DEFAULT_WIDGETS]); };
    body.querySelectorAll('[data-wsz]').forEach(b => b.onclick = () => { const list = homeEntries(), e = list.find(x => x.id === b.dataset.wsz); if (!e) return; e.size = b.dataset.v; saveEntries(list); buzz(); draw(); if (S.view === 'today') render(false); });
  };
  const save = ids => { const cur = new Map(homeEntries().map(e => [e.id, e.size])); saveEntries(ids.map(id => ({ id, size: cur.get(id) || WIDGETS[id].size || 'm' }))); buzz(); draw(); if (S.view === 'today' || S.view === 'prefs') render(false); };
  openSheet('', null); draw();
}

function rowSession(s) {
  const a = S.A.sess.get(s.id) || { ex: 0, sets: 0, vol: 0, prs: [], int: 0 };
  const sp = s.splitId && S.splits.get(s.splitId);
  return `<button class="row" data-act="open" data-id="${s.id}"><span class="tri"></span>
  <span class="row-m"><span class="t">${esc(sessName(s))}</span><span class="sub">${fmtDate(s.startedAt)}${sp ? ` · ${esc(sp.name)} day ${(s.splitDay ?? 0) + 1}` : ''} · ${a.sets} sets · ${fmtVol(a.vol)}${a.prs.length ? ` · <em class="pr">${a.prs.length} PR</em>` : ''}</span></span>
  <span class="row-r"><span class="d">${Math.round(a.int)}</span><span class="ichip${s.endedAt ? (a.int >= 75 ? ' hot' : '') : ' hot'}">${s.endedAt ? tierShort(a.int) : 'LIVE'}</span></span></button>`;
}

/* ---------- Session ---------- */
function vSession() {
  const s = cur(), a = S.A.sess.get(s.id), live = !s.endedAt, groups = groupsOf(s), gmap = new Map();
  for (const g of groups) for (const x of g.m) gmap.set(x.st.id, g);
  const sp = s.splitId && S.splits.get(s.splitId);
  return `<header class="s-top rv"><button class="iconbtn" data-act="back" aria-label="Back">${ICON.back}</button>
    <input class="s-name" data-f="sname" value="${esc(s.name || '')}" placeholder="${esc(sessName({ ...s, name: null }))}" aria-label="Session name" maxlength="80">
    <button class="iconbtn" data-act="sess-menu" aria-label="Session options">${ICON.dots}</button></header>
  <div class="s-meta lbl rv">${fmtDate(s.startedAt)} · ${fmtTime(s.startedAt)}${sp ? ` · ${esc(sp.name)} day ${(s.splitDay ?? 0) + 1}` : ''} · ${live ? 'live' : 'completed'}</div>
  <section class="s-hero rv"><div><div class="lbl">Session intensity</div>
    <div class="bignum" id="sint" style="margin-top:10px">${big(Math.round(a.int))}<span class="dot${live ? ' live' : ''}"></span></div>
    <div class="tier" id="stier">${tierText(a)}</div></div>
    <button class="fab magnet" data-act="add-ex" aria-label="Add exercise"><span class="fab-l" aria-hidden="true">Add exercise</span>${ICON.plus}</button></section>
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
  const ex = exOf(it.exId) || { name: 'Deleted exercise', muscle: '', kind: 'w' }, bw = ex.kind === 'bw';
  return `<article class="ex rv" data-item="${it.id}">
  <div class="ex-h"><button class="nm" data-act="open-ex" data-id="${esc(it.exId)}"><h3>${esc(ex.name)}</h3><div class="sub" data-orm="${it.id}">${ormLine(cur() || { id: null }, it)}</div></button>
  <button class="iconbtn" data-act="item-menu" data-item="${it.id}" aria-label="Exercise options">${ICON.dots}</button></div>
  ${suggLine(it, bw)}
  <div class="set-head lbl"><span>Set</span><span>${bw ? '+' + unit() : unit()}</span><span>Reps</span><span>Int</span><span></span></div>
  <div class="sets">${it.sets.map((st, i) => setRow(st, i, gmap)).join('')}</div>
  <div class="ex-f"><button class="btn ghost sm" data-act="add-set" data-item="${it.id}">${roll('+ Set')}</button>${it.sets.length ? `<button class="btn line sm" data-act="add-drop" data-set="${it.sets[it.sets.length - 1].id}">${roll('+ Drop')}</button>` : ''}${bw ? '' : `<button class="btn ghost sm ex-plates" data-act="plates" data-item="${it.id}">${roll('Plates')}</button>`}</div></article>`;
}
/* "Last 80×8 → try 82.5×8": shown while the session is live and the exercise has history */
function suggLine(it, bw) {
  const s = cur(); if (!s || s.endedAt) return '';
  const g = suggestFor(s, it); if (!g) return '';
  const fmt = x => bw && !x.w ? `${x.r} reps` : `${fmtW(x.w)}×${x.r}`;
  const why = { load: 'add weight', reps: 'one more rep', repeat: 'match last time, one more rep', consolidate: 'own this weight first' }[g.why];
  return `<div class="sugg"><span class="sugg-t"><span class="lbl">Last</span> ${fmt(g.last)} <span class="arr" aria-hidden="true">→</span> <span class="lbl">Try</span> <b>${fmt(g.next)}</b><small>${why}</small></span><button class="btn ghost sm" data-act="sugg-use" data-item="${it.id}">${roll('Use')}</button></div>`;
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
  for (const it of s.items) { const el = $(`[data-orm="${it.id}"]`); if (el) el.innerHTML = ormLine(s, it); }
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
  <div class="rv pagehead" style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin:10px 0 6px"><h1 class="h1">Exercises</h1>
  <div style="display:flex;gap:8px"><button class="btn" data-act="new-ex">${roll('Add exercise')}</button><button class="iconbtn" data-act="lib-menu" aria-label="Library options">${ICON.dots}</button></div></div>
  <p class="muted rv" style="font-size:13px;max-width:60ch">Your own copy of the list. Edit, add or remove anything; changes are private to your account.</p>
  <div class="toolbar rv"><input class="search" data-f="exq" placeholder="Search exercises" value="${esc(S.exq)}" autocomplete="off"></div>
  <div class="hscroll rv" id="exm">${muscleChips()}</div>
  <div id="exlist" class="rv">${exList()}</div>`;
}
const muscleChips = () => ['', ...muscles(), 'Custom'].map(m => `<button class="chip${S.exm === m ? ' on' : ''}" data-act="exm" data-m="${esc(m)}">${esc(m || 'All')}</button>`).join('') + `<button class="chip chip-edit" data-act="edit-muscles">${ICON.plus.replace('class="ico"', 'class="ico" style="width:14px;height:14px"')}Edit groups</button>`;
function exList() {
  const q = S.exq.trim().toLowerCase(), m = S.exm;
  const match = e => (!q || e.name.toLowerCase().includes(q) || e.muscle.toLowerCase().includes(q)) && (!m || (m === 'Custom' ? !e.isDefault : e.muscle === m));
  const lib = S.library.filter(e => !e.archived && match(e)).sort((a, b) => a.name.localeCompare(b.name));
  const arch = S.library.filter(e => e.archived && match(e)).sort((a, b) => a.name.localeCompare(b.name));
  let h = '';
  if (!lib.length) h = `<div class="empty"><b>${q || m ? 'No exercises match.' : 'Your list is empty.'}</b>${q ? `Add “${esc(S.exq.trim())}” as a new exercise with the button above.` : 'Add one with the button above, or restore the default list from the menu.'}</div>`;
  const groups = new Map(); for (const e of lib) { if (!groups.has(e.muscle)) groups.set(e.muscle, []); groups.get(e.muscle).push(e); }
  const order = [...muscles(), ...[...groups.keys()].filter(k => !muscles().includes(k))];
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
    <div class="card rv"><div class="card-h"><span class="lbl">${ex.oneRm > 0 ? 'Your 1RM' : 'Estimated 1RM'} · ${unit()}</span><button class="btn ghost sm" data-act="edit-orm" data-id="${ex.id}">${roll(ex.oneRm > 0 ? 'Edit' : 'Set 1RM')}</button></div>
      <div class="bignum md">${big(ex.oneRm > 0 ? fmtW(ex.oneRm) : x ? fmtW(roundW(x.best)) : '–')}<span class="dot"></span></div>
      <p class="muted" style="margin-top:14px;font-size:13px">${ex.oneRm > 0 ? `Saved ${fmtDate(ex.oneRmAt || Date.now())}${x ? ` · best estimate ${fmtW(roundW(x.best))} ${unit()}` : ''}` : bs ? `From ${fmtW(loadOf(bs, ex))} ${unit()} × ${bs.r} on ${fmtDate(x.bestT)}` : 'Log a set to see your estimate.'}</p></div>
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
  return `<div class="daybar">${days.map((d, i) => `<span class="${isRestDay(d) ? '' : 'on'}${i === next ? ' next' : ''}" title="Day ${i + 1}: ${esc(d.type || 'Untitled')}">${esc(isRestDay(d) ? 'rest' : (d.type || 'day ' + (i + 1)))}</span>`).join('')}</div>`;
}
function vSplits() {
  const mine = [...S.splits.values()].sort((a, b) => b.updatedAt - a.updatedAt), nx = nextSplitDay();
  const card = sp => { const tr = sp.days.filter(d => !isRestDay(d)), exn = tr.reduce((x, d) => x + d.exercises.length, 0), shared = (S.recipients.get(sp.id) || []).length;
    return `<div class="split-card rv"><button class="sc-main" data-act="open-split" data-id="${sp.id}"><div><h3>${esc(sp.name)}</h3><div class="muted" style="font-size:13px;margin-top:2px">${plural(sp.days.length, 'day')} · ${tr.length} training · ${plural(exn, 'exercise')}${sp.copiedFrom ? ` · from ${esc(sp.copiedFrom)}` : ''}${sp.shareToken || shared ? ` · shared` : ''}</div></div>
    ${dayBar(sp.days, nx && nx.sp.id === sp.id ? nx.i : -1)}</button>
    <div class="sc-acts"><button class="btn ghost sm" data-act="open-split" data-id="${sp.id}">${ICON.pen}${roll('Edit')}</button><button class="btn ghost sm" data-act="dup-split" data-id="${sp.id}">${roll('Duplicate')}</button><button class="btn ghost sm" data-act="share-split" data-id="${sp.id}">${ICON.share}${roll('Share')}</button></div></div>`; };
  const tcard = t => `<button class="split-card tpl rv" data-act="tpl-view" data-id="${t.id}"><div><h3>${esc(t.name)}</h3><div class="muted" style="font-size:13px;margin-top:2px">${esc(t.desc)}</div></div>${dayBar(t.plan.map(([ty, ex]) => ({ type: ty, rest: !ex, exercises: [] })))}<div class="lbl">preview & use ↗</div></button>`;
  const shcard = sp => `<button class="split-card rv" data-act="open-shared" data-id="${sp.id}"><div><h3>${esc(sp.name)}</h3><div class="from" style="margin-top:4px">from @${esc(sp.from || 'someone')} · ${fmtDate(sp.sharedAt)}</div></div>${dayBar(sp.days)}<div class="lbl">view ↗</div></button>`;
  return pageTop('Splits') + `
  <div class="rv pagehead" style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin:10px 0 6px"><h1 class="h1">Splits</h1><button class="btn" data-act="new-split">${ICON.plus}${roll('New split')}</button></div>
  <p class="muted rv" style="font-size:13px;max-width:60ch">Plan your week: how many days, what each day trains, and the exercises with sets and reps. Start any day as a session, and share the plan with other lifters.</p>
  <div class="mgroup rv"><span class="lbl">Your splits</span><span class="lbl">${mine.length}</span></div>
  <div class="split-grid" style="margin-top:12px">${mine.map(card).join('') || `<div class="empty rv"><b>No splits yet.</b>Create one to plan your training days. Push / Pull / Legs is a good place to start.</div>`}</div>
  <div class="mgroup rv" style="margin-top:18px"><span class="lbl">Shared with you</span><span class="lbl">${S.shared.length}</span></div>
  <div class="split-grid" style="margin-top:12px">${S.shared.map(shcard).join('') || `<div class="empty rv">When someone shares a split with @${esc(S.profile.username)}, it shows up here.</div>`}</div>
  <div class="mgroup rv" style="margin-top:18px"><span class="lbl">Templates</span><span class="lbl">${TEMPLATES.length}</span></div>
  <p class="muted rv" style="font-size:13px;margin-top:8px">Start from a proven plan. Using one makes your own copy to edit.</p>
  <div class="split-grid" style="margin-top:12px">${TEMPLATES.map(tcard).join('')}</div>`;
}
function vSplit() {
  const sp = S.splits.get(S.arg), rec = S.recipients.get(sp.id), tr = sp.days.filter(d => !isRestDay(d)).length;
  return `<header class="s-top rv"><button class="iconbtn" data-act="back" aria-label="Back">${ICON.back}</button><span class="lbl" style="flex:1">Split</span>
    <button class="btn ghost sm" data-act="share-split" data-id="${sp.id}">${ICON.share}${roll('Share')}</button><button class="iconbtn" data-act="split-menu" data-id="${sp.id}" aria-label="Split options">${ICON.dots}</button></header>
  <div class="rv" style="margin-top:12px"><textarea class="sp-name autosize" data-f="spname" rows="1" maxlength="60" aria-label="Split name" placeholder="Split name">${esc(sp.name)}</textarea>
  <textarea class="sp-desc" data-f="spdesc" maxlength="1000" placeholder="Describe it: goal, who it suits, how to progress" aria-label="Description">${esc(sp.description)}</textarea></div>
  <div class="toolbar rv" style="justify-content:space-between"><div style="display:flex;align-items:center;gap:12px"><span class="lbl">Days</span><span class="stepper" style="background:var(--surface)"><button data-act="days-step" data-d="-1" aria-label="Remove last day">−</button><span>${sp.days.length}</span><button data-act="days-step" data-d="1" aria-label="Add a day">+</button></span></div>
  <span class="lbl">${tr} training · ${sp.days.length - tr} rest${rec && rec.length ? ` · shared with ${rec.length}` : ''}${sp.shareToken ? ' · link on' : ''}</span></div>
  ${dayBar(sp.days)}
  <div class="days">${sp.days.map((d, i) => dayCard(d, i, false)).join('')}</div>`;
}
/* split days: exercises can be linked like session sets (superset, giant set, or one exercise's sets as a drop set) */
function dayGroups(d) {
  const map = new Map(); d.exercises.forEach((x, j) => { if (x.g) { if (!map.has(x.g)) map.set(x.g, []); map.get(x.g).push(j); } });
  const out = new Map(); let n = 0;
  for (const [g, js] of map) { const t = js.length >= 3 ? ['Giant set', 'GS'] : js.length === 2 ? ['Superset', 'SS'] : ['Drop set', 'DS']; out.set(g, { g, js, type: t[0], ab: t[1], letter: String.fromCharCode(65 + (n++ % 26)) }); }
  return out;
}
const spLinkType = n => n >= 3 ? 'Giant set' : n === 2 ? 'Superset' : 'Drop set';
function dayCard(d, i, ro) {
  const rest = isRestDay(d), groups = dayGroups(d), lk = !ro && S.spLink && S.spLink.day === i ? S.spLink : null;
  const head = ro
    ? `<div class="day-h"><span class="day-n">DAY ${i + 1}</span><span class="day-type" style="display:flex;align-items:center">${esc(d.type || (rest ? 'Rest' : 'Training'))}</span></div>`
    : `<div class="day-h"><span class="day-mv"><button class="iconbtn sm" data-act="day-move" data-day="${i}" data-d="-1"${i === 0 ? ' disabled' : ''} aria-label="Move day ${i + 1} earlier">${ICON.up}</button><button class="iconbtn sm" data-act="day-move" data-day="${i}" data-d="1"${i === (S.splits.get(S.arg)?.days.length || 0) - 1 ? ' disabled' : ''} aria-label="Move day ${i + 1} later">${ICON.down}</button></span><span class="day-n">DAY ${i + 1}</span><input class="day-type" data-f="dtype" data-day="${i}" value="${esc(d.type)}" maxlength="40" placeholder="Session type" aria-label="Day ${i + 1} session type">${rest ? '' : `<button class="iconbtn" data-act="start-day" data-sp="${S.arg}" data-day="${i}" aria-label="Start day ${i + 1} as a session" title="Start this day">${ICON.play}</button>`}</div>
      <div class="types">${DAY_TYPES.map(t => `<button class="chip${d.type === t ? ' on' : ''}" data-act="dtype-pick" data-day="${i}" data-t="${esc(t)}">${t}</button>`).join('')}</div>`;
  if (rest) return `<div class="day rest${ro ? ' ro' : ''} rv" data-did="${d.id}">${head}<p class="muted" style="font-size:13px">Rest day. Recovery is part of the plan.</p>${ro ? '' : `<div class="day-f"><button class="btn line sm" data-act="day-train" data-day="${i}">${roll('Make it a training day')}</button></div>`}</div>`;
  const rows = d.exercises.map((x, j) => {
    const e = !ro && x.exId && exOf(x.exId), name = e ? e.name : x.name, muscle = e ? e.muscle : x.muscle, gr = x.g && groups.get(x.g);
    const tag = gr ? `<span class="gtag">${gr.ab}·${gr.letter}</span> ` : '';
    return ro ? `<div class="dex${gr ? ' linked' : ''}"><div class="nm"><b>${esc(name)}</b><small>${tag}${esc(muscle)}</small></div><span class="ro">${x.sets}</span><span class="ro">${esc(x.reps)}</span><span></span></div>`
      : `<div class="dex${gr ? ' linked' : ''}${lk && lk.sel.has(j) ? ' sel' : ''}"${lk ? ` data-act="sp-link-pick" data-x="${j}" role="button" tabindex="0"` : ''}><div class="nm"><b>${esc(name)}</b><small>${tag}${esc(muscle)}</small></div>
        <input data-f="dsets" data-day="${i}" data-x="${j}" inputmode="numeric" value="${x.sets}" aria-label="Sets for ${esc(name)}">
        <input data-f="dreps" data-day="${i}" data-x="${j}" value="${esc(x.reps)}" maxlength="12" aria-label="Reps for ${esc(name)}">
        <button class="iconbtn" data-act="dex-menu" data-day="${i}" data-x="${j}" aria-label="Options for ${esc(name)}">${ICON.dots}</button></div>`;
  }).join('');
  const glist = [...groups.values()].map(g => `<div class="grp"><span class="gtag">${g.ab}·${g.letter}</span><span><b style="font-weight:500">${g.type}</b> <span class="muted">· ${esc(g.js.map(j => d.exercises[j].name).join(' + '))}</span></span>${ro ? '' : `<button class="gx lbl" data-act="sp-unlink" data-day="${i}" data-g="${g.g}">${roll('Unlink')}</button>`}</div>`).join('');
  const foot = ro ? '' : lk
    ? `<div class="sp-linkbar"><button class="iconbtn" data-act="sp-link-cancel" aria-label="Cancel linking">${ICON.x}</button><div class="tlink"><b>${lk.sel.size ? spLinkType(lk.sel.size) : 'Select exercises to link'}</b><span class="muted">${lk.sel.size ? (lk.sel.size === 1 ? 'all its sets run back to back' : `set 1 of each, then set 2…`) : 'tap 2+ for a superset, or 1 for a drop set'}</span></div><button class="btn sm" data-act="sp-link-do"${lk.sel.size ? '' : ' disabled'}>Link</button></div>`
    : `<div class="day-f"><button class="btn ghost sm" data-act="dex-add" data-day="${i}">${roll('+ Exercise')}</button>${d.exercises.length ? `<button class="btn ghost sm" data-act="sp-link" data-day="${i}">${ICON.link}${roll('Link sets')}</button>` : ''}<button class="btn line sm" data-act="day-rest" data-day="${i}">${roll('Make it a rest day')}</button></div>`;
  return `<div class="day${ro ? ' ro' : ''}${lk ? ' linking' : ''} rv" data-did="${d.id}">${head}
    ${d.exercises.length ? `<div class="dex-h lbl"><span>Exercise</span><span>Sets</span><span>Reps</span><span></span></div>${rows}` : `<p class="muted" style="font-size:13px">No exercises yet.</p>`}
    ${glist ? `<div class="groups">${glist}</div>` : ''}${foot}</div>`;
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
  if (S.local) return;
  S.recipients.set(id, []);
  if (!(await flushNow('sp:' + id))) return;
  const { data, error } = await sb.rpc('split_recipients', { p_split: id });
  if (!error) { S.recipients.set(id, data || []); if (S.view === 'split' || S.view === 'splits') soft(); }
}

/* ---------- User guide ---------- */
const guideDevice = () => S.guideDev || (coarse.matches || innerWidth < 768 ? 'phone' : 'desktop');
function vGuide() {
  const dev = guideDevice(), secs = guideSections(dev);
  return `<header class="s-top rv"><button class="iconbtn" data-act="back" aria-label="Back">${ICON.back}</button></header>
  <div class="guide">
    <div class="guide-hero rv"><span class="lbl">Help</span><h1 class="h1">User guide</h1><p class="lead">Everything Synergym does, in a few short steps each.</p>
      <div class="guide-dev"><span class="seg" role="group" aria-label="Show steps for"><button class="${dev === 'phone' ? 'on' : ''}" data-act="guide-dev" data-v="phone">Phone</button><button class="${dev === 'desktop' ? 'on' : ''}" data-act="guide-dev" data-v="desktop">Desktop</button></span>
      <button class="btn ghost sm" data-act="tour">${roll('Replay the tour')}</button></div></div>
    <nav class="guide-toc rv" aria-label="Topics">${secs.map(x => `<a href="#g-${x.id}" data-act="guide-jump" data-id="${x.id}"><span class="gi">${x.icon}</span>${esc(x.t)}</a>`).join('')}</nav>
    ${secs.map((x, i) => `<details class="guide-sec rv" id="g-${x.id}"${i === 0 ? ' open' : ''}><summary><span class="gi">${x.icon}</span><span class="gt"><b>${esc(x.t)}</b><small>${esc(x.s)}</small></span><span class="chev" aria-hidden="true"></span></summary>
      <ol class="guide-steps">${x.steps.map(st => `<li>${st}</li>`).join('')}</ol>${x.tip ? `<p class="guide-tip"><b>Tip</b>${x.tip}</p>` : ''}</details>`).join('')}
    <p class="muted guide-foot rv">Want the maths? <button class="linkbtn" data-act="how">How the numbers work</button></p>
  </div>`;
}
function openTour() {
  const slides = tourSlides(coarse.matches || innerWidth < 768 ? 'phone' : 'desktop');
  let i = 0;
  const draw = body => {
    const x = slides[i], last = i === slides.length - 1;
    body.innerHTML = `<div class="tour" aria-live="polite"><div class="tour-art" aria-hidden="true"><span>${x.icon}</span></div>
      <span class="lbl">${i + 1} of ${slides.length}</span><h3>${esc(x.t)}</h3><p>${esc(x.b)}</p>
      <div class="tour-dots" aria-hidden="true">${slides.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>
      <div class="btns">${last ? `<button class="btn line" id="tour-guide">Open the guide</button><button class="btn" data-act="close">Start training</button>` : `<button class="btn ghost" data-act="close">Skip</button><button class="btn" id="tour-next">Next</button>`}</div></div>`;
    body.querySelector('#tour-next')?.addEventListener('click', () => { i++; buzz(); draw(body); });
    body.querySelector('#tour-guide')?.addEventListener('click', () => { closeSheet(); go('guide'); });
  };
  openSheet('', draw);
}

/* ---------- Settings ---------- */
function vPrefs() {
  const d = S.profile, du = d.unit === 'lb' ? 'lb' : 'kg';
  const bwShown = Math.round((du === 'lb' ? d.bw * KG_LB : d.bw) * 10) / 10;
  const row = (k, ctl, hint = '') => `<div class="srow"><span class="k">${k}${hint ? `<small>${hint}</small>` : ''}</span>${ctl}</div>`;
  const link = (k, attrs, val = '', cls = '') => `<button class="srow link${cls}" ${attrs}><span class="k">${k}</span>${val ? `<span class="v">${val}</span>` : ''}<span class="chev" aria-hidden="true"></span></button>`;
  const group = (title, body, foot = '') => `<section class="sg rv"><h2 class="sg-h">${title}</h2><div class="sg-b">${body}</div>${foot ? `<p class="sg-f">${foot}</p>` : ''}</section>`;
  const who = d.name || S.profile.username || '?';
  return pageTop('Settings') + `<h1 class="h1 rv" style="margin:10px 0 4px">Settings</h1><p class="lbl autosave rv" id="autosave">${autosaveText()}</p>
  <div class="settings">
  <section class="sg rv"><div class="sg-b me"><span class="avatar" aria-hidden="true">${esc(who.trim().charAt(0).toUpperCase())}</span><span class="me-t"><b>${esc(who)}</b><span>${S.local ? 'Offline · saved on this phone' : '@' + esc(S.profile.username) + (S.user.email ? ' · ' + esc(S.user.email) : '')}</span></span></div></section>
  ${group('Profile',
    row('Name', `<input class="field" data-f="d-name" value="${esc(d.name)}" maxlength="40" aria-label="Your name">`, 'Shown in your greeting') +
    row('Bodyweight', `<span class="unitin"><input class="field" data-f="d-bw" inputmode="decimal" value="${bwShown}" aria-label="Bodyweight"><span class="lbl">${du}</span></span>`, 'Used for bodyweight exercises'))}
  ${group('Training',
    row('Units', `<span class="seg"><button class="${du === 'kg' ? 'on' : ''}" data-act="d-set" data-k="unit" data-v="kg">kg</button><button class="${du === 'lb' ? 'on' : ''}" data-act="d-set" data-k="unit" data-v="lb">lb</button></span>`, 'Stored precisely; switch any time') +
    row('Weekly target', `<span class="stepper"><button data-act="d-step" data-k="target" data-d="-1" aria-label="Fewer">−</button><span>${d.target}</span><button data-act="d-step" data-k="target" data-d="1" aria-label="More">+</button></span>`, 'Sessions per week for consistency') +
    row('Rest timer', `<button class="toggle${d.restOn ? ' on' : ''}" data-act="d-toggle" data-k="restOn" aria-pressed="${d.restOn}" aria-label="Rest timer"></button>`, 'Counts down after you tick a set') +
    (d.restOn ? row('Rest length', `<span class="stepper"><button data-act="d-step" data-k="rest" data-d="-15" aria-label="Shorter">−</button><span>${mmss(d.rest * 1000)}</span><button data-act="d-step" data-k="rest" data-d="15" aria-label="Longer">+</button></span>`) +
      row('Rest sound', `<button class="toggle${d.sound ? ' on' : ''}" data-act="d-toggle" data-k="sound" aria-pressed="${d.sound}" aria-label="Rest sound"></button>`, 'A short beep when rest ends') : ''),
    'Your weekly target drives the consistency score and streak.')}
  ${group('Appearance', `<div class="srow"><span class="k">Theme</span><span class="v">${esc((THEMES.find(t => t.id === themePref()) || THEMES[0]).name)}</span></div><div class="sg-pad">${themePicker()}</div>` + link('Home widgets', 'data-act="edit-home"', plural(homeWidgets().length, 'widget')))}
  ${remGroup(row, link, group)}
  ${S.local ? group('Account',
    `<div class="srow"><span class="k">Offline<small class="keep">Everything is saved on this phone only</small></span><span class="off-dot" aria-hidden="true"></span></div>` +
    link('Go online', 'data-act="go-online"', 'Sync to an account'),
    'Going online asks you to log in or create an account, then uploads this phone’s workouts to it.')
  : group('Account',
    link('Username', 'data-act="change-username"', '@' + esc(S.profile.username)) +
    (canGoLocal() ? link('Use offline', 'data-act="go-offline"', 'Keep data on this phone') : '') +
    (standalone() ? '' : link('Install the app', 'data-act="install"')),
    'Your sessions, exercises and splits are private to your account. Others only see a split when you share it.')}
  ${group('Your data', link('Export JSON', 'data-act="export" data-f="json"') + link('Export CSV', 'data-act="export" data-f="csv"') + link('Import JSON', 'data-act="import"'))}
  ${group('Help', link('User guide', 'data-act="nav" data-v="guide"') + link('Replay the tour', 'data-act="tour"') + link('How the numbers work', 'data-act="how"'))}
  <section class="sg rv"><div class="sg-b">${S.local ? link('Delete data on this phone', 'data-act="delete-local"', '', ' center danger') : link('Sign out', 'data-act="signout"', '', ' center') + link('Delete account', 'data-act="delete-account"', '', ' center danger')}</div></section>
  </div>`;
}
/* reminders: phones only; they need an account (the server sends them) and a browser that can receive push */
const localTz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch { return null; } };
function remGroup(row, link, group) {
  if (!coarse.matches) return '';
  const d = S.profile, note = t => group('Reminders', `<div class="srow"><span class="k">Workout reminders<small class="keep">${t}</small></span></div>`);
  if (S.local) return note('Reminders need an online account. Go online below to turn them on.');
  if (!pushSupported()) return note(isIOS() && !standalone() ? 'On iPhone, add Synergym to your Home Screen and open it from there to get reminders.' : 'This browser can’t show reminders. Try the app from your Home Screen.');
  const blocked = Notification.permission === 'denied', on = d.reminderOn && !blocked;
  return group('Reminders',
    row('Workout reminders', `<button class="toggle${on ? ' on' : ''}" data-act="rem-toggle" aria-pressed="${on}" aria-label="Workout reminders"></button>`, blocked ? 'Blocked. Allow notifications for Synergym in your phone’s settings.' : 'A nudge on your training days') +
    (on ? row('Time', `<input class="field rem-time" type="time" data-f="rem-time" value="${esc(d.reminderTime)}" aria-label="Reminder time">`) +
      `<div class="srow rem-row"><span class="k">Days<small class="keep" id="rem-days-t">${daysText(d.reminderDays)}</small></span><span class="rem-days" role="group" aria-label="Reminder days">${DAY_LETTERS.map((l, i) => `<button class="${d.reminderDays & (1 << i) ? 'on' : ''}" data-act="rem-day" data-i="${i}" aria-pressed="${!!(d.reminderDays & (1 << i))}" aria-label="${DAY_NAMES[i]}">${l}</button>`).join('')}</span></div>` +
      link('Send a test reminder', 'data-act="rem-test"') : ''),
    on ? `<span id="rem-foot">At ${timeText(d.reminderTime)}, ${daysText(d.reminderDays).toLowerCase()}. Days you’ve already trained stay quiet.</span>` : '');
}
async function reminderOn() {
  if (S.local) return toast('Go online to use reminders');
  if (!pushSupported()) return toast('This browser can’t show reminders');
  let perm = Notification.permission;
  if (perm === 'default') { try { perm = await Notification.requestPermission(); } catch { perm = 'denied'; } }
  if (perm !== 'granted') { render(false); return toast('Notifications are blocked. Allow them for Synergym in your phone’s settings.'); }
  try {
    const sub = await pushSubscribe();
    const { error } = await sb.rpc('save_push_subscription', { p_endpoint: sub.endpoint, p_p256dh: sub.keys.p256dh, p_auth: sub.keys.auth });
    if (error) throw error;
  } catch (e) { console.error(e); return toast(e && /worker/.test(e.message || '') ? e.message : 'Couldn’t turn on reminders. Check your connection and try again.'); }
  S.profile.reminderOn = true; S.profile.tz = localTz(); queue('p', 0); buzz(); render(false);
  toast(`Reminders on · ${timeText(S.profile.reminderTime)}`);
}
/* stop reminders on this device (and for the account, which uses one device at a time) */
async function reminderOff() {
  const ep = await pushUnsubscribe().catch(() => null);
  if (S.local || !S.user || !sb) return;
  if (ep) await sb.from('push_subscriptions').delete().eq('endpoint', ep).then(() => {}, () => {});
  if (S.profile.reminderOn) { S.profile.reminderOn = false; queue('p', 0); await flushNow('p'); }
}
async function reminderTest() {
  const { data } = await sb.auth.getSession(), t = data.session && data.session.access_token;
  if (!t) return toast('Log in again to send a test');
  try {
    const r = await fetch('/api/reminders', { method: 'POST', headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: JSON.stringify({ test: true }) });
    toast(r.ok ? 'Test sent. It should arrive in a few seconds.' : r.status === 404 ? 'This phone isn’t registered. Turn reminders off and on again.' : 'Couldn’t send a test right now.');
  } catch { toast('Couldn’t reach the server'); }
}

const HOW = `<h2 style="margin-bottom:12px">How the numbers work</h2><div class="how">
    <p><b>Set intensity.</b> Each set’s estimated one-rep max (weight × (1 + reps ÷ 30)) as a percentage of your best estimate on that exercise up to that day. 100 means you matched or beat your best. Bodyweight exercises use your bodyweight plus any added load.</p>
    <p><b>Session intensity.</b> The average of your set intensities, weighted by load × reps, so heavy working sets count more than light ones. Easy under 60, moderate to 75, hard to 88, then max effort. It reads “calibrating” until each exercise has a couple of sessions behind it.</p>
    <p><b>Linked sets.</b> Link two or more sets and Synergym names the structure: two exercises make a superset, three or more a giant set. On one exercise, falling weight is a drop set, the same weight a rest-pause set, anything else a pyramid. Rest starts after the last set of a group.</p>
    <p><b>Consistency.</b> Sessions per week against your weekly target, averaged over the last 8 full weeks (or since your first session). A week at or above target scores 100. The streak counts consecutive weeks on target.</p>
    <p><b>Splits.</b> The Today screen suggests the next training day of the split you used last, skipping rest days.</p>
  </div><button class="btn lg wide" data-act="close" style="margin-top:16px">Done</button>`;

/* ================= sheets ================= */
function openSheet(html, mount) { const sh = $('#sheet'); $('#sheet-body').innerHTML = html; sh.hidden = false; document.body.style.overflow = 'hidden'; mount && mount($('#sheet-body')); fluidApply($('#sheet-body'), null); const f = $('#sheet-body').querySelector('input:not([type=hidden]),button'); if (f && matchMedia('(pointer:fine)').matches) f.focus(); }
function closeSheet() { for (const w of $$('.what-pick.open')) { w.classList.remove('open'); w.setAttribute('aria-expanded', 'false'); } $('#sheet').hidden = true; $('#sheet-body').innerHTML = ''; document.body.style.overflow = ''; const sp = $('#sheet .sp'); sp.style.transform = sp.style.transition = sp.style.animation = ''; }
/* drag a sheet down from its top to dismiss it, like a native bottom sheet */
(() => {
  const sp = $('#sheet .sp'); let y0 = null, dy = 0, t0 = 0;
  sp.addEventListener('touchstart', e => { if (sp.scrollTop > 0 || e.touches.length > 1 || e.target.closest('input,textarea,select,.range')) return; y0 = e.touches[0].clientY; dy = 0; t0 = performance.now(); }, { passive: true });
  sp.addEventListener('touchmove', e => {
    if (y0 == null) return; dy = Math.max(0, e.touches[0].clientY - y0);
    if (sp.scrollTop > 0) { y0 = null; dy = 0; sp.style.transform = ''; return; }
    sp.style.animation = 'none'; sp.style.transition = 'none'; sp.style.transform = dy ? `translateY(${dy}px)` : '';
  }, { passive: true });
  sp.addEventListener('touchend', () => {
    if (y0 == null) return; const v = dy / Math.max(1, performance.now() - t0); y0 = null;
    sp.style.transition = 'transform .32s var(--ease)';
    if (dy > 120 || (dy > 40 && v > .6)) { sp.style.transform = 'translateY(105%)'; setTimeout(closeSheet, 260); }
    else sp.style.transform = '';
  });
})();
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !$('#sheet').hidden) return closeSheet();
  if (e.key === 'Escape' && S.view === 'widget') return back();
  const el = e.target; if ((e.key === 'Enter' || e.key === ' ') && el.getAttribute && el.getAttribute('role') === 'button' && el.dataset.act) { e.preventDefault(); el.click(); }
});
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
  <div><span class="lbl">Muscle group</span><div class="chips" id="ef-m" style="margin-top:8px">${muscles().map(x => `<button class="chip${x === m ? ' on' : ''}" data-m="${esc(x)}">${esc(x)}</button>`).join('')}</div></div>
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
  $('#pkm').innerHTML = ['', ...muscles()].map(x => `<button class="chip${m === x ? ' on' : ''}" data-act="pk-m" data-m="${esc(x)}">${esc(x || 'All')}</button>`).join('');
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
function dayPicker({ title, note, onPick, foot = [] }) {
  const splits = [...S.splits.values()].filter(sp => sp.days.some(d => !isRestDay(d))).sort((x, y) => y.updatedAt - x.updatedAt);
  const nx = nextSplitDay(); let sel = nx ? nx.sp.id : splits[0]?.id;
  const body = $('#sheet-body');
  const draw = () => {
    const prev = fluidCapture(body), sp = S.splits.get(sel);
    body.innerHTML = `<div class="sh-h"><h3>${esc(title)}</h3><button class="btn ghost sm" data-act="close">Close</button></div>
    ${sp ? `${splits.length > 1 ? `<span class="lbl">Split</span><div class="hscroll st-splits">${splits.map(x => `<button class="chip${x.id === sel ? ' on' : ''}" data-st-sp="${x.id}">${esc(x.name)}</button>`).join('')}</div>` : `<span class="lbl">${esc(sp.name)}</span>`}
      <span class="lbl st-q">Which day?</span>
      <div class="st-days">${sp.days.map((d, i) => { if (isRestDay(d)) return ''; const isNext = nx && nx.sp.id === sp.id && nx.i === i, g = dayGroups(d).size;
        return `<button class="st-day${isNext ? ' next' : ''}" data-st-day="${i}"><span class="lbl">Day ${i + 1}${isNext ? ' · up next' : ''}</span><b>${esc(d.type || 'Training')}</b><span class="sub">${d.exercises.length ? esc(d.exercises.slice(0, 4).map(x => x.name).join(' · ')) + (d.exercises.length > 4 ? ` +${d.exercises.length - 4}` : '') : 'No exercises yet'}${g ? ` · ${plural(g, 'linked group')}` : ''}</span></button>`; }).join('')}</div>
      ${note ? `<p class="muted st-note">${note}</p>` : ''}`
    : `<p class="muted" style="margin-bottom:var(--s0)">Plan a split and its days show up here, ready to start with sets and reps filled in.</p>`}
    ${foot.length || !sp ? `<div class="btns st-foot">${foot.map((f, k) => `<button class="btn ${f.cls || 'line'}" data-st-foot="${k}">${esc(f.label)}</button>`).join('')}${sp ? '' : '<button class="btn" id="st-plan">Plan a split</button>'}</div>` : ''}`;
    fluidApply(body, prev);
    body.querySelectorAll('[data-st-sp]').forEach(b => b.onclick = () => { sel = b.dataset.stSp; buzz(); draw(); });
    body.querySelectorAll('[data-st-day]').forEach(b => b.onclick = () => { closeSheet(); onPick(sel, +b.dataset.stDay); });
    body.querySelectorAll('[data-st-foot]').forEach(b => b.onclick = () => { closeSheet(); foot[+b.dataset.stFoot].fn(); });
    body.querySelector('#st-plan')?.addEventListener('click', () => { closeSheet(); go('splits'); });
  };
  openSheet('', null); draw();
}
function startMenu() {
  const a = activeSession(); if (a) return go('session', a.id);
  dayPicker({ title: 'Start a session', note: 'The session is filled in from that day. Change anything once it starts.', onPick: startFromSplit, foot: [{ label: 'Empty session', fn: startSession }] });
}
function nextMenu() {
  const nx = nextSplitDay();
  dayPicker({ title: 'Up next', note: 'Home and the + button use this day until you start your next session, then the split carries on from it.',
    onPick: (sp, i) => { S.profile.nextDay = { sp, i, at: Date.now() }; queue('p', 200); render(false); toast(`Up next: ${S.splits.get(sp)?.days[i]?.type || 'Day ' + (i + 1)}`); },
    foot: nx && nx.picked ? [{ label: 'Back to the split’s order', fn: () => { S.profile.nextDay = null; queue('p', 200); render(false); toast('Following your split’s order'); } }] : [] });
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
  const groups = dayGroups(d), gid = new Map();
  const items = d.exercises.map(x => {
    const e = ensureExercise(x), last = lastSetsFor(e.id), r0 = parseInt(String(x.reps)) || null, gr = x.g && groups.get(x.g);
    return { id: sid(), exId: e.id, sets: Array.from({ length: x.sets }, (_, i) => {
      const l = last && last[Math.min(i, last.length - 1)];
      /* superset / giant set: set i of each linked exercise forms round i; a single linked exercise links all its sets */
      let g = null; if (gr) { const key = gr.js.length > 1 ? x.g + ':' + i : x.g; if (!gid.has(key)) gid.set(key, sid()); g = gid.get(key); }
      return { id: sid(), w: null, r: null, pw: l ? l.w : null, pr: r0 ?? (l ? l.r : null), done: false, g };
    }) };
  });
  const tmp = { items }; cleanGroups(tmp);
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
  st.done = true; queue('s:' + s.id, 300); buzz(12);
  let nextName = null;
  if (st.g && !s.endedAt) { const g = groupsOf(s).find(x => x.g === st.g); if (g) { const idx = g.m.findIndex(x => x.st.id === st.id); const nxt = g.m.slice(idx + 1).find(x => !x.st.done); if (nxt) nextName = exOf(nxt.it.exId)?.name; } }
  render(false);
  if (s.endedAt) return;
  if (nextName) { toast('Next in group: ' + nextName); S.rest = null; tick(); } else if (S.profile.restOn) startRest();
  maybePromptOneRm(s, f.it, st);
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
/* fill the suggested target into the sets you haven't done yet (working sets only, so warm-ups stay as they were) */
function useSuggestion(itemId) {
  const s = cur(), it = s && s.items.find(x => x.id === itemId); if (!it) return;
  const g = suggestFor(s, it); if (!g) return;
  const open = it.sets.filter(st => !st.done && st.w == null), work = open.filter(st => st.pw == null || st.pw >= g.last.w - 1e-6);
  for (const st of work.length ? work : open) { st.pw = g.next.w; st.pr = g.next.r; }
  if (!open.length) it.sets.push({ id: sid(), w: null, r: null, pw: g.next.w, pr: g.next.r, done: false, g: null });
  queue('s:' + s.id, 300); render(false); buzz(); toast(`Target set: ${exOf(it.exId)?.kind === 'bw' && !g.next.w ? g.next.r + ' reps' : fmtW(g.next.w) + ' ' + unit() + ' × ' + g.next.r}`);
}
/* plate calculator: per-side plates for a target weight, with the bar remembered per unit on this device */
const PLATE_TONE = ['#D7263D', '#1F6FEB', '#E8B90E', '#2E9D50', '#F2F2F2', '#2A2A2A', '#B8B8B8'];
function barbellSVG(side, plates) {
  const H = 110, cx = 160, sleeve = 118, h = p => [1, .92, .8, .68, .52, .42, .34][plates.indexOf(p)] * H, w = p => [11, 10, 9, 8, 6, 5, 4][plates.indexOf(p)];
  let x = cx + 34, l = '', r = '';
  for (const p of side) { const pw = w(p), ph = h(p), y = (130 - ph) / 2, c = PLATE_TONE[plates.indexOf(p)];
    r += `<rect x="${x}" y="${y}" width="${pw}" height="${ph}" rx="2" fill="${c}" class="pl"/>`; l += `<rect x="${2 * cx - x - pw}" y="${y}" width="${pw}" height="${ph}" rx="2" fill="${c}" class="pl"/>`; x += pw + 1.5; }
  return `<svg class="barbell" viewBox="0 0 320 130" aria-hidden="true"><rect class="bar" x="${cx - 120}" y="61" width="240" height="8" rx="3"/><rect class="bar" x="${cx - sleeve}" y="57" width="${sleeve - 34}" height="16" rx="3"/><rect class="bar" x="${cx + 34}" y="57" width="${sleeve - 34}" height="16" rx="3"/><rect class="bar collar" x="${cx - 36}" y="52" width="4" height="26" rx="1"/><rect class="bar collar" x="${cx + 32}" y="52" width="4" height="26" rx="1"/>${l}${r}</svg>`;
}
function plateSheet(kg) {
  const u = unit(), key = 'sg-bar-' + u; let bar = BARS[u][0]; try { const v = localStorage.getItem(key), b = +v; if (v !== null && v !== '' && BARS[u].includes(b)) bar = b; } catch {}
  const start = kg > 0 ? Math.round(toU(kg) * 100) / 100 : '';
  openSheet(`<div class="sh-h"><h3>Plate calculator</h3><button class="btn ghost sm" data-act="close">Close</button></div>
  <div class="pl-in"><label>Target<span class="unitin"><input class="field" id="pl-w" inputmode="decimal" value="${start}" placeholder="0" aria-label="Target weight"><span class="lbl">${u}</span></span></label>
  <div><span class="lbl">Bar</span><span class="seg" role="group" aria-label="Bar weight">${BARS[u].map(b => `<button class="${b === bar ? 'on' : ''}" data-bar="${b}">${b ? b + ' ' + u : 'None'}</button>`).join('')}</span></div></div>
  <div id="pl-out" aria-live="polite"></div>`, root => {
    const inp = root.querySelector('#pl-w'), out = root.querySelector('#pl-out');
    const draw = () => {
      const t = parseFloat(String(inp.value).replace(',', '.')), r = platesFor(t, bar, PLATES[u]);
      if (!(t > 0)) { out.innerHTML = `<p class="muted pl-note">Enter a weight to see the plates.</p>`; return; }
      if (r.under) { out.innerHTML = barbellSVG([], PLATES[u]) + `<p class="muted pl-note">That’s lighter than the ${bar} ${u} bar.</p>`; return; }
      out.innerHTML = barbellSVG(r.side, PLATES[u]) + `<div class="pl-res"><div><span class="lbl">Each side</span><b>${r.side.length ? sideText(r.side) : 'Just the bar'}</b></div><div><span class="lbl">On the bar</span><b>${r.loaded} ${u}</b></div></div>`
        + (r.left > 0 ? `<p class="muted pl-note">${r.left} ${u} can’t be loaded with standard plates, so this is the closest under it.</p>` : '');
    };
    inp.addEventListener('input', draw);
    root.querySelectorAll('[data-bar]').forEach(b => b.onclick = () => { bar = +b.dataset.bar; try { localStorage.setItem(key, bar); } catch {} root.querySelectorAll('[data-bar]').forEach(x => x.classList.toggle('on', x === b)); buzz(); draw(); });
    draw();
  });
}
function setMenu(setId) {
  const s = cur(), f = s && findSet(s, setId); if (!f) return; const st = f.st;
  const w = st.w ?? st.pw, ex = exOf(f.it.exId);
  const items = [...(ex && ex.kind !== 'bw' ? [{ label: 'Plate calculator', hint: w > 0 ? `${fmtW(w)} ${unit()}` : '', fn: () => plateSheet(w) }] : []), { label: 'Add drop set after this', hint: '80% weight', fn: () => addDrop(setId) },
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
/* reorder split days; sessions logged from this split keep pointing at the same day */
function moveDay(i, dir) {
  const sp = curSplit(), j = i + dir; if (!sp || j < 0 || j >= sp.days.length) return;
  const before = new Map($$('.day[data-did]').map(el => [el.dataset.did, el.getBoundingClientRect().top]));
  [sp.days[i], sp.days[j]] = [sp.days[j], sp.days[i]];
  for (const s of S.sessions.values()) if (s.splitId === sp.id && (s.splitDay === i || s.splitDay === j)) { s.splitDay = s.splitDay === i ? j : i; queue('s:' + s.id, 1500); }
  S.spLink = null; touchSplit(sp, 400); render(false);
  for (const el of $$('.day[data-did]')) { const y = before.get(el.dataset.did); if (y == null) continue; const dy = y - el.getBoundingClientRect().top; if (!dy || reduced) continue;
    el.style.transition = 'none'; el.style.transform = `translateY(${dy}px)`; requestAnimationFrame(() => { el.style.transition = 'transform .55s var(--spring)'; el.style.transform = ''; }); }
}
function dupSplit(id) {
  const sp = S.splits.get(id); if (!sp) return;
  const c = { ...clone(sp), id: uuid(), name: (sp.name + ' copy').slice(0, 60), shareToken: null, copiedFrom: null, updatedAt: Date.now() };
  S.splits.set(c.id, c); queue('sp:' + c.id, 0); go('split', c.id); toast('Duplicated. Edit away.');
}
function templateSheet(tid) {
  const t = TEMPLATES.find(x => x.id === tid); if (!t) return;
  openSheet(`<div class="sh-h"><h3>${esc(t.name)}</h3><button class="btn ghost sm" data-act="close">Close</button></div>
    <p class="muted" style="font-size:13px;margin-bottom:var(--s0)">${esc(t.desc)} Using it makes your own copy that you can rename, re-order and edit freely.</p>
    <div class="tpl-days">${t.plan.map(([ty, exs], i) => `<div class="pd${exs ? '' : ' rest'}"><span class="lbl">Day ${i + 1}</span><b>${esc(ty)}</b>${exs ? `<span class="sub">${exs.map(e => `${esc(e[0])} ${e[1]}×${esc(e[2])}`).join(' · ')}</span>` : ''}</div>`).join('')}</div>
    <div class="btns" style="margin-top:var(--s0)"><button class="btn lg" id="tpl-use">Use this template</button></div>`, r => {
    r.querySelector('#tpl-use').onclick = () => { closeSheet(); const sp = splitFromTemplate(t); go('split', sp.id); toast('Template added. Make it yours.'); };
  });
}
function splitMenu(id) {
  const sp = S.splits.get(id); if (!sp) return;
  menuSheet(sp.name, [
    { label: 'Share', fn: () => shareSheet(id) },
    { label: 'Duplicate', fn: () => dupSplit(id) },
    { label: 'Delete split', warn: true, fn: () => confirmSheet('Delete split?', 'This deletes the plan and stops sharing it. Sessions you logged from it are kept.', 'Delete', () => { S.splits.delete(id); queue('sp:' + id, 0); go('splits', null, { replace: true }); toast('Split deleted'); }) }
  ]);
}
/* when a superset loses a member and one exercise is left, unlink it rather than turn it into a drop set */
function tidySplitGroups(d, g, before) { if (!g || before < 2) return; const left = d.exercises.filter(x => x.g === g); if (left.length === 1) left[0].g = null; }
function dexMenu(di, xi) {
  const sp = curSplit(), d = sp && sp.days[di], x = d && d.exercises[xi]; if (!x) return;
  const mv = k => { const j = xi + k; if (j < 0 || j >= d.exercises.length) return; [d.exercises[xi], d.exercises[j]] = [d.exercises[j], d.exercises[xi]]; touchSplit(sp, 300); render(false); };
  const items = [];
  if (xi > 0) items.push({ label: 'Move up', fn: () => mv(-1) });
  if (xi < d.exercises.length - 1) items.push({ label: 'Move down', fn: () => mv(1) });
  for (let k = 0; k < sp.days.length; k++) if (k !== di && !isRestDay(sp.days[k])) items.push({ label: `Copy to day ${k + 1}`, hint: sp.days[k].type, fn: () => { sp.days[k].exercises.push({ ...clone(x), id: sid() }); touchSplit(sp, 300); render(false); toast(`Copied to day ${k + 1}`); } });
  const g0 = x.g, n0 = g0 ? d.exercises.filter(y => y.g === g0).length : 0;
  if (x.g) items.push({ label: 'Unlink', hint: 'Take it out of its linked group', fn: () => { x.g = null; tidySplitGroups(d, g0, n0); touchSplit(sp, 300); render(false); } });
  items.push({ label: 'Remove from this day', warn: true, fn: () => { d.exercises.splice(xi, 1); tidySplitGroups(d, g0, n0); touchSplit(sp, 300); render(false); } });
  menuSheet(x.name, items);
}
async function shareSheet(id) {
  if (S.local) return toast('Go online to share splits. Settings › Go online.');
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
  let d = null; try { d = parseImport(JSON.parse(await f.text()), S.profile.bw); } catch {}
  if (!d) return toast('That file isn’t a valid Synergym export');
  const now = [plural(S.sessions.size, 'session'), plural(S.library.length, 'exercise'), plural(S.splits.size, 'split')];
  const incoming = [plural(d.sessions.length, 'session'), plural(d.library.length, 'exercise'), plural(d.splits.length, 'split')];
  openSheet(`<div class="sh-h"><h3>Replace all your data?</h3><button class="btn ghost sm" data-act="close">Close</button></div>
  <div class="imp-warn"><b>This overwrites everything ${S.local ? 'on this phone' : 'in your account'}.</b> Your current ${now.join(', ')} will be permanently deleted and replaced by the file. This can’t be undone.</div>
  <p class="muted" style="margin-top:12px">The file${d.exportedAt ? ` from ${esc(fmtDate(d.exportedAt))}` : ''} has ${incoming.join(', ')}. Your username and login stay the same. Splits you had shared by link stop working.</p>
  <div class="btns" style="flex-wrap:wrap"><button class="btn line" id="imp-backup" style="margin-right:auto">Export current data first</button><button class="btn ghost" data-act="close">Cancel</button><button class="btn danger" id="imp-go">Replace my data</button></div>`, r => {
    r.querySelector('#imp-backup').onclick = () => { exportData('json'); toast('Saved a copy of your current data'); };
    r.querySelector('#imp-go').onclick = async ev => {
      const btn = ev.currentTarget; btn.disabled = true; btn.textContent = 'Replacing…';
      flushAll(); for (const end = Date.now() + 8000; (OB.pending.size || OB.inflight.size) && Date.now() < end;) await sleep(150);
      if (OB.pending.size || OB.inflight.size) { btn.disabled = false; btn.textContent = 'Replace my data'; return toast('Some changes are still saving. Connect and try again.'); }
      if (S.local) {
        /* offline: replace what's on the phone, and remember every change so going online uploads it */
        const keys = [...S.sessions.keys()].map(k => 's:' + k).concat(S.library.map(e => 'x:' + e.id), [...S.splits.keys()].map(k => 'sp:' + k), d.sessions.map(x => 's:' + x.id), d.library.map(x => 'x:' + x.id), d.splits.map(x => 'sp:' + x.id), ['p']);
        const prof = d.profile ? { ...d.profile, username: S.profile.username, onboarded: true, name: d.profile.name || S.profile.name } : S.profile;
        try { await ldb.replaceAll({ profile: clone(prof), exercises: clone(d.library), sessions: clone(d.sessions), splits: clone(d.splits), dirty: [...new Set([...LDIRTY, ...keys])] }); }
        catch { btn.disabled = false; btn.textContent = 'Replace my data'; return toast('Import failed. Nothing was changed.'); }
        closeSheet(); await loadLocal(); if (S.profile.theme) applyTheme(S.profile.theme);
        render(false); return toast(`Imported ${incoming.join(', ')}`);
      }
      const payload = { library: d.library.map(exToDb), sessions: d.sessions.map(sessToDb), splits: d.splits.map(splitToDb), profile: d.profile ? (({ onboarded, ...rest }) => rest)(profToDb(d.profile)) : null };
      const { error } = await sb.rpc('import_replace', { p: payload });
      if (error) { console.error(error); btn.disabled = false; btn.textContent = 'Replace my data'; return toast('Import failed. Nothing was changed.'); }
      closeSheet();
      try { await loadAll(); } catch (er) { console.error(er); }
      if (S.profile.theme) applyTheme(S.profile.theme);
      render(false); toast(`Imported ${incoming.join(', ')}`);
    };
  });
});

/* ================= account ================= */
async function signOut() {
  if (S.local) return toast('You’re using Synergym offline. Go online in Settings to use an account.');
  flushAll(); const t0 = Date.now();
  while ((OB.pending.size || OB.inflight.size) && Date.now() - t0 < 5000) await sleep(150);
  if (OB.pending.size && !confirmLeave) { confirmLeave = true; return toast('Some changes haven’t saved yet. They’ll sync when you sign back in. Tap Sign out again to leave.'); }
  confirmLeave = false;
  const ep = await pushUnsubscribe().catch(() => null); if (ep) await sb.from('push_subscriptions').delete().eq('endpoint', ep).then(() => {}, () => {});
  await sb.auth.signOut();
}
let confirmLeave = false;
function deleteAccount() {
  if (S.local) return deleteLocalSheet();
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
function changeUsername(intro = false) {
  if (S.local) return toast('Go online to pick a username');
  openSheet(`<div class="sh-h"><h3>${intro ? 'Pick a username' : 'Change username'}</h3><button class="btn ghost sm" data-act="close">${intro ? 'Later' : 'Close'}</button></div>${intro ? '<p class="muted" style="margin-bottom:12px">You’re online. A username lets other lifters share splits with you. You can do this later in Settings.</p>' : ''}
  <div class="form"><label>New username<input class="field" id="un" value="${esc(S.profile.username)}" autocapitalize="none" spellcheck="false" maxlength="20"></label><p class="muted" style="font-size:12px">Splits already shared with you stay. People will need the new name to share with you.</p></div>
  <div class="btns"><button class="btn" id="un-save">Save</button></div>`, r => {
    r.querySelector('#un-save').onclick = async () => { if (await setUsername(r.querySelector('#un').value)) { closeSheet(); render(false); toast('Username updated'); } };
  });
}

/* ================= event wiring ================= */
const ACT = {
  nav: el => go(el.dataset.v),
  'auth-mode': el => { S.authMode = el.dataset.m; S.authMsg = null; S.authSwap = true; render(false); },
  signout: signOut,
  'retry-load': () => S.local ? startLocal() : startApp(),
  tour: () => openTour(),
  'rem-toggle': () => S.profile.reminderOn && Notification.permission !== 'denied' ? reminderOff().then(() => { render(false); toast('Reminders off'); }) : reminderOn(),
  'rem-day': el => { const m = S.profile.reminderDays ^ (1 << +el.dataset.i); if (!(m & 127)) return toast('Keep at least one day'); S.profile.reminderDays = m; queue('p', 500); buzz(); render(false); },
  'rem-test': () => reminderTest(),
  'guide-dev': el => { S.guideDev = el.dataset.v; render(false); },
  'guide-jump': el => { const d = $('#g-' + el.dataset.id); if (!d) return; d.open = true; d.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' }); },
  'go-local-new': () => startOfflineNew(),
  'go-offline': () => goOfflineSheet(),
  'go-online': () => goOnline(),
  'sync-cancel': () => { S.syncFlow = false; S.authMsg = null; try { sb.auth.stopAutoRefresh(); } catch {} render(true); },
  'leave-local': () => confirmSheet('Use an account instead?', 'This removes the offline profile on this phone. You can create an account or log in next.', 'Continue', () => leaveLocal()),
  'delete-local': () => deleteLocalSheet(),
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
  'edit-orm': el => editOneRm(el.dataset.id),
  'edit-muscles': editMuscles,
  'dash-go': el => { const d = $('#dash'), k = d && d.children[+el.dataset.i]; if (k) d.scrollTo({ left: k.offsetLeft - (d.clientWidth - k.offsetWidth) / 2, behavior: reduced ? 'auto' : 'smooth' }); },
  'open-ex': el => { if (!S.link) go('exercise', el.dataset.id); },
  'exm': el => { S.exm = el.dataset.m; $('#exm').innerHTML = muscleChips(); $('#exlist').innerHTML = exList(); },
  'toggle-arch': () => { S.showArchived = !S.showArchived; $('#exlist').innerHTML = exList(); },
  'lib-menu': () => menuSheet('Exercise list', [
    { label: 'Edit muscle groups', hint: 'add, rename, remove', fn: editMuscles },
    { label: 'Restore default list', hint: 'adds back removed defaults', fn: async () => { if (S.local) return restoreDefaultsLocal(); const { data, error } = await sb.rpc('restore_default_exercises'); if (error) return toast('Couldn’t restore. Try again.'); await reloadLibrary(); toast(data ? `Restored ${plural(data, 'exercise')}` : 'Your default list is complete'); } },
    { label: S.showArchived ? 'Hide removed exercises' : 'Show removed exercises', fn: () => { S.showArchived = !S.showArchived; render(false); } }
  ]),
  'pk-m': el => { S.pk.m = el.dataset.m; pickerList(); },
  'pk-pick': el => picked(exOf(el.dataset.id)),
  'pk-new': () => { const q = S.pk.q.trim(), pk = { ...S.pk }; closeSheet(); newExercise({ name: q, muscle: pk.m }, ex => { S.pk = pk; picked(ex); if (pk.mode === 'split') openPicker('split', { split: pk.split, day: pk.day }); }); },
  'add-set': el => addSet(el.dataset.item),
  'add-drop': el => addDrop(el.dataset.set),
  done: el => toggleDone(el.dataset.set),
  'set-menu': el => setMenu(el.dataset.set),
  'sugg-use': el => useSuggestion(el.dataset.item),
  plates: el => { const s = cur(), it = s && s.items.find(x => x.id === el.dataset.item); const st = it && [...it.sets].reverse().find(x => (x.w ?? x.pw) > 0); plateSheet(st ? st.w ?? st.pw : (el.dataset.w ? +el.dataset.w : null)); },
  'bw-del': el => { S.profile.bwLog = unlogBw(S.profile.bwLog, el.dataset.d); const l = S.profile.bwLog; if (l.length) S.profile.bw = l[l.length - 1].kg; queue('p', 300); render(false); },
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
  'sp-link': el => { S.spLink = { day: +el.dataset.day, sel: new Set() }; render(false); },
  'sp-link-cancel': () => { S.spLink = null; render(false); },
  'day-move': el => moveDay(+el.dataset.day, +el.dataset.d),
  'sp-link-pick': el => { const L = S.spLink; if (!L) return; const j = +el.dataset.x; L.sel.has(j) ? L.sel.delete(j) : L.sel.add(j); buzz(6); render(false); },
  'sp-link-do': () => { const sp = curSplit(), L = S.spLink, d = sp && L && sp.days[L.day]; if (!d || !L.sel.size) return; const g = sid(), t = spLinkType(L.sel.size);
    const old = new Map(); for (const j of L.sel) { const og = d.exercises[j]?.g; if (og && !old.has(og)) old.set(og, d.exercises.filter(y => y.g === og).length); }
    for (const j of L.sel) if (d.exercises[j]) d.exercises[j].g = g;
    for (const [og, n] of old) tidySplitGroups(d, og, n);
    S.spLink = null; touchSplit(sp, 300); render(false); toast(t + ' linked'); },
  'sp-unlink': el => { const sp = curSplit(), d = sp && sp.days[+el.dataset.day]; if (!d) return; for (const x of d.exercises) if (x.g === el.dataset.g) x.g = null; touchSplit(sp, 300); render(false); toast('Unlinked'); },
  'dup-split': el => dupSplit(el.dataset.id),
  'tpl-view': el => templateSheet(el.dataset.id),
  'dex-menu': el => dexMenu(+el.dataset.day, +el.dataset.x),
  'copy-shared': el => { const sp = S.shared.find(x => x.id === el.dataset.id); if (sp) copySplit(sp, sp.from); },
  'remove-shared': el => confirmSheet('Remove shared split?', 'It disappears from your list. The owner keeps it.', 'Remove', async () => {
    const { error } = await sb.from('split_shares').delete().eq('split_id', el.dataset.id).eq('to_user', S.user.id);
    if (error) return toast('Couldn’t remove it. Try again.'); S.shared = S.shared.filter(x => x.id !== el.dataset.id); go('splits', null, { replace: true }); }),
  'copy-public': () => { if (S.pub?.data) copySplit(S.pub.data, S.pub.data.owner_username); },
  'public-signin': () => { try { localStorage.setItem('sg-open-split', S.arg); } catch {} S.authMode = 'signup'; go('today', null, { replace: true }); },
  unit: el => { S.profile.unit = el.dataset.u; queue('p'); render(false); },
  'change-username': changeUsername,
  'delete-account': deleteAccount,
  export: el => exportData(el.dataset.f),
  import: () => $('#imp').click(),
  close: closeSheet,
  'w-open': el => { S.homeRestore = { y: scrollY, x: $('#dash')?.scrollLeft || 0 }; go('widget', el.dataset.id); },
  'w-opt': el => { WOPT[el.dataset.id] = +el.dataset.v; try { localStorage.setItem('sg-wopt', JSON.stringify(WOPT)); } catch {} render(false); },
  'w-close': () => back(),
  'rest-today': () => setRestToday(true),
  'next-pick': el => { el.classList.add('open'); el.setAttribute('aria-expanded', 'true'); nextMenu(); },
  'rest-undo': () => setRestToday(false),
  'w-size': el => { const list = homeEntries(), e = list.find(x => x.id === el.dataset.id); if (!e) return; e.size = el.dataset.v; saveEntries(list); buzz(); render(false); },
  'edit-home': () => editHome(),
  how: () => openSheet(HOW),
  install: async () => {
    if (installEvt) { installEvt.prompt(); const r = await installEvt.userChoice.catch(() => null); installEvt = null; if (r && r.outcome === 'accepted') toast('Synergym is on your home screen'); return; }
    const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    openSheet(`<h2 style="margin-bottom:8px">Install Synergym</h2><p class="muted">${ios ? 'In Safari, tap the <b>Share</b> button, then <b>Add to Home Screen</b>.' : 'Open your browser menu (⋮) and choose <b>Install app</b> or <b>Add to Home screen</b>.'} It then opens full screen, like any other app.</p><button class="btn lg wide" data-act="close" style="margin-top:16px">Got it</button>`);
  },
  'theme-flip': flipTheme,
  'd-theme': el => { const t = el.dataset.t; applyTheme(t); S.profile.theme = t; queue('p', 300); render(false); },
  'd-set': el => { S.profile[el.dataset.k] = el.dataset.v; queue('p', 300); render(false); },
  'd-step': el => { const k = el.dataset.k, d = +el.dataset.d, p = S.profile; p[k] = k === 'target' ? Math.min(7, Math.max(1, p.target + d)) : Math.min(600, Math.max(15, p.rest + d)); queue('p', 600); render(false); },
  'd-toggle': el => { const k = el.dataset.k; S.profile[k] = !S.profile[k]; queue('p', 300); render(false); },
  resend: async () => { if (!S.pendingEmail) return; const { error } = await sb.auth.resend({ type: 'signup', email: S.pendingEmail, options: { emailRedirectTo: location.origin } }); S.authMsg = error ? { text: authErr(error), err: true } : { text: 'Sent again. It can take a minute to arrive.', err: false }; render(false); },
  'ob-unit': el => { S.ob.unit = S.profile.unit = el.dataset.u; render(false); },
  'ob-pick': el => { const k = el.dataset.k, v = el.dataset.v; S.ob[k] = k === 'days' ? +v : v; S.authMsg = null; buzz(); render(false); },
  'ob-theme': el => { S.ob.theme = el.dataset.t; applyTheme(el.dataset.t); buzz(); render(false); },
  'ob-back': () => { S.ob.step = Math.max(2, S.ob.step - 1); S.authMsg = null; render(true); },
  'ob-next': () => {
    const o = S.ob, bad = t => { S.authMsg = { text: t, err: true }; render(false); };
    if (o.step === 3) { if (!(o.bw >= 30 && o.bw <= 300)) return bad('Enter your bodyweight so bodyweight exercises are scored correctly.'); if (!o.exp) return bad('Pick your experience level.'); }
    if (o.step === 4) { if (!o.goal) return bad('Pick a goal.'); o.tpl = o.tpl || recommendTemplate(o.days, o.exp).id; }
    if (o.step === 5 && !o.tpl) return bad('Pick a split, or choose to build your own.');
    S.authMsg = null; o.step = Math.min(OB_N, o.step + 1); render(true);
  },
  'ob-finish': async el => {
    const o = S.ob, p = S.profile; el.disabled = true;
    const th = o.theme || themePref();
    Object.assign(p, { unit: o.unit, bw: o.bw, bwLog: logBw(p.bwLog, o.bw), exp: o.exp, goal: o.goal, target: o.days, theme: th === 'auto' ? null : th, onboarded: true });
    const { error } = S.local ? (queue('p', 0), { error: null }) : await sb.from('profiles').update(profToDb(p)).eq('id', S.user.id);
    if (error) { p.onboarded = false; el.disabled = false; S.authMsg = { text: 'Couldn’t finish setup. Check your connection and try again.', err: true }; return render(false); }
    if (o.tpl && o.tpl !== 'none') splitFromTemplate(TEMPLATES.find(t => t.id === o.tpl));
    S.authMsg = null; const t = pendingPublic();
    if (t) go('public', t, { replace: true }); else { go('today', null, { replace: true }); setTimeout(() => openTour(), 700); }
    toast(`Welcome to Synergym${p.name ? ', ' + p.name : ''}`);
  }
};
/* app feel on phones: a light haptic tick on key taps (Android; iOS has no web vibration) */
const coarse = matchMedia('(pointer:coarse)');
const BUZZ = new Set(['day-move', 'w-open', 'w-close', 'nav', 'start', 'start-menu', 'start-day', 'resume', 'dash-go', 'unit', 'install']);
const buzz = (ms = 8) => { if (!coarse.matches || reduced) return; try { navigator.vibrate && navigator.vibrate(ms); } catch {} };
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el || el.disabled) return;
  const fn = ACT[el.dataset.act]; if (!fn) return; e.preventDefault(); if (BUZZ.has(el.dataset.act)) buzz();
  const oops = err => { console.error(err); reportError(err && err.message || String(err), err && err.stack); toast('Something went wrong. Try that again.'); };
  try { const r = fn(el, e); if (r && r.catch) r.catch(oops); } catch (err) { oops(err); }
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
    case 'rem-time': if (/^\d{2}:\d{2}$/.test(el.value)) { S.profile.reminderTime = el.value; queue('p', 800); const f = $('#rem-foot'); if (f) f.textContent = `At ${timeText(el.value)}, ${daysText(S.profile.reminderDays).toLowerCase()}. Days you’ve already trained stay quiet.`; } break;
    case 'd-bw': { const v = parseFloat(el.value.replace(',', '.')), kg = unit() === 'lb' ? v / KG_LB : v; const ok = isFinite(kg) && kg >= 30 && kg <= 300; el.classList.toggle('bad', !ok && el.value.trim() !== ''); if (ok) { S.profile.bw = kg; S.profile.bwLog = logBw(S.profile.bwLog, kg); queue('p', 900); } break; }
    case 'pw': { const v = el.value; let sc = 0; if (v.length >= 8) sc++; if (v.length >= 12) sc++; if (/[a-z]/.test(v) && /[A-Z]/.test(v)) sc++; if (/\d/.test(v)) sc++; if (/[^A-Za-z0-9]/.test(v)) sc++;
      const m = $('#pwm'), t = $('#pwt'); if (m) { m.style.width = (sc * 20) + '%'; m.style.background = sc <= 1 ? 'var(--bad)' : sc <= 3 ? 'var(--accent)' : 'var(--good)'; }
      const need = [!/[A-Z]/.test(v) && 'a capital', !/[a-z]/.test(v) && 'a lowercase letter', !/\d/.test(v) && 'a number'].filter(Boolean);
      if (t) t.textContent = !v ? PW_HINT : v.length < 8 ? `${8 - v.length} more character${8 - v.length === 1 ? '' : 's'}` : need.length ? `Add ${need.join(' and ')}` : ['Weak', 'Weak', 'Okay', 'Good', 'Strong', 'Very strong'][sc];
      break; }
    case 'obbw': { const v = parseFloat(el.value.replace(',', '.')); S.ob.bw = isFinite(v) && v > 0 ? (S.ob.unit === 'lb' ? v / KG_LB : v) : null; break; }
    case 'd-name': { const v = el.value.trim().slice(0, 40); if (v) { S.profile.name = v; queue('p', 900); } break; }
    case 'restr': S.profile.rest = +el.value; $('#restv').textContent = 'rest ' + mmss(S.profile.rest * 1000); queue('p', 900); break;
    case 'spname': { if (/\n/.test(el.value)) el.value = el.value.replace(/\s*\n\s*/g, ' '); grow(el); const sp = curSplit(); if (sp) { sp.name = el.value.slice(0, 60) || 'Untitled split'; touchSplit(sp); } break; }
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

/* phones: once the page scrolls, the sticky header shows the page title (native large-title pattern) */
let scT = 0;
addEventListener('scroll', () => { if (scT) return; scT = requestAnimationFrame(() => { scT = 0; document.body.classList.toggle('scrolled', scrollY > 56); }); }, { passive: true });
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
let installEvt = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; });

/* one device at a time: the newest sign-in owns the account. It records its session id on the profile and
   revokes every other session; any other device notices within a minute (or when it comes back to the
   foreground), saves what it still has queued, and signs itself out */
const DEV = { sid: null, t: 0, busy: false };
const jwtSid = s => { try { return JSON.parse(atob(s.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).session_id || null; } catch { return null; } };
async function claimDevice() {
  if (!sb || !S.user || S.local || !DEV.sid) return;
  const { error } = await sb.from('profiles').update({ active_session: DEV.sid }).eq('id', S.user.id);
  if (error) return console.error('Device claim failed', error);
  S.profile.activeSession = DEV.sid;
  sb.auth.signOut({ scope: 'others' }).catch(() => {});
}
async function checkDevice(known) {
  if (!sb || !S.user || S.local || S.syncing || !S.loaded || !DEV.sid || DEV.busy || S.recover) return;
  let a = known;
  if (a === undefined) {
    if (Date.now() - DEV.t < 20000) return; DEV.t = Date.now();
    const { data, error } = await sb.from('profiles').select('active_session').eq('id', S.user.id).maybeSingle();
    if (error || !data) return; a = data.active_session;
  }
  if (!a) return claimDevice();
  if (a !== DEV.sid) leaveDevice();
}
async function leaveDevice() {
  DEV.busy = true;
  flushAll();
  for (const end = Date.now() + 3000; (OB.pending.size || OB.inflight.size) && Date.now() < end;) await sleep(100);
  S.kickMsg = 'You were logged out here because your account was opened on another device.';
  await sb.auth.signOut({ scope: 'local' }).catch(() => {});
  DEV.busy = false;
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkDevice(); });
addEventListener('focus', () => checkDevice());
setInterval(() => { if (document.visibilityState === 'visible') checkDevice(); }, 60000);

/* new version check: when the app comes back to the foreground, compare the deployed bundle with the running one.
   Pull-to-refresh is off, so without this a phone tab could keep running an old build. */
let updT = 0;
async function checkUpdate() {
  if (Date.now() - updT < 60000) return; updT = Date.now();
  try {
    const mine = document.querySelector('script[type="module"][src*="/assets/index-"]')?.getAttribute('src'); if (!mine) return;
    const html = await (await fetch('/', { cache: 'no-store' })).text(), next = (html.match(/\/assets\/index-[^"']+\.js/) || [])[0];
    if (!next || next === mine) return;
    const busy = (S.view === 'session' && activeSession()) || !$('#sheet').hidden || isTyping();
    if (!busy) { flushAll(); setTimeout(() => location.reload(), 400); return; }
    const n = $('#net'); if (n) { n.hidden = false; n.classList.add('upd'); n.textContent = 'Update ready · tap to refresh'; n.onclick = () => { flushAll(); setTimeout(() => location.reload(), 300); }; }
  } catch {}
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkUpdate(); });
addEventListener('focus', checkUpdate);
setInterval(checkUpdate, 10 * 60 * 1000);

/* ================= offline mode (mobile home-screen app) =================
   An offline account keeps everything in IndexedDB on the phone and never talks to the server.
   - New users can start offline from the login screen, with no account.
   - Online users can switch to offline in Settings; their data is copied to the phone.
   - Going online (Settings) logs in or creates an account, merges this phone's data into it (lib/sync.js)
     and uploads it. The phone's copy is only cleared once the upload has finished, so a dropped connection
     or a closed app mid-way leaves everything on the phone and the next attempt picks up again.
   The mode lives in localStorage ('sg-mode') so it is known before anything loads. */
const MODE_KEY = 'sg-mode';
const readMode = () => { try { const m = JSON.parse(localStorage.getItem(MODE_KEY) || 'null'); return m && (m.mode === 'local' || m.mode === 'syncing') ? m : null; } catch { return null; } };
const writeMode = m => { try { m ? localStorage.setItem(MODE_KEY, JSON.stringify(m)) : localStorage.removeItem(MODE_KEY); } catch {} };
/* only where data on the device is safe from the browser clearing it: an installed app on a phone */
const canGoLocal = () => standalone() && coarse.matches;
const LOCAL_USER = { id: 'local', email: null, local: true };
/* keys changed on the phone since it went offline: these are what going online uploads */
const LDIRTY = new Set();
const SYNC_FAILED = [];

async function runLocal(key) {
  const [t, id] = splitKey(key);
  try {
    if (t === 's') { const x = S.sessions.get(id); x ? await ldb.put('sessions', clone(x)) : await ldb.del('sessions', id); }
    else if (t === 'x') { const x = S.library.find(e => e.id === id); x ? await ldb.put('exercises', clone(x)) : await ldb.del('exercises', id); }
    else if (t === 'sp') { const x = S.splits.get(id); x ? await ldb.put('splits', clone(x)) : await ldb.del('splits', id); }
    else if (t === 'p') await ldb.kvSet('profile', clone(S.profile));
    else return { error: null };
    if (!LDIRTY.has(key)) { LDIRTY.add(key); await ldb.kvSet('dirty', [...LDIRTY]); }
    return { error: null };
  } catch (e) { return { error: { message: (e && e.message) || 'Couldn’t save on this phone', code: 'LOCAL' } }; }
}
async function loadLocal() {
  const d = await ldb.loadAllLocal();
  S.profile = { ...DEFAULT_PROFILE, ...(d.profile || {}) };
  S.library = d.exercises.filter(e => e && e.id && e.name).map(e => ({ id: e.id, name: String(e.name).slice(0, 60), muscle: e.muscle || 'Full body', kind: e.kind === 'bw' ? 'bw' : 'w', archived: !!e.archived, isDefault: !!e.isDefault, oneRm: num(e.oneRm), oneRmAt: num(e.oneRmAt) }));
  S.sessions = new Map(d.sessions.map(cleanSession).filter(Boolean).map(x => [x.id, x]));
  S.splits = new Map(d.splits.filter(x => x && x.id).map(x => [x.id, { ...x, days: cleanDays(x.days) }]));
  S.shared = []; S.lastFetch = Date.now();
  LDIRTY.clear(); for (const k of d.dirty) LDIRTY.add(k);
}
/* what both kinds of start do once the data is in memory */
function afterLoad() {
  S.loaded = true; flushAll();
  if (S.profile.theme) applyTheme(S.profile.theme);
  const p = S.profile;
  if (!S.local && p.reminderOn && localTz() && p.tz !== localTz()) { p.tz = localTz(); queue('p', 3000); }
  S.ob = { step: (S.local ? p.name : p.username) ? 3 : 2, name: p.name, username: p.username || '', unit: p.unit, bw: p.bw, exp: p.exp, goal: p.goal, days: p.target || 3, tpl: null, theme: themePref() };
}
async function startLocal() {
  S.local = true; S.user = LOCAL_USER; S.authReady = true; S.loaded = false; S.loadError = null; S.syncFlow = false;
  try { sb && sb.auth.stopAutoRefresh(); } catch {}
  render(false);
  try { await loadLocal(); }
  catch (e) { console.error(e); S.loadError = 'Couldn’t open the data on this phone. Close the app fully and open it again.'; return render(true); }
  restoreOutbox(); afterLoad();
  route(true);
}
/* a brand-new offline account: the starter exercise list, then onboarding */
async function startOfflineNew() {
  if (!canGoLocal()) return toast('Offline use needs the app on your Home Screen');
  if (!(await ldb.localSupported())) return toast('This phone won’t let the app keep data. Create an account instead.');
  try { await navigator.storage?.persist?.(); } catch {}
  const exercises = DEFAULT_EXERCISES.map(([name, muscle, kind]) => ({ id: uuid(), name, muscle, kind, archived: false, isDefault: true, oneRm: null, oneRmAt: null }));
  try { await ldb.replaceAll({ profile: { ...DEFAULT_PROFILE, theme: themePref() === 'auto' ? null : themePref() }, exercises, sessions: [], splits: [], dirty: [] }); }
  catch { return toast('Couldn’t set up storage on this phone. Try again.'); }
  writeMode({ mode: 'local', linked: null, since: Date.now() });
  S.authMsg = null; await startLocal(); buzz();
}
/* online → offline: copy everything to the phone; anything not yet uploaded goes with it */
function goOfflineSheet() {
  if (!canGoLocal()) return toast('Offline use is for the app on your phone’s Home Screen');
  openSheet(`<div class="sh-h"><h3>Use Synergym offline?</h3><button class="btn ghost sm" data-act="close">Close</button></div>
  <div class="off-pts"><p><b>Everything stays on this phone.</b> Your sessions, exercises, splits and settings are copied here, and new workouts are saved here only.</p>
  <p><b>Nothing syncs until you go online.</b> Then you log in, and this phone’s changes are uploaded to your account.</p>
  <p><b>Some things wait for online:</b> sharing splits, reminders and changing your username.</p></div>
  <div class="btns"><button class="btn ghost" data-act="close">Cancel</button><button class="btn" id="off-go">Go offline</button></div>`, r => {
    r.querySelector('#off-go').onclick = async ev => {
      const b = ev.currentTarget; b.disabled = true; b.textContent = 'Copying…';
      if (!(await ldb.localSupported())) { b.disabled = false; b.textContent = 'Go offline'; return toast('This phone won’t let the app keep data, so offline use isn’t available.'); }
      try { await navigator.storage?.persist?.(); } catch {}
      flushAll(); for (const end = Date.now() + 6000; (OB.pending.size || OB.inflight.size) && navigator.onLine && Date.now() < end;) await sleep(150);
      const carry = [...OB.pending, ...OB.inflight], linked = { id: S.user.id, email: S.user.email || null }, oldKey = obKey();
      await reminderOff().catch(() => {});
      try { await ldb.replaceAll({ profile: clone(S.profile), exercises: clone(S.library), sessions: clone([...S.sessions.values()]), splits: clone([...S.splits.values()]), dirty: carry }); }
      catch { b.disabled = false; b.textContent = 'Go offline'; return toast('Couldn’t copy your data to this phone. Nothing changed.'); }
      for (const t of OB.timers.values()) clearTimeout(t); OB.timers.clear(); OB.pending.clear(); OB.failing = false;
      try { localStorage.removeItem(oldKey); } catch {}
      writeMode({ mode: 'local', linked, since: Date.now() });
      LDIRTY.clear(); for (const k of carry) LDIRTY.add(k);
      S.local = true; S.user = LOCAL_USER; try { sb.auth.stopAutoRefresh(); } catch {}
      closeSheet(); render(false); syncUI(); buzz(); toast('You’re offline. Everything is saved on this phone.');
    };
  });
}
/* offline → online: log in or register (or reuse the session this phone still has), then merge and upload */
async function goOnline() {
  if (!navigator.onLine) return toast('You’re not connected. Connect to the internet, then try again.');
  await drainOutbox(5000);
  const m = readMode() || {};
  if (m.linked && sb) {
    try {
      const { data } = await sb.auth.getSession();
      if (data.session && data.session.user.id === m.linked.id) {
        const r = await sb.auth.refreshSession();
        if (!r.error && r.data.session) return syncUp(r.data.session.user);
      }
    } catch {}
  }
  S.syncFlow = true; S.authMode = m.linked ? 'signin' : 'signup'; S.authEmail = m.linked?.email || ''; S.authMsg = null;
  try { sb.auth.startAutoRefresh(); } catch {}
  render(true); scrollTo(0, 0);
}
async function drainOutbox(ms) { flushAll(); for (const end = Date.now() + ms; (OB.pending.size || OB.inflight.size) && Date.now() < end;) await sleep(100); return !OB.pending.size && !OB.inflight.size; }
function syncSheet(text) {
  if ($('#sheet').hidden || !$('#sync-t')) openSheet(`<div class="sync-box"><div class="sync-ring" aria-hidden="true"></div><h3>Going online</h3><p class="muted" id="sync-t"></p></div>`);
  const t = $('#sync-t'); if (t) t.textContent = text;
}
async function syncUp(u) {
  if (S.syncing) return; S.syncing = true; S.syncFlow = false;
  const m = readMode() || { mode: 'local', linked: null };
  const fresh = !m.linked || m.linked.id !== u.id;
  writeMode({ ...m, mode: 'syncing', target: u.id });
  syncSheet('Saving what’s on this phone…');
  try {
    if (!S.loaded || !S.local) { S.local = true; S.user = LOCAL_USER; await loadLocal(); }
    if (!(await drainOutbox(8000))) throw new Error('local-writes');
    const local = { profile: clone(S.profile), library: clone(S.library), sessions: clone([...S.sessions.values()]), splits: clone([...S.splits.values()]), dirty: new Set(LDIRTY) };
    /* from here every save goes to the account */
    S.local = false; S.user = u; DEV.sid = null;
    try { const { data } = await sb.auth.getSession(); if (data.session) DEV.sid = jwtSid(data.session); } catch {}
    syncSheet('Checking your account…');
    let pr = await sb.from('profiles').select('*').eq('id', u.id).maybeSingle(); if (pr.error) throw pr.error;
    if (!pr.data) { pr = await sb.from('profiles').insert({ id: u.id }).select().single(); if (pr.error) throw pr.error; await sb.rpc('restore_default_exercises'); }
    const serverLib = (await fetchAll(() => sb.from('exercises').select('*').order('name'))).map(exFromDb);
    const plan = planSync(local, serverLib, { fresh });
    const server = profFromDb(pr.data);
    S.library = plan.library; S.sessions = new Map(plan.sessions.map(x => [x.id, x])); S.splits = new Map(plan.splits.map(x => [x.id, x]));
    S.profile = { ...plan.profile, username: server.username, activeSession: server.activeSession, onboarded: plan.profile.onboarded || server.onboarded };
    const n = plan.upload.size;
    SYNC_FAILED.length = 0;
    for (const k of plan.upload) { OB.pending.add(k); }
    persistOutbox(); flushAll();
    /* give up (keeping everything on the phone) if a record is rejected, the connection drops, or the server
       keeps failing for 15 seconds */
    let failSince = 0;
    for (const end = Date.now() + 180000; OB.pending.size || OB.inflight.size;) {
      syncSheet(`Uploading ${Math.max(0, n - OB.pending.size - OB.inflight.size)} of ${n}…`);
      if (SYNC_FAILED.length) throw new Error('Rejected: ' + SYNC_FAILED.join(', '));
      if (OB.failing) { failSince = failSince || Date.now(); if (!navigator.onLine || Date.now() - failSince > 15000) throw new Error('upload'); } else failSince = 0;
      if (Date.now() > end) throw new Error('timeout');
      await sleep(250);
    }
    if (SYNC_FAILED.length) throw new Error('Rejected: ' + SYNC_FAILED.join(', '));
    syncSheet('Almost done…');
    await loadAll();
    await ldb.clearLocal(); writeMode(null); LDIRTY.clear();
    S.loaded = true; S.syncing = false; claimDevice();
    closeSheet(); go('today', null, { replace: true });
    const ns = [...plan.upload].filter(k => k.startsWith('s:')).length;
    toast(ns ? `You’re online. ${plural(ns, 'session')} synced.` : 'You’re online. Everything is in sync.');
    if (!S.profile.username) setTimeout(() => changeUsername(true), 900);
  } catch (e) {
    console.error(e); reportError('Go online failed: ' + (e && e.message), e && e.stack);
    for (const t of OB.timers.values()) clearTimeout(t); OB.timers.clear(); OB.pending.clear(); OB.failing = false;
    try { if (S.user && !S.user.local) localStorage.removeItem('sg-outbox-' + S.user.id); } catch {}
    writeMode({ ...m, mode: 'local' });
    S.syncing = false; closeSheet();
    await startLocal();
    toast('Couldn’t finish going online. Everything is still on this phone. Try again with a steady connection.');
  } finally { S.syncing = false; }
}
/* restore missing starter exercises on the phone */
function restoreDefaultsLocal() {
  let n = 0;
  for (const [name, muscle, kind] of DEFAULT_EXERCISES) {
    const e = S.library.find(x => x.name.toLowerCase() === name.toLowerCase());
    if (!e) { const x = { id: uuid(), name, muscle, kind, archived: false, isDefault: true, oneRm: null, oneRmAt: null }; S.library.push(x); queue('x:' + x.id, 0); n++; }
    else if (e.archived && e.isDefault) { e.archived = false; queue('x:' + e.id, 0); n++; }
  }
  render(false); toast(n ? `Restored ${plural(n, 'exercise')}` : 'Your default list is complete');
}
function deleteLocalSheet() {
  openSheet(`<div class="sh-h"><h3>Delete the data on this phone?</h3><button class="btn ghost sm" data-act="close">Close</button></div>
  <p class="muted">This permanently deletes every session, exercise, split and setting stored on this phone. ${readMode()?.linked ? 'Your online account keeps what it had before you went offline.' : 'You have no online account, so nothing else has a copy.'} Export first if you want one. Type DELETE to confirm.</p>
  <div class="form" style="margin-top:14px"><input class="field" id="del-c" autocomplete="off" placeholder="DELETE"></div>
  <div class="btns"><button class="btn line" data-act="export" data-f="json" style="margin-right:auto">Export first</button><button class="btn danger" id="del-go">Delete</button></div>`, r => {
    r.querySelector('#del-go').onclick = async () => {
      if (r.querySelector('#del-c').value.trim() !== 'DELETE') return toast('Type DELETE to confirm');
      await leaveLocal(); toast('Deleted from this phone');
    };
  });
}
/* forget the offline account and go back to the login screen */
async function leaveLocal() {
  for (const t of OB.timers.values()) clearTimeout(t); OB.timers.clear(); OB.pending.clear(); OB.failing = false;
  try { localStorage.removeItem('sg-outbox-local'); } catch {}
  try { await ldb.clearLocal(); } catch {}
  writeMode(null); LDIRTY.clear(); closeSheet();
  resetState(); S.local = false; S.syncFlow = false; S.authMode = 'signin'; S.authMsg = null;
  try { sb && sb.auth.startAutoRefresh(); } catch {}
  go('today', null, { replace: true });
}

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
  afterLoad();
  if (S.claim) { S.claim = false; claimDevice(); } else checkDevice(S.profile.activeSession);
  const t = S.profile.onboarded && pendingPublic();
  if (t) return go('public', t, { replace: true });
  route(true);
}
function boot() {
  setSplashHooks({ render, playEnter });
  /* the service worker lets the app open without a connection and receives reminders */
  if ('serviceWorker' in navigator && import.meta.env.PROD) addEventListener('load', () => navigator.serviceWorker.register('/sw.js').then(r => { if (r && r.active) r.active.postMessage('refresh-shell'); }).catch(() => {}));
  document.body.insertAdjacentHTML('beforeend', '<div id="net" role="status" hidden></div>');
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { if (themePref() === 'auto') render(false); });
  history.replaceState({ d: 0 }, '', location.pathname + location.search + location.hash);
  const mode = readMode();
  /* phones get a quick splash each time the app opens */
  if (coarse.matches && !reduced) quickIn();
  if (mode && mode.mode === 'local') startLocal(); else route(true);
  if (mode && mode.mode === 'syncing') S.pendingSync = mode;
  if (!sb) return;
  sb.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') { S.recover = true; S.authMsg = null; render(false); }
    const u = session?.user || null;
    if (session) DEV.sid = jwtSid(session);
    setTimeout(() => {
      /* offline: the account is ignored, except when going online (or finishing an interrupted go-online) */
      if (S.pendingSync) {
        const m = S.pendingSync; S.pendingSync = null;
        if (u && u.id === m.target) { S.authReady = true; S.local = true; S.user = LOCAL_USER; syncUp(u); }
        else { writeMode({ ...m, mode: 'local' }); startLocal().then(() => toast('Log in again in Settings › Go online to finish syncing.')); }
        return;
      }
      if (S.local || S.syncing) { if (S.syncFlow && u && event === 'SIGNED_IN') syncUp(u); return; }
      /* the splash plays for a sign-in from the login page, not when a reload restores the session */
      const first = !S.authReady; S.authReady = true;
      if (u && (!S.user || S.user.id !== u.id)) { const fresh = event === 'SIGNED_IN' && !first; if (fresh) splashIn(); resetState(); S.user = u; S.claim = fresh; startApp(); }
      else if (u) { S.user = u; }
      else if (!u && S.user) { resetState(); S.recover = false; S.authMode = 'signin'; S.authMsg = S.kickMsg ? { text: S.kickMsg, err: false } : null; S.kickMsg = null; go('today', null, { replace: true }); }
      else render(first);
    }, 0);
  });
}
boot();
