/* Plate calculator: which plates go on each side of the bar for a target weight. Weights are in the
   user's unit (kg or lb). Greedy from the heaviest plate is exact for standard plate sets. */
export const PLATES = { kg: [25, 20, 15, 10, 5, 2.5, 1.25], lb: [45, 35, 25, 10, 5, 2.5] };
export const BARS = { kg: [20, 15, 10, 0], lb: [45, 35, 25, 0] };

/* returns { side: plates for one side, heaviest first, loaded: total actually on the bar, left: what couldn't
   be loaded, under: the target is lighter than the bar } */
export function platesFor(total, bar, plates) {
  total = +total || 0; bar = +bar || 0;
  if (total <= 0) return { side: [], loaded: 0, left: 0, under: false };
  if (total < bar) return { side: [], loaded: bar, left: 0, under: true };
  let per = (total - bar) / 2;
  const side = [];
  for (const p of [...plates].sort((a, b) => b - a)) while (per >= p - 1e-9) { side.push(p); per -= p; }
  const loaded = bar + 2 * side.reduce((x, p) => x + p, 0);
  return { side, loaded: Math.round(loaded * 100) / 100, left: Math.round((total - loaded) * 100) / 100, under: false };
}

/* "20 + 10 + 2.5" with repeats folded: "2 × 20 + 5" */
export function sideText(side) {
  const out = [];
  for (let i = 0; i < side.length;) { let j = i; while (j < side.length && side[j] === side[i]) j++; out.push((j - i > 1 ? `${j - i} × ` : '') + side[i]); i = j; }
  return out.join(' + ');
}
