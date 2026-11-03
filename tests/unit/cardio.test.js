import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTime, fmtDur, fmtMin, parseDist, fmtDist, distUnit, pace, fmtPace, howOf, defaultMetrics, cleanMetrics, effortInt, scanCardio } from '../../src/lib/cardio.js';

test('time reads as minutes, m:ss, h:mm:ss or with h and m', () => {
  assert.equal(parseTime('30'), 1800);
  assert.equal(parseTime('30,5'), 1830);
  assert.equal(parseTime('30:15'), 1815);
  assert.equal(parseTime('1:05:00'), 3900);
  assert.equal(parseTime('1h 5m'), 3900);
  assert.equal(parseTime('45min'), 2700);
  assert.equal(parseTime(''), null);
  assert.equal(parseTime('abc'), null);
  assert.equal(parseTime('99999'), 86400);
});

test('durations print as m:ss or h:mm:ss, and summaries in minutes', () => {
  assert.equal(fmtDur(1800), '30:00');
  assert.equal(fmtDur(3900), '1:05:00');
  assert.equal(fmtDur(0), '');
  assert.equal(fmtMin(1830), '31 min');
  assert.equal(fmtMin(3900), '1 h 05');
});

test('distance: km, or mi for lb, and metres on the water', () => {
  assert.equal(distUnit('road', 'kg'), 'km');
  assert.equal(distUnit('road', 'lb'), 'mi');
  assert.equal(distUnit('row', 'lb'), 'm');
  assert.equal(parseDist('5,2', 'km'), 5200);
  assert.equal(Math.round(parseDist('3.1', 'mi')), 4989);
  assert.equal(fmtDist(5200, 'km'), '5.2');
  assert.equal(fmtDist(2000, 'm'), '2000');
  assert.equal(parseDist('', 'km'), null);
});

test('pace per km or mi, per 500 m rowing, per 100 m swimming, and speed riding', () => {
  assert.equal(fmtPace(pace(1800, 5000, 'road', 'kg')), '6:00 /km');
  assert.equal(fmtPace(pace(480, 2000, 'row', 'kg')), '2:00 /500m');
  assert.equal(fmtPace(pace(120, 100, 'swim', 'kg')), '2:00 /100m');
  assert.equal(fmtPace(pace(3600, 30000, 'ride', 'kg')), '30 km/h');
  assert.equal(fmtPace(pace(3600, 16093.44, 'ride', 'lb')), '10 mph');
  assert.equal(pace(1800, 0, 'road', 'kg'), null);
});

test('a cardio exercise is measured by its kind, or by what its name says', () => {
  assert.equal(howOf('Run'), 'road');
  assert.equal(howOf('Row'), 'row');
  assert.equal(howOf('Rowing machine'), 'row');
  assert.equal(howOf('Assault bike'), 'ride');
  assert.equal(howOf('Pool swim'), 'swim');
  assert.equal(howOf('Treadmill'), 'road');
  assert.deepEqual(defaultMetrics('Run'), ['d']);
  assert.deepEqual(defaultMetrics('Battle ropes'), ['e']);
  assert.deepEqual(cleanMetrics(['e', 'x', 'd']), ['d', 'e']);
  assert.equal(cleanMetrics('d'), null);
});

test('effort reads on the session intensity scale', () => {
  assert.ok(effortInt(2) < 60);
  assert.ok(effortInt(5) >= 60 && effortInt(5) < 75);
  assert.ok(effortInt(8) >= 75 && effortInt(8) < 88);
  assert.ok(effortInt(10) >= 88);
});

let n = 0;
const sess = (bouts, ex = 'run') => ({ id: 's' + (++n), startedAt: n * 1000, items: [{ exId: ex, sets: bouts.map(([t, d]) => ({ id: 'b' + (++n), t, d })) }] });
const how = id => id === 'run' ? 'road' : null;

test('the first session is the baseline; then longer, farther and faster are records', () => {
  const a = sess([[1800, 5000]]), b = sess([[2400, 6000]]), c = sess([[1500, 5000]]);
  const r = scanCardio([a, b, c], how);
  assert.equal(r.bySet.get(a.items[0].sets[0].id), undefined);
  assert.deepEqual(r.bySet.get(b.items[0].sets[0].id).map(e => e.kind), ['long', 'far']);
  assert.deepEqual(r.bySet.get(c.items[0].sets[0].id).map(e => e.kind), ['fast']);
  const x = r.ex.get('run');
  assert.equal(x.long.v, 2400); assert.equal(x.far.v, 6000); assert.equal(x.fast.v, 0.3);
  assert.equal(x.n, 3); assert.equal(x.t, 5700);
});

test('a pace over a short distance is not a record, and lifts are not read', () => {
  const a = sess([[1800, 5000]]), b = sess([[60, 400]]), lift = { id: 'L', startedAt: 99e9, items: [{ exId: 'bench', sets: [{ id: 'w1', w: 100, r: 5 }] }] };
  const r = scanCardio([a, b, lift], how);
  assert.equal(r.bySet.get(b.items[0].sets[0].id), undefined);
  assert.equal(r.ex.has('bench'), false);
  assert.equal(r.bySess.has('L'), false);
});

test('an empty bout does not take the baseline: the first one with time does', () => {
  const a = sess([[null, null]]), b = sess([[1800, 5000]]), c = sess([[2000, 5500]]);
  const r = scanCardio([a, b, c], how);
  assert.equal(r.bySet.get(b.items[0].sets[0].id), undefined);
  assert.deepEqual(r.bySet.get(c.items[0].sets[0].id).map(e => e.kind), ['long', 'far']);
});

test('a session’s cardio: total time and distance, and effort weighted by time', () => {
  const s = { id: 'm', startedAt: 1, items: [{ exId: 'run', sets: [{ id: 'q1', t: 1200, d: 3000, e: 8 }, { id: 'q2', t: 600, e: 5 }] }] };
  const r = scanCardio([s], how).bySess.get('m');
  assert.equal(r.t, 1800); assert.equal(r.d, 3000); assert.equal(r.e, 7);
});

test('saved and loaded, a cardio bout keeps its numbers and an item its metrics; split days keep minutes', async () => {
  const { cleanSession, cleanDays, cleanKind } = await import('../../src/lib/sanitize.js');
  const s = cleanSession({ id: 'x', startedAt: 1, items: [{ id: 'i', exId: 'run', m: ['e', 'd', 'nope'], sets: [{ id: 'b', t: '1800', d: 5000.25, hr: 20, kc: 310.6, e: 12, pt: 1800, pd: 5000, done: true }] }] });
  assert.deepEqual(s.items[0].m, ['d', 'e']);
  assert.deepEqual({ ...s.items[0].sets[0], id: undefined }, { id: undefined, w: null, r: null, pw: null, pr: null, done: true, g: null, t: 1800, pt: 1800, d: 5000.25, pd: 5000, hr: 30, kc: 311, e: 10 });
  const lift = cleanSession({ id: 'y', items: [{ id: 'j', exId: 'bench', sets: [{ id: 's', w: 80, r: 8 }] }] });
  assert.equal('t' in lift.items[0].sets[0], false); assert.equal('m' in lift.items[0], false);
  const d = cleanDays([{ id: 'd', type: 'Cardio', exercises: [{ id: 'e', exId: 'run', name: 'Run', kind: 'c', min: '45' }, { id: 'f', name: 'Bench', kind: 'w' }] }]);
  assert.equal(d[0].exercises[0].kind, 'c'); assert.equal(d[0].exercises[0].min, 45); assert.equal('min' in d[0].exercises[1], false);
  assert.equal(cleanKind('c'), 'c'); assert.equal(cleanKind('x'), 'w');
});
