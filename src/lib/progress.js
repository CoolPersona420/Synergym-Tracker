/* Next-set suggestions: double progression on the top set.
   A session's history for one exercise is an array of logged sets {w, r} (w in kg, r reps).
   Add weight when last time went at least as well as the time before; otherwise hold the weight and add a rep. */

/* heaviest set with reps; ties go to the one with more reps */
export function topSet(sets) {
  let best = null;
  for (const s of sets || []) {
    const w = +s.w || 0, r = +s.r || 0;
    if (r <= 0) continue;
    if (!best || w > best.w || (w === best.w && r > best.r)) best = { w, r };
  }
  return best;
}

const est = s => s.w * (1 + s.r / 30);

/* history: newest first. opts.bw: bodyweight exercise. opts.step: weight jump in kg. opts.round: snaps a weight in kg
   to what can be loaded. Returns null without history, else { last, next, why } where why is
   'load' (add weight), 'reps' (add a rep), 'repeat' (slipped since the time before) or 'consolidate'
   (later sets fell short at that weight) */
export function suggestNext(history, { bw = false, step = 2.5, round = w => w } = {}) {
  const lastSets = history && history[0], last = topSet(lastSets);
  if (!last) return null;
  const prev = history[1] ? topSet(history[1]) : null;
  if (bw && !last.w) return { last, next: { w: 0, r: last.r + 1 }, why: 'reps' };
  if (prev && est(last) < est(prev) - 1e-9) return { last, next: { w: last.w, r: last.r + 1 }, why: 'repeat' };
  const atTop = lastSets.filter(s => +s.r > 0 && (+s.w || 0) === last.w).map(s => +s.r);
  if (Math.min(...atTop) < last.r - 1) return { last, next: { w: last.w, r: last.r }, why: 'consolidate' };
  if (last.r < 5) return { last, next: { w: last.w, r: last.r + 1 }, why: 'reps' };
  const w = round(last.w + step);
  return { last, next: { w: w > last.w ? w : last.w + step, r: last.r }, why: 'load' };
}
