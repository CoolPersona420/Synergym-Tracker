import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DAY, WEEK, e1rm, loadFor, parseRange, seriesByLift, currentE1rm, trend, stalled, falling, loadRatio, trainingStreak, splitRun,
  readiness, lastBreak, deloadCheck, splitCheck, prescribe, goalPlan, phaseFor, analyse } from '../../src/lib/coach.js';

const NOW = new Date(2026, 9, 27, 18, 0).getTime();
const snap = w => Math.round(w / 2.5) * 2.5;
/* a session: daysAgo, then [exId, weight, reps, sets] for each lift */
const sess = (daysAgo, lifts, extra = {}) => ({ id: 's' + daysAgo + Math.random(), t: NOW - daysAgo * DAY, splitId: null, splitDay: null, ...extra,
  items: lifts.map(([exId, w, r, n = 3]) => ({ exId, sets: Array.from({ length: n }, () => ({ w, r, load: w })) })) });
/* a lift going up `step` kg a session, every `gap` days, for `n` sessions, newest last */
const climb = (exId, start, step, n, gap = 3.5, r = 5) => Array.from({ length: n }, (_, i) => sess((n - 1 - i) * gap, [[exId, start + i * step, r]]));
const ctx = (o = {}) => ({ now: NOW, exp: 'intermediate', target: 3, split: null, round: snap, ...o });

test('Epley both ways: 100×5 is about 117 kg, and 5 reps with 2 in reserve from that is about 95 kg', () => {
  assert.equal(Math.round(e1rm(100, 5)), 117);
  assert.equal(e1rm(140, 1), 140);
  assert.equal(e1rm(0, 5), 0);
  assert.equal(Math.round(loadFor(e1rm(100, 5), 5, 2)), 95);
});

test('rep ranges are read from the split', () => {
  assert.deepEqual(parseRange('8-12'), { lo: 8, hi: 12 });
  assert.deepEqual(parseRange('6–8'), { lo: 6, hi: 8 });
  assert.deepEqual(parseRange('5'), { lo: 5, hi: 5 });
  assert.deepEqual(parseRange('10+'), { lo: 10, hi: 12 });
  assert.equal(parseRange('AMRAP'), null);
  assert.equal(parseRange('12-8'), null);
});

test('series: one point per session, strength from sets of 12 reps or fewer', () => {
  const log = [sess(7, [['sq', 100, 5]]), sess(3, [['sq', 60, 20], ['sq', 105, 5, 1]])];
  const p = seriesByLift(log).get('sq');
  assert.equal(p.length, 2);
  assert.equal(Math.round(p[1].e1), Math.round(e1rm(105, 5)));
  assert.equal(p[1].sets.length, 4);
});

test('current strength: recent best, faded for long breaks, and a recent saved 1RM counts', () => {
  const p = seriesByLift([sess(10, [['sq', 100, 5]]), sess(5, [['sq', 110, 5]])]).get('sq');
  assert.equal(Math.round(currentE1rm(p, NOW)), Math.round(e1rm(110, 5)));
  const old = seriesByLift([sess(70, [['sq', 110, 5]])]).get('sq');
  assert.ok(currentE1rm(old, NOW) < e1rm(110, 5) * 0.95);
  assert.equal(currentE1rm(p, NOW, { kg: 140, at: NOW - 7 * DAY }), 140);
});

test('trend is kg a week and shrugs off one bad day', () => {
  const log = climb('sq', 100, 2.5, 10, 3.5);
  log[7].items[0].sets.forEach(s => { s.w = s.load = 60; });
  const s = trend(seriesByLift(log).get('sq'), NOW);
  assert.ok(s > 4 && s < 7, `trend ${s}`);
  assert.equal(trend(seriesByLift(climb('sq', 100, 2.5, 3)).get('sq'), NOW), null);
});

test('stalled and falling', () => {
  const flat = Array.from({ length: 6 }, (_, i) => sess(30 - i * 5, [['b', 80, 5]]));
  assert.equal(stalled(seriesByLift(flat).get('b'), NOW), true);
  assert.equal(stalled(seriesByLift(climb('b', 80, 2.5, 6, 5)).get('b'), NOW), false);
  const down = [sess(20, [['b', 100, 5]]), sess(15, [['b', 100, 5]]), sess(6, [['b', 90, 5]]), sess(2, [['b', 90, 5]])];
  assert.equal(falling(seriesByLift(down).get('b'), NOW), true);
});

test('training load and streaks', () => {
  const steady = Array.from({ length: 12 }, (_, i) => sess(33 - i * 3, [['sq', 100, 5, 4], ['b', 80, 5, 4]]));
  assert.ok(Math.abs(loadRatio(steady, NOW) - 1) < 0.35);
  const spike = [...steady, sess(1, [['sq', 100, 5, 10], ['b', 80, 5, 10]]), sess(0.2, [['sq', 100, 5, 10]])];
  assert.ok(loadRatio(spike, NOW) >= 1.5);
  assert.equal(trainingStreak([sess(3, []), sess(2, []), sess(1, [])], NOW), 3);
  assert.equal(splitRun([{ rest: false }, { rest: false }, { rest: true }, { rest: false }]), 3);
});

test('readiness: rest after a long run, rest when the split says so, go easy on a load spike', () => {
  const run = [sess(4, [['sq', 100, 5]]), sess(3, [['b', 80, 5]]), sess(2, [['sq', 100, 5]]), sess(1, [['b', 80, 5]])];
  assert.equal(readiness(run, seriesByLift(run), ctx()).call, 'rest');
  const split = { id: 'p', days: [{ rest: false }, { rest: true }, { rest: false }] };
  const one = [sess(1, [['sq', 100, 5]], { splitId: 'p', splitDay: 0 })];
  const r = readiness(one, seriesByLift(one), ctx({ split, lastSplitDay: 0 }));
  assert.equal(r.call, 'rest'); assert.match(r.reasons.join(' '), /rest day/);
  const steady = Array.from({ length: 12 }, (_, i) => sess(36 - i * 3, [['sq', 100, 5, 4], ['b', 80, 5, 4]]));
  const spike = [...steady, sess(2, [['sq', 100, 5, 12], ['b', 80, 5, 12]])];
  assert.equal(readiness(spike, seriesByLift(spike), ctx()).call, 'easy');
  const fresh = [sess(2, [['sq', 100, 5]])];
  assert.equal(readiness(fresh, seriesByLift(fresh), ctx()).call, 'train');
  assert.equal(readiness([], new Map(), ctx()).call, 'train');
});

test('readiness: yesterday already worked the muscles today needs', () => {
  const log = [sess(1, [['bench', 80, 8, 8]])];
  const r = readiness(log, seriesByLift(log), ctx({ nextMuscles: ['Chest'], muscleOf: () => 'Chest' }));
  assert.equal(r.call, 'easy'); assert.match(r.reasons.join(' '), /chest/);
});

test('deload: due by the calendar, now when lifts stall, a week off after a long unbroken stretch', () => {
  const weeks = n => Array.from({ length: n * 3 }, (_, i) => sess(n * 7 - 1 - i * (7 / 3), [['sq', 100 + i, 5, 4], ['b', 80 + i * 0.5, 5, 4]]));
  /* weeks(n) is n - 1 full weeks of training */
  assert.equal(deloadCheck(weeks(4), seriesByLift(weeks(4)), ctx()).status, 'ok');
  const due = weeks(7), d = deloadCheck(due, seriesByLift(due), ctx());
  assert.equal(d.status, 'now'); assert.equal(d.kind, 'deload');
  assert.equal(deloadCheck(weeks(6), seriesByLift(weeks(6)), ctx()).status, 'soon');
  assert.equal(deloadCheck(weeks(10), seriesByLift(weeks(10)), ctx({ exp: 'beginner' })).status, 'soon');
  const long = weeks(17), w = deloadCheck(long, seriesByLift(long), ctx());
  assert.equal(w.kind, 'week-off');
  const flat = Array.from({ length: 9 }, (_, i) => sess(40 - i * 5, [['sq', 100, 5, 4], ['b', 80, 5, 4]]));
  const f = deloadCheck(flat, seriesByLift(flat), ctx());
  assert.equal(f.status, 'now'); assert.match(f.reasons.join(' '), /stalled/);
  const gap = [...weeks(8).filter(s => s.t < NOW - 20 * DAY), sess(3, [['sq', 100, 5]])];
  assert.equal(deloadCheck(gap, seriesByLift(gap), ctx()).weeks, 0);
});

test('straight after a lighter week, dips and stalls don’t call another deload', () => {
  const log = [];
  for (let d = 63; d >= 0; d -= 2) { const light = d >= 7 && d < 14; log.push(sess(d, [['sq', light ? 90 : 100, 5, light ? 1 : 5], ['b', light ? 70 : 80, 5, light ? 1 : 5]])); }
  const d = deloadCheck(log, seriesByLift(log), ctx());
  assert.equal(d.status, 'ok'); assert.match(d.reasons.join(' '), /bounce back/);
});

test('a light week counts as the break', () => {
  const log = [];
  for (let d = 70; d >= 0; d -= 2) { const light = d >= 14 && d < 21; log.push(sess(d, [['sq', 100, 5, light ? 1 : 5]])); }
  const b = lastBreak(log, NOW);
  assert.ok(b.light, 'found the light week');
  assert.ok((NOW - b.start) / WEEK < 2.5);
});

test('split check: too many days for the schedule, too early to judge, missing muscles', () => {
  const day = m => ({ rest: false, exercises: m.map(muscle => ({ muscle })) });
  const five = { id: 'f', days: [day(['Chest']), day(['Back']), day(['Quads', 'Hamstrings']), day(['Shoulders']), day(['Biceps'])] };
  const sparse = Array.from({ length: 8 }, (_, i) => sess(27 - i * 3.5, [['x', 50, 8]], { splitId: 'f' }));
  const c = splitCheck(sparse, seriesByLift(sparse), ctx({ split: five, deload: { status: 'ok' } }));
  assert.equal(c.status, 'change'); assert.match(c.ideas.join(' '), /full-body|upper\/lower/);
  const full = { id: 'u', days: [day(['Chest', 'Back', 'Quads', 'Hamstrings', 'Shoulders'])] };
  const fresh = [sess(5, [['x', 50, 8]], { splitId: 'u' }), sess(2, [['x', 50, 8]], { splitId: 'u' })];
  const k = splitCheck(fresh, seriesByLift(fresh), ctx({ split: full, deload: { status: 'ok' } }));
  assert.equal(k.status, 'keep'); assert.match(k.reasons.join(' '), /6 to 8 weeks/);
  const noLegs = { id: 'n', days: [day(['Chest', 'Back', 'Shoulders'])] };
  assert.equal(splitCheck(fresh, seriesByLift(fresh), ctx({ split: noLegs, deload: { status: 'ok' } })).status, 'consider');
  assert.equal(splitCheck([], new Map(), ctx()).status, 'none');
});

test('prescribe: double progression inside the rep range', () => {
  const r = { lo: 8, hi: 12 }, o = { range: r, sets: 3, step: 2.5, round: snap };
  /* reps climbing inside the range: same weight, a rep more on the weakest set */
  assert.deepEqual(prescribe([[{ w: 60, r: 10 }, { w: 60, r: 9 }, { w: 60, r: 9 }]], o).next, { w: 60, r: 10 });
  /* every set at the top: add weight, back to the bottom */
  const up = prescribe([[{ w: 60, r: 12 }, { w: 60, r: 12 }, { w: 60, r: 12 }]], o);
  assert.deepEqual(up.next, { w: 62.5, r: 8 }); assert.equal(up.why, 'range-up');
  /* under the range twice at a weight: drop 5% */
  assert.equal(prescribe([[{ w: 100, r: 6 }], [{ w: 100, r: 7 }]], o).why, 'reset');
  /* once under: own it first */
  assert.equal(prescribe([[{ w: 100, r: 6 }], [{ w: 95, r: 9 }]], o).why, 'consolidate');
  /* heavy lifts add about 2.5%, in whole plate steps */
  assert.deepEqual(prescribe([[{ w: 200, r: 5 }, { w: 200, r: 5 }]], { ...o, range: { lo: 3, hi: 5 } }).next, { w: 205, r: 3 });
});

test('prescribe: without a range it is the plain next-set rule; easy days and deloads lighten it', () => {
  const h = [[{ w: 80, r: 8 }, { w: 80, r: 8 }, { w: 80, r: 8 }]];
  assert.deepEqual(prescribe(h, { step: 2.5, round: snap }).next, { w: 82.5, r: 8 });
  const easy = prescribe(h, { step: 2.5, round: snap, call: 'easy', sets: 3 });
  /* 10% under last time's 80, not under the progressed 82.5 */
  assert.equal(easy.why, 'easy'); assert.equal(easy.sets, 2); assert.deepEqual(easy.next, { w: 72.5, r: 8 });
  const dl = prescribe(h, { step: 2.5, round: snap, deload: true, sets: 4 });
  assert.equal(dl.why, 'deload'); assert.equal(dl.sets, 2); assert.equal(dl.next.w, 72.5);
  assert.equal(prescribe([], {}), null);
  /* bodyweight: reps up to the top, then a little weight */
  assert.deepEqual(prescribe([[{ w: 0, r: 12 }, { w: 0, r: 12 }]], { bw: true, range: { lo: 8, hi: 12 }, step: 2.5, round: snap }).next, { w: 2.5, r: 8 });
  /* a goal week sets the work */
  const g = prescribe(h, { goalWeek: { sets: 5, reps: 4, pct: 0.8 }, e1: 125, round: snap });
  assert.deepEqual([g.next, g.sets, g.why], [{ w: 100, r: 4 }, 5, 'goal']);
});

test('goal: squat 150 from about 127 is months away, with milestones, a block and this week', () => {
  const log = climb('sq', 90, 1.25, 16, 3.5);
  const pts = seriesByLift(log).get('sq'), cur = currentE1rm(pts, NOW);
  const g = goalPlan({ exId: 'sq', kg: 150, at: NOW - 10 * DAY, from: cur - 3 }, pts, ctx());
  assert.equal(g.status, 'on-track');
  /* this lifter is climbing fast (over 2% a week); the projection allows at most twice the usual rate for their level */
  assert.ok(g.rate <= 0.01 + 1e-9, `rate ${g.rate}`);
  assert.ok(g.weeks.likely >= 16 && g.weeks.likely < 156, `likely ${g.weeks.likely} weeks`);
  assert.ok(g.weeks.fast < g.weeks.likely && g.weeks.likely < g.weeks.slow);
  assert.equal(g.plan.phase, 'build');
  assert.ok(g.plan.week.kg > 0 && g.plan.week.kg < cur);
  assert.ok(g.milestones.length >= 3 && g.milestones.every((m, i, a) => !i || m.kg > a[i - 1].kg));
  assert.ok(g.progress > 0 && g.progress < 0.2);
});

test('goal: deadlines are judged, far goals get a first milestone, reached goals get a test', () => {
  const pts = seriesByLift(climb('sq', 100, 1.25, 10, 3.5)).get('sq'), cur = currentE1rm(pts, NOW);
  const soon = goalPlan({ exId: 'sq', kg: 150, by: NOW + 6 * WEEK, at: NOW }, pts, ctx());
  assert.equal(soon.deadline, 'no'); assert.equal(soon.status, 'behind');
  const easy = goalPlan({ exId: 'sq', kg: cur * 1.02, by: NOW + 26 * WEEK, at: NOW }, pts, ctx());
  assert.equal(easy.deadline, 'yes'); assert.equal(easy.plan.phase, 'peak');
  const far = goalPlan({ exId: 'sq', kg: 400, at: NOW }, pts, ctx({ exp: 'advanced' }));
  assert.equal(far.status, 'long'); assert.match(far.tips.join(' '), /six months/);
  const done = goalPlan({ exId: 'sq', kg: cur - 5, at: NOW }, pts, ctx());
  assert.equal(done.status, 'ready'); assert.match(done.tips.join(' '), /Test day/);
  assert.equal(goalPlan({ exId: 'x', kg: 100, at: NOW }, undefined, ctx()).status, 'no-data');
  assert.equal(phaseFor(0.2), 'build'); assert.equal(phaseFor(0.05), 'strength'); assert.equal(phaseFor(0.01), 'peak');
});

test('goal: beginners are projected faster than advanced lifters', () => {
  const pts = seriesByLift(climb('sq', 100, 0, 2, 3.5)).get('sq');
  const b = goalPlan({ exId: 'sq', kg: 130, at: NOW }, pts, ctx({ exp: 'beginner' })), a = goalPlan({ exId: 'sq', kg: 130, at: NOW }, pts, ctx({ exp: 'advanced' }));
  assert.ok(b.weeks.likely < a.weeks.likely);
});

test('fast enough to run on every change: three years of four sessions a week', () => {
  const lifts = ['sq', 'bench', 'dl', 'ohp', 'row', 'curl'], log = [];
  for (let d = 3 * 365; d >= 0; d -= 1.75) log.push(sess(d, lifts.map((x, i) => [x, 60 + i * 10 + (3 * 365 - d) / 20, 5 + (i % 3) * 3, 4])));
  const t0 = performance.now();
  const a = analyse(log, ctx({ goals: [{ exId: 'sq', kg: 250, at: NOW - 30 * DAY }, { exId: 'bench', kg: 200, at: NOW }], muscleOf: () => 'Chest', nextMuscles: ['Chest'] }));
  const ms = performance.now() - t0;
  assert.ok(a.goals.length === 2 && a.ready.call && a.deload.status);
  assert.ok(ms < 150, `took ${ms.toFixed(1)} ms`);
});
