/* Drag along the dock, as on iPhone: press anywhere on the tabs and slide; the raised circle lifts and follows the
   finger, the tab under it lights up with a light tick as you pass each one, and letting go opens that tab. A
   plain tap still works as a tap. The + beside the tabs keeps its own hold gesture and isn't part of this.
   The circle's place is --nif on the dock (style.css): fractional while dragging, then it settles on a tab. */
export function dockDrag(nav, { enabled = () => true, onPick, buzz = () => {} }) {
  let g = null, swallowUntil = 0;
  const cells = () => [...nav.querySelectorAll('.nav-i')].filter(c => c.offsetWidth > 0);
  /* where the finger is, in tabs: 0 is the first tab's centre, n-1 the last's */
  const at = (x, cs) => {
    const a = cs[0].getBoundingClientRect(), b = cs[cs.length - 1].getBoundingClientRect(), w = (b.right - a.left) / cs.length;
    return Math.max(0, Math.min(cs.length - 1, (x - a.left) / w - 0.5));
  };
  const light = k => g.cs.forEach((c, i) => c.classList.toggle('hot', i === k));

  nav.addEventListener('pointerdown', e => {
    if (g || e.button !== 0 || !enabled() || e.target.closest('.nav-train')) return;
    const cs = cells(); if (cs.length < 2) return;
    g = { id: e.pointerId, x0: e.clientX, cs, on: false, f: 0, last: -1 };
  });
  nav.addEventListener('pointermove', e => {
    if (!g || e.pointerId !== g.id) return;
    if (!g.on) {
      if (Math.abs(e.clientX - g.x0) < 8) return;
      g.on = true; try { nav.setPointerCapture(e.pointerId); } catch {}
      nav.classList.add('drag');
    }
    /* the dock can redraw under the finger (a refresh): find the tabs again */
    if (!g.cs[0].isConnected) g.cs = cells();
    g.f = at(e.clientX, g.cs);
    nav.style.setProperty('--nif', g.f.toFixed(3));
    const k = Math.round(g.f); if (k !== g.last) { g.last = k; light(k); buzz(6); }
  });
  const end = cancel => e => {
    if (!g || e.pointerId !== g.id) return;
    const s = g; g = null; if (!s.on) return;
    const k = Math.round(s.f), cell = s.cs[k];
    s.cs.forEach(c => c.classList.remove('hot'));
    /* the circle settles on the tab (the dock's own easing), and the tap a drag ends with isn't a tap */
    nav.style.setProperty('--nif', k); nav.classList.remove('drag');
    swallowUntil = performance.now() + 450;
    if (!cancel && cell && !cell.classList.contains('on')) onPick(cell);
    setTimeout(() => { if (!g) nav.style.removeProperty('--nif'); }, 600);
  };
  nav.addEventListener('pointerup', end(false));
  nav.addEventListener('pointercancel', end(true));
  nav.addEventListener('click', e => { if (performance.now() < swallowUntil && !e.target.closest('.nav-train')) { e.preventDefault(); e.stopImmediatePropagation(); } }, true);
}
