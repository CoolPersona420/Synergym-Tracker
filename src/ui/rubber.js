/* iOS-style rubber banding at the top and bottom of the page, on phones.
   - iOS does this itself, so there the browser's own overscroll is simply switched back on (html.ios).
   - Elsewhere (Android) the page content follows the finger past either end with growing resistance and
     springs back on release, and a fling that hits an end bounces. The dock and anything else fixed to the
     screen stays put, as on iOS. */

/* fixed bars that live inside the page; anything holding one isn't moved itself, only its other children */
const FIXED = '.transport,.savebar,.ob-nav';
/* resistance as in UIScrollView, and the stiffness of the (critically damped) spring back, in rad/s */
const C = 0.55, W = 14;

/* held(): another gesture (the today panel) has this touch, so leave it alone */
export function rubberBand(view, { ios = false, reduced = false, held = () => false } = {}) {
  if (ios) { document.documentElement.classList.add('ios'); return; }
  const se = document.scrollingElement || document.documentElement;
  const band = d => (1 - 1 / (d * C / innerHeight + 1)) * innerHeight;
  const unband = o => innerHeight / C * (o / innerHeight) / (1 - o / innerHeight);
  const atTop = () => se.scrollTop <= 0, atEnd = () => se.scrollTop >= se.scrollHeight - se.clientHeight - 1;
  let els = [], x = 0, v = 0, raf = 0, touch = null, down = false, ended = 0, last = null, tgt = null;
  /* each event once: it can reach a handler twice, on the touched element and on the window (see touchstart) */
  const fresh = e => e !== last && !!(last = e);

  const pick = () => {
    const out = [], walk = el => { for (const c of el.children) { if (c.matches(FIXED)) continue; if (c.querySelector(FIXED)) walk(c); else out.push(c); } };
    walk(view); return out;
  };
  const paint = () => { const t = Math.abs(x) < 0.5 ? '' : `0 ${x.toFixed(1)}px`; for (const el of els) el.style.translate = t; };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };
  /* from offset x moving at v (px/s) back to rest; interruptible, frame-rate independent */
  const spring = () => {
    stop(); let last = performance.now();
    const step = now => {
      const t = Math.min((now - last) / 1000, 0.05), e = Math.exp(-W * t), x0 = x, v0 = v; last = now;
      x = (x0 + (v0 + W * x0) * t) * e; v = (v0 - W * (v0 + W * x0) * t) * e;
      if (Math.abs(x) < 0.4 && Math.abs(v) < 20) { x = v = 0; paint(); els = []; raf = 0; return; }
      paint(); raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  };
  /* sheets, sliders, text boxes and the dock (holding + slides up to the Logbook) keep their own touch behaviour */
  const skip = t => !(t instanceof Element) || t.closest('.sheet,textarea,input[type=range],#nav') || document.body.style.overflow === 'hidden';

  addEventListener('touchstart', e => {
    down = true;
    if (e.touches.length !== 1 || skip(e.target)) { touch = null; return; }
    const p = e.touches[0];
    touch = { x: p.clientX, y: p.clientY, lastY: p.clientY, axis: 0, dir: 0, anchor: 0 };
    /* caught while springing back: carry on from where it is */
    const caught = !!(raf && x);
    if (caught) { stop(); v = 0; touch.axis = 1; touch.dir = Math.sign(x); touch.anchor = p.clientY - touch.dir * unband(Math.abs(x)); }
    /* only a touch that starts at an end (or catches a bounce) may need to hold the page still, so only then does
       the browser wait for this listener; every other scroll goes ahead without asking the page first */
    removeEventListener('touchmove', move);
    const passive = !(caught || atTop() || atEnd());
    addEventListener('touchmove', move, { passive });
    /* the touched element hears the rest of this finger even if it leaves the page mid-gesture (a redraw), when
       the window no longer does */
    if (tgt) { tgt.removeEventListener('touchmove', move); tgt.removeEventListener('touchend', end); tgt.removeEventListener('touchcancel', end); }
    tgt = e.target; tgt.addEventListener('touchmove', move, { passive }); tgt.addEventListener('touchend', end, { passive: true }); tgt.addEventListener('touchcancel', end, { passive: true });
  }, { passive: true });

  function move(e) {
    if (!touch || !fresh(e)) return;
    if (held()) { if (x) { x = 0; paint(); } touch = null; return; }
    if (e.touches.length !== 1) { if (x) spring(); touch = null; return; }
    const p = e.touches[0], y = p.clientY;
    if (!touch.axis) {
      const dx = Math.abs(p.clientX - touch.x), dy = Math.abs(y - touch.y);
      if (dx < 6 && dy < 6) return;
      touch.axis = dy >= dx ? 1 : -1;
    }
    if (touch.axis < 0) return;
    if (!touch.dir) {
      /* reaching an end, or starting at one, and pulling past it */
      if (y > touch.lastY && atTop()) touch.dir = 1; else if (y < touch.lastY && atEnd()) touch.dir = -1;
      else { touch.lastY = y; return; }
      touch.anchor = touch.lastY; stop(); if (!els.length) els = pick();
    }
    const d = (y - touch.anchor) * touch.dir;
    /* back inside the page: it scrolls normally again */
    if (d <= 0) { x = 0; paint(); touch.dir = 0; touch.lastY = y; return; }
    /* the browser is already scrolling this gesture and can't be stopped, so reversing lets go */
    if (!e.cancelable && (y - touch.lastY) * touch.dir < 0) { spring(); touch = null; return; }
    if (e.cancelable) e.preventDefault();
    x = band(d) * touch.dir; touch.lastY = y; paint();
  }

  function end(e) { if (!fresh(e)) return; if (touch && x) { v = 0; spring(); } touch = null; down = e.touches.length > 0; ended = performance.now(); }
  addEventListener('touchend', end, { passive: true });
  addEventListener('touchcancel', end, { passive: true });

  /* a fling that runs into an end bounces off it, harder the faster it was going */
  let sy = se.scrollTop, st = 0, sv = 0;
  addEventListener('scroll', () => {
    const now = performance.now(), y = se.scrollTop, dt = now - st, dy = y - sy;
    /* only continuous scrolling counts; a jump (a new page, scrolling to an item) never bounces */
    const steady = dt > 0 && dt < 100 && Math.abs(dy) < innerHeight / 2, vel = steady ? dy / dt * 1000 : 0;
    if (steady && !down && !x && !reduced && now - ended < 3000 && ((dy < 0 && y <= 0) || (dy > 0 && atEnd()))) {
      const speed = Math.min(Math.max(Math.abs(vel), Math.abs(sv)), 2600);
      if (speed > 400) { els = pick(); v = -Math.sign(dy) * speed; spring(); }
    }
    sy = y; st = now; sv = vel;
  }, { passive: true });
}
