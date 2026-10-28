/* An in-memory stand-in for the Supabase project, served through Playwright's request interception.
   It covers the auth and REST calls the app makes, so the browser tests run anywhere without a network
   or a real account. One FakeSupabase is one database; pages that share it are devices on one account. */
import crypto from 'node:crypto';

const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const pick = (row, cols) => !cols || cols === '*' ? row : Object.fromEntries(cols.split(',').map(c => [c, row[c] ?? null]));

export class FakeSupabase {
  /* registered: false models an email nobody has signed up with yet; signing up creates the account the way
     the real database does (an empty profile and the starter exercises, with the server's own ids) */
  constructor({ email = 'tester@example.com', password = 'Lift1234', profile = {}, exercises = [], sessions = [], splits = [], registered = true, defaults = ['Bench Press', 'Back Squat', 'Deadlift', 'Pull-up'] } = {}) {
    this.uid = crypto.randomUUID(); this.email = email; this.password = password; this.registered = registered; this.defaults = defaults;
    if (!registered) { this.profiles = []; this.exercises = []; this.sessions = []; this.splits = []; this.errors = []; this.log = []; this.calls = []; return; }
    this.profiles = [{ id: this.uid, username: 'tester', display_name: 'Test', onboarded: true, unit: 'kg', weekly_target: 3, rest_seconds: 90, rest_enabled: true, rest_sound: true, bodyweight: 80, active_session: null, bw_log: null, widgets: null, ...profile }];
    this.exercises = exercises.map(e => ({ user_id: this.uid, archived: false, is_default: true, ...e }));
    this.sessions = sessions.map(s => ({ user_id: this.uid, notes: '', split_id: null, split_day: null, ...s }));
    this.splits = splits.map(s => ({ user_id: this.uid, description: '', share_token: null, copied_from: null, updated_at: new Date().toISOString(), ...s }));
    this.errors = []; this.log = []; this.calls = [];
  }
  table(name) { return { profiles: this.profiles, exercises: this.exercises, sessions: this.sessions, splits: this.splits }[name]; }
  register(email, password) {
    this.registered = true; this.email = email; this.password = password;
    this.profiles.push({ id: this.uid, username: null, display_name: null, onboarded: false, unit: 'kg', weekly_target: 3, rest_seconds: 90, rest_enabled: true, rest_sound: true, bodyweight: 75, active_session: null, bw_log: null, widgets: null });
    for (const name of this.defaults) this.exercises.push({ id: crypto.randomUUID(), user_id: this.uid, name, muscle: 'Chest', kind: name === 'Pull-up' ? 'bw' : 'w', archived: false, is_default: true });
  }
  session() {
    const sid = crypto.randomUUID(), now = Math.floor(Date.now() / 1000);
    const user = { id: this.uid, aud: 'authenticated', role: 'authenticated', email: this.email, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
    const at = b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ sub: this.uid, role: 'authenticated', aud: 'authenticated', exp: now + 3600, iat: now, session_id: sid, email: this.email }) + '.sig';
    return { access_token: at, token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, refresh_token: 'r-' + sid, user };
  }
  async attach(page, name = 'device') {
    await page.route(/\.supabase\.co\//, route => this.handle(route, name));
    await page.route(/\/_vercel\/insights\//, route => route.fulfill({ status: 204, body: '' }));
  }
  async handle(route, name) {
    const r = route.request(), u = new URL(r.url()), p = u.pathname, method = r.method();
    const obj = (r.headers()['accept'] || '').includes('pgrst.object');
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    const body = () => { try { return JSON.parse(r.postData() || 'null'); } catch { return null; } };
    this.calls.push(`${name} ${method} ${p}${u.search}`);
    if (p.endsWith('/auth/v1/signup')) {
      const b = body() || {};
      if (this.registered && b.email === this.email) return json({ code: 422, error_code: 'user_already_exists', msg: 'User already registered' }, 422);
      this.register(b.email, b.password); this.log.push(`${name} signup`);
      return json(this.session());
    }
    if (p.endsWith('/auth/v1/token')) {
      const b = body() || {};
      if (u.searchParams.get('grant_type') === 'refresh_token') { this.log.push(`${name} refresh`); return json(this.session()); }
      if (u.searchParams.get('grant_type') === 'password' && (!this.registered || b.email !== this.email || b.password !== this.password)) return json({ code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' }, 400);
      this.log.push(`${name} login`); return json(this.session());
    }
    if (p.endsWith('/auth/v1/user')) return json(this.session().user);
    if (p.endsWith('/auth/v1/logout')) { this.log.push(`${name} logout ${u.searchParams.get('scope') || 'global'}`); return route.fulfill({ status: 204, body: '' }); }
    const rpc = p.match(/\/rest\/v1\/rpc\/(\w+)/);
    if (rpc) {
      const b = body() || {};
      if (rpc[1] === 'report_error') { this.errors.push(b); return route.fulfill({ status: 204, body: '' }); }
      if (rpc[1] === 'import_replace') {
        const d = b.p; this.log.push(`${name} import_replace`);
        this.exercises.splice(0, Infinity, ...d.library.map(x => ({ ...x, user_id: this.uid })));
        this.sessions.splice(0, Infinity, ...d.sessions.map(x => ({ ...x, user_id: this.uid })));
        this.splits.splice(0, Infinity, ...d.splits.map(x => ({ ...x, user_id: this.uid, updated_at: new Date().toISOString() })));
        if (d.profile) Object.assign(this.profiles[0], Object.fromEntries(Object.entries(d.profile).filter(([k]) => !['username', 'onboarded', 'active_session'].includes(k))));
        return route.fulfill({ status: 204, body: '' });
      }
      if (rpc[1] === 'restore_default_exercises') return json(0);
      return json([]);
    }
    const t = p.match(/\/rest\/v1\/(\w+)/), rows = t && this.table(t[1]);
    if (!rows) return json([]);
    const eq = [...u.searchParams].filter(([, v]) => v.startsWith('eq.')).map(([k, v]) => [k, v.slice(3)]);
    const match = row => eq.every(([k, v]) => String(row[k]) === v);
    if (method === 'GET') {
      let out = rows.filter(match).map(row => pick(row, u.searchParams.get('select')));
      const ord = u.searchParams.get('order'); if (ord) { const [c, dir] = ord.split('.'); out.sort((a, b) => (a[c] > b[c] ? 1 : -1) * (dir === 'desc' ? -1 : 1)); }
      return json(obj ? out[0] ?? null : out);
    }
    if (method === 'PATCH') { const b = body(); for (const row of rows.filter(match)) Object.assign(row, b); if ('active_session' in (b || {})) this.log.push(`${name} claims`); return route.fulfill({ status: 204, body: '' }); }
    if (method === 'POST') {
      for (const row of [].concat(body() || [])) { const i = rows.findIndex(x => x.id === row.id); if (i >= 0) Object.assign(rows[i], row); else rows.push({ user_id: this.uid, ...row }); }
      return obj ? json(rows[rows.length - 1]) : route.fulfill({ status: 201, body: '' });
    }
    if (method === 'DELETE') { for (let i = rows.length - 1; i >= 0; i--) if (match(rows[i])) rows.splice(i, 1); return route.fulfill({ status: 204, body: '' }); }
    return json([]);
  }
}

/* log in through the real form, then wait for the splash to finish and the app to show */
export async function login(page, fake, name) {
  await fake.attach(page, name);
  await page.goto('/');
  await page.fill('#f-auth [name=email]', fake.email);
  await page.fill('#f-auth [name=password]', fake.password);
  await page.click('#f-auth button[type=submit]');
  await page.waitForFunction(() => !document.getElementById('splash') && document.querySelector('#nav') && !document.querySelector('#nav').hidden, null, { timeout: 15000 });
}

/* a bench press history: last session 80×8 three times, the one before 77.5×8 */
export function benchHistory() {
  const ex = { id: crypto.randomUUID(), name: 'Bench Press', muscle: 'Chest', kind: 'w' };
  const day = n => new Date(Date.now() - n * 864e5).toISOString();
  const sess = (n, w) => ({ id: crypto.randomUUID(), name: 'Push', started_at: day(n), ended_at: day(n - 0.04), items: [{ id: 'i' + n, exId: ex.id, sets: [1, 2, 3].map(k => ({ id: `s${n}${k}`, w, r: 8, done: true })) }] });
  return { exercises: [ex], sessions: [sess(3, 80), sess(10, 77.5)] };
}
