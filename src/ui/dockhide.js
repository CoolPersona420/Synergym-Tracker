/* The phone dock, and the session bar in a session, step aside while you scroll down a page and come back the moment
   you scroll up. They also come back when you stop scrolling for a moment, at the top and the end of a page, and on
   every page change. Nothing hides while a sheet is open, while linking sets or editing a past session (those bars
   are what you're doing), or on a computer.
   Only the state is set here (body.dock-away, and --dock-h, how far down is out of sight); the CSS slides the bars
   with `translate` transitions, which the browser runs on its compositor, so they stay smooth however busy the page
   is. A turn of direction mid-slide reverses from wherever the bar is. */
export function dockAutoHide({ enabled }) {
  let y0 = scrollY, run = 0, idle = 0, away = false, reachPx = 120;
  const root = document.documentElement, body = document.body;
  /* from the top of the highest bar part on screen (the + and its label sit above the dock) to below the bottom */
  const reach = () => {
    let top = Infinity;
    for (const el of document.querySelectorAll('#nav, #nav .ring, #nav .nl, .transport')) {
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || +cs.opacity === 0) continue;
      const r = el.getBoundingClientRect();
      if (r.height && r.top < innerHeight) top = Math.min(top, r.top);
    }
    return top === Infinity ? 0 : Math.ceil(innerHeight - top + 18);
  };
  /* the top and the end of a page: near the end means within the bars' own height of it, so the last of the page is
     never left without them. A phone can arrive at the end with no scroll event at the very bottom (its toolbar
     resizing the screen, or the bounce), so this is checked again when scrolling settles, the screen resizes or a
     finger lifts */
  const atEdge = () => { const y = scrollY; return y < 56 || y + innerHeight >= root.scrollHeight - Math.max(64, reachPx); };
  const set = a => {
    if (a === away) return;
    if (a) { const h = reach(); if (!h) return; reachPx = h; root.style.setProperty('--dock-h', h + 'px'); }
    away = a; body.classList.toggle('dock-away', a);
  };
  const show = () => { run = 0; clearTimeout(idle); set(false); };
  const recheck = () => { if (away && (!enabled() || atEdge())) show(); };
  addEventListener('scroll', () => {
    const y = scrollY, dy = y - y0; y0 = y;
    if (!enabled() || atEdge()) return show();
    if (!dy) return;
    /* a run of scrolling one way: 24px down hides, 6px up is enough to bring them back */
    run = Math.sign(dy) === Math.sign(run) ? run + dy : dy;
    if (run > 24) set(true); else if (run < -6) set(false);
    clearTimeout(idle); idle = setTimeout(show, 1400);
  }, { passive: true });
  addEventListener('scrollend', recheck);
  addEventListener('touchend', () => setTimeout(recheck, 320), { passive: true });
  addEventListener('resize', recheck);
  if (window.visualViewport) visualViewport.addEventListener('resize', recheck);
  /* a key press into a bar (Tab) brings it back */
  addEventListener('focusin', e => { if (e.target.closest && e.target.closest('.nav,.transport')) show(); });
  return { show };
}
