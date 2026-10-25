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

test('the scheduled run sends each due device its message and drops devices that are gone', async () => {
  globalThis.fetch = async (url, opts) => {
    calls.push({ url, body: opts.body && JSON.parse(opts.body) });
    if (url.endsWith('/rpc/reminders_due')) return respond(200, [
      { endpoint: 'e1', p256dh: 'k', auth: 'a', title: 'Time to train', body: '1 of 3 sessions done this week. Keep it going.' },
      { endpoint: 'e2', p256dh: 'k', auth: 'a', title: 'Time to train', body: 'Start your week strong. Your first session is waiting.' },
      { endpoint: 'gone', p256dh: 'k', auth: 'a', title: 'Time to train', body: 'Start your week strong. Your first session is waiting.' }
    ]);
    if (url.endsWith('/rpc/reminders_drop')) return respond(204, null);
    throw new Error('unexpected ' + url);
  };
  pushFails.add('gone');
  const r = res(); await handler({ method: 'POST', headers: { authorization: 'Bearer ' + SECRET }, body: {} }, r);
  assert.equal(r.code, 200);
  assert.deepEqual(r.body, { due: 3, sent: 2, dropped: 1 });
  assert.equal(sent.find(s => s.ep === 'e1').msg.body, '1 of 3 sessions done this week. Keep it going.');
  const drop = calls.find(c => c.url.endsWith('/rpc/reminders_drop'));
  assert.deepEqual(drop.body, { p_secret: SECRET, p_endpoints: ['gone'] });
});

test('a test reminder goes only to the signed-in user’s own devices', async () => {
  globalThis.fetch = async (url, opts) => {
    assert.equal(opts.headers.Authorization, 'Bearer user-token');
    if (url.endsWith('/auth/v1/user')) return respond(200, { id: 'u1' });
    if (url.includes('/rest/v1/push_subscriptions')) return respond(200, [{ endpoint: 'mine', p256dh: 'k', auth: 'a' }]);
    throw new Error('unexpected ' + url);
  };
  const r = res(); await handler({ method: 'POST', headers: { authorization: 'Bearer user-token' }, body: { test: true } }, r);
  assert.equal(r.code, 200); assert.equal(sent.length, 1); assert.equal(sent[0].ep, 'mine');
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
