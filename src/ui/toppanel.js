/* A panel that comes down from the top of the screen: Home's "today" panel.
   - On phones, pulling Home down from the top draws it down under the finger. Let go past a point (or flick
     down) and it springs open; short of that, it springs back up. A pill under its edge says what's coming.
   - Swiping it up closes it, the same way: it follows the finger and springs. Tapping outside closes it too.
   - open() and close() animate it the same way for taps and keys.
   Motion is a damped spring in JS, so it carries the speed of the finger and can be caught mid-flight. */

/* the panel reaches this far above the screen, so a spring's overshoot never shows a gap at the top */
const OVER = 64;
/* resistance past the end of the pull, as in UIScrollView */
const C = 0.55;
const OPEN = { k: 300, z: 0.8 }, SHUT = { k: 360, z: 1 };
/* how far the content trails the panel's edge while it moves (0 slides with it, 1 stays put) */
const PARALLAX = 0.72;

export function topPanel({ content, canPull, hintText, reduced = false, buzz = () => {}, onClose = () => {} }) {
  document.body.insertAdjacentHTML('beforeend', `<div id="tsheet" hidden><div class="tsh-scrim" data-act="top-close"></div>
    <section class="tsh-panel" role="dialog" aria-modal="true" aria-labelledby="tsh-title" tabindex="-1"><div class="tsh-body"></div>
    <div class="tsh-grab" aria-hidden="true"><i></i><span>Swipe up to close</span></div></section></div>
    <div id="pull-hint" aria-hidden="true"><span class="ph-i"><svg class="ico" viewBox="0 0 24 24"><path d="M12 5v14M6 13l6 6 6-6"/></svg></span><span class="ph-t"></span></div>`);
  const root = document.getElementById('tsheet'), panel = root.querySelector('.tsh-panel'), body = root.querySelector('.tsh-body'),
    scrim = root.querySelector('.tsh-scrim'), hint = document.getElementById('pull-hint'), hintT = hint.querySelector('.ph-t');
  let hv = 0, y = 0, v = 0, raf = 0, shown = false, open = false, drag = null, armed = false, back = null;

  const clamp = (a, lo, hi) => Math.min(hi, Math.max(lo, a));
  const band = d => (1 - 1 / (d * C / innerHeight + 1)) * innerHeight;
  /* where the panel's lower edge is (y px down the screen), and everything that follows it */
  const paint = () => {
    const f = clamp(y / (hv || 1), 0, 1);
    panel.style.transform = `translate3d(0,${(y - hv).toFixed(2)}px,0)`;
    /* parallax: the content lags behind the edge, so it is revealed top first rather than sliding in bottom first */
    body.style.transform = f < 1 ? `translate3d(0,${((hv - y) * PARALLAX).toFixed(2)}px,0)` : '';
    body.style.opacity = f < 1 ? clamp(f * 1.6, 0, 1).toFixed(3) : '';
    scrim.style.opacity = f.toFixed(3);
    if (drag && drag.kind === 'pull') {
      hint.style.transform = `translate3d(-50%,${Math.max(0, y).toFixed(1)}px,0)`;
      hint.style.opacity = clamp((y - 8) / 48, 0, 1).toFixed(3);
    }
  };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };
  /* a damped spring from (y, v) to target; small steps keep it steady at any frame rate */
  const spring = (target, { k, z }, done) => {
    stop();
    if (reduced) { y = target; v = 0; paint(); return done && done(); }
    const c = 2 * z * Math.sqrt(k); let last = performance.now();
    const step = now => {
      const dt = Math.min(0.034, (now - last) / 1000); last = now;
      for (let i = 0; i < 4; i++) { const h = dt / 4; v += (-k * (y - target) - c * v) * h; y += v * h; }
      if (Math.abs(y - target) < 0.4 && Math.abs(v) < 8) { y = target; v = 0; paint(); raf = 0; return done && done(); }
      paint(); raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  };
  /* fill the panel and put it, closed, above the screen */
  const prepare = () => {
    if (shown) return;
    const c = content(); body.innerHTML = c.html; body.scrollTop = 0;
    back = document.activeElement;
    root.hidden = false; shown = true; document.body.style.overflow = 'hidden'; document.body.classList.add('top-open');
    hv = panel.offsetHeight - OVER; y = 0; v = 0; paint();
  };
  const opened = () => { open = true; root.classList.add('is-open'); panel.focus({ preventScroll: true }); };
  const hide = () => {
    stop(); root.hidden = true; root.classList.remove('is-open'); shown = open = false; y = 0;
    document.body.classList.remove('top-open'); body.innerHTML = '';
    /* a sheet opened from the panel (starting a session can ask a question) keeps the page locked and the focus */
    const sheet = document.getElementById('sheet'), free = !sheet || sheet.hidden;
    if (free) document.body.style.overflow = '';
    if (free && back && back.focus && document.contains(back)) back.focus({ preventScroll: true }); back = null; onClose();
  };
  const settle = (wantOpen, speed = 0) => { v = speed; if (wantOpen) spring(hv, OPEN, opened); else { open = false; root.classList.remove('is-open'); spring(0, SHUT, hide); } };
  const pillOff = () => { hint.classList.remove('show', 'armed'); hint.style.opacity = '0'; armed = false; };
  /* finger speed over the last ~90 ms, in px/s */
  const speedOf = d => { const s = d.s, a = s[s.length - 1]; let b = a; for (let i = s.length - 1; i >= 0 && a.t - s[i].t < 90; i--) b = s[i]; return a.t > b.t ? (a.y - b.y) / (a.t - b.t) * 1000 : 0; };

  addEventListener('touchstart', e => {
    if (e.touches.length !== 1) { drag = null; return; }
    const p = e.touches[0], at = { x: p.clientX, y: p.clientY, s: [{ y: p.clientY, t: performance.now() }], on: false };
    if (shown) {
      /* the open panel (or the dim area): a swipe up closes it; caught mid-spring, it carries on from there */
      if (!root.contains(e.target)) return;
      stop(); drag = { kind: 'shut', base: y, ...at };
    } else if (canPull(e)) drag = { kind: 'pull', ...at };
    else drag = null;
    /* only a touch that can move the panel holds up the page's scrolling (see rubber.js) */
    removeEventListener('touchmove', move);
    if (drag) addEventListener('touchmove', move, { passive: false });
  }, { passive: true });

  function move(e) {
    if (!drag || e.touches.length !== 1) return;
    const p = e.touches[0], dy = p.clientY - drag.y, dx = p.clientX - drag.x;
    drag.s.push({ y: p.clientY, t: performance.now() }); if (drag.s.length > 12) drag.s.shift();
    if (!drag.on) {
      if (drag.kind === 'pull') {
        /* decide on the first move, before the browser starts its own scroll or bounce */
        if (!(dy > 0 && dy >= Math.abs(dx))) { drag = null; return; }
        prepare(); hintT.textContent = hintText(); hint.classList.add('show');
      } else {
        if (Math.abs(dy) < 3 && Math.abs(dx) < 3) return;
        if (Math.abs(dx) > Math.abs(dy)) { drag = null; return; }
        /* inside the panel its own content scrolls first; the panel moves once that runs out */
        const inBody = body.contains(e.target), end = body.scrollTop + body.clientHeight >= body.scrollHeight - 1;
        if (inBody && ((dy < 0 && !end) || (dy > 0 && body.scrollTop > 0))) { drag = null; return; }
      }
      drag.on = true; stop();
    }
    if (e.cancelable) e.preventDefault();
    const raw = drag.kind === 'pull' ? dy : drag.base + dy;
    y = raw <= hv ? Math.max(0, raw) : hv + band(raw - hv);
    if (drag.kind === 'pull') {
      const need = Math.min(hv * 0.35, 150), on = y >= need;
      if (on !== armed) { armed = on; hint.classList.toggle('armed', on); if (on) buzz(10); }
    }
    paint();
  }

  const end = () => {
    const d = drag; drag = null; if (!d || !d.on) return;
    const sp = speedOf(d);
    if (d.kind === 'pull') { const go = (armed && sp > -300) || sp > 900; pillOff(); settle(go, sp); }
    else settle(!((hv - y > hv * 0.2 && sp < 300) || sp < -700), sp);
  };
  addEventListener('touchend', end, { passive: true });
  addEventListener('touchcancel', () => { if (drag && drag.on) { const k = drag.kind; drag = null; pillOff(); settle(k === 'shut'); } else drag = null; }, { passive: true });

  return {
    open() { if (open) return; prepare(); settle(true); },
    close() { if (shown) settle(false); },
    isOpen: () => shown,
    dragging: () => !!(drag && drag.on)
  };
}
