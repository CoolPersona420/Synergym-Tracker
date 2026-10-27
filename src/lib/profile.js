/* The profile as the app uses it, and its database row. */
import { cleanBwLog } from './body.js';

/* deleted splits that sessions still point at: their name and day labels, so history keeps them.
   { [splitId]: { name, days: [{ type, rest, same }], at } }, at most 100, newest kept */
export function cleanArchive(a) {
  if (!a || typeof a !== 'object' || Array.isArray(a)) return {};
  const rows = Object.entries(a).filter(([id, v]) => typeof id === 'string' && id.length <= 40 && v && typeof v === 'object')
    .map(([id, v]) => [id, { name: String(v.name || 'Deleted split').slice(0, 60), at: +v.at || 0,
      days: (Array.isArray(v.days) ? v.days : []).slice(0, 14).map(d => ({ type: String(d?.type || '').slice(0, 40), rest: !!d?.rest, same: !!d?.same })) }])
    .sort((x, y) => y[1].at - x[1].at).slice(0, 100);
  return Object.fromEntries(rows);
}

/* lift goals: a target one-rep max per exercise, at most 20 (one per exercise), newest kept.
   [{ id, exId, kg, by (deadline ms or null), at (set ms), from (estimated max then, kg) }] */
export function cleanGoals(a) {
  if (!Array.isArray(a)) return [];
  const seen = new Set(), out = [];
  for (const g of a) {
    if (!g || typeof g !== 'object' || !g.exId || seen.has(String(g.exId))) continue;
    const kg = +g.kg; if (!(kg > 0 && kg < 2000)) continue;
    seen.add(String(g.exId));
    out.push({ id: String(g.id || g.exId).slice(0, 40), exId: String(g.exId).slice(0, 40), kg: Math.round(kg * 100) / 100, by: +g.by > 0 ? +g.by : null, at: +g.at > 0 ? +g.at : Date.now(), from: +g.from > 0 && +g.from < 2000 ? Math.round(+g.from * 100) / 100 : null });
  }
  return out.slice(-20);
}

export const DEFAULT_PROFILE = { weekStart: 1, coachOn: true, liftGoals: [], splitArchive: {}, reminderOn: false, reminderTime: '18:00', reminderDays: 127, tz: null, bwLog: [], nextDay: null, restDays: [], widgets: null, muscles: null, theme: null, username: null, name: '', exp: null, goal: null, onboarded: false, unit: 'kg', target: 3, rest: 90, restOn: true, sound: true, bw: 75 };
export const profFromDb = r => ({ weekStart: [0, 1, 6].includes(r.week_start) ? r.week_start : 1, coachOn: r.coach_on !== false, liftGoals: cleanGoals(r.lift_goals), splitArchive: cleanArchive(r.split_archive), nextDay: r.next_day && typeof r.next_day === 'object' && r.next_day.sp ? { sp: String(r.next_day.sp).slice(0, 40), i: Math.max(0, parseInt(r.next_day.i) || 0), at: +r.next_day.at || 0 } : null, restDays: Array.isArray(r.rest_days) ? r.rest_days.filter(d => typeof d === 'string' && /^\d{4}-\d{1,2}-\d{1,2}$/.test(d)).slice(-400) : [], widgets: Array.isArray(r.widgets) ? r.widgets.filter(id => typeof id === 'string').slice(0, 20) : null, muscles: Array.isArray(r.muscles) ? r.muscles.filter(m => typeof m === 'string' && m.trim()).map(m => m.trim().slice(0, 30)).slice(0, 40) : null, theme: r.theme || null, username: r.username || null, name: r.display_name || '', exp: r.experience || null, goal: r.goal || null, onboarded: !!r.onboarded, unit: r.unit === 'lb' ? 'lb' : 'kg', target: r.weekly_target || 3, rest: r.rest_seconds || 90, restOn: r.rest_enabled !== false, sound: r.rest_sound !== false, bw: +r.bodyweight || 75, bwLog: cleanBwLog(r.bw_log), activeSession: r.active_session || null, reminderOn: !!r.reminder_on, reminderTime: /^\d{2}:\d{2}/.test(r.reminder_time || '') ? r.reminder_time.slice(0, 5) : '18:00', reminderDays: Number.isInteger(r.reminder_days) ? r.reminder_days & 127 : 127, tz: r.tz || null });
export const profToDb = p => ({ week_start: [0, 1, 6].includes(p.weekStart) ? p.weekStart : 1, coach_on: p.coachOn !== false, lift_goals: Array.isArray(p.liftGoals) && p.liftGoals.length ? cleanGoals(p.liftGoals) : null, split_archive: p.splitArchive && Object.keys(p.splitArchive).length ? cleanArchive(p.splitArchive) : null, next_day: p.nextDay || null, rest_days: Array.isArray(p.restDays) && p.restDays.length ? p.restDays.slice(-400) : null, widgets: Array.isArray(p.widgets) ? p.widgets.slice(0, 20) : null, muscles: Array.isArray(p.muscles) && p.muscles.length ? p.muscles : null, theme: p.theme || null, display_name: (p.name || '').slice(0, 40) || null, experience: p.exp || null, goal: p.goal || null, onboarded: !!p.onboarded, unit: p.unit, weekly_target: p.target, rest_seconds: p.rest, rest_enabled: p.restOn, rest_sound: p.sound, bodyweight: Math.round(p.bw * 100) / 100, bw_log: p.bwLog && p.bwLog.length ? cleanBwLog(p.bwLog) : null, reminder_on: !!p.reminderOn, reminder_time: /^\d{2}:\d{2}$/.test(p.reminderTime || '') ? p.reminderTime : '18:00', reminder_days: Number.isInteger(p.reminderDays) && p.reminderDays & 127 ? p.reminderDays & 127 : 127, tz: p.tz || null });
