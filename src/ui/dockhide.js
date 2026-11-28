/* The phone dock follows your scrolling, the way a browser's own toolbar does: scrolling down slides it away a little
   at a time, and any scroll up pulls it back straight away (a bit faster than you scroll). When you stop, it settles
   all the way in or out with a soft ease, and after a moment's pause it comes back by itself. It stays put at the top
   and the end of a page, while a sheet is open, in a session (which has its own bar) and on a computer, where the
   dock is a side rail.
   The offset is the dock's own `translate`, written once per scroll event with no transition (so it tracks the page
   exactly); only the settle animates. body.dock-away marks it fully hidden, and takes away its taps. */
export function dockAutoHide({ nav, enabled, reduced }) {
  let y0 = scrollY, off = 0, H = 0, dir = 0, live = false, endT = 0, idleT = 0, easeT = 0;
  /* how far the dock has to travel to be out of sight: from the top of its highest visible part (the + and its
     label sit above the pill) to below the screen's bottom edge */
  const measure = () => {
    let top = Infinity;
    for (const el of [nav, ...nav.querySelectorAll('.ring,.nl')]) {
      const r = el.getBoundingClientRect();
      if (r.height && getComputedStyle(el).opacity !== '0') top = Math.min(top, r.top);
    }
    H = top === Infinity ? 0 : Math.ceil(innerHeight - top + 16);
  };
  const paint = () => {
    nav.style.translate = off ? `0 ${off.toFixed(1)}px` : '';
    const away = H > 0 && off >= H - 1;
    if (document.body.classList.contains('dock-away') !== away) document.body.classList.toggle('dock-away', away);
  };
  /* glide to a position: a soft deceleration, no bounce */
  const glide = (to, ms = 340) => {
    live = false; off = to; clearTimeout(easeT);
    if (reduced) { nav.style.transition = ''; return paint(); }
    nav.style.transition = `translate ${ms}ms cubic-bezier(.22,.8,.24,1)`;
    paint();
    easeT = setTimeout(() => { if (!live) nav.style.transition = ''; }, ms + 60);
  };
  const show = ms => { clearTimeout(endT); clearTimeout(idleT); if (off) glide(0, ms); };
  const settle = () => glide(dir < 0 || off < H * 0.4 ? 0 : H, 300);

  addEventListener('scroll', () => {
    const y = scrollY, dy = y - y0; y0 = y;
    if (!enabled()) return show();
    const end = document.documentElement.scrollHeight - innerHeight;
    if (y < 56 || y > end - 32) return show(260);
    if (!dy) return;
    if (!live) { if (!off) measure(); if (!H) return; live = true; clearTimeout(easeT); nav.style.transition = 'none'; }
    dir = Math.sign(dy);
    off = Math.min(H, Math.max(0, off + (dy < 0 ? dy * 1.6 : dy)));
    paint();
    clearTimeout(endT); endT = setTimeout(settle, 130);
    clearTimeout(idleT); idleT = setTimeout(() => show(), 1400);
  }, { passive: true });
  /* a key press into the dock (Tab) brings it back */
  addEventListener('focusin', e => { if (e.target.closest && e.target.closest('.nav')) show(); });
  return { show };
}
