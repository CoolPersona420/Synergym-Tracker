/* A month against the one before it: sessions and volume against the same days of last month (a fair race while
   the month is still going), and strength as each lift's best estimated 1RM this month against its best last
   month, averaged over the lifts trained in both. Sessions come in already cleaned of suspected typos. */
const e1rm = (l, r) => (!(l > 0) || !(r > 0)) ? 0 : r === 1 ? l : l * (1 + r / 30);

/* local midnight on the first of the month that holds t, and the first of the month n months on */
export const monthStart = (t, n = 0) => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth() + n, 1).getTime(); };

/**
 * @param sessions  [{startedAt, items:[{exId, sets:[{w, r, t}]}]}]
 * @param from      the month's first instant (monthStart)
 * @param now       the end of the window (now, or the month's last instant for a finished month)
 * @param opts.loadOf (set, exId) => kg moved (bodyweight added for bodyweight lifts)
 * @param opts.isLift exId => true for a lift that has an estimated 1RM (not cardio)
 */
export function monthSummary(sessions, from, now, { loadOf = st => +st.w || 0, isLift = () => true } = {}) {
  const prevFrom = monthStart(from, -1), elapsed = Math.max(0, now - from), sameTo = Math.min(from, prevFrom + elapsed);
  const logged = s => s.items && s.items.some(it => it.sets.some(st => +st.r > 0 || +st.t > 0));
  const vol = s => s.items.reduce((x, it) => x + it.sets.reduce((y, st) => y + (+st.r > 0 ? (+st.w || 0) * +st.r : 0), 0), 0);
  let count = 0, prevCount = 0, prevSame = 0, v = 0, prevV = 0;
  const best = new Map(), before = new Map();
  for (const s of sessions) {
    if (!logged(s)) continue;
    const t = s.startedAt, here = t >= from && t <= now, prev = t >= prevFrom && t < from;
    if (here) { count++; v += vol(s); }
    if (prev) { prevCount++; if (t < sameTo) { prevSame++; prevV += vol(s); } }
    const bucket = here ? best : prev ? before : null;
    if (!bucket) continue;
    for (const it of s.items) {
      if (!isLift(it.exId)) continue;
      for (const st of it.sets) { const e = e1rm(loadOf(st, it.exId), +st.r); if (e > (bucket.get(it.exId) || 0)) bucket.set(it.exId, e); }
    }
  }
  const lifts = [];
  for (const [exId, to] of best) { const was = before.get(exId); if (was > 0) lifts.push({ exId, from: was, to, pct: (to / was - 1) * 100 }); }
  lifts.sort((a, b) => b.pct - a.pct);
  const strength = lifts.length ? lifts.reduce((x, l) => x + l.pct, 0) / lifts.length : null;
  return { from, prevFrom, count, prevCount, prevSame, vol: v, prevVol: prevV, volPct: prevV > 0 ? (v / prevV - 1) * 100 : null, strength, lifts };
}
