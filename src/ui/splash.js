/* The login splash: the mascot glides in from the login page, its eyes flare, then it lunges and the app
   appears through its eye. The app passes in how to render and how to play its entrance. */
import { $ } from '../lib/util.js';
import { reduced } from '../lib/env.js';
import { WOLF } from './brand.js';

const hooks = { render: () => {}, playEnter: () => {} };
export const setSplashHooks = h => Object.assign(hooks, h);

/* splash: the mascot after logging in (not on a reload), then the wolf lunges and the app appears through its eye */
export const SPL = { el: null, t0: 0, leaving: false, hold: false, dirty: false, dirtyEnter: false, hand: false }, HAND = 700;
export const wolfPath = c => (WOLF.match(new RegExp(`class="${c}" d="([^"]+)"`)) || [])[1] || '';
export const WOLF_BODY = wolfPath('w-body'), WOLF_EYES = wolfPath('w-eyes'), WOLF_NOSE = wolfPath('w-nose');
/* the right eye on its own, with its incentre and inradius: scaled about that point, its edges move in evenly.
   EYE_BODY is how far that point sits from the edge of the body (stroke included) */
export const EYE = [[212, 220], [280, 188], [268, 212]], EYE_D = 'M212 220 L280 188 L268 212 Z', EYE_IX = 262.8, EYE_IY = 204.79, EYE_R = 7.871, EYE_BODY = 63;
export function splashIn() {
  if (SPL.el) return;
  quickDrop();
  const el = document.createElement('div');
  el.id = 'splash'; el.setAttribute('aria-hidden', 'true');
  /* the stage is a full-screen copy of the wolf for the lunge; a clip-path cuts the eye-shaped hole that reveals the app */
  const glow = id => `<path class="w-glow" d="${WOLF_EYES}" filter="url(#${id})"/>`;
  const blur = id => `<filter id="${id}" x="-60%" y="-120%" width="220%" height="340%"><feGaussianBlur stdDeviation="7"/></filter>`;
  el.innerHTML = `<div class="spl-stage"><svg class="spl-bg"><defs>${blur('spl-glow-c')}</defs><g class="spl-cam wolf-t"><path class="w-body" d="${WOLF_BODY}" stroke-width="16" stroke-linejoin="miter"/><path class="spl-shade" d="${WOLF_BODY}" stroke-width="16" stroke-linejoin="miter"/><path class="w-nose" d="${WOLF_NOSE}"/>${glow('spl-glow-c')}<path class="w-eyes" d="${WOLF_EYES}"/></g><g class="spl-hot"><path class="a" d="${EYE_D}"/><path class="b" d="${EYE_D}"/></g></svg></div><svg class="spl-echo" viewBox="44 40 312 330"><path d="${WOLF_BODY}"/><path class="b" d="${WOLF_BODY}"/></svg>
  <div class="spl-in"><span class="spl-mask"><svg class="wolf wolf-t spl-wolf" viewBox="44 40 312 330"><defs>${blur('spl-glow')}</defs>${WOLF.replace('<path class="w-eyes"', glow('spl-glow') + '<path class="w-eyes"')}</svg></span><span class="spl-mask spl-word"><span class="wordmark">${[...'SYNERGYM'].map((c, i) => `<i style="--i:${i}">${c}</i>`).join('')}</span></span></div>`;
  /* after signing in, the splash starts from the mascot on the login page */
  const from = !reduced && $('.auth-logo .lockup');
  SPL.hand = !!(from && from.getBoundingClientRect().width);
  if (SPL.hand) el.classList.add('handoff');
  document.body.appendChild(el);
  SPL.el = el; SPL.t0 = performance.now(); SPL.leaving = false;
  if (SPL.hand) splashHandoff(el, from);
  setTimeout(() => { if (SPL.el === el && !SPL.leaving) splashOut(); }, 10000);
}
/* the login page's wolf and wordmark glide to the middle and grow into the splash lockup while the page fades out behind them */
export function splashHandoff(el, from) {
  const pairs = [[$('.wolf', from), el.querySelector('.spl-wolf')], [$('.wordmark', from), el.querySelector('.spl-word .wordmark')]];
  for (const [a, b] of pairs) {
    if (!a || !b) continue;
    const r = a.getBoundingClientRect(), q = b.getBoundingClientRect(), box = b.parentElement, m = box.getBoundingClientRect();
    box.style.transformOrigin = `${q.left + q.width / 2 - m.left}px ${q.top + q.height / 2 - m.top}px`;
    box.animate([{ transform: `translate(${r.left + r.width / 2 - (q.left + q.width / 2)}px, ${r.top + r.height / 2 - (q.top + q.height / 2)}px) scale(${r.width / q.width})` }, { transform: 'none' }], { duration: HAND, easing: 'cubic-bezier(.65,0,.25,1)' });
  }
  el.querySelector('.spl-stage').animate([{ opacity: 0 }, { opacity: 1 }], { duration: HAND * .75, easing: 'cubic-bezier(.4,0,.2,1)' });
  from.style.visibility = 'hidden';
  SPL.hold = true;
  setTimeout(() => {
    SPL.hold = false;
    if (SPL.dirty) { const e = SPL.dirtyEnter; SPL.dirty = SPL.dirtyEnter = false; hooks.render(e); }
  }, HAND);
}
/* where the drawn wolf's viewBox lands on screen (xMidYMid meet) */
export function splashFit(el) {
  const r = el.querySelector('.spl-wolf').getBoundingClientRect();
  if (!r.width) return null;
  const s = Math.min(r.width / 312, r.height / 330);
  return { s, ox: r.left + (r.width - 312 * s) / 2 - 44 * s, oy: r.top + (r.height - 330 * s) / 2 - 40 * s };
}
/* reveal: the eyes flare with a jolt and a shockwave, then the wolf lunges at the screen.
   Only reduced motion and data saver get the plain lift instead: it is all vector work, and device hints
   (cores, memory) are randomised by privacy browsers such as Brave */
export function splashOut() {
  if (SPL.leaving) return; SPL.leaving = true;
  const el = SPL.el, wait = Math.max(0, (reduced ? 400 : SPL.hand ? HAND + 120 : 650) - (performance.now() - SPL.t0));
  const finish = () => { el.remove(); if (SPL.el === el) { SPL.el = null; SPL.leaving = false; } };
  setTimeout(() => {
    const c = navigator.connection, plain = reduced || !!(c && c.saveData);
    const f = !plain && el.querySelector('.spl-cam') && splashFit(el);
    if (!f) { el.classList.add('out'); hooks.playEnter($('#view')); setTimeout(finish, 1000); return; }
    const r = el.querySelector('.spl-wolf').getBoundingClientRect();
    Object.assign(el.querySelector('.spl-echo').style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    el.classList.add('wake');
    setTimeout(() => splashConsume(el, finish), 420);
  }, wait);
}
/* the lunge, in four beats:
   crouch  - it pulls back
   lunge   - it springs at the screen, faster and faster, until its body blacks out the view with the eye in the middle
   impact  - a short shake while the eye burns
   tear    - the eye rips open from its centre with a hot rim and the app is behind it */
export function splashConsume(el, done) {
  const f = splashFit(el), stage = el.querySelector('.spl-stage'), cam = el.querySelector('.spl-cam'), hot = el.querySelector('.spl-hot');
  if (!f || !stage || !cam) { hooks.playEnter($('#view')); return done(); }
  const [hotA, hotB] = hot.children, shade = cam.querySelector('.spl-shade'), nose = cam.querySelector('.w-nose'), glowEl = cam.querySelector('.w-glow');
  const W = innerWidth, H = innerHeight, cx = W / 2, cy = H / 2, R = Math.hypot(cx, cy);
  const s0 = f.s, ix0 = f.ox + EYE_IX * s0, iy0 = f.oy + EYE_IY * s0;
  /* sc: crouched; sb: the body just covers the screen; s1: the opened eye covers the screen */
  const sc = s0 * .86, sb = Math.max(sc * 2, R / EYE_BODY * 1.08), s1 = R / EYE_R * 1.06;
  const C = 170, L = 400, B = 130, T = 560, D = C + L + B + T;
  const smooth = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
  const io = t => t < .5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
  const px = (x, y) => `${x.toFixed(1)}px ${y.toFixed(1)}px`;
  let entered = false;
  const t0 = performance.now();
  const frame = now => {
    const t = Math.min(D, now - t0);
    let s, m = 1, dark = 1, open = 0, w = 14, jx = 0, jy = 0;
    if (t < C) { s = s0 * (1 - .14 * Math.sin(t / C * Math.PI / 2)); m = 0; dark = 0; }
    else if (t < C + L) {
      const u = (t - C) / L;
      s = sc * Math.pow(sb / sc, u ** 2.4); m = smooth(u / .8); dark = smooth((u - .35) / .5);
    } else if (t < C + L + B) {
      const v = (t - C - L) / B, a = 7 * (1 - v) ** 2;
      s = sb * (1 + .05 * v); jx = Math.sin(v * 26) * a; jy = Math.cos(v * 20) * a * .6;
    } else {
      const v = (t - C - L - B) / T, e = io(v);
      s = sb * 1.05 * Math.pow(s1 / (sb * 1.05), e); open = smooth(v / .45); w = 14 * (1 - smooth((v - .75) / .25));
    }
    /* the eye drifts to the middle of the screen as the wolf closes in */
    const x = ix0 + (cx - ix0) * m + jx, y = iy0 + (cy - iy0) * m + jy, tx = x - EYE_IX * s, ty = y - EYE_IY * s;
    cam.setAttribute('transform', `translate(${tx} ${ty}) scale(${s})`);
    const k = Math.max(0, open * (1 - w / (EYE_R * s)));
    if (k > 0) {
      /* the screen minus the eye: the triangle runs against the outer edge, so the nonzero rule leaves it empty */
      const p = EYE.map(([a, b]) => [tx + (EYE_IX + (a - EYE_IX) * k) * s, ty + (EYE_IY + (b - EYE_IY) * k) * s]);
      stage.style.clipPath = `polygon(0px 0px, 0px ${H}px, ${px(...p[0])}, ${px(...p[1])}, ${px(...p[2])}, ${px(...p[0])}, 0px ${H}px, ${W}px ${H}px, ${W}px 0px)`;
      hot.setAttribute('transform', `translate(${tx + EYE_IX * s * (1 - k)} ${ty + EYE_IY * s * (1 - k)}) scale(${s * k})`);
      hot.style.opacity = Math.min(1, open * 1.6) * (1 - smooth((t - D + 160) / 160));
      hotA.setAttribute('stroke-width', 30 / (s * k)); hotB.setAttribute('stroke-width', 5 / (s * k));
      if (!entered) { entered = true; hooks.playEnter($('#view')); }
    } else hot.style.opacity = 0;
    shade.style.opacity = dark;
    nose.style.opacity = 1 - smooth((t - C) / (L * .4));
    const go = .85 * (1 - smooth((t - C) / (L * .3)));
    glowEl.style.opacity = go; glowEl.style.display = go ? '' : 'none';
    if (t < D) requestAnimationFrame(frame); else { if (!entered) hooks.playEnter($('#view')); done(); }
  };
  frame(t0); el.classList.add('consume');
  requestAnimationFrame(frame);
}

/* the quick splash when the app opens on a phone: the mascot wakes, then zooms past as the app fades in.
   It waits for the first screen to be ready, but never longer than 3 seconds. */
export const QS = { el: null, t0: 0 };
export function quickIn() {
  if (QS.el || SPL.el) return;
  const el = document.createElement('div');
  el.id = 'qsplash'; el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `<div class="qs-in"><svg class="wolf wolf-t" viewBox="44 40 312 330">${WOLF}</svg><span class="wordmark">SYNERGYM</span></div>`;
  document.body.appendChild(el);
  QS.el = el; QS.t0 = performance.now();
  setTimeout(() => quickOut(), 3000);
}
export function quickOut() {
  const el = QS.el; if (!el || el.dataset.out) return; el.dataset.out = '1';
  const wait = Math.max(0, 750 - (performance.now() - QS.t0));
  setTimeout(() => {
    el.classList.add('out'); hooks.playEnter($('#view'));
    setTimeout(() => { el.remove(); if (QS.el === el) QS.el = null; }, 560);
  }, wait);
}
export function quickDrop() { if (QS.el) { QS.el.remove(); QS.el = null; } }
