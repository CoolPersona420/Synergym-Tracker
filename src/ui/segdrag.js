/* Slide along a switch (.seg), as on the dock and iPhone's segmented controls: press anywhere on it and slide; the
   pill follows the finger, the option under it lights up with a light tick as you pass each one, and letting go
   picks it. Picking clicks the option, so every switch keeps its own handler. A plain tap is still a tap, and up and
   down still scrolls the page (style.css lets the browser have vertical moves only).
   The pill is the switch's ::before, placed by --x and --w (main.js, fluidApply); while dragging they follow the
   finger. Switches drawn without a pill just light the option under the finger. */
export function segDrag({ enabled = () => true, buzz = () => {} } = {}) {
  let g = null, swallowUntil = 0;
  const buttons = seg => [...seg.querySelectorAll(':scope > button')].filter(b => b.offsetWidth > 0 && !b.disabled);
  /* where the finger is, in options: 0 is the first one's centre, n-1 the last one's */
  const at = (x, g) => {
    const c = g.r.map(r => r.left + r.width / 2), n = c.length;
    if (x <= c[0]) return 0;
    if (x >= c[n - 1]) return n - 1;
    let i = 0; while (x > c[i + 1]) i++;
    return i + (x - c[i]) / (c[i + 1] - c[i]);
  };
  /* the pill for a place f: between two options it blends their place and width */
  const pillAt = (g, f) => {
    const i = Math.min(Math.floor(f), g.bs.length - 2), t = f - i, a = g.bs[i], b = g.bs[i + 1];
    return [a.offsetLeft + (b.offsetLeft - a.offsetLeft) * t, a.offsetWidth + (b.offsetWidth - a.offsetWidth) * t];
  };
  const light = (g, k) => g.bs.forEach((b, i) => b.classList.toggle('hot', i === k));
  const done = g => { g.bs.forEach(b => b.classList.remove('hot')); g.seg.classList.remove('drag'); };

  document.addEventListener('pointerdown', e => {
    /* a new press is a new tap: only the click that ends a slide is ignored */
    swallowUntil = 0;
    if (g || e.button !== 0 || !enabled()) return;
    const seg = e.target instanceof Element ? e.target.closest('.seg') : null; if (!seg) return;
    const bs = buttons(seg); if (bs.length < 2) return;
    g = { id: e.pointerId, seg, bs, x0: e.clientX, y0: e.clientY, on: false, f: 0, k: -1 };
  }, true);
  document.addEventListener('pointermove', e => {
    if (!g || e.pointerId !== g.id) return;
    if (!g.on) {
      const dx = Math.abs(e.clientX - g.x0), dy = Math.abs(e.clientY - g.y0);
      if (dx < 8 && dy < 8) return;
      /* up or down: a scroll, not this */
      if (dy >= dx) { g = null; return; }
      g.on = true; g.r = g.bs.map(b => b.getBoundingClientRect()); g.pill = g.seg.classList.contains('pill');
      try { g.seg.setPointerCapture(e.pointerId); } catch {}
      g.seg.classList.add('drag');
    }
    g.f = at(e.clientX, g);
    if (g.pill) { const [x, w] = pillAt(g, g.f); g.seg.style.setProperty('--x', x + 'px'); g.seg.style.setProperty('--w', w + 'px'); }
    const k = Math.round(g.f); if (k !== g.k) { g.k = k; light(g, k); buzz(6); }
  });
  const end = cancel => e => {
    if (!g || e.pointerId !== g.id) return;
    const s = g; g = null; if (!s.on) return;
    /* the click a drag ends with isn't a tap on an option */
    swallowUntil = performance.now() + 450;
    const pick = cancel ? s.bs.find(b => b.classList.contains('on')) : s.bs[Math.round(s.f)];
    const was = s.bs.find(b => b.classList.contains('on'));
    done(s);
    if (pick && pick !== was) {
      /* the switch is usually drawn again by the click: its pill then glides on from where the finger let go */
      if (s.pill) s.seg.dataset.dragAt = `${pillAt(s, s.f).join(',')}`;
      pick.click();
    }
    /* still here (not drawn again, or nothing changed): the pill settles on the option that is on */
    if (s.seg.isConnected) {
      delete s.seg.dataset.dragAt;
      const on = s.seg.querySelector(':scope > button.on');
      if (s.pill && on) { s.seg.style.setProperty('--x', on.offsetLeft + 'px'); s.seg.style.setProperty('--w', on.offsetWidth + 'px'); }
    }
  };
  document.addEventListener('pointerup', end(false));
  document.addEventListener('pointercancel', end(true));
  document.addEventListener('click', e => {
    if (!e.isTrusted || performance.now() > swallowUntil || !(e.target instanceof Element) || !e.target.closest('.seg')) return;
    e.preventDefault(); e.stopImmediatePropagation();
  }, true);
}
