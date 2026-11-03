/* Cleaning data that comes from storage, the network or an imported file. */
import { sid } from './util.js';
import { cleanMetrics } from './cardio.js';

/* a number, or null for anything missing: +null and +'' are 0, which turned a set's empty weight and reps into
   0 kg × 0 whenever a session was loaded */
export const num = v => { if (v == null || v === '' || typeof v === 'boolean') return null; v = +v; return isFinite(v) ? v : null; };
export const safeId = v => String(v || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40) || sid();
export function cleanSet(o) {
  if (!o || typeof o !== 'object') return null;
  let w = num(o.w), r = num(o.r); const pw = num(o.pw), pr = num(o.pr), done = !!o.done;
  /* a set not yet done with 0 reps is an empty set (saved as zeros by the bug above): empty again, so it shows
     last time's numbers as hints */
  if (!done && r === 0) { r = null; if (w === 0) w = null; }
  const out = { id: safeId(o.id), w: w == null ? null : Math.max(0, w), r: r == null ? null : Math.max(0, Math.round(r)), pw, pr, done, g: o.g ? safeId(o.g) : null };
  /* a cardio bout: seconds, metres, heart rate, calories, effort, and the time and distance it was hinted with */
  for (const [k, lo, hi, whole] of CARDIO_FIELDS) { const v = num(o[k]); if (v != null) out[k] = Math.min(hi, Math.max(lo, whole ? Math.round(v) : v)); }
  return out;
}
const CARDIO_FIELDS = [['t', 0, 86400, true], ['pt', 0, 86400, true], ['d', 0, 1e6, false], ['pd', 0, 1e6, false], ['hr', 30, 250, true], ['kc', 0, 20000, true], ['e', 1, 10, true]];
/* exercise kinds: weighted, bodyweight, cardio */
export const cleanKind = k => k === 'bw' || k === 'c' ? k : 'w';
export function cleanItem(o) {
  if (!o || typeof o !== 'object' || !o.exId) return null;
  const it = { id: safeId(o.id), exId: safeId(o.exId), sets: Array.isArray(o.sets) ? o.sets.slice(0, 40).map(cleanSet).filter(Boolean) : [] };
  /* the metrics a cardio item shows (time is always there) */
  if (Array.isArray(o.m)) it.m = cleanMetrics(o.m);
  return it;
}
export function cleanSession(o) {
  if (!o || typeof o !== 'object') return null;
  return { id: String(o.id), name: typeof o.name === 'string' && o.name ? o.name.slice(0, 80) : null, startedAt: num(o.startedAt) || Date.now(), endedAt: num(o.endedAt) || null,
    notes: typeof o.notes === 'string' ? o.notes.slice(0, 4000) : '', items: Array.isArray(o.items) ? o.items.slice(0, 60).map(cleanItem).filter(Boolean) : [],
    splitId: o.splitId || null, splitDay: o.splitDay == null ? null : num(o.splitDay) };
}
export function cleanDays(d) {
  if (!Array.isArray(d)) return [];
  return d.slice(0, 14).map(x => ({
    id: safeId(x && x.id), type: String(x?.type || '').slice(0, 40), rest: !!x?.rest, same: !!x?.same,
    exercises: Array.isArray(x?.exercises) ? x.exercises.slice(0, 30).map(e => ({
      id: safeId(e?.id), exId: e?.exId ? String(e.exId).slice(0, 40) : null, name: String(e?.name || 'Exercise').slice(0, 60),
      muscle: String(e?.muscle || 'Full body').trim().slice(0, 30) || 'Full body', kind: cleanKind(e?.kind),
      sets: Math.min(20, Math.max(1, parseInt(e?.sets) || 3)), reps: String(e?.reps ?? '8-12').slice(0, 12), g: e?.g ? safeId(e.g) : null,
      /* cardio: the minutes planned */
      ...(e?.kind === 'c' ? { min: Math.min(600, Math.max(1, parseInt(e?.min) || 30)) } : {})
    })) : []
  }));
}
