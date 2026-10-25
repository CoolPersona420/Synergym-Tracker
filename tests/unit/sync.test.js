import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planSync } from '../../src/lib/sync.js';

const ex = (id, name) => ({ id, name, muscle: 'Chest', kind: 'w', archived: false });
const sess = (id, exId) => ({ id, startedAt: 1, items: [{ id: 'i', exId, sets: [{ id: 'a', w: 80, r: 8 }] }] });

test('a fresh offline account: starter exercises take the account ids, custom ones upload, everything else uploads', () => {
  const server = [ex('S-bench', 'Bench Press'), ex('S-squat', 'Back Squat')];
  const local = { profile: { name: 'Alex' }, library: [ex('L-bench', 'bench press'), ex('L-squat', 'Back Squat'), ex('L-sled', 'Sled Push')],
    sessions: [sess('s1', 'L-bench'), sess('s2', 'L-sled')], splits: [{ id: 'p1', days: [{ type: 'Push', exercises: [{ exId: 'L-bench', name: 'Bench' }] }] }], dirty: [] };
  const r = planSync(local, server, { fresh: true });
  assert.equal(r.sessions[0].items[0].exId, 'S-bench');
  assert.equal(r.sessions[1].items[0].exId, 'L-sled');
  assert.equal(r.splits[0].days[0].exercises[0].exId, 'S-bench');
  assert.deepEqual([...r.upload].sort(), ['p', 's:s1', 's:s2', 'sp:p1', 'x:L-sled', 'x:S-bench', 'x:S-squat'].sort());
  assert.equal(r.library.length, 3);
  assert.equal(r.remapped, 2);
});

test('a returning account uploads only what changed offline, including deletions', () => {
  const server = [ex('A', 'Bench Press'), ex('B', 'Row')];
  const local = { profile: {}, library: [ex('A', 'Bench Press'), ex('B', 'Row')], sessions: [sess('s1', 'A'), sess('s2', 'B')], splits: [],
    dirty: new Set(['s:s2', 's:gone', 'x:C']) };
  const r = planSync(local, server, { fresh: false });
  assert.deepEqual([...r.upload].sort(), ['s:gone', 's:s2', 'x:C']);
  assert.ok(!r.upload.has('p'));
  assert.ok(!r.upload.has('s:s1'));
});

test('an exercise renamed into an account name collapses onto it, and its sessions follow', () => {
  const server = [ex('A', 'Bench Press')];
  const local = { profile: {}, library: [ex('N', 'Bench Press')], sessions: [sess('s1', 'N')], splits: [], dirty: new Set(['x:N']) };
  const r = planSync(local, server, { fresh: false });
  assert.equal(r.sessions[0].items[0].exId, 'A');
  assert.ok(r.upload.has('x:A') && r.upload.has('s:s1') && !r.upload.has('x:N'));
});

test('two device exercises with the same name become one', () => {
  const local = { profile: {}, library: [ex('L1', 'Dip'), ex('L2', 'dip ')], sessions: [sess('s1', 'L2')], splits: [], dirty: [] };
  const r = planSync(local, [], { fresh: true });
  assert.equal(r.library.length, 1);
  assert.equal(r.sessions[0].items[0].exId, 'L1');
});

test('an exercise the account no longer has is uploaded again rather than lost', () => {
  const local = { profile: {}, library: [ex('A', 'Bench Press')], sessions: [sess('s1', 'A')], splits: [], dirty: [] };
  const r = planSync(local, [], { fresh: false });
  assert.ok(r.upload.has('x:A'));
});
