/* What a workout reminder says, or whether it says anything at all. The aim is a note from a coach who knows
   your log, not an app chasing you, so:
   - it stays quiet on a day you've trained (or started a session), a day you marked as rest, a day the coach
     called rest, a planned week off, and once the week's target is met;
   - after time away it thins out (every 3 days after 10 days away, weekly after 3 weeks, fortnightly after 2 months)
     and never scolds;
   - otherwise it says the most useful thing: a first session, coming back, a goal ready to test, a lighter week,
     an easy day, one more for the week, last session's record, a goal in reach, or simply what's next with its first
     target. The wording changes from day to day.
   The brief is worked out by the app (it runs the coach) and saved on the profile; see reminderBrief in src/main.js.
   (A file starting with _ is not served as an endpoint.) */

/* a small, stable hash: the same person on the same day always gets the same wording */
const hash = s => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
const txt = (v, n) => typeof v === 'string' && v.trim() ? v.trim().replace(/\s+/g, ' ').slice(0, n) : null;
const int = v => Number.isFinite(+v) && v !== null && v !== '' ? Math.round(+v) : null;

/* the brief, trusting nothing about its shape */
export function cleanBrief(b) {
  if (!b || typeof b !== 'object' || Array.isArray(b)) return {};
  const g = b.goal && typeof b.goal === 'object' ? b.goal : null;
  return {
    day: txt(b.day, 30), n: Math.max(0, int(b.n) || 0), lift: txt(b.lift, 40), tgt: txt(b.tgt, 24),
    call: ['train', 'easy', 'rest'].includes(b.call) ? b.call : null, for: txt(b.for, 10),
    deload: ['deload', 'off'].includes(b.deload) ? b.deload : null, coach: !!b.coach, pr: txt(b.pr, 40),
    goal: g && txt(g.lift, 40) && txt(g.kg, 16) ? { lift: txt(g.lift, 40), kg: txt(g.kg, 16), left: txt(g.left, 16), pct: Math.max(0, Math.min(100, int(g.pct) || 0)), ready: !!g.ready, wk: txt(g.wk, 40) } : null
  };
}

/* how many days apart reminders are after time away */
export const every = gap => gap == null || gap < 10 ? 1 : gap < 21 ? 3 : gap < 60 ? 7 : 14;
/* "2026-10-27" → "2026-10-27"; the app's day keys aren't zero-padded ("2026-3-5"), so compare as numbers */
const sameDay = (a, b) => { const x = String(a || '').split('-').map(Number), y = String(b || '').split('-').map(Number); return x.length === 3 && x.every((v, i) => v === y[i]); };

/* why today is quiet, or null to send */
export function quiet(ctx) {
  const b = cleanBrief(ctx.brief), target = int(ctx.target) || 3;
  if (ctx.today) return 'trained';
  if (ctx.rest) return 'rest-day';
  if ((int(ctx.wk) || 0) >= target) return 'target-met';
  if (b.call === 'rest' && sameDay(b.for, ctx.day)) return 'coach-rest';
  if (b.deload === 'off') return 'week-off';
  const since = int(ctx.since);
  if (since != null && since < every(int(ctx.gap))) return 'thinned';
  return null;
}

/* ctx: { uid, name, day ('YYYY-MM-DD', local), dow (1 = Monday), wk, target, gap (days since the last session
   before today, or since joining), streak, total, since (days since the last reminder sent), rest, today, brief }.
   force: skip the quiet rules (a test). Returns { title, body, url, tag } or null. */
export function compose(ctx, { force = false } = {}) {
  if (!force && quiet(ctx)) return null;
  const b = cleanBrief(ctx.brief), seed = hash(`${ctx.uid || ''}|${ctx.day || ''}`), pick = (l, k = 0) => l[(seed >>> k) % l.length];
  const first = txt(String(ctx.name || '').split(' ')[0], 20), wk = int(ctx.wk) || 0, target = int(ctx.target) || 3, gap = int(ctx.gap), total = int(ctx.total) || 0;
  const day = b.day, lead = b.lift && b.tgt ? `${b.lift} ${b.tgt}` : null;
  const more = b.n > 1 ? `, then ${b.n - 1} more exercise${b.n > 2 ? 's' : ''}` : '';
  /* "Lower is next: Back Squat 137.5 kg × 5 to start." */
  const next = day ? (lead ? pick([`${day} is next: ${lead} to start.`, `Next up is ${day}, opening with ${lead}.`, `${day} is next. First up: ${lead}.`], 3) : `${day} is next.`) : null;
  const out = (title, body, url = '/') => ({ title, body: body.replace(/\s+/g, ' ').trim().slice(0, 170), url, tag: 'reminder' });

  if (!total) return out(pick(['Your first session', 'Ready when you are']),
    `${day ? `${day} is set up. ` : ''}Log as you go: your targets start from your first set.`);

  /* time away: a week, or two for someone who trains once a week */
  if (gap != null && gap >= (target <= 1 ? 14 : 7)) {
    const away = gap < 14 ? `${gap} days` : gap < 60 ? `${Math.round(gap / 7)} weeks` : 'a while';
    const lighter = b.coach && gap >= 14 ? ' Your targets start a little lighter after time away.' : '';
    return out(pick(['Whenever you’re ready', first ? `Still here, ${first}` : 'Still here for you', 'Easing back in']),
      pick([`It’s been ${away}. Even a short session gets things moving again.`, `It’s been ${away}, and that’s fine. ${day ? `${day} is next whenever it suits you.` : 'Pick something you enjoy.'}`], 1) + lighter);
  }

  const g = b.goal;
  if (g && g.ready) return out(`${g.lift} ${g.kg}: test day?`, 'Your estimated max says you’re there. Warm up, a couple of heavy singles, then go for it.', '/coach/goals');

  if (b.deload === 'deload') return out(pick(['Lighter week', 'Deload week']),
    `Same lifts at about 90% with half the sets: most people come back stronger. ${day ? `${day} is next.` : ''}`, '/coach/recovery');

  if (b.call === 'easy' && sameDay(b.for, ctx.day)) return out(pick(['An easier one today', 'Take it a bit lighter']),
    `The coach suggests about 10% lighter and a set fewer today. ${day ? `${day} is next.` : ''}`, '/coach');

  if (target >= 2 && wk === target - 1) return out(pick(['One more for the week', `${wk} down, one to go`]),
    `${next || 'Anything you train today rounds off the week.'}`);

  if (b.pr && gap != null && gap <= 3) return out(pick([`New best on ${b.pr}`, 'Nice work last time']),
    `${pick([`Last session set a record on ${b.pr}.`, `That ${b.pr} record was a good one.`], 2)} ${next || 'Keep it rolling.'}`);

  if (g && g.pct >= 75 && seed % 3 === 0) return out(`${g.lift} ${g.kg} is getting close`,
    `${g.left ? `About ${g.left} to go. ` : ''}${g.wk ? `This week’s work: ${g.wk}.` : next || ''}`, '/coach/goals');

  const week = wk ? ` ${wk} of ${target} this week.` : '';
  if (day && lead) return out(pick([`${day} today?`, `Up next: ${day}`, first ? `${first}, ${day} is up` : `${day} is up`]),
    pick([`${lead} to start${more}.`, `First up: ${lead}${more}.`, `It opens with ${lead}${more}.`], 2) + (seed % 2 ? week : ''));
  if (day) return out(pick([`${day} today?`, `Up next: ${day}`]), `Your split day is ready when you are.${week}`);
  return out(pick(['Time to train', first ? `Ready, ${first}?` : 'Ready to train?']),
    wk ? `${wk} of ${target} this week. Whatever you train today counts.` : 'First session of the week, whenever it suits you.');
}
