/* Cardio: the built-in kinds, how a bout's time, distance and pace read, and cardio records.
   A cardio exercise is a library exercise of kind 'c'. Its sets are bouts: t seconds, d metres, hr average heart
   rate, kc calories, e effort 1–10, and pt / pd the time and distance it was hinted with (planned, or last time's).
   Time is always logged; the rest are metrics the user turns on per exercise (an item's m). */

export const MI = 1609.344;
/* how distance is measured and paced: 'road' in km or mi with pace per km or mi, 'ride' the same distance read as
   speed, 'row' metres with pace per 500 m (as on a rowing machine), 'swim' metres with pace per 100 m */
export const CARDIO = [
  { key: 'run', name: 'Run', how: 'road', m: ['d'] },
  { key: 'walk', name: 'Walk', how: 'road', m: ['d'] },
  { key: 'cycle', name: 'Cycle', how: 'ride', m: ['d'] },
  { key: 'row', name: 'Row', how: 'row', m: ['d'] },
  { key: 'elliptical', name: 'Elliptical', how: 'road', m: ['kc'] },
  { key: 'stairs', name: 'Stairs', how: 'road', m: ['kc'] },
  { key: 'swim', name: 'Swim', how: 'swim', m: ['d'] },
  { key: 'rope', name: 'Jump rope', how: 'road', m: ['e'] },
  { key: 'hiit', name: 'HIIT', how: 'road', m: ['e'] }
];
export const METRICS = [['d', 'Distance'], ['hr', 'Heart rate'], ['kc', 'Calories'], ['e', 'Effort']];
const KEYS = METRICS.map(x => x[0]);
export const cleanMetrics = m => Array.isArray(m) ? KEYS.filter(k => m.includes(k)) : null;

const builtIn = name => CARDIO.find(c => c.name.toLowerCase() === String(name || '').trim().toLowerCase()) || null;
/* a cardio exercise's measure: a built-in by name, otherwise guessed from its name ("Assault bike" rides) */
export function howOf(name) {
  const b = builtIn(name); if (b) return b.how;
  const n = String(name || '').toLowerCase();
  return /swim/.test(n) ? 'swim' : /\brow|erg\b/.test(n) ? 'row' : /bike|cycl|spin/.test(n) ? 'ride' : 'road';
}
/* the metrics a new cardio exercise starts with */
export const defaultMetrics = name => (builtIn(name) || { m: ['e'] }).m.slice();

/* time typed as minutes ("30", "30.5"), m:ss ("30:15"), h:mm:ss ("1:05:00") or with h / m ("1h 5m", "45m") */
export function parseTime(raw) {
  const s = String(raw ?? '').trim().toLowerCase().replace(',', '.'); if (!s) return null;
  let v = null, m;
  if ((m = s.match(/^(\d+):(\d{1,2}):(\d{1,2})$/))) v = +m[1] * 3600 + +m[2] * 60 + +m[3];
  else if ((m = s.match(/^(\d+):(\d{1,2})$/))) v = +m[1] * 60 + +m[2];
  else if ((m = s.match(/^(?:(\d+(?:\.\d+)?)\s*h)?\s*(?:(\d+(?:\.\d+)?)\s*m(?:in)?)?$/)) && (m[1] || m[2])) v = (+m[1] || 0) * 3600 + (+m[2] || 0) * 60;
  else if (/^\d+(\.\d+)?$/.test(s)) v = +s * 60;
  return v == null || !isFinite(v) ? null : Math.min(86400, Math.max(0, Math.round(v)));
}
const pad = n => String(n).padStart(2, '0');
/* 30:00, 1:05:00 */
export function fmtDur(sec) {
  if (!(sec > 0)) return ''; sec = Math.round(sec);
  const h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, s = sec % 60;
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
/* 32 min, 1 h 05 */
export function fmtMin(sec) {
  if (!(sec > 0)) return '0 min'; const min = Math.round(sec / 60);
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${pad(min % 60)}`;
}

/* distance unit: metres on the water, otherwise km, or mi for someone who lifts in lb */
export const distUnit = (how, u) => how === 'row' || how === 'swim' ? 'm' : u === 'lb' ? 'mi' : 'km';
const per = du => du === 'm' ? 1 : du === 'mi' ? MI : 1000;
export function fmtDist(m, du) {
  if (!(m > 0)) return '';
  if (du === 'm') return String(Math.round(m));
  return String(Math.round(m / per(du) * 100) / 100);
}
export function parseDist(raw, du) {
  const s = String(raw ?? '').trim().replace(',', '.'); if (!s) return null;
  const v = parseFloat(s); if (!isFinite(v) || v < 0) return null;
  return Math.min(1e6, Math.round(v * per(du) * 10) / 10);
}
/* pace (or speed when riding), from a bout's time and distance; null without both */
export function pace(t, d, how, u) {
  if (!(t > 0 && d > 0)) return null;
  if (how === 'ride') { const du = distUnit(how, u); return { speed: true, v: (d / per(du)) / (t / 3600), unit: du === 'mi' ? 'mph' : 'km/h' }; }
  const step = how === 'row' ? 500 : how === 'swim' ? 100 : per(distUnit(how, u));
  return { speed: false, v: t / (d / step), unit: how === 'row' ? '/500m' : how === 'swim' ? '/100m' : '/' + distUnit(how, u) };
}
export function fmtPace(p) {
  if (!p) return '';
  if (p.speed) return `${Math.round(p.v * 10) / 10} ${p.unit}`;
  const s = Math.round(p.v); return `${Math.floor(s / 60)}:${pad(s % 60)} ${p.unit}`;
}

/* effort 1–10 read on the same scale as a lifting session's intensity (easy under 60, hard from 75, max from 88) */
const EFFORT_INT = [0, 48, 51, 54, 61, 66, 71, 77, 83, 89, 95];
export const effortInt = e => EFFORT_INT[Math.max(0, Math.min(10, Math.round(+e || 0)))];
export const effortWord = e => e >= 9 ? 'Max' : e >= 7 ? 'Hard' : e >= 4 ? 'Moderate' : e > 0 ? 'Easy' : '';

/* the shortest distance a pace record counts from, so a sprint to the door isn't the fastest run */
const FAST_MIN = { road: 1000, ride: 1000, row: 500, swim: 100 };
export const CARDIO_LABEL = { long: 'Longest', far: 'Farthest', fast: 'Fastest' };

/* Records per cardio exercise, read in the order things were done: longest bout, farthest, fastest pace over a
   real distance. As with lifts, the exercise's first session is the baseline and holds no records, and a record
   needs one before it to beat (the first time distance is logged sets it). how(exId): the exercise's measure,
   or null for anything that isn't cardio. */
export function scanCardio(list, how) {
  const ex = new Map(), events = [], bySet = new Map(), bySess = new Map();
  for (const s of list) {
    const tot = { t: 0, d: 0, et: 0, e: 0 };
    for (const it of s.items) {
      const h = how(it.exId); if (!h) continue;
      let r = ex.get(it.exId), st0 = 0, sd0 = 0;
      for (const st of it.sets) {
        const t = +st.t || 0, d = +st.d || 0; if (!(t > 0)) continue;
        if (!r) { r = { long: null, far: null, fast: null, n: 0, t: 0, d: 0, last: 0, pts: [], first: s.id }; ex.set(it.exId, r); }
        const base = r.first === s.id;
        st0 += t; sd0 += d; tot.t += t; tot.d += d; if (+st.e > 0) { tot.et += t; tot.e += +st.e * t; }
        const hit = [], at = { v: 0, t: s.startedAt, sid: s.id, setId: st.id };
        if (!r.long || t > r.long.v) { if (r.long && !base) hit.push(['long', t, r.long.v]); r.long = { ...at, v: t }; }
        if (d > 0 && (!r.far || d > r.far.v)) { if (r.far && !base) hit.push(['far', d, r.far.v]); r.far = { ...at, v: d }; }
        const sp = d >= FAST_MIN[h] ? t / d : 0;
        if (sp > 0 && (!r.fast || sp < r.fast.v)) { if (r.fast && !base) hit.push(['fast', sp, r.fast.v]); r.fast = { ...at, v: sp, t0: t, d0: d }; }
        if (hit.length) { const evs = hit.map(([kind, v, prev]) => ({ exId: it.exId, sid: s.id, setId: st.id, t: s.startedAt, kind, v, prev })); events.push(...evs); bySet.set(st.id, evs); }
      }
      if (r && st0 > 0) { r.n++; r.t += st0; r.d += sd0; r.last = s.startedAt; r.pts.push({ t: s.startedAt, sid: s.id, v: st0, d: sd0 }); }
    }
    if (tot.t > 0) bySess.set(s.id, { t: tot.t, d: tot.d, e: tot.et ? tot.e / tot.et : 0 });
  }
  return { ex, events, bySet, bySess };
}
