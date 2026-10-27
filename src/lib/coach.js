/* The coach: what to lift next, when to rest, when to deload or take a week off, when to change the split,
   and a realistic plan to reach a lift goal. Pure functions over the training log; no UI, no storage.

   The science it leans on, kept simple and on the cautious side:
   - Strength from a set: Epley, e1RM = load × (1 + reps / 30). Sets over 12 reps are left out of strength
     estimates, where the formula overshoots.
   - Load for a target: Epley turned round with reps in reserve (RIR), load = e1RM / (1 + (reps + RIR) / 30),
     so a prescribed set ends about two reps short of failure.
   - Progression: double progression inside a rep range. Hold the weight until every working set reaches
     the top of the range, then add weight and go back to the bottom.
   - Fatigue: training load this week against the usual week (acute:chronic, 7 against 28 days), runs of
     training days, and lifts falling below the lifter's own recent best.
   - Deloads: a lighter week every 4 to 10 weeks of hard training (sooner the more advanced), or straight
     away when several lifts stall or fall together. A full week off after a long stretch with no break, or
     when a deload didn't help.
   - Goals: gains slow with training age. Expected e1RM gains are about 1% a week for beginners, 0.5% for
     intermediates and 0.2% for advanced lifters, blended with the lifter's own measured trend and tapering
     as the months go on. Training runs in 4-week blocks (three building weeks, one deload): volume while the
     goal is far, heavier and fewer reps as it gets close, then a test.

   Input: the log is finished sessions, oldest first: { id, t, splitId, splitDay, items: [{ exId, sets: [{ w, r, load }] }] }
   where w is the weight entered (for bodyweight exercises, the added load) and load is what counts for strength
   (bodyweight plus added load for bodyweight exercises). All weights are in kg. */
import { topSet, suggestNext } from './progress.js';

export const DAY = 864e5, WEEK = 7 * DAY;
export const EXP_RATE = { beginner: 0.01, intermediate: 0.005, advanced: 0.002 };
/* weeks of hard training between deloads */
export const DELOAD_EVERY = { beginner: 10, intermediate: 6, advanced: 5 };
const MAX_STRENGTH_REPS = 12;

export const e1rm = (load, reps) => !(load > 0) || !(reps > 0) ? 0 : reps === 1 ? load : load * (1 + reps / 30);
/* the load for `reps` reps with `rir` reps left in the tank */
export const loadFor = (e1, reps, rir = 2) => e1 > 0 && reps > 0 ? e1 / (1 + (reps + rir) / 30) : 0;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const median = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
/* local calendar day number, so "yesterday" means what the lifter thinks it means */
export const dayNo = t => { const d = new Date(t); return Math.round(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / DAY); };

/* "8-12", "8–12", "5", "10+" → { lo, hi }; anything else (AMRAP, blank) → null */
export function parseRange(reps) {
  const m = String(reps ?? '').trim().match(/^(\d{1,2})\s*(?:[-–—]|to)\s*(\d{1,2})$/i);
  if (m) { const lo = +m[1], hi = +m[2]; return lo > 0 && hi >= lo ? { lo, hi } : null; }
  const one = String(reps ?? '').trim().match(/^(\d{1,2})(\+)?$/);
  if (one && +one[1] > 0) return one[2] ? { lo: +one[1], hi: +one[1] + 2 } : { lo: +one[1], hi: +one[1] };
  return null;
}

/* ---------- per lift ---------- */
/* one point per session for every lift: best strength estimate, top set, working sets. One pass over the log. */
export function seriesByLift(log) {
  const out = new Map();
  for (const s of log) for (const it of s.items) {
    let best = 0, top = null; const sets = [];
    for (const st of it.sets) {
      const r = Math.floor(+st.r || 0), w = +st.w || 0, load = +st.load || w;
      /* no load, no strength data (a weighted set with no weight entered) */
      if (r <= 0 || !(load > 0)) continue;
      sets.push({ w, r, load });
      if (r <= MAX_STRENGTH_REPS) { const v = e1rm(load, r); if (v > best) best = v; }
      if (!top || w > top.w || (w === top.w && r > top.r)) top = { w, r, load };
    }
    if (!sets.length) continue;
    /* only high-rep sets: still a point, at a discount, so the lift isn't invisible */
    if (!best) best = Math.max(...sets.map(x => e1rm(x.load, MAX_STRENGTH_REPS))) * 0.95;
    let p = out.get(it.exId); if (!p) out.set(it.exId, p = []);
    const last = p[p.length - 1];
    /* the same lift twice in one session counts once */
    if (last && last.sid === s.id) { last.sets.push(...sets); if (best > last.e1) last.e1 = best; }
    else p.push({ t: s.t, sid: s.id, e1: best, top, sets });
  }
  return out;
}

/* where a lift stands now: the best of its last three sessions (within 8 weeks). Strength holds for about three
   weeks off, then fades about 1% a week, by 10% at most. A 1RM the lifter saved in the last 6 weeks counts too. */
export function currentE1rm(points, now, saved = null) {
  let v = 0;
  if (points && points.length) {
    const last = points[points.length - 1], recent = points.slice(-3).filter(p => now - p.t <= 8 * WEEK);
    v = recent.length ? Math.max(...recent.map(p => p.e1)) : last.e1;
    const away = (now - last.t) / WEEK;
    if (away > 3) v *= Math.max(0.9, 1 - 0.01 * (away - 3));
  }
  if (saved && saved.kg > 0 && (!saved.at || now - saved.at <= 6 * WEEK)) v = Math.max(v, saved.kg);
  return v;
}

/* the lift's trend in kg a week over the last `weeks` weeks: the median of every pairwise slope (Theil–Sen), so one
   great or awful day doesn't swing it. Needs 4 sessions over 3 weeks. */
export function trend(points, now, weeks = 12) {
  const p = (points || []).filter(x => now - x.t <= weeks * WEEK && x.e1 > 0).slice(-40);
  if (p.length < 4 || p[p.length - 1].t - p[0].t < 3 * WEEK) return null;
  const s = [];
  for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) { const dt = (p[j].t - p[i].t) / WEEK; if (dt >= 0.5) s.push((p[j].e1 - p[i].e1) / dt); }
  return median(s);
}

/* stalled: the last three sessions, over at least 10 days, didn't beat the best before them by 1% */
export function stalled(points, now) {
  const p = (points || []).filter(x => now - x.t <= 10 * WEEK);
  if (p.length < 5) return false;
  const last3 = p.slice(-3), before = p.slice(0, -3);
  if (last3[2].t - last3[0].t < 10 * DAY) return false;
  return Math.max(...last3.map(x => x.e1)) < Math.max(...before.map(x => x.e1)) * 1.01;
}
/* falling: the last two sessions both came in 5% or more under the best of the six weeks before them */
export function falling(points, now) {
  const p = (points || []).filter(x => now - x.t <= 8 * WEEK);
  if (p.length < 4) return false;
  const last2 = p.slice(-2), before = p.slice(0, -2).filter(x => last2[0].t - x.t <= 6 * WEEK);
  if (!before.length) return false;
  const best = Math.max(...before.map(x => x.e1));
  return last2.every(x => x.e1 < best * 0.95);
}
/* lifts that matter for "are things moving": trained at least 4 times in the last 6 weeks */
export function mainLifts(series, now) {
  const out = [];
  for (const [exId, p] of series) if (p.filter(x => now - x.t <= 6 * WEEK).length >= 4) out.push(exId);
  return out;
}

/* ---------- training load ---------- */
/* sets logged per calendar day, worked out once per log, so window counts cost a few additions */
const DAILY = new WeakMap();
function daily(log) {
  let m = DAILY.get(log); if (m) return m;
  m = new Map();
  for (const s of log) { let n = 0; for (const it of s.items) for (const st of it.sets) if (+st.r > 0) n++; const d = dayNo(s.t); m.set(d, (m.get(d) || 0) + n); }
  DAILY.set(log, m); return m;
}
/* sets on days [a, b) */
const setsOn = (m, a, b) => { let n = 0; for (let d = a; d < b; d++) n += m.get(d) || 0; return n; };
/* sets this week against the usual week (the last 28 days). Null until there are three weeks of history. */
export function loadRatio(log, now) {
  if (!log.length || now - log[0].t < 21 * DAY) return null;
  const m = daily(log), today = dayNo(now), acute = setsOn(m, today - 6, today + 1), chronic = setsOn(m, today - 27, today + 1) / 4;
  return chronic >= 6 ? acute / chronic : null;
}
/* how many calendar days in a row ending yesterday (or today) had a session */
export function trainingStreak(log, now) {
  const days = new Set(log.map(s => dayNo(s.t))), today = dayNo(now);
  let d = days.has(today) ? today : today - 1, n = 0;
  while (days.has(d)) { n++; d--; }
  return n;
}
/* the longest run of training days in a split's cycle (a rest day breaks it; the cycle wraps round) */
export function splitRun(days) {
  if (!days || !days.length) return 0;
  const train = days.map(d => !d.rest), n = train.length;
  if (train.every(Boolean)) return n;
  let best = 0, run = 0;
  for (let i = 0; i < 2 * n; i++) { if (train[i % n]) { run++; best = Math.max(best, run); } else run = 0; }
  return Math.min(best, n);
}

/* ---------- today: train, go easy, or rest ---------- */
/* ctx: { now, exp, target (sessions a week), split: { days } | null, lastSplitDay, nextMuscles: [] }
   Returns { call: 'train' | 'easy' | 'rest', reasons: [string], notes: [string] } */
export function readiness(log, series, ctx) {
  const { now } = ctx, reasons = [], notes = [];
  if (!log.length) return { call: 'train', reasons: ['No history yet: train, and the coach learns from every session.'], notes };
  const last = log[log.length - 1], since = dayNo(now) - dayNo(last.t);
  let rest = 0, easy = 0;
  /* a run of training days longer than the split plans (or than recovery allows without a split) */
  const streak = trainingStreak(log, now), planned = ctx.split ? splitRun(ctx.split.days) : 0;
  const cap = Math.max(2, planned || { beginner: 2, intermediate: 3, advanced: 4 }[ctx.exp] || 3);
  if (since <= 1 && streak >= cap) { rest++; reasons.push(`${streak} training days in a row${planned ? `; your split runs ${planned} before a rest` : ''}. Muscles grow on the days off.`); }
  /* the split has a rest day here */
  if (ctx.split && ctx.lastSplitDay != null && since <= 1 && last.splitId === ctx.split.id) {
    const d = ctx.split.days[(ctx.lastSplitDay + 1) % ctx.split.days.length];
    if (d && d.rest) { rest++; reasons.push('Your split has a rest day after the day you trained last.'); }
  }
  /* load spike */
  const ratio = loadRatio(log, now);
  if (ratio != null && ratio >= 1.5) { easy++; reasons.push(`This week's training load is ${Math.round((ratio - 1) * 100)}% above your usual week. Big jumps raise injury risk.`); }
  /* lifts falling below recent best */
  const fell = mainLifts(series, now).filter(id => falling(series.get(id), now));
  if (fell.length >= 2) { easy++; reasons.push(`${fell.length} of your main lifts have been 5% or more under your recent best two sessions running. That's fatigue, not lost strength.`); }
  /* yesterday hit the muscles today's plan needs */
  if (since === 1 && ctx.nextMuscles && ctx.nextMuscles.length) {
    const want = new Set(ctx.nextMuscles.map(m => m.toLowerCase())), hit = new Map();
    for (const it of last.items) { const m = (ctx.muscleOf && ctx.muscleOf(it.exId) || '').toLowerCase(); if (want.has(m)) hit.set(m, (hit.get(m) || 0) + it.sets.filter(x => +x.r > 0).length); }
    const sore = [...hit].filter(([, n]) => n >= 6).map(([m]) => m);
    if (sore.length) { easy++; reasons.push(`Yesterday already gave ${sore.join(' and ')} ${sore.length > 1 ? 'plenty of' : 'a lot of'} work; most muscles need about 48 hours.`); }
  }
  /* coming back */
  if (since >= 14) { easy++; reasons.push(`${since} days since your last session: ease back in at about 90% of your usual weights.`); }
  const wk = log.filter(s => now - s.t < 7 * DAY).length;
  if (ctx.target && wk >= ctx.target && !rest) notes.push(`You've done ${wk} sessions in the last 7 days, your target is ${ctx.target}. More is optional.`);
  if (rest) return { call: 'rest', reasons, notes };
  if (easy) return { call: 'easy', reasons, notes };
  reasons.push(since <= 0 ? 'You trained today. Recover well.' : since === 1 ? 'Trained yesterday, and nothing says you need a rest.' : `Last session ${since} days ago: you're recovered.`);
  return { call: 'train', reasons, notes };
}

/* ---------- deload and week off ---------- */
/* the start of the current unbroken stretch: after the last gap of 6+ days, or after the last light week
   (a 7-day window with under 60% of the sets of the three weeks before it) */
export function lastBreak(log, now) {
  if (!log.length) return null;
  let start = log[0].t, light = null;
  for (let i = 1; i < log.length; i++) if (log[i].t - log[i - 1].t >= 6 * DAY) start = log[i].t;
  /* light weeks: only the last half year matters, and each window is a handful of additions */
  const m = daily(log), today = dayNo(now), first = Math.max(dayNo(start) + 21, today - 182);
  for (let d = first; d <= today - 6; d++) {
    const wk = setsOn(m, d, d + 7), before = setsOn(m, d - 21, d) / 3;
    if (before >= 8 && wk > 0 && wk < before * 0.6) { light = d; start = Math.max(start, (d + 7) * DAY + new Date(now).getTimezoneOffset() * 6e4); }
  }
  return { start, light: light == null ? null : light * DAY };
}
/* ctx: { now, exp }. Returns { status: 'ok' | 'soon' | 'now' | 'rested', kind: 'deload' | 'week-off', weeks, every, reasons } */
export function deloadCheck(log, series, ctx) {
  const { now } = ctx, every = DELOAD_EVERY[ctx.exp] || DELOAD_EVERY.intermediate, reasons = [];
  if (!log.length) return { status: 'ok', kind: 'deload', weeks: 0, every, reasons: ['Nothing logged yet.'] };
  if (now - log[log.length - 1].t >= 10 * DAY) return { status: 'rested', kind: 'deload', weeks: 0, every, reasons: ['You have had a break recently, so no deload is needed. Ease back in.'] };
  const b = lastBreak(log, now), weeks = Math.max(0, Math.floor((now - b.start) / WEEK));
  const main = mainLifts(series, now), stuck = main.filter(id => stalled(series.get(id), now)), fell = main.filter(id => falling(series.get(id), now));
  /* weeks since a lighter week ended: lifts take a week or two to bounce back, so stalls don't count straight after */
  const sinceLight = b.light != null ? (now - b.light) / WEEK - 1 : Infinity;
  if (sinceLight < 2) return { status: 'ok', kind: 'deload', weeks, every, reasons: ['Back from a lighter week. Give your lifts a week or two to bounce back.'], stuck: [], fell: [] };
  const recentLight = sinceLight <= 5;
  let status = 'ok', kind = 'deload';
  if (main.length >= 2 && stuck.length / main.length >= 0.5) { status = 'now'; reasons.push(`${stuck.length} of your ${main.length} main lifts have stalled.`); }
  if (fell.length >= 2) { status = 'now'; reasons.push(`${fell.length} main lifts are falling below your recent best.`); }
  if (weeks >= every) { status = 'now'; reasons.push(`${weeks} weeks of hard training since your last lighter week; about every ${every} is right for you.`); }
  else if (weeks >= every - 1 && status === 'ok') { status = 'soon'; reasons.push(`${weeks} weeks since your last lighter week. Plan one next week.`); }
  /* a full week off: a long unbroken stretch, or a recent deload that didn't fix things */
  if (weeks >= 16) { kind = 'week-off'; status = 'now'; reasons.push(`${weeks} weeks without any break. A full week off is overdue.`); }
  else if (status === 'now' && recentLight && (stuck.length || fell.length)) { kind = 'week-off'; reasons.push('You had a lighter week recently and lifts are still stuck, so a full week off is the better reset.'); }
  if (status === 'ok') reasons.push(`${weeks} of about ${every} weeks into this stretch. Lifts are moving, so keep going.`);
  return { status, kind, weeks, every, reasons, stuck, fell };
}

/* ---------- the split ---------- */
const MAJOR = ['chest', 'back', 'shoulders', 'quads', 'hamstrings', 'glutes'];
/* ctx: { now, split: { id, name, days }, muscleOf, deload }. Returns { status: 'keep' | 'consider' | 'change' | 'none', weeks, sessions, perWeek, reasons, ideas } */
export function splitCheck(log, series, ctx) {
  const { now, split } = ctx;
  if (!split) return { status: 'none', weeks: 0, sessions: 0, perWeek: 0, reasons: ['No split yet. A plan makes progress easier to steer.'], ideas: [] };
  const on = log.filter(s => s.splitId === split.id), reasons = [], ideas = [];
  const weeks = on.length ? Math.floor((now - on[0].t) / WEEK) : 0;
  const recent = log.filter(s => now - s.t <= 28 * DAY), perWeek = Math.round(recent.length / 4 * 10) / 10;
  const trainDays = split.days.filter(d => !d.rest), per = trainDays.length || 1;
  /* how often each muscle gets trained a week, at the rate the lifter actually turns up */
  const freq = new Map();
  for (const d of trainDays) for (const m of new Set(d.exercises.map(e => (e.muscle || '').toLowerCase()).filter(Boolean))) freq.set(m, (freq.get(m) || 0) + perWeek / per);
  const rare = MAJOR.filter(m => freq.has(m) && freq.get(m) < 0.9);
  const missing = MAJOR.filter(m => !freq.has(m) && !(m === 'glutes' && (freq.has('quads') || freq.has('hamstrings'))));
  const main = mainLifts(series, now), stuck = main.filter(id => stalled(series.get(id), now));
  const rising = main.filter(id => { const s = trend(series.get(id), now, 6); return s != null && s > 0; });
  let status = 'keep';
  if (recent.length >= 4 && rare.length >= 2 && per >= 4) {
    status = 'change';
    reasons.push(`At about ${perWeek} sessions a week, a ${per}-day split trains ${rare.join(', ')} less than once a week.`);
    ideas.push(perWeek < 3.5 ? 'A 3-day full-body split hits every muscle about three times a week.' : 'An upper/lower split over four days hits every muscle twice a week.');
  }
  if (weeks >= 8 && main.length >= 2 && stuck.length / main.length >= 0.5 && ctx.deload && ctx.deload.status !== 'now') {
    status = 'change';
    reasons.push(`${weeks} weeks on this split and ${stuck.length} of ${main.length} main lifts have stalled, even outside a deload.`);
    ideas.push('Start a new block: change rep ranges (for example 8–12 to 4–6) or swap in variations (paused or close-grip versions). Keep the lifts you want to get better at.');
  } else if (weeks >= 16 && main.length && rising.length / main.length < 0.5) {
    if (status === 'keep') status = 'consider';
    reasons.push(`${weeks} weeks on this split and fewer than half your main lifts are still climbing.`);
    ideas.push('A new block with different rep ranges or exercise variations usually restarts progress.');
  }
  if (missing.length && trainDays.length) {
    if (status === 'keep') status = 'consider';
    reasons.push(`The split doesn't train ${missing.join(', ')}.`);
    ideas.push(`Add 2–3 exercises for ${missing.join(', ')}: about 10 hard sets a week per muscle is a good target.`);
  }
  if (status === 'keep') {
    if (weeks < 6) reasons.push(on.length ? `${weeks ? `${weeks} week${weeks > 1 ? 's' : ''}` : 'Under a week'} on this split. Give a split 6 to 8 weeks before judging it; hopping too soon costs progress.` : 'You haven’t trained this split yet.');
    else reasons.push(main.length ? `${rising.length} of ${main.length} main lifts are still going up. Stick with it.` : 'Keep logging; the coach needs a few weeks of the same lifts to judge the split.');
  }
  return { status, weeks, sessions: on.length, perWeek, reasons, ideas };
}

/* ---------- next session: weight, reps, sets ---------- */
/* history: past sessions of this exercise, newest first, each an array of sets { w, r }.
   opts: { range: { lo, hi } | null, sets, bw (bodyweight exercise), step, round, call ('train' | 'easy' | 'rest'),
   deload (true in a deload week), goalWeek ({ sets, reps, pct }) and e1 (current e1RM in kg, for goal work) }.
   Returns null without history, else { last, next: { w, r }, sets, why, range }.
   why: load (add weight), range-up (top of the range: add weight, back to the bottom), reps (add reps),
   repeat (slipped last time), consolidate (later sets fell short), reset (too heavy twice: drop 5%),
   easy (a lighter day), deload (a lighter week), goal (this week of the goal plan) */
export function prescribe(history, opts = {}) {
  const { range = null, bw = false, step = 2.5, round = w => w, call = 'train', deload = false, goalWeek = null, e1 = 0 } = opts;
  const planned = Math.max(1, opts.sets || 3);
  const lastSets = (history && history[0] || []).filter(s => +s.r > 0);
  /* goal work: this week of the goal's block, a little lighter on an easy day or in a deload week */
  if (goalWeek && e1 > 0 && !bw) {
    const k = deload ? 0.9 : call === 'easy' ? 0.95 : 1, n = deload ? Math.max(1, Math.ceil(goalWeek.sets / 2)) : call === 'easy' ? Math.max(1, goalWeek.sets - 1) : goalWeek.sets;
    return { last: topSet(lastSets), next: { w: round(e1 * goalWeek.pct * k), r: goalWeek.reps }, sets: n, why: 'goal', range };
  }
  const last = topSet(lastSets); if (!last) return null;
  const prev = topSet((history[1] || []).filter(s => +s.r > 0));
  const atTop = lastSets.filter(s => (+s.w || 0) === last.w).map(s => +s.r);
  let next, why;
  /* no rep range planned: the plain next-set rule (progress.js) */
  if (!range) ({ next, why } = suggestNext(history, { bw, step, round }));
  else if (bw && !last.w) {
    /* bodyweight only: add reps; past the top of the range, it's time to add a little weight */
    if (Math.min(...atTop) >= range.hi) { next = { w: round(step), r: range.lo }; why = 'range-up'; }
    else { next = { w: 0, r: clamp(Math.min(...atTop) + 1, range.lo, range.hi) }; why = 'reps'; }
  } else if (prev && est(last) < est(prev) * 0.97) { next = { w: last.w, r: last.r }; why = 'repeat'; }
  else {
    const lo = Math.min(...atTop);
    if (atTop.length >= Math.min(planned, lastSets.length) && lo >= range.hi) { next = { w: up(last.w, step, round), r: range.lo }; why = 'range-up'; }
    else if (last.r < range.lo) {
      const prevTop = prev && prev.w === last.w ? prev.r : Infinity;
      if (prevTop < range.lo) { next = { w: Math.max(0, round(last.w * 0.95)), r: range.lo }; why = 'reset'; }
      else { next = { w: last.w, r: range.lo }; why = 'consolidate'; }
    } else { next = { w: last.w, r: clamp(lo + 1, range.lo, range.hi) }; why = 'reps'; }
  }
  /* lighter days start from what was lifted last time, not from the progressed target */
  if (deload) return { last, next: { w: last.w ? round(last.w * 0.9) : 0, r: range ? range.lo : last.r }, sets: Math.max(1, Math.ceil(planned / 2)), why: 'deload', range };
  if (call === 'easy') return { last, next: { w: last.w ? round(last.w * 0.9) : 0, r: range ? range.lo : last.r }, sets: Math.max(1, planned - 1), why: 'easy', range };
  return { last, next, sets: planned, why, range };
}
const est = s => (s.w || 0) * (1 + s.r / 30);
/* add about 2.5%, at least one plate step */
function up(w, step, round) { const inc = Math.max(step, Math.floor(w * 0.025 / step) * step), n = round(w + inc); return n > w ? n : w + step; }

/* ---------- lift goals ---------- */
/* the three phases of a goal, each a 4-week block: three building weeks then a deload.
   Percentages are of the current e1RM, so every week is doable today. */
export const PHASES = {
  build: { name: 'Build', focus: 'Volume and technique: more muscle to get strong with.', weeks: [{ sets: 4, reps: 6, pct: 0.725 }, { sets: 4, reps: 6, pct: 0.75 }, { sets: 4, reps: 6, pct: 0.775 }, { sets: 3, reps: 6, pct: 0.65, deload: true }] },
  strength: { name: 'Strength', focus: 'Heavier sets of 3–5: turning muscle into strength.', weeks: [{ sets: 5, reps: 4, pct: 0.8 }, { sets: 5, reps: 4, pct: 0.825 }, { sets: 5, reps: 3, pct: 0.85 }, { sets: 3, reps: 3, pct: 0.7, deload: true }] },
  peak: { name: 'Peak', focus: 'Heavy doubles and singles, then test the goal.', weeks: [{ sets: 3, reps: 2, pct: 0.88 }, { sets: 3, reps: 1, pct: 0.92 }, { sets: 1, reps: 1, pct: 1, test: true }, { sets: 3, reps: 3, pct: 0.7, deload: true }] }
};
export const phaseFor = gap => gap > 0.1 ? 'build' : gap > 0.03 ? 'strength' : 'peak';

/* goal: { exId, kg, by (deadline ms or null), at (set ms), from (e1RM then) }. points: the lift's series.
   ctx: { now, exp, saved, round }. Everything a goal card needs: where it stands, how fast it's realistic to get
   there (likely, fast and slow), whether the deadline works, this block and this week's work, and milestones. */
export function goalPlan(goal, points, ctx) {
  const { now, round = w => w } = ctx, kg = +goal.kg;
  const cur = currentE1rm(points, now, ctx.saved);
  const base = { goal, cur, from: goal.from > 0 ? goal.from : cur, tips: [] };
  if (!(cur > 0)) return { ...base, status: 'no-data', progress: 0 };
  const from = Math.min(base.from, cur), progress = kg > from ? clamp((cur - from) / (kg - from), 0, 1) : 1;
  const expected = EXP_RATE[ctx.exp] || EXP_RATE.intermediate, slope = trend(points, now);
  let rate = expected, stuck = false;
  if (slope != null) { const obs = slope / cur; if (obs <= 0) { rate = expected * 0.5; stuck = true; } else rate = clamp(0.5 * obs + 0.5 * expected, expected * 0.25, expected * 2); }
  const gap = kg / cur - 1, phase = phaseFor(gap);
  const wk = Math.max(0, Math.floor((now - (goal.at || now)) / WEEK)) % 4, week = PHASES[phase].weeks[wk];
  const plan = { phase, name: PHASES[phase].name, focus: PHASES[phase].focus, weekNo: wk + 1, week: { ...week, kg: round(cur * week.pct) } };
  if (cur >= kg * 0.995) return { ...base, from, progress: 1, status: 'ready', rate, plan: { ...plan, phase: 'peak', name: 'Test', focus: 'Your estimated max is at the goal. Test it.' }, tips: ['Test day: warm up, then singles at about 90% and 95%, then the goal. Rest 3–5 minutes between them.'] };
  const weeks = { likely: weeksTo(cur, kg, rate), fast: weeksTo(cur, kg, rate * 1.5), slow: weeksTo(cur, kg, rate * 0.6) };
  const eta = Object.fromEntries(Object.entries(weeks).map(([k, w]) => [k, w == null ? null : now + w * WEEK]));
  let deadline = null, needed = null;
  if (goal.by && goal.by > now) {
    const left = (goal.by - now) / WEEK; needed = Math.pow(kg / cur, 1 / Math.max(left, 0.5)) - 1;
    deadline = needed <= rate ? 'yes' : needed <= rate * 1.5 ? 'tight' : 'no';
  } else if (goal.by) deadline = 'passed';
  const status = weeks.likely == null || weeks.likely > 260 ? 'long' : stuck ? 'stalled' : deadline === 'no' || deadline === 'passed' ? 'behind' : 'on-track';
  /* milestones every 4 weeks along the likely path, at most six */
  const milestones = [];
  if (weeks.likely != null) for (let w = 4; w < weeks.likely && milestones.length < 6; w += 4) { const v = Math.floor(project(cur, rate, w) / 2.5) * 2.5; if (v > cur && (!milestones.length || v > milestones[milestones.length - 1].kg)) milestones.push({ kg: v, t: now + w * WEEK }); }
  const tips = [];
  const lastMonth = (points || []).filter(p => now - p.t <= 28 * DAY).length;
  if (lastMonth < 6) tips.push(`Train this lift twice a week (${lastMonth} time${lastMonth === 1 ? '' : 's'} in the last 4 weeks). Frequency is one of the strongest levers for strength.`);
  if (stuck) tips.push('Your trend is flat. Follow the block below for 4 weeks rather than testing heavy every session.');
  if (status === 'long') tips.push(`That's a long-term goal. Aim for ${round(Math.floor(project(cur, rate, 26) / 2.5) * 2.5)} kg in about six months first.`);
  tips.push('Sleep 7–9 hours and eat about 1.6 g of protein per kg of bodyweight a day: recovery is where strength is built.');
  return { ...base, from, progress, status, rate, gap, weeks, eta, deadline, needed, plan, milestones, tips };
}
/* gains taper about 8% each quarter as training age grows */
function project(v, rate, weeks) { for (let w = 0; w < weeks; w++) v *= 1 + rate * Math.pow(0.92, w / 13); return v; }
function weeksTo(cur, kg, rate) {
  if (!(rate > 0)) return null;
  let v = cur, w = 0;
  while (v < kg && w < 520) { v *= 1 + rate * Math.pow(0.92, w / 13); w++; }
  return v >= kg ? w : null;
}

/* ---------- everything, once ---------- */
/* ctx: { now, exp, target, split, lastSplitDay, nextMuscles, muscleOf, goals, savedOf(exId) → { kg, at } | null, round } */
export function analyse(log, ctx) {
  const series = seriesByLift(log);
  const ready = readiness(log, series, ctx), deload = deloadCheck(log, series, ctx);
  const split = splitCheck(log, series, { ...ctx, deload });
  const goals = (ctx.goals || []).map(g => goalPlan(g, series.get(g.exId), { ...ctx, saved: ctx.savedOf ? ctx.savedOf(g.exId) : null }));
  return { series, ready, deload, split, goals };
}
