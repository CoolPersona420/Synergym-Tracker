/* Personal records, per exercise.
   - Weight PR: heavier than anything lifted on that exercise before (with at least one rep).
   - Rep PR: more reps than ever done at that weight or heavier.
   - Both: heavier than the record weight, and more reps than the record set had.
   Sets are read in the order they were done, so each one is judged against everything before it,
   earlier sets that day included. An exercise's first session sets the baseline and holds no records.
   For bodyweight exercises the weight is the added load, so their rep PRs are most reps at that load. */
const EPS = 1e-6;
export const PR_LABEL = { w: 'Weight PR', r: 'Rep PR', wr: 'Weight + rep PR' };
/* strongest first, for picking one record to show per exercise per session */
export const PR_RANK = { wr: 3, w: 2, r: 1 };

/* reps: the most reps done at each weight (for the rep records table). front: the sets nothing beats on both
   weight and reps, heaviest first, so their reps rise as the weight falls; it stays a handful long and answers
   "most reps at this weight or heavier" without going through every weight ever done. */
const fresh = () => ({ w: -1, wr: 0, wt: 0, wsid: null, maxR: 0, maxRw: 0, maxRt: 0, reps: new Map(), front: [] });
const key = w => Math.round(w * 100) / 100;

/* most reps done at weight w or heavier: the lightest frontier point at or above w */
export function repsAtOrAbove(rec, w) {
  let best = 0; for (const p of rec.front) { if (p.w >= w - EPS) best = p.r; else break; }
  return best;
}
/* add (w, r) to the frontier unless something heavier-or-equal already has as many reps, dropping what it beats */
function addFront(front, w, r) {
  for (const p of front) if (p.w >= w - EPS && p.r >= r) return;
  let i = 0; while (i < front.length && front[i].w > w + EPS) i++;
  let j = i; while (j < front.length && front[j].r <= r) j++;
  front.splice(i, j - i, { w, r });
}
export function classify(rec, w, r) {
  if (!(r > 0) || rec.w < 0) return null;
  if (w > rec.w + EPS) return r > rec.wr ? 'wr' : 'w';
  const best = repsAtOrAbove(rec, w);
  return best > 0 && r > best ? 'r' : null;
}
function add(rec, w, r, s) {
  const k = key(w); if (r > (rec.reps.get(k) || 0)) { rec.reps.set(k, r); addFront(rec.front, k, r); }
  if (w > rec.w + EPS || (Math.abs(w - rec.w) <= EPS && r > rec.wr)) { rec.w = w; rec.wr = r; rec.wt = s.startedAt; rec.wsid = s.id; }
  if (r > rec.maxR) { rec.maxR = r; rec.maxRw = w; rec.maxRt = s.startedAt; }
}

/* sessions oldest first. weightOf(set, session, item) gives the weight a set counts at, or null to leave it out
   (a weighted lift with no weight entered).
   Returns each exercise's records (ex), the record each set set (bySet), every record in order (events),
   and each exercise's records as they stood when a session started (before, keyed "sessionId:exerciseId"). */
export function scanRecords(sessions, { weightOf = st => +st.w || 0 } = {}) {
  const ex = new Map(), bySet = new Map(), events = [], before = new Map();
  for (const s of sessions) {
    const had = new Set();
    for (const it of s.items) if (ex.has(it.exId) && !had.has(it.exId)) { had.add(it.exId); const e = ex.get(it.exId); before.set(s.id + ':' + it.exId, { w: e.w, wr: e.wr, maxR: e.maxR, maxRw: e.maxRw }); }
    for (const it of s.items) for (const st of it.sets) {
      const r = Math.floor(+st.r || 0); if (r <= 0) continue;
      const wv = weightOf(st, s, it); if (wv == null) continue;
      const w = Math.max(0, +wv || 0);
      let e = ex.get(it.exId); if (!e) { e = fresh(); ex.set(it.exId, e); }
      if (had.has(it.exId)) {
        const kind = classify(e, w, r);
        if (kind) { const ev = { exId: it.exId, sid: s.id, setId: st.id, t: s.startedAt, kind, w, r, prevW: e.w, prevWr: e.wr, prevR: repsAtOrAbove(e, w) }; bySet.set(st.id, ev); events.push(ev); }
      }
      add(e, w, r, s);
    }
  }
  return { ex, bySet, events, before };
}

/* one record per exercise per session: the strongest, and the later set on a tie */
export function bestPerSession(events) {
  const m = new Map();
  for (const e of events) { const k = e.sid + ':' + e.exId, o = m.get(k); if (!o || PR_RANK[e.kind] >= PR_RANK[o.kind]) m.set(k, e); }
  return [...m.values()];
}

/* the heaviest weights done, each with its most reps: the "rep records" table */
export function repTable(rec, n = 5) {
  return rec ? [...rec.reps].sort((a, b) => b[0] - a[0]).slice(0, n).map(([w, r]) => ({ w, r })) : [];
}
