/* Bodyweight history and the weekly summary. Pure functions: everything they need is passed in. */

export const dateKey = t => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const keyTime = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d, 12).getTime(); };

/* one entry per day ({d: 'YYYY-MM-DD', kg}), sorted oldest first, most recent 400 kept */
export function cleanBwLog(log) {
  if (!Array.isArray(log)) return [];
  const m = new Map();
  for (const e of log) {
    if (!e || typeof e.d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(e.d)) continue;
    const kg = +e.kg; if (!(kg >= 30 && kg <= 300)) continue;
    m.set(e.d, Math.round(kg * 100) / 100);
  }
  return [...m].sort((a, b) => a[0] < b[0] ? -1 : 1).slice(-400).map(([d, kg]) => ({ d, kg }));
}
export const logBw = (log, kg, t = Date.now()) => cleanBwLog([...(log || []), { d: dateKey(t), kg }]);
export const unlogBw = (log, d) => cleanBwLog((log || []).filter(e => e.d !== d));

/* entries in the last `days` days (all of them for 0), as {t, kg} */
export function bwSeries(log, days, now = Date.now()) {
  const from = days ? now - days * 864e5 : -Infinity;
  return cleanBwLog(log).map(e => ({ t: keyTime(e.d), kg: e.kg })).filter(p => p.t >= from && p.t <= now + 864e5);
}
/* change over the window: latest minus the first entry inside it (null with fewer than two) */
export function bwChange(log, days, now = Date.now()) {
  const s = bwSeries(log, days, now);
  return s.length >= 2 ? Math.round((s[s.length - 1].kg - s[0].kg) * 100) / 100 : null;
}

/* sessions: [{startedAt, items: [{exId, sets: [{w, r}]}]}]. weekFrom: start of this week (ms).
   Returns this week's session count and volume, last week's volume, and the lifts whose top weight this week
   beats the best of the four weeks before, biggest jump first */
export function weekSummary(sessions, weekFrom, now = Date.now()) {
  const wk = 7 * 864e5, lastFrom = weekFrom - wk, lookFrom = weekFrom - 4 * wk;
  const vol = s => s.items.reduce((x, it) => x + it.sets.reduce((y, st) => y + (+st.r > 0 ? (+st.w || 0) * +st.r : 0), 0), 0);
  let count = 0, v = 0, lastV = 0;
  const now_ = new Map(), before = new Map();
  for (const s of sessions) {
    if (!s.items || !s.items.some(it => it.sets.some(st => +st.r > 0))) continue;
    const t = s.startedAt;
    if (t >= weekFrom && t <= now) { count++; v += vol(s); }
    else if (t >= lastFrom && t < weekFrom) lastV += vol(s);
    const bucket = t >= weekFrom && t <= now ? now_ : t >= lookFrom && t < weekFrom ? before : null;
    if (!bucket) continue;
    for (const it of s.items) for (const st of it.sets) {
      const w = +st.w || 0; if (!(+st.r > 0) || w <= 0) continue;
      if (w > (bucket.get(it.exId) || 0)) bucket.set(it.exId, w);
    }
  }
  const gains = [];
  for (const [exId, w] of now_) { const b = before.get(exId); if (b && w > b + 1e-9) gains.push({ exId, from: b, to: w, by: Math.round((w - b) * 100) / 100 }); }
  gains.sort((a, b) => b.by / b.from - a.by / a.from);
  return { count, vol: v, lastVol: lastV, gains };
}
