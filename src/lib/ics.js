/* Calendar reminders for a split: weekly repeating events in an .ics file (RFC 5545) that any phone or computer
   calendar can add, each with a reminder before it and a link that opens that workout in the app. Times are
   "floating" (no time zone), so 18:00 stays 18:00 wherever the phone is. No server is involved. */

export const WEEKDAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']; // index 0 is Monday
/* the usual pattern for n training days a week */
export const DEFAULT_DAYS = { 1: [0], 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 3, 4], 6: [0, 1, 2, 3, 4, 5], 7: [0, 1, 2, 3, 4, 5, 6] };

/* which split day goes on which weekday: by name when there are as many training days as weekdays picked (the split
   lines up with the week), otherwise every event is plain "Training" and its link opens whatever is next */
export function weekPlan(training, weekdays) {
  const wd = [...new Set(weekdays)].filter(d => d >= 0 && d <= 6).sort((a, b) => a - b);
  const named = training.length > 0 && training.length === wd.length;
  return { named, rows: wd.map((d, k) => ({ wd: d, day: named ? training[k] : null })) };
}

/* a typical session's length: about 2.5 minutes a set plus 10 to warm up, in 15-minute steps, 30 to 120 */
export const sessionMinutes = sets => Math.min(120, Math.max(30, Math.round((sets * 2.5 + 10) / 15) * 15));

const esc = s => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const pad = n => String(n).padStart(2, '0');
const local = d => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
const utc = d => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
/* lines longer than 75 bytes continue on the next line after a space, never splitting a character */
function fold(line) {
  const out = []; let cur = '', bytes = 0;
  for (const ch of line) {
    const b = new TextEncoder().encode(ch).length;
    if (bytes + b > (out.length ? 74 : 75)) { out.push(cur); cur = ''; bytes = 0; }
    cur += ch; bytes += b;
  }
  out.push(cur);
  return out.join('\r\n ');
}
/* the first time weekday wd (0 = Monday) comes round at hh:mm, today included if that time is still ahead */
export function firstOn(wd, time, now = new Date()) {
  const [h, m] = time.split(':').map(Number), d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0);
  const today = (now.getDay() + 6) % 7;
  let add = (wd - today + 7) % 7;
  if (add === 0 && d <= now) add = 7;
  d.setDate(d.getDate() + add);
  return d;
}

/**
 * @param events [{ wd, title, notes, url, uid, minutes }]
 * @param time   "HH:MM", local
 * @param alarm  minutes before, or 0 for none
 */
export function buildIcs({ events, time, alarm = 30, now = new Date() }) {
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Synergym//Training days//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  for (const e of events) {
    L.push('BEGIN:VEVENT', `UID:${e.uid}`, `DTSTAMP:${utc(now)}`, `DTSTART:${local(firstOn(e.wd, time, now))}`, `DURATION:PT${e.minutes || 60}M`,
      `RRULE:FREQ=WEEKLY;BYDAY=${WEEKDAYS[e.wd]}`, `SUMMARY:${esc(e.title)}`, `DESCRIPTION:${esc(e.notes || '')}`);
    if (e.url) L.push(`URL:${e.url}`);
    if (alarm > 0) L.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(e.title)}`, `TRIGGER:-PT${alarm}M`, 'END:VALARM');
    L.push('END:VEVENT');
  }
  L.push('END:VCALENDAR');
  return L.map(fold).join('\r\n') + '\r\n';
}
