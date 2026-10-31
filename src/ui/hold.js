/* Press and hold a button: a capsule rises above it. Slide up into the capsule and let go to open what it holds,
   the way holding Telegram's mic and sliding up locks a recording. Let go early and it springs back; let go without
   sliding and the capsule stays a moment, so it can be tapped instead. A plain tap still does the button's own job.
   side() true (a computer's sidebar): the capsule pops out to the button's right instead, and you drag right.
   Works the same with a finger or a mouse; holding Space on the button raises it from the keyboard. */

const HOLD = 420;

export function holdReveal(btn, { label, icon, open, buzz = () => {}, reduced = false, enabled = () => true, side = () => false }) {
  let timer = 0, start = null, cap = null, knob = null, track = 0, armed = false, hideT = 0, swallow = false, h = false;

  /* above the button when there's room (a phone's +); otherwise (the sidebar's Start session, near the top of the
     window) it grows up from the button itself, its knob sitting over the button, as Telegram's mic does */
  const place = () => {
    const r = (btn.querySelector('.ring') || btn).getBoundingClientRect();
    cap.classList.toggle('h', h);
    if (h) {
      /* beside the button, level with its ring, across the sidebar's edge */
      const b = btn.getBoundingClientRect(), H = Math.max(r.height + 12, 52), W = Math.min(232, innerWidth - b.right - 18);
      Object.assign(cap.style, { left: `${b.right + 10}px`, top: `${r.top + r.height / 2 - H / 2}px`, bottom: '', width: `${W}px`, height: `${H}px` });
      cap.classList.remove('over'); track = cap.clientWidth - knob.offsetWidth - 12; return;
    }
    cap.style.top = '';
    const w = Math.max(r.width, 52), H = 152, room = r.top - 10 - 8 >= H;
    cap.style.left = `${r.left + r.width / 2 - w / 2}px`; cap.style.width = `${w}px`;
    cap.style.bottom = `${room ? innerHeight - r.top + 10 : innerHeight - r.bottom - (w - r.width) / 2}px`;
    cap.style.height = `${room ? H : Math.min(H, r.bottom + (w - r.width) / 2 - 8)}px`;
    cap.classList.toggle('over', !room);
    /* the knob travels to the far end and stops there, inside the pill, with the same inset all round */
    track = cap.clientHeight - knob.offsetHeight - 12;
  };
  const show = () => {
    clearTimeout(hideT);
    if (!cap) {
      cap = document.createElement('button');
      cap.className = 'holdcap'; cap.type = 'button'; cap.setAttribute('aria-label', `Open ${label}`); h = !!side();
      cap.innerHTML = `<span class="hc-up" aria-hidden="true"></span><span class="hc-t">${label}</span><span class="hc-knob" aria-hidden="true">${icon}</span>`;
      cap.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); go(); });
      document.body.appendChild(cap); knob = cap.querySelector('.hc-knob');
    }
    place(); cap.classList.remove('out', 'armed'); knob.style.transform = ''; armed = false;
    void cap.offsetWidth; cap.classList.add('in'); btn.classList.add('holding'); buzz(14);
  };
  const hide = () => {
    clearTimeout(hideT); btn.classList.remove('holding'); if (!cap) return;
    const c = cap; cap = null; knob = null; c.classList.remove('in'); c.classList.add('out');
    setTimeout(() => c.remove(), reduced ? 0 : 260);
  };
  /* follows the finger along the track (up, or right beside a sidebar) and stops at its end, never leaving the
     pill; near the end it arms */
  const drag = dist => {
    const d = Math.max(0, dist), y = Math.min(d, track);
    cap.classList.add('drag'); knob.style.transform = h ? `translateX(${y}px)` : `translateY(${-y}px)`; cap.style.setProperty('--p', Math.min(1, y / track).toFixed(3));
    const on = d >= track * 0.8;
    if (on !== armed) { armed = on; cap.classList.toggle('armed', on); if (on) buzz(10); }
  };
  const go = () => { const c = cap; if (!c) return; cap = null; knob = null; clearTimeout(hideT); btn.classList.remove('holding'); open(c); };
  const reset = () => { clearTimeout(timer); timer = 0; start = null; };

  btn.style.touchAction = 'none';
  btn.addEventListener('contextmenu', e => { if (start || cap) e.preventDefault(); });
  btn.addEventListener('pointerdown', e => {
    swallow = false;
    if (e.button !== 0 || !enabled()) return;
    start = { x: e.clientX, y: e.clientY, id: e.pointerId, shown: false };
    try { btn.setPointerCapture(e.pointerId); } catch {}
    clearTimeout(timer); timer = setTimeout(() => { if (!start) return; start.shown = true; show(); }, HOLD);
  });
  btn.addEventListener('pointermove', e => {
    if (!start || e.pointerId !== start.id) return;
    const dx = e.clientX - start.x, dy = start.y - e.clientY;
    /* moving off before the hold is a slip, not a hold */
    if (!start.shown) { if (Math.hypot(dx, dy) > 12) reset(); return; }
    if (cap) drag(h ? dx : dy);
  });
  const end = cancel => e => {
    if (!start || e.pointerId !== start.id) return;
    const shown = start.shown; reset();
    if (!shown) return;
    swallow = true;
    if (!cancel && armed) return go();
    /* not far enough: back down, and it waits a moment to be tapped */
    if (cap) { cap.classList.remove('armed', 'drag'); cap.style.removeProperty('--p'); knob.style.transform = ''; armed = false; hideT = setTimeout(hide, 3000); }
  };
  btn.addEventListener('pointerup', end(false));
  btn.addEventListener('pointercancel', end(true));
  /* the tap that ends a hold isn't a tap */
  btn.addEventListener('click', e => { if (!swallow) return; swallow = false; e.preventDefault(); e.stopImmediatePropagation(); }, true);
  btn.addEventListener('keydown', e => {
    if (e.key !== ' ' || !e.repeat || cap || !enabled()) return;
    e.preventDefault(); swallow = true; show(); cap.focus();
  });
  btn.addEventListener('keyup', e => { if (e.key === ' ' && swallow) { e.preventDefault(); setTimeout(() => { swallow = false; }); } });
  /* anywhere else closes a waiting capsule */
  addEventListener('pointerdown', e => { if (cap && !cap.contains(e.target) && !btn.contains(e.target)) hide(); }, true);
  addEventListener('scroll', () => { if (cap && !start) hide(); }, { passive: true });
  addEventListener('keydown', e => { if (e.key === 'Escape' && cap) hide(); });

  return { hide };
}
