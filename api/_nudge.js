/* What a workout reminder says, or whether it says anything at all. Every reminder is about one of two things:
   - a session still open: one started 3+ hours ago and never finished, so its sets aren't saved into your
     progress yet. It says so and opens that session;
   - otherwise, your next session: the split day and its first targets, with at most one line of context (your
     first session, coming back after time away, a lighter week, an easy day, one more for the week, or the week
     so far). The wording changes from day to day.
   It stays quiet while a session is under way, on a day you've trained, a day you marked as rest, a day the coach
   called rest, a planned week off, and once the week's target is met. After time away it thins out (every 3 days
   after 10 days, weekly after 3 weeks, fortnightly after 2 months), and a session left open for days is mentioned
   every 3 days, not daily. It never scolds.
   The brief is worked out by the app (it runs the coach) and saved on the profile; see reminderBrief in src/main.js.
   (A file starting with _ is not served as an endpoint.) */

/* a small, stable hash: the same person on the same day always gets the same wording */
const hash = s => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
const txt = (v, n) => typeof v === 'string' && v.trim() ? v.trim().replace(/\s+/g, ' ').slice(0, n) : null;
const int = v => Number.isFinite(+v) && v !== null && v !== '' ? Math.round(+v) : null;
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

/* the brief, trusting nothing about its shape. list: the next session's first targets (older briefs have one,
   as lift and tgt) */
export function cleanBrief(b) {
  if (!b || typeof b !== 'object' || Array.isArray(b)) return { list: [] };
  const list = (Array.isArray(b.list) ? b.list : b.lift && b.tgt ? [{ lift: b.lift, tgt: b.tgt }] : [])
    .map(x => x && typeof x === 'object' && txt(x.lift, 40) && txt(x.tgt, 24) ? { lift: txt(x.lift, 40), tgt: txt(x.tgt, 24) } : null).filter(Boolean).slice(0, 3);
  return {
    day: txt(b.day, 30), n: Math.max(0, int(b.n) || 0), list,
    call: ['train', 'easy', 'rest'].includes(b.call) ? b.call : null, for: txt(b.for, 10),
    deload: ['deload', 'off'].includes(b.deload) ? b.deload : null, coach: !!b.coach
  };
}

/* the session left open, from the database's columns or the app's own ctx.open: { id, name, mins, days, sets } */
const OPEN_AFTER = 180;
function openOf(ctx) {
  const o = ctx.open && typeof ctx.open === 'object' ? ctx.open : { id: ctx.open_id, name: ctx.open_name, mins: ctx.open_mins, days: ctx.open_days, sets: ctx.open_sets };
  const mins = int(o.mins);
  return o.id && mins != null ? { id: String(o.id).slice(0, 40), name: txt(o.name, 40), mins, days: Math.max(0, int(o.days) || 0), sets: Math.max(0, int(o.sets) || 0) } : null;
}

/* how many days apart reminders are after time away */
export const every = gap => gap == null || gap < 10 ? 1 : gap < 21 ? 3 : gap < 60 ? 7 : 14;
/* "2026-10-27" → "2026-10-27"; the app's day keys aren't zero-padded ("2026-3-5"), so compare as numbers */
const sameDay = (a, b) => { const x = String(a || '').split('-').map(Number), y = String(b || '').split('-').map(Number); return x.length === 3 && x.every((v, i) => v === y[i]); };

/* why today is quiet, or null to send */
export function quiet(ctx) {
  const b = cleanBrief(ctx.brief), target = int(ctx.target) || 3, since = int(ctx.since), o = openOf(ctx);
  if (o) {
    if (o.mins < OPEN_AFTER) return 'in-session';
    /* a session to finish matters even on a day you trained or rested; one left for days, every few days */
    return o.days >= 2 && since != null && since < 3 ? 'thinned' : null;
  }
  if (ctx.today) return 'trained';
  if (ctx.rest) return 'rest-day';
  if ((int(ctx.wk) || 0) >= target) return 'target-met';
  if (b.call === 'rest' && sameDay(b.for, ctx.day)) return 'coach-rest';
  if (b.deload === 'off') return 'week-off';
  if (since != null && since < every(int(ctx.gap))) return 'thinned';
  return null;
}

/* ctx: { uid, name, day ('YYYY-MM-DD', local), wk, target, gap (days since the last session before today, or since
   joining), total, since (days since the last reminder sent), rest, today, brief, and the open session (open_id,
   open_name, open_mins, open_days, open_sets, or open: {…}) }. force: skip the quiet rules (a test).
   Returns { title, body, url, tag } or null. */
export function compose(ctx, { force = false } = {}) {
  if (!force && quiet(ctx)) return null;
  const b = cleanBrief(ctx.brief), seed = hash(`${ctx.uid || ''}|${ctx.day || ''}`), pick = (l, k = 0) => l[(seed >>> k) % l.length];
  const first = txt(String(ctx.name || '').split(' ')[0], 20), wk = int(ctx.wk) || 0, target = int(ctx.target) || 3, gap = int(ctx.gap), total = int(ctx.total) || 0;
  const out = (title, body, url = '/') => ({ title, body: body.replace(/\s+/g, ' ').trim().slice(0, 170), url, tag: 'reminder' });

  /* a session to complete */
  const o = openOf(ctx);
  if (o && o.mins >= OPEN_AFTER) {
    const name = o.name || 'Your session', when = o.days === 0 ? 'earlier today' : o.days === 1 ? 'yesterday' : o.days < 7 ? `${o.days} days ago` : 'over a week ago';
    return out(pick([`${name} is still open`, 'Finish your session?', 'A session to wrap up']),
      o.sets ? `You started it ${when} and logged ${plural(o.sets, 'set')}. Finish it to save them and keep your next targets right.`
        : `You started it ${when} but haven’t logged a set. Pick it up, or finish it so your next session starts fresh.`, `/session/${encodeURIComponent(o.id)}`);
  }

  /* the next session: one line of context, then what's on the plan */
  const away = gap != null && gap >= (target <= 1 ? 14 : 7);
  const context = !total ? 'Your first session: log as you go and your targets start from there.'
    : away ? `It’s been ${gap < 14 ? `${gap} days` : gap < 60 ? `${Math.round(gap / 7)} weeks` : 'a while'}. A short session still counts${b.coach && gap >= 14 ? ', and your targets start a little lighter' : ''}.`
    : b.deload === 'deload' ? 'Lighter week: about 90% of your usual weights, half the sets.'
    : b.call === 'easy' && sameDay(b.for, ctx.day) ? 'An easier day: targets about 10% lighter, one set fewer.'
    : target >= 2 && wk === target - 1 ? `One more makes ${target} this week.`
    : wk && seed % 2 ? `${wk} of ${target} this week.` : '';
  const plan = list => {
    if (!list.length) return b.day && b.n ? `${plural(b.n, 'exercise')} ready.` : '';
    const rest = b.n > list.length ? `, then ${b.n - list.length} more` : '';
    return `${pick(['First up: ', 'On the plan: ', ''], 2)}${list.map(x => `${x.lift} ${x.tgt}`).join(', ')}${rest}.`;
  };
  /* as many targets as fit a notification */
  let list = b.list, body = `${context} ${plan(list)}`;
  while (body.length > 160 && list.length > 1) { list = list.slice(0, -1); body = `${context} ${plan(list)}`; }
  if (b.day) return out(pick([`Next up: ${b.day}`, `${b.day} today?`, `Time for ${b.day}`, first ? `${first}, ${b.day} is up` : `${b.day} is up`]), body);
  return out(pick(['Your next session', 'Time to train', first ? `Ready, ${first}?` : 'Ready to train?']),
    !total || away ? context : `${context} ${wk ? 'Whatever you train today counts.' : 'First session of the week, whenever it suits you.'}`);
}
