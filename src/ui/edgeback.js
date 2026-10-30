/* Swipe back from the left edge, as on iPhone, for the app installed on an iPhone: it has no browser back, and
   Safari's own edge swipe doesn't work there. (In a Safari tab, and on Android, the system's back already does
   this, so it's off.) The page follows the finger and a pill names where it goes; letting go past a third of
   the screen, or with a flick, goes back. Anything less springs home. */
import { ICON } from './brand.js';

/* how close to the left edge a back swipe starts (iOS uses about 20pt), and the bars fixed inside a page:
   they're moved themselves, since moving something that holds one would unpin it */
const EDGE = 22, FIXED = '.transport,.savebar,.ob-nav';
const ease = t => 1 - Math.pow(1 - t, 3);

/* canBack(): this page has somewhere to go back to. label(): where that is. onBack(): go there.
   held(): another gesture has the screen. */
export function edgeBack({ view, canBack, label, onBack, held = () => false, reduced = false }) {
  document.body.insertAdjacentHTML('beforeend', `<div id="eb-edge" aria-hidden="true"></div><div id="eb-hint" aria-hidden="true">${ICON.back}<span></span></div>`);
  const edge = document.getElementById('eb-edge'), hint = document.getElementById('eb-hint');
  let g = null, raf = 0, last = null;
  /* each event once: it can reach a handler twice, on the touched element and on the window (see start) */
  const fresh = e => e !== last && !!(last = e);

  const parts = () => {
    const out = [], walk = el => { for (const c of el.children) { if (c.matches(FIXED)) out.push(c); else if (c.querySelector(FIXED)) walk(c); else out.push(c); } };
    walk(view); return out;
  };
  const paint = (els, dx) => {
    const W = innerWidth, k = Math.min(1, dx / 90);
    for (const el of els) el.style.translate = dx ? `${dx.toFixed(1)}px 0` : '';
    edge.style.opacity = dx ? String(Math.max(0, 1 - dx / W)) : '0';
    edge.style.translate = `${(dx - 28).toFixed(1)}px 0`;
    hint.style.opacity = String(k);
    hint.style.transform = `translate(${(-10 + 10 * k).toFixed(1)}px,-50%) scale(${(0.9 + 0.1 * k).toFixed(3)})`;
  };
  const overlays = () => { edge.style.cssText = ''; hint.style.cssText = ''; document.documentElement.classList.remove('eb-on'); };

  function start(e) {
    if (g || raf || e.touches.length !== 1) return;
    const p = e.touches[0];
    if (p.clientX > EDGE || !canBack() || held()) return;
    if (e.target instanceof Element && e.target.closest('.sheet,#tsheet')) return;
    g = { x0: p.clientX, y0: p.clientY, dx: 0, on: false, els: null, trail: [[e.timeStamp, p.clientX]], el: e.target };
    /* only a swipe that starts at the edge listens to moves (and can stop the page scrolling). The touched element
       hears the rest of this finger even if it leaves the page mid-swipe (the launch splash fading out, a redraw),
       when the window no longer does, so it listens there too */
    addEventListener('touchmove', move, { passive: false });
    g.el.addEventListener('touchmove', move, { passive: false });
    g.el.addEventListener('touchend', end, { passive: true });
    g.el.addEventListener('touchcancel', cancel, { passive: true });
  }
  function move(e) {
    if (!g || !fresh(e)) return;
    const p = e.touches[0], dx = p.clientX - g.x0, dy = p.clientY - g.y0;
    if (!g.on) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      /* more down or up than across: a scroll, not a back swipe */
      if (dx <= Math.abs(dy)) return finish(false, true);
      g.on = true; g.els = parts(); hint.querySelector('span').textContent = label();
      document.documentElement.classList.add('eb-on');
    }
    e.preventDefault();
    g.dx = Math.max(0, dx);
    g.trail.push([e.timeStamp, p.clientX]); if (g.trail.length > 5) g.trail.shift();
    paint(g.els, g.dx);
  }
  function end(e) {
    if (!g || !fresh(e)) return;
    if (!g.on) return finish(false, true);
    const [t0, x0] = g.trail[0], [t1, x1] = g.trail[g.trail.length - 1], v = t1 > t0 ? (x1 - x0) / (t1 - t0) : 0;
    finish(g.dx > innerWidth * 0.35 || (v > 0.45 && g.dx > 24));
  }
  function cancel(e) { if (g && fresh(e)) finish(false); }
  function finish(go, quiet = false) {
    removeEventListener('touchmove', move, { passive: false });
    const s = g; g = null;
    if (s) { s.el.removeEventListener('touchmove', move); s.el.removeEventListener('touchend', end); s.el.removeEventListener('touchcancel', cancel); }
    if (quiet || !s || !s.on) return;
    const from = s.dx, to = go ? innerWidth : 0, dur = reduced ? 0 : go ? 220 : 280, t0 = performance.now();
    const done = () => {
      raf = 0; overlays();
      if (!go) { paint(s.els, 0); return; }
      /* the page stays slid out until the next one is drawn over it; if nothing replaces it, put it back */
      onBack();
      setTimeout(() => { for (const el of s.els) if (el.isConnected) el.style.translate = ''; }, 900);
    };
    if (!dur) return done();
    const step = now => {
      const k = Math.min(1, (now - t0) / dur);
      paint(s.els, from + (to - from) * ease(k));
      if (k < 1) raf = requestAnimationFrame(step); else done();
    };
    raf = requestAnimationFrame(step);
  }

  addEventListener('touchstart', start, { passive: true });
  addEventListener('touchend', end, { passive: true });
  addEventListener('touchcancel', cancel, { passive: true });
}
