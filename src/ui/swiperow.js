/* Swipe a row left to open its Delete. The row makes room rather than sliding away: its name keeps its place
   and shortens, the rest moves over, and the Delete pill is uncovered at the right (style.css, driven by --sw:
   0 shut, 1 open). While the finger is down it follows exactly; let go and it eases the rest of the way, frame by
   frame, so it's smooth on every phone (a CSS transition on a custom property isn't, on older iPhones).
   Let go past half way, or flick, and it stays open; anything less springs back. An open row can be pushed
   shut, and a tap anywhere else closes it (that tap does nothing else). Up and down is a scroll, not a swipe.
   Rows are .rsw: the row (.row) and its pill (.rsw-del). */
const ease = t => 1 - Math.pow(1 - t, 4);

export function swipeRows({ W = 126, enabled = () => true, buzz = () => {}, reduced = false }) {
  let g = null, open = null, swallowUntil = 0;
  const raf = new WeakMap();
  const now = el => parseFloat(el.style.getPropertyValue('--sw')) || 0;
  const paint = (el, v) => el.style.setProperty('--sw', v.toFixed(3));
  const stop = el => { cancelAnimationFrame(raf.get(el) || 0); raf.delete(el); };
  /* ease --sw to `to`: 0.24 s for a short way, up to 0.4 s for all of it */
  const glide = (el, to) => {
    stop(el); const from = now(el), d = Math.abs(to - from);
    if (reduced || d < 0.002) return paint(el, to);
    const t0 = performance.now(), dur = 240 + 160 * Math.min(1, d);
    const step = t => { const k = Math.min(1, Math.max(0, (t - t0) / dur)); paint(el, from + (to - from) * ease(k)); if (k < 1) raf.set(el, requestAnimationFrame(step)); else raf.delete(el); };
    raf.set(el, requestAnimationFrame(step));
  };
  const setOpen = (el, on) => { el.classList.toggle('sw-open', on); glide(el, on ? 1 : 0); };
  const close = (anim = true) => { if (!open) return; const el = open; open = null; if (!el.isConnected) return; if (anim) setOpen(el, false); else { stop(el); el.classList.remove('sw-open'); paint(el, 0); } };

  addEventListener('touchstart', e => {
    if (e.touches.length !== 1 || !enabled()) return;
    const el = e.target instanceof Element ? e.target.closest('.rsw') : null;
    /* the open row's Delete does its own job */
    if (open && el === open && e.target.closest('.rsw-del')) return;
    /* another row, or anywhere else: close the open one, and that touch does nothing more */
    if (open && el !== open) { close(); swallowUntil = performance.now() + 600; return; }
    if (!el) return;
    const p = e.touches[0];
    stop(el);
    g = { el, x0: p.clientX, y0: p.clientY, on: false, base: now(el), v: 0, last: [e.timeStamp, p.clientX] };
  }, { passive: true });
  addEventListener('touchmove', e => {
    if (!g) return;
    const p = e.touches[0], dx = p.clientX - g.x0, dy = p.clientY - g.y0;
    if (!g.on) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      /* a scroll, or a swipe right on a shut row: not this */
      if (Math.abs(dy) >= Math.abs(dx) || (dx > 0 && g.base < 0.01)) { g = null; return; }
      g.on = true; g.el.classList.add('drag');
    }
    e.preventDefault();
    const [t0, x0] = g.last; if (e.timeStamp > t0) g.v = (p.clientX - x0) / (e.timeStamp - t0); g.last = [e.timeStamp, p.clientX];
    /* in open units; past fully open it pulls with resistance */
    let v = g.base - dx / W; if (v > 1) v = 1 + Math.pow(v - 1, 0.7) * 0.35; if (v < 0) v = 0;
    paint(g.el, v);
  }, { passive: false });
  const end = () => {
    if (!g) return; const s = g; g = null; s.el.classList.remove('drag');
    /* a tap on the open row shuts it */
    if (!s.on) { if (open === s.el) { close(); swallowUntil = performance.now() + 400; } return; }
    const v = now(s.el), flick = Math.abs(s.v) > 0.35, keep = flick ? s.v < 0 : v > 0.5;
    setOpen(s.el, keep);
    if (keep && open !== s.el) buzz(10);
    open = keep ? s.el : null;
    /* the tap a swipe ends with isn't a tap on the row */
    swallowUntil = performance.now() + 400;
  };
  addEventListener('touchend', end, { passive: true });
  addEventListener('touchcancel', () => { if (g && g.on) { g.el.classList.remove('drag'); setOpen(g.el, open === g.el); } g = null; }, { passive: true });
  document.addEventListener('click', e => {
    if (performance.now() > swallowUntil) return;
    if (e.target instanceof Element && e.target.closest('.rsw-del')) return;
    e.preventDefault(); e.stopImmediatePropagation();
  }, true);
  /* a page that scrolls closes it */
  addEventListener('scroll', () => { if (open && !g) close(); }, { passive: true });
  return { close };
}
