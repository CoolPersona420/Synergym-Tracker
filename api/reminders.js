/* Sends workout reminders as web push.
   - The database pings this every 5 minutes (pg_cron + pg_net) with the shared secret. It then asks the
     database who is due and what's going on in their training (reminders_next), writes each person's message
     (or stays quiet: see _nudge.js), sends it to their devices, and reports back who was reached and which
     devices the push service says no longer exist (reminders_done).
   - A signed-in user can ask for a test reminder with their own access token; it goes to their devices only,
     and says what a reminder would say right now.
   Environment: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, REMINDER_SECRET (all set in Vercel, never in the repo). */
import crypto from 'node:crypto';
import webpush from 'web-push';
import { compose } from './_nudge.js';

const SB_URL = process.env.SUPABASE_URL || 'https://dqpxqinejgovkhwvsqem.supabase.co';
const SB_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_jTBU_Y-1T3ouNej7YUsCIQ_E5ceELbu';
const SITE = process.env.SITE_URL || 'https://synergym-tracker-log.vercel.app';

const sameSecret = (a, b) => {
  const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''));
  return x.length > 0 && x.length === y.length && crypto.timingSafeEqual(x, y);
};
const sb = (path, { token, body } = {}) => fetch(`${SB_URL}${path}`, {
  method: body === undefined ? 'GET' : 'POST',
  headers: { apikey: SB_KEY, Authorization: `Bearer ${token || SB_KEY}`, 'Content-Type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body)
});

/* send one message to many devices; returns how many arrived and which devices are gone */
async function sendAll(subs, message) {
  const gone = []; let sent = 0;
  await Promise.all(subs.map(async s => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(message), { TTL: 3600, urgency: 'normal' });
      sent++;
    } catch (e) {
      if (e && (e.statusCode === 404 || e.statusCode === 410)) gone.push(s.endpoint);
      else console.error('push failed', e && e.statusCode, e && e.body);
    }
  }));
  return { sent, gone };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, REMINDER_SECRET } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return res.status(503).json({ error: 'Reminders are not configured' });
  webpush.setVapidDetails(SITE, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const body = typeof req.body === 'string' ? (() => { try { return JSON.parse(req.body); } catch { return {}; } })() : req.body || {};

  /* a signed-in user testing their reminders: only their own devices, read with their own token */
  if (body.test) {
    const me = await sb('/auth/v1/user', { token });
    if (!me.ok) return res.status(401).json({ error: 'Sign in first' });
    const r = await sb('/rest/v1/push_subscriptions?select=endpoint,p256dh,auth', { token });
    const subs = r.ok ? await r.json() : [];
    if (!subs.length) return res.status(404).json({ error: 'No devices to remind' });
    /* the app sends what it knows (this week, the brief); it only shapes the wording of the user's own test */
    const c = body.ctx && typeof body.ctx === 'object' ? body.ctx : {};
    const m = compose({ day: new Date().toISOString().slice(0, 10), ...c, uid: 'test' }, { force: true });
    const out = await sendAll(subs, { ...m, tag: 'reminder-test' });
    return res.status(200).json({ sent: out.sent });
  }

  /* the scheduled run */
  if (!sameSecret(token, REMINDER_SECRET)) return res.status(401).json({ error: 'Forbidden' });
  const r = await sb('/rest/v1/rpc/reminders_next', { body: { p_secret: REMINDER_SECRET } });
  if (!r.ok) { console.error('reminders_next failed', r.status, await r.text()); return res.status(502).json({ error: 'Database error' }); }
  /* one row per device; everyone's devices get the same message */
  const people = new Map();
  for (const d of await r.json()) { if (!people.has(d.uid)) people.set(d.uid, { ctx: d, subs: [] }); people.get(d.uid).subs.push(d); }
  let sent = 0, quiet = 0; const gone = [], reached = [];
  await Promise.all([...people].map(async ([uid, p]) => {
    const m = compose(p.ctx);
    if (!m) { quiet++; return; }
    const out = await sendAll(p.subs, m);
    sent += out.sent; gone.push(...out.gone); if (out.sent) reached.push(uid);
  }));
  if (reached.length || gone.length) await sb('/rest/v1/rpc/reminders_done', { body: { p_secret: REMINDER_SECRET, p_sent: reached, p_gone: gone } });
  return res.status(200).json({ due: people.size, sent, quiet, dropped: gone.length });
}
