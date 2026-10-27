/* The admin console (/admin). Loaded only when an admin opens it.
   Every action goes through admin_* database functions that check the caller is an admin and write the
   admin log, so this page grants nothing by itself. Admins see accounts and counts, not anyone's workouts. */

const TABS = [['overview', 'Overview'], ['users', 'Users'], ['errors', 'Errors'], ['log', 'Activity log'], ['settings', 'Settings']];
const FILTERS = [['', 'All'], ['pending', 'Pending'], ['active', 'Active'], ['deactivated', 'Deactivated'], ['admin', 'Admins']];
const ACTIONS = { approve: 'Approved', deactivate: 'Deactivated', reactivate: 'Reactivated', sign_out: 'Signed out everywhere', delete: 'Deleted', grant_admin: 'Made admin', revoke_admin: 'Removed admin', settings: 'Changed settings', clear_errors: 'Cleared errors' };
const PAGE = 50;

/* kept across visits while the app is open */
const ST = { tab: 'overview', ov: null, users: null, total: 0, q: '', filter: '', errors: null, days: 7, log: null, logTotal: 0, admins: null, err: null, loading: false };
let C = null, root = null, qTimer = 0, seq = 0;

export function mountAdmin(el, ctx) {
  C = ctx; root = el;
  el.addEventListener('click', onClick);
  el.addEventListener('input', onInput);
  draw(); load();
}

/* ---------- data ---------- */
async function rpc(name, args) {
  const { data, error } = await C.sb.rpc(name, args);
  if (error) throw Object.assign(new Error(error.message || 'Something went wrong'), { code: error.code });
  return data;
}
/* a newer load or search makes an older one's answer stale; only the latest is drawn */
async function load() {
  const my = ++seq;
  ST.loading = true; ST.err = null; draw();
  try {
    if (ST.tab === 'overview') ST.ov = await rpc('admin_overview');
    else if (ST.tab === 'users') { const rows = await rpc('admin_users', { p_search: ST.q || null, p_status: ST.filter || null, p_limit: PAGE, p_offset: 0 }) || []; if (my !== seq) return; ST.users = rows; ST.total = rows[0] ? +rows[0].total : 0; if (!ST.ov) ST.ov = await rpc('admin_overview'); }
    else if (ST.tab === 'errors') ST.errors = await rpc('admin_errors', { p_days: ST.days }) || [];
    else if (ST.tab === 'log') { const rows = await rpc('admin_log_list', { p_limit: PAGE, p_offset: 0 }) || []; ST.log = rows; ST.logTotal = rows[0] ? +rows[0].total : 0; }
    else if (ST.tab === 'settings') { ST.ov = await rpc('admin_overview'); ST.admins = await rpc('admin_users', { p_search: null, p_status: 'admin', p_limit: 200, p_offset: 0 }) || []; }
  } catch (e) { if (my === seq) ST.err = e.code === '42501' ? 'This account isn’t an admin.' : e.message; }
  if (my !== seq) return;
  ST.loading = false; draw();
}
async function act(name, args, done) {
  try { await rpc(name, args); if (done) C.toast(done); ST.ov = null; await load(); return true; }
  catch (e) { C.toast(e.message); return false; }
}

/* ---------- drawing ---------- */
const esc = s => C.esc(s == null ? '' : String(s));
const n = v => (+v || 0).toLocaleString('en-US');
function ago(t) {
  if (!t) return 'never'; const d = (Date.now() - Date.parse(t)) / 1000;
  if (d < 90) return 'just now'; if (d < 3600) return `${Math.round(d / 60)} min ago`; if (d < 86400) return `${Math.round(d / 3600)} h ago`;
  if (d < 86400 * 30) return `${Math.round(d / 86400)} d ago`; return C.fmtDate(Date.parse(t));
}
const badge = st => `<span class="adm-st ${esc(st)}">${esc(st)}</span>`;
const who = u => u.display_name || (u.username ? '@' + u.username : u.email);

function tabs() {
  const p = ST.ov && ST.ov.users ? +ST.ov.users.pending : 0;
  return `<nav class="adm-tabs" role="tablist">${TABS.map(([id, t]) => `<button role="tab" aria-selected="${ST.tab === id}" class="${ST.tab === id ? 'on' : ''}" data-adm="tab" data-t="${id}">${t}${id === 'users' && p ? ` <b class="adm-count">${p}</b>` : ''}</button>`).join('')}</nav>`;
}
function draw() {
  if (!root || !root.isConnected) return;
  /* on Users the search box stays put (with its focus and what's being typed) while everything around it redraws */
  const q = root.querySelector('[data-adm-in="q"]');
  if (q && ST.tab === 'users' && !ST.err) {
    root.querySelector('.adm-tabs').outerHTML = tabs();
    root.querySelector('.adm-chips').innerHTML = chips(); root.querySelector('.adm-bulk').innerHTML = bulk(); root.querySelector('.adm-list').innerHTML = list();
    return;
  }
  root.innerHTML = `<div class="adm-head"><div><span class="lbl">Synergym</span><h1 class="h1">Admin</h1></div><button class="btn ghost sm" data-adm="refresh">${C.roll('Refresh')}</button></div>
  ${tabs()}<div class="adm-body">${ST.err ? `<div class="msg err">${esc(ST.err)}</div>` : body()}</div>`;
}
function body() {
  const busy = `<div class="empty">Loading…</div>`;
  if (ST.tab === 'overview') return ST.ov ? overview(ST.ov) : busy;
  if (ST.tab === 'users') return users();
  if (ST.tab === 'errors') return ST.errors ? errors() : busy;
  if (ST.tab === 'log') return ST.log ? logList() : busy;
  return ST.ov && ST.admins ? settings() : busy;
}

function overview(o) {
  const u = o.users || {}, kpi = (k, v, sub, cls = '') => `<div class="adm-kpi ${cls}"><span class="lbl">${k}</span><b>${v}</b><span class="muted">${sub}</span></div>`;
  const pend = +u.pending || 0;
  return `${pend ? `<button class="adm-callout" data-adm="tab" data-t="users" data-f="pending"><b>${pend} ${pend === 1 ? 'account is' : 'accounts are'} waiting for approval</b><span>Review</span></button>` : ''}
  <div class="adm-kpis">
    ${kpi('Accounts', n(u.total), `${n(u.active)} active · ${n(u.pending)} pending · ${n(u.deactivated)} deactivated`)}
    ${kpi('Active lifters', n(o.active_7d), `logged in the last 7 days · ${n(o.active_30d)} in 30`)}
    ${kpi('Sessions', n(o.sessions_7d), `last 7 days · ${n(o.sessions_today)} today · ${n(o.sessions_total)} all time`)}
    ${kpi('Sets logged', n(o.sets_30d), 'last 30 days')}
    ${kpi('New sign-ups', n(o.signups_7d), `last 7 days · ${n(o.signups_30d)} in 30`)}
    ${kpi('Splits', n(o.splits), `${n(o.shared_links)} shared by link · ${n(o.shares)} shares`)}
    ${kpi('Reminders', n(o.reminders_on), `on · ${n(o.devices)} devices`)}
    ${kpi('Errors', n(o.errors_7d), 'last 7 days', +o.errors_7d ? 'warn' : '')}
  </div>
  <div class="adm-charts">${chart('Sessions per day', o.daily, 'sessions')}${chart('Sign-ups per day', o.daily, 'signups')}</div>
  <p class="muted adm-note">New accounts ${o.require_approval ? '<b>need approval</b>' : 'are <b>let in straight away</b>'}. Change it in <button class="linkbtn" data-adm="tab" data-t="settings">Settings</button>.</p>`;
}
/* 30 days as thin bars; today in the accent colour */
function chart(title, days, key) {
  const d = Array.isArray(days) ? days : [], vals = d.map(x => +x[key] || 0), max = Math.max(1, ...vals), W = 300, H = 80, bw = W / Math.max(30, d.length);
  const bars = vals.map((v, i) => { const h = v ? Math.max(3, v / max * (H - 6)) : 1.5; return `<rect class="${i === vals.length - 1 ? 'now' : ''}" x="${(i * bw + bw * 0.18).toFixed(1)}" y="${(H - h).toFixed(1)}" width="${(bw * 0.64).toFixed(1)}" height="${h.toFixed(1)}" rx="1.5"><title>${esc(d[i].d)}: ${v}</title></rect>`; }).join('');
  return `<section class="card adm-chart"><div class="card-h"><span class="lbl">${title}</span><span class="lbl">${n(vals.reduce((a, b) => a + b, 0))} in 30 days · peak ${n(max)}</span></div>
  <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${title}, last 30 days">${bars}</svg>
  <div class="axis"><span class="lbl">${d[0] ? esc(C.fmtDate(Date.parse(d[0].d))) : ''}</span><span class="lbl">today</span></div></section>`;
}

function users() {
  return `<div class="adm-tools"><input class="search" data-adm-in="q" placeholder="Search email, username or name" value="${esc(ST.q)}" autocomplete="off" aria-label="Search accounts">
    <div class="hf-row adm-chips">${chips()}</div><div class="adm-bulk">${bulk()}</div></div><div class="adm-list">${list()}</div>`;
}
function chips() {
  const counts = ST.ov && ST.ov.users ? ST.ov.users : {};
  return FILTERS.map(([v, t]) => { const c = v && v !== 'admin' ? counts[v] : v === '' ? counts.total : null; return `<button class="chip${ST.filter === v ? ' on' : ''}" data-adm="filter" data-f="${v}">${t}${c != null ? ` <span class="adm-cn">${n(c)}</span>` : ''}</button>`; }).join('');
}
function bulk() {
  const pend = ST.users ? ST.users.filter(u => u.status === 'pending').length : 0;
  return `${ST.filter === 'pending' && pend ? `<button class="btn sm" data-adm="approve-all">Approve all ${pend}</button>` : ''}<button class="btn ghost sm" data-adm="csv">${C.roll('Export CSV')}</button>`;
}
function list() {
  const rows = ST.users;
  return !rows ? `<div class="empty">Loading…</div>` : rows.length ? `<div class="list adm-users">${rows.map(userRow).join('')}</div>
    <div class="adm-more">${rows.length < ST.total ? `<button class="btn line sm" data-adm="more">Load more (${rows.length} of ${n(ST.total)})</button>` : `<span class="lbl">${n(ST.total)} ${ST.total === 1 ? 'account' : 'accounts'}</span>`}</div>`
    : `<div class="empty"><b>No accounts match.</b>${ST.q ? 'Try another search.' : ''}</div>`;
}
function userRow(u) {
  const last = u.last_session_at || u.last_sign_in_at;
  return `<div class="row adm-u" data-adm="user" data-id="${esc(u.id)}" role="button" tabindex="0">
    <span class="row-m"><span class="t">${esc(who(u))}${u.is_admin ? '<span class="badge acc">admin</span>' : ''}${u.id === C.me ? '<span class="badge">you</span>' : ''}</span>
    <span class="sub">${esc(u.email)}${u.username && u.display_name ? ` · @${esc(u.username)}` : ''} · joined ${esc(ago(u.created_at))} · active ${esc(ago(last))} · ${n(u.sessions)} sessions</span></span>
    <span class="row-r">${badge(u.status)}${u.status === 'pending' ? `<button class="btn sm" data-adm="approve" data-id="${esc(u.id)}">Approve</button>` : ''}</span></div>`;
}

function errors() {
  const e = ST.errors;
  return `<div class="adm-tools adm-row"><span class="seg" role="group" aria-label="Range">${[7, 30].map(d => `<button class="${ST.days === d ? 'on' : ''}" data-adm="days" data-d="${d}">${d} days</button>`).join('')}</span>
    ${e.length ? `<button class="btn ghost sm" data-adm="clear-errors">${C.roll('Clear all')}</button>` : ''}</div>
  ${e.length ? `<div class="list">${e.map(x => `<div class="row adm-err"><span class="row-m"><span class="t">${esc(x.message)}</span><span class="sub">${n(x.n)} ${+x.n === 1 ? 'time' : 'times'} · ${n(x.users)} ${+x.users === 1 ? 'person' : 'people'} · last ${esc(ago(x.last_at))}${x.path ? ` · ${esc(x.path)}` : ''}${x.build ? ` · ${esc(x.build)}` : ''}</span></span></div>`).join('')}</div>`
    : `<div class="empty"><b>No errors in the last ${ST.days} days.</b>Errors from people’s browsers show up here.</div>`}`;
}

function logList() {
  const l = ST.log;
  return l.length ? `<div class="list">${l.map(x => `<div class="row adm-log"><span class="row-m"><span class="t">${esc(ACTIONS[x.action] || x.action)}${x.target_email ? ` · ${esc(x.target_email)}` : ''}</span>
      <span class="sub">${esc(C.fmtDate(Date.parse(x.at)))} ${esc(C.fmtTime(Date.parse(x.at)))} · by ${esc(x.admin_email || 'an admin')}${x.detail ? ` · ${esc(x.detail)}` : ''}</span></span></div>`).join('')}</div>
    <div class="adm-more">${l.length < ST.logTotal ? `<button class="btn line sm" data-adm="more-log">Load more (${l.length} of ${n(ST.logTotal)})</button>` : `<span class="lbl">${n(ST.logTotal)} ${ST.logTotal === 1 ? 'entry' : 'entries'}</span>`}</div>`
    : `<div class="empty"><b>No admin actions yet.</b>Approvals, deactivations, deletions and setting changes are recorded here.</div>`;
}

function settings() {
  const on = !!ST.ov.require_approval;
  return `<section class="sg"><h2 class="sg-h">Sign-ups</h2><div class="sg-b">
    <div class="srow"><span class="k">Require approval<small>New accounts wait on a holding screen until an admin approves them</small></span><button class="toggle${on ? ' on' : ''}" data-adm="approval" aria-pressed="${on}" aria-label="Require approval for new accounts"></button></div>
  </div><p class="sg-f">${on ? 'On: new accounts start as pending.' : 'Off: new accounts can use the app straight away.'} Existing accounts aren’t affected.</p></section>
  <section class="sg"><h2 class="sg-h">Admins</h2><div class="sg-b">${ST.admins.map(u => `<div class="srow"><span class="k">${esc(who(u))}<small>${esc(u.email)}</small></span>${u.id === C.me ? '<span class="v">you</span>' : `<button class="btn ghost sm" data-adm="unadmin" data-id="${esc(u.id)}">Remove</button>`}</div>`).join('')}</div>
  <p class="sg-f">To add an admin, open an active account in Users and choose Make admin.</p></section>
  <section class="sg"><h2 class="sg-h">How access works</h2><div class="sg-b"><p class="adm-help">Pending and deactivated accounts can’t read or save any data; the database enforces it, not just this page. Deactivating also blocks sign-in and signs the account out on every device. Deleting removes the account and all its data for good. Every action here is recorded in the activity log.</p></div></section>`;
}

/* ---------- one account ---------- */
async function openUser(id) {
  C.openSheet(`<div class="sh-h"><h3>Account</h3><button class="btn ghost sm" data-act="close">Close</button></div><div class="empty">Loading…</div>`);
  let u; try { u = await rpc('admin_user', { p_id: id }); } catch (e) { C.closeSheet(); return C.toast(e.message); }
  const self = u.id === C.me, fact = (k, v) => `<div><span class="lbl">${k}</span><b>${v}</b></div>`;
  const btn = (a, t, cls = 'line') => `<button class="btn ${cls}" data-adm-s="${a}">${t}</button>`;
  let acts = '';
  if (self) acts = `<p class="muted">This is your account. Manage it from Settings.</p>`;
  else if (u.is_admin) acts = btn('unadmin', 'Remove admin access') + `<p class="muted adm-sm">Remove admin access before deactivating or deleting this account.</p>`;
  else {
    if (u.status === 'pending') acts += btn('approve', 'Approve', '') + btn('delete', 'Reject and delete', 'danger');
    if (u.status === 'active') acts += btn('deactivate', 'Deactivate') + btn('signout', 'Sign out everywhere') + btn('admin', 'Make admin');
    if (u.status === 'deactivated') acts += btn('reactivate', 'Reactivate', '');
    if (u.status !== 'pending') acts += btn('delete', 'Delete permanently', 'danger');
  }
  C.openSheet(`<div class="sh-h"><div><span class="lbl">Account</span><h3>${esc(who(u))}</h3></div><button class="btn ghost sm" data-act="close">Close</button></div>
  <p class="adm-id">${esc(u.email)}${u.username ? ` · @${esc(u.username)}` : ''} ${badge(u.status)}${u.is_admin ? '<span class="badge acc">admin</span>' : ''}</p>
  <div class="adm-facts">
    ${fact('Joined', esc(C.fmtDate(Date.parse(u.created_at))))}${fact('Last sign-in', esc(ago(u.last_sign_in_at)))}${fact('Last session', esc(ago(u.last_session_at)))}
    ${fact('Sessions', `${n(u.sessions)} <small>${n(u.sessions_30d)} in 30 d</small>`)}${fact('Splits', n(u.splits))}${fact('Own exercises', n(u.custom_exercises))}
    ${fact('Reminders', u.reminder_on ? `on <small>${n(u.devices)} devices</small>` : 'off')}${fact('Errors', `${n(u.errors_30d)} <small>30 d</small>`)}${fact('Set up', u.onboarded ? 'done' : 'not yet')}
    ${fact('Goal', esc(u.goal ? u.goal.replace('_', ' ') : '–'))}${fact('Level', esc(u.experience || '–'))}${fact('Status since', esc(u.status_at ? ago(u.status_at) : '–'))}
  </div>
  <div class="adm-acts">${acts}</div>
  ${u.log && u.log.length ? `<span class="lbl" style="display:block;margin-top:16px">Admin history</span><div class="list">${u.log.map(x => `<div class="row adm-log"><span class="row-m"><span class="t">${esc(ACTIONS[x.action] || x.action)}</span><span class="sub">${esc(ago(x.at))} · by ${esc(x.admin_email || 'an admin')}${x.detail ? ` · ${esc(x.detail)}` : ''}</span></span></div>`).join('')}</div>` : ''}`,
  r => r.querySelectorAll('[data-adm-s]').forEach(b => b.onclick = () => userAction(b.dataset.admS, u)));
}
function userAction(a, u) {
  const name = who(u), reopen = () => openUser(u.id);
  if (a === 'approve') return C.closeSheet(), act('admin_set_status', { p_id: u.id, p_status: 'active' }, `${name} approved`);
  if (a === 'reactivate') return C.closeSheet(), act('admin_set_status', { p_id: u.id, p_status: 'active' }, `${name} reactivated`);
  if (a === 'deactivate') return C.confirmSheet(`Deactivate ${name}?`, 'They’re signed out on every device, can’t sign back in, and can’t read or save anything until you reactivate them. Their data is kept.', 'Deactivate', () => act('admin_set_status', { p_id: u.id, p_status: 'deactivated' }, `${name} deactivated`));
  if (a === 'signout') return C.confirmSheet(`Sign ${name} out everywhere?`, 'Every device they’re signed in on is signed out within the hour. They can sign back in.', 'Sign out', () => act('admin_sign_out', { p_id: u.id }, `${name} will be signed out`));
  if (a === 'admin') return C.confirmSheet(`Make ${name} an admin?`, 'They’ll be able to open this console: approve, deactivate and delete accounts, and change settings.', 'Make admin', () => act('admin_set_admin', { p_id: u.id, p_on: true }, `${name} is now an admin`));
  if (a === 'unadmin') return C.confirmSheet(`Remove ${name}’s admin access?`, 'They keep their account; they just can’t open this console.', 'Remove', () => act('admin_set_admin', { p_id: u.id, p_on: false }, 'Admin access removed').then(ok => ok && ST.tab !== 'settings' && reopen()));
  if (a === 'delete') return deleteSheet(u);
}
/* deleting can't be undone: type the email to confirm */
function deleteSheet(u) {
  C.openSheet(`<div class="sh-h"><h3>Delete ${esc(who(u))}?</h3><button class="btn ghost sm" data-act="close">Cancel</button></div>
  <p class="muted">This permanently deletes the account and everything in it: sessions, splits, exercises and settings. It can’t be undone.</p>
  <label class="adm-confirm">Type <b>${esc(u.email)}</b> to confirm<input class="field" id="adm-del" autocomplete="off" autocapitalize="off" spellcheck="false"></label>
  <div class="btns"><button class="btn ghost" data-act="close">Cancel</button><button class="btn danger" id="adm-del-go" disabled>Delete permanently</button></div>`, r => {
    const i = r.querySelector('#adm-del'), go = r.querySelector('#adm-del-go');
    i.oninput = () => { go.disabled = i.value.trim().toLowerCase() !== String(u.email).toLowerCase(); };
    go.onclick = async () => { go.disabled = true; go.textContent = 'Deleting…'; C.closeSheet(); await act('admin_delete_user', { p_id: u.id }, `${who(u)} deleted`); };
  });
}

/* ---------- events ---------- */
async function onClick(e) {
  const el = e.target.closest('[data-adm]'); if (!el || !root.contains(el)) return;
  const a = el.dataset.adm;
  if (a === 'tab') { ST.tab = el.dataset.t; if (el.dataset.f != null) { ST.filter = el.dataset.f; ST.users = null; } ST.err = null; draw(); return load(); }
  if (a === 'refresh') { ST.ov = null; return load(); }
  if (a === 'filter') { ST.filter = el.dataset.f; ST.users = null; draw(); return load(); }
  if (a === 'user' && !e.target.closest('button')) return openUser(el.dataset.id);
  if (a === 'approve') { e.stopPropagation(); el.disabled = true; return act('admin_set_status', { p_id: el.dataset.id, p_status: 'active' }, 'Approved'); }
  if (a === 'approve-all') {
    const ids = (ST.users || []).filter(u => u.status === 'pending').map(u => u.id);
    return C.confirmSheet(`Approve ${ids.length} ${ids.length === 1 ? 'account' : 'accounts'}?`, 'They can use the app straight away.', 'Approve all', async () => {
      let ok = 0; for (const id of ids) { try { await rpc('admin_set_status', { p_id: id, p_status: 'active' }); ok++; } catch { /* reported below */ } }
      C.toast(ok === ids.length ? `${ok} approved` : `${ok} of ${ids.length} approved`); ST.ov = null; load();
    }, 'Cancel');
  }
  if (a === 'more') {
    try { const rows = await rpc('admin_users', { p_search: ST.q || null, p_status: ST.filter || null, p_limit: PAGE, p_offset: ST.users.length }) || []; ST.users = ST.users.concat(rows); draw(); } catch (err) { C.toast(err.message); }
    return;
  }
  if (a === 'more-log') {
    try { const rows = await rpc('admin_log_list', { p_limit: PAGE, p_offset: ST.log.length }) || []; ST.log = ST.log.concat(rows); draw(); } catch (err) { C.toast(err.message); }
    return;
  }
  if (a === 'csv') return exportCsv();
  if (a === 'days') { ST.days = +el.dataset.d; ST.errors = null; draw(); return load(); }
  if (a === 'clear-errors') return C.confirmSheet('Clear all errors?', 'Every stored error report is deleted. New ones keep arriving as they happen.', 'Clear all', () => act('admin_clear_errors', {}, 'Errors cleared'));
  if (a === 'approval') {
    const on = !ST.ov.require_approval;
    return act('admin_settings', { p_require_approval: on }, on ? 'New accounts now need approval' : 'New accounts are let in straight away');
  }
  if (a === 'unadmin') { const u = (ST.admins || []).find(x => x.id === el.dataset.id); if (u) userAction('unadmin', u); }
}
function onInput(e) {
  if (e.target.dataset.admIn !== 'q') return;
  ST.q = e.target.value; clearTimeout(qTimer);
  qTimer = setTimeout(async () => {
    const my = ++seq;
    try { const rows = await rpc('admin_users', { p_search: ST.q || null, p_status: ST.filter || null, p_limit: PAGE, p_offset: 0 }) || []; if (my !== seq) return; ST.users = rows; ST.total = rows[0] ? +rows[0].total : 0; }
    catch (err) { return C.toast(err.message); }
    draw();
  }, 250);
}
/* every account in the current filter and search, as a spreadsheet */
async function exportCsv() {
  let all = [], off = 0;
  try { for (;;) { const rows = await rpc('admin_users', { p_search: ST.q || null, p_status: ST.filter || null, p_limit: 200, p_offset: off }) || []; all = all.concat(rows); off += rows.length; if (rows.length < 200 || off >= 5000) break; } }
  catch (e) { return C.toast(e.message); }
  const cell = v => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const head = ['email', 'username', 'name', 'status', 'admin', 'joined', 'last_sign_in', 'sessions', 'last_session', 'splits'];
  const lines = [head.join(',')].concat(all.map(u => [u.email, u.username, u.display_name, u.status, u.is_admin ? 'yes' : 'no', u.created_at, u.last_sign_in_at, u.sessions, u.last_session_at, u.splits].map(cell).join(',')));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
  a.download = `synergym-accounts-${new Date().toISOString().slice(0, 10)}.csv`; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  C.toast(`Exported ${all.length} ${all.length === 1 ? 'account' : 'accounts'}`);
}
