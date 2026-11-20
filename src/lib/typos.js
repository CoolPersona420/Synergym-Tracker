/* Sets that look like typos (GitHub issue #3). A set far beyond what you usually do on an exercise is most likely a
   slip of the thumb: 106 reps for 10, 800 kg for 80. Reps: 30 or more and over three times the exercise's usual
   (the middle of its logged sets); weight: from 40 kg and over two and a half times its heaviest other set. With
   fewer than three other sets to go by, only the extreme counts (100+ reps, 500+ kg). Cardio isn't checked (kindOf
   returns 'c'), warm-ups aren't (they're in it.wu, not it.sets), and a set kept as it is (ok) never again.
   sessions: iterable of { id, items: [{ exId, sets: [{ id, w, r, ok }] }] }. Returns Map set id → { sid, exId,
   kind ('r' or 'w'), v, usual (or null), fix (a likely meant value, or null) }. */
export function findTypos(sessions, kindOf = () => 'w') {
  const base = new Map(), out = new Map(), list = [...sessions];
  for (const s of list) for (const it of s.items) {
    if (kindOf(it.exId) === 'c') continue;
    let b = base.get(it.exId); if (!b) base.set(it.exId, b = { r: [], w: [] });
    for (const st of it.sets) { const r = +st.r || 0; if (r > 0) { b.r.push(r); if (+st.w > 0) b.w.push(+st.w); } }
  }
  for (const b of base.values()) { b.r.sort((x, y) => x - y); b.w.sort((x, y) => x - y); }
  for (const s of list) for (const it of s.items) {
    const b = base.get(it.exId); if (!b) continue;
    for (const st of it.sets) {
      const r = +st.r || 0, w = +st.w || 0; if (st.ok || !(r > 0)) continue;
      const nr = b.r.length - 1, med = b.r[b.r.length >> 1];
      if ((nr >= 3 && r >= 30 && r > 3 * med) || (nr < 3 && r >= 100)) {
        out.set(st.id, { sid: s.id, exId: it.exId, kind: 'r', v: r, usual: nr >= 3 ? med : null, fix: likelyMeant(r, nr >= 3 ? med : null, false) }); continue;
      }
      if (!(w > 0)) continue;
      const nw = b.w.length - 1, top = b.w[b.w.length - 1] === w ? b.w[b.w.length - 2] : b.w[b.w.length - 1];
      if ((nw >= 3 && top > 0 && w >= 40 && w > 2.5 * top) || (nw < 3 && w >= 500))
        out.set(st.id, { sid: s.id, exId: it.exId, kind: 'w', v: w, usual: nw >= 3 ? top : null, fix: likelyMeant(w, nw >= 3 ? top : null, true) });
    }
  }
  return out;
}
/* what was probably meant: the number with one digit left out (or, for a weight, a tenth of it), whichever is
   nearest the usual, between half and twice it; null when there's no usual or no guess is close */
export function likelyMeant(v, usual, weight = false) {
  if (!(usual > 0)) return null;
  const d = String(Math.round(v)), c = [];
  for (let i = d.length - 1; i >= 0; i--) { const x = +(d.slice(0, i) + d.slice(i + 1)); if (x > 0) c.push(x); }
  if (weight) c.push(Math.round(v) / 10);
  let best = null; for (const x of c) if (x >= usual / 2 && x <= usual * 2 && (best == null || Math.abs(x - usual) < Math.abs(best - usual))) best = x;
  return best;
}
