/* Swipe a row left to show Delete behind it, as in iPhone lists. Let go past half the button's width and it
   stays open; a tap anywhere else, or on another row, closes it (and that tap does nothing else). Up and down
   is a scroll, not a swipe. Rows are .rsw: the row itself (.row) on top of its delete button (.rsw-del). */
export function swipeRows({ W = 88, enabled = () => true, buzz = () => {}, reduced = false }) {
  let g = null, open = null, swallowUntil = 0;
  const row = el => el.querySelector('.row');
  const set = (el, x, anim) => {
    const r = row(el); if (!r) return;
    r.style.transition = anim && !reduced ? 'transform .28s cubic-bezier(.2,.8,.2,1)' : 'none';
    r.style.transform = x ? `translateX(${x.toFixed(1)}px)` : '';
    el.style.setProperty('--sw', String(Math.min(1, -x / W).toFixed(3)));
    el.classList.toggle('sw-open', x <= -W + 0.5);
    el.classList.toggle('drag', !anim);
  };
  const close = (anim = true) => { if (open) { if (open.isConnected) set(open, 0, anim); open = null; } };

  addEventListener('touchstart', e => {
    if (e.touches.length !== 1 || !enabled()) return;
    const el = e.target instanceof Element ? e.target.closest('.rsw') : null;
    /* the Delete button of the open row does its own job */
    if (open && el === open && e.target.closest('.rsw-del')) return;
    if (open) { close(); swallowUntil = performance.now() + 600; return; }
    if (!el) return;
    const p = e.touches[0];
    g = { el, x0: p.clientX, y0: p.clientY, on: false, x: 0 };
  }, { passive: true });
  addEventListener('touchmove', e => {
    if (!g) return;
    const p = e.touches[0], dx = p.clientX - g.x0, dy = p.clientY - g.y0;
    if (!g.on) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      /* a scroll, or a swipe to the right: not this */
      if (Math.abs(dy) >= Math.abs(dx) || dx > 0) { g = null; return; }
      g.on = true;
    }
    e.preventDefault();
    /* past the button it pulls with resistance */
    let x = Math.min(0, dx); if (x < -W) x = -W - Math.pow(-W - x, 0.75);
    g.x = x; set(g.el, x, false);
  }, { passive: false });
  const end = () => {
    if (!g) return; const s = g; g = null; if (!s.on) return;
    const keep = s.x < -W / 2;
    set(s.el, keep ? -W : 0, true); open = keep ? s.el : null;
    if (keep) buzz(10);
    /* the tap a swipe ends with isn't a tap on the row */
    swallowUntil = performance.now() + 400;
  };
  addEventListener('touchend', end, { passive: true });
  addEventListener('touchcancel', () => { if (g && g.on) set(g.el, 0, true); g = null; }, { passive: true });
  document.addEventListener('click', e => {
    if (performance.now() > swallowUntil) return;
    if (e.target instanceof Element && e.target.closest('.rsw-del')) return;
    e.preventDefault(); e.stopImmediatePropagation();
  }, true);
  /* a page that scrolls or redraws closes it */
  addEventListener('scroll', () => { if (open && !g) close(); }, { passive: true });
  return { close };
}
