/* The phone dock steps aside while you scroll down a page, so the page has the whole screen, and comes back as soon
   as you scroll up, reach the top or the end, or stop scrolling for a moment. It never hides while a sheet is open,
   in a session (which has its own bar), or on a computer, where the dock is a side rail. body.dock-away is the
   hidden state; the CSS moves the dock (and the + with it) below the screen. */
export function dockAutoHide({ enabled, reduced }) {
  let y0 = scrollY, run = 0, idle = 0;
  const set = away => { if (document.body.classList.contains('dock-away') !== away) document.body.classList.toggle('dock-away', away); };
  const show = () => { run = 0; clearTimeout(idle); set(false); };
  addEventListener('scroll', () => {
    const y = scrollY, dy = y - y0; y0 = y;
    if (!enabled()) return show();
    const end = document.documentElement.scrollHeight - innerHeight;
    if (y < 56 || y > end - 32) return show();
    /* a run of scrolling one way: 28px down hides it, 12px up brings it back, so small jiggles do nothing */
    run = Math.sign(dy) === Math.sign(run) ? run + dy : dy;
    if (run > 28) set(true); else if (run < -12) set(false);
    clearTimeout(idle); idle = setTimeout(show, reduced ? 600 : 1100);
  }, { passive: true });
  /* a key press into the dock (Tab) brings it back */
  addEventListener('focusin', e => { if (e.target.closest && e.target.closest('.nav')) show(); });
  return { show };
}
