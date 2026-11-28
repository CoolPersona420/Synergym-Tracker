import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanSession } from '../../src/lib/sanitize.js';

test('a deload is per session: the flag is kept on a session that has it, and absent otherwise', () => {
  const base = { id: 's1', name: 'Push', startedAt: 1, endedAt: 2, items: [] };
  assert.equal(cleanSession({ ...base, deload: true }).deload, true);
  assert.equal('deload' in cleanSession(base), false);
  assert.equal('deload' in cleanSession({ ...base, deload: false }), false);
  assert.equal('deload' in cleanSession({ ...base, deload: 0 }), false);
});
