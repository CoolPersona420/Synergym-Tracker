import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import webpush from 'web-push';
import handler from '../../api/reminders.js';

const SECRET = 'a'.repeat(64);
let sent, calls, pushFails;
beforeEach(() => {
  process.env.VAPID_PUBLIC_KEY = 'pub'; process.env.VAPID_PRIVATE_KEY = 'priv'; process.env.REMINDER_SECRET = SECRET;
  sent = []; calls = []; pushFails = new Set();
  webpush.setVapidDetails = () => {};
  webpush.sendNotification = async (sub, payload) => { if (pushFails.has(sub.endpoint)) { const e = new Error('gone'); e.statusCode = 410; throw e; } sent.push({ ep: sub.endpoint, msg: JSON.parse(payload) }); };
});
const res = () => { const r = { code: 0, body: null, status(c) { r.code = c; return r; }, json(b) { r.body = b; return r; }, end() { return r; } }; return r; };
const respond = (status, body) => ({ ok: status < 300, status, json: async () => body, text: async () => JSON.stringify(body) });

test('the scheduled run needs the secret', async () => {
  globalThis.fetch = async () => { throw new Error('should not be called'); };
  const r = res(); await handler({ method: 'POST', headers: { authorization: 'Bearer nope' }, body: {} }, r);
  assert.equal(r.code, 401);
  const r2 = res(); await handler({ method: 'GET', headers: {}, body: {} }, r2);
  assert.equal(r2.code, 405);
});

const ctx = { name: 'Alex', day: '2026-10-27', dow: 2, wk: 1, target: 4, gap: 2, streak: 0, total: 30, since: 1, rest: false, today: false,
  brief: { coach: true, day: 'Lower', n: 5, lift: 'Back Squat', tgt: '137.5 kg × 5' } };
test('the scheduled run writes each person’s message, stays quiet when it should, and reports back', async () => {
  globalThis.fetch = async (url, opts) => {
    calls.push({ url, body: opts.body && JSON.parse(opts.body) });
    if (url.endsWith('/rpc/reminders_next')) return respond(200, [
      /* two devices for one person: both get the same message */
      { endpoint: 'e1', p256dh: 'k', auth: 'a', uid: 'u1', ...ctx },
      { endpoint: 'e2', p256dh: 'k', auth: 'a', uid: 'u1', ...ctx },
      /* trained today: quiet */
      { endpoint: 'e3', p256dh: 'k', auth: 'a', uid: 'u2', ...ctx, today: true },
      /* a device the push service says is gone */
      { endpoint: 'gone', p256dh: 'k', auth: 'a', uid: 'u3', ...ctx, brief: null }
    ]);
    if (url.endsWith('/rpc/reminders_done')) return respond(204, null);
    throw new Error('unexpected ' + url);
  };
  pushFails.add('gone');
  const r = res(); await handler({ method: 'POST', headers: { authorization: 'Bearer ' + SECRET }, body: {} }, r);
  assert.equal(r.code, 200);
  assert.deepEqual(r.body, { due: 3, sent: 2, quiet: 1, dropped: 1 });
  const m1 = sent.find(s => s.ep === 'e1').msg, m2 = sent.find(s => s.ep === 'e2').msg;
  assert.deepEqual(m1, m2);
  assert.match(m1.title + ' ' + m1.body, /Lower/); assert.match(m1.body, /Back Squat 137\.5 kg × 5/);
  assert.ok(!sent.some(s => s.ep === 'e3'));
  const done = calls.find(c => c.url.endsWith('/rpc/reminders_done'));
  assert.deepEqual(done.body, { p_secret: SECRET, p_sent: ['u1'], p_gone: ['gone'] });
});

test('a quiet run reports nothing back', async () => {
  globalThis.fetch = async (url, opts) => {
    calls.push({ url, body: opts.body && JSON.parse(opts.body) });
    if (url.endsWith('/rpc/reminders_next')) return respond(200, [{ endpoint: 'e1', p256dh: 'k', auth: 'a', uid: 'u1', ...ctx, rest: true }]);
    throw new Error('unexpected ' + url);
  };
  const r = res(); await handler({ method: 'POST', headers: { authorization: 'Bearer ' + SECRET }, body: {} }, r);
  assert.deepEqual(r.body, { due: 1, sent: 0, quiet: 1, dropped: 0 });
  assert.equal(sent.length, 0); assert.equal(calls.length, 1);
});

test('a test reminder goes only to the signed-in user’s own devices', async () => {
  globalThis.fetch = async (url, opts) => {
    assert.equal(opts.headers.Authorization, 'Bearer user-token');
    if (url.endsWith('/auth/v1/user')) return respond(200, { id: 'u1' });
    if (url.includes('/rest/v1/push_subscriptions')) return respond(200, [{ endpoint: 'mine', p256dh: 'k', auth: 'a' }]);
    throw new Error('unexpected ' + url);
  };
  const r = res(); await handler({ method: 'POST', headers: { authorization: 'Bearer user-token' }, body: { test: true, ctx: { ...ctx, today: true } } }, r);
  assert.equal(r.code, 200); assert.equal(sent.length, 1); assert.equal(sent[0].ep, 'mine');
  /* it reads like a real reminder, even on a day a real one would stay quiet */
  assert.match(sent[0].msg.body, /Back Squat/); assert.equal(sent[0].msg.tag, 'reminder-test');
});

test('a test reminder needs a valid sign-in', async () => {
  globalThis.fetch = async url => url.endsWith('/auth/v1/user') ? respond(401, {}) : respond(200, []);
  const r = res(); await handler({ method: 'POST', headers: { authorization: 'Bearer bad' }, body: { test: true } }, r);
  assert.equal(r.code, 401); assert.equal(sent.length, 0);
});

test('without keys configured, nothing is sent', async () => {
  delete process.env.VAPID_PRIVATE_KEY;
  const r = res(); await handler({ method: 'POST', headers: { authorization: 'Bearer ' + SECRET }, body: {} }, r);
  assert.equal(r.code, 503);
});
