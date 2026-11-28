/* Buttons that feel pressed: a tap leaves a drop of ink that spreads out from under your finger, like sumi ink on
   washi paper, while the button sinks and springs back (the press itself is CSS). --ix/--iy are where you touched,
   --ir how far the ink has to spread to reach the far corner. */
const SEL = '.btn,.chip,.opt,.fab';
export function tactile({ reduced }) {
  if (reduced) return;
  addEventListener('pointerdown', e => {
    const b = e.target.closest && e.target.closest(SEL);
    if (!b || b.disabled || e.button > 0) return;
    const r = b.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    b.style.setProperty('--ix', x + 'px'); b.style.setProperty('--iy', y + 'px');
    b.style.setProperty('--ir', Math.ceil(Math.hypot(Math.max(x, r.width - x), Math.max(y, r.height - y))) + 'px');
    b.classList.remove('ink'); void b.offsetWidth; b.classList.add('ink');
  }, { passive: true });
  addEventListener('animationend', e => { if (e.animationName === 'ink') e.target.classList.remove('ink'); });
}
