/* An exercise's setup, tapped in rather than typed: the fields worth noting for it are guessed from its name (a
   Smith machine has a bar hook and safety pins, a cable a pulley height and an attachment, a dumbbell press a bench
   angle). Numbers get − / + and can be typed; choices are chips; a free note takes the rest.
   A setup is kept as one line of text, "Hook 12 · Pins 8 · Wide stance · knees out", which is what the exercise's
   card shows. Older notes are plain text and read back as a note, so nothing in the database changes. */
const N = (id, label, short) => ({ id, label, short, num: true });
const C = (id, label, opts) => ({ id, label, opts });
const STANCE = C('stance', 'Stance', [['Narrow', 'Narrow stance'], ['Shoulder-width', 'Shoulder-width stance'], ['Wide', 'Wide stance']]);
const GRIP = C('grip', 'Grip', [['Close', 'Close grip'], ['Shoulder-width', 'Shoulder-width grip'], ['Wide', 'Wide grip']]);
const SEAT = N('seat', 'Seat', 'Seat');
/* first match wins: the more specific kinds come first */
const KINDS = [
  [/smith/i, [N('hook', 'Bar hook', 'Hook'), N('pins', 'Safety pins', 'Pins'), STANCE, C('feet', 'Feet', [['Under the bar', 'Feet under the bar'], ['Slightly forward', 'Feet forward'], ['Far forward', 'Feet far forward']])]],
  [/leg press|hack squat|pendulum|v-squat|belt squat/i, [SEAT, N('safety', 'Safety stops', 'Stops'), C('feet', 'Feet', [['Low', 'Feet low'], ['Middle', 'Feet middle'], ['High', 'Feet high']]), STANCE]],
  [/cable|pushdown|push-down|pulldown|pull-down|crossover|face pull|pull-through|straight-arm/i, [N('pulley', 'Pulley height', 'Pulley'), C('att', 'Attachment', [['Rope', 'Rope'], ['Straight bar', 'Straight bar'], ['V-bar', 'V-bar'], ['Handle', 'Single handle'], ['Wide bar', 'Wide bar']]), SEAT]],
  [/dumbbell|\bdb\b/i, [C('bench', 'Bench', [['Flat', 'Flat bench'], ['15°', 'Bench 15°'], ['30°', 'Bench 30°'], ['45°', 'Bench 45°'], ['60°', 'Bench 60°'], ['Upright', 'Bench upright']])]],
  [/deadlift|rdl|romanian/i, [C('stance', 'Stance', [['Conventional', 'Conventional'], ['Sumo', 'Sumo']]), C('grip', 'Grip', [['Double overhand', 'Double overhand'], ['Mixed', 'Mixed grip'], ['Hook', 'Hook grip'], ['Straps', 'Straps']])]],
  [/machine|pec deck|leg extension|leg curl|hamstring curl|chest press|shoulder press|seated row|abduct|adduct|calf|preacher|assisted/i, [SEAT, N('back', 'Back pad', 'Back pad'), N('pad', 'Leg or arm pad', 'Pad')]],
  [/squat|bench press|overhead press|military press|barbell|good morning/i, [N('rack', 'Rack height', 'Rack'), N('safe', 'Safeties', 'Safeties'), GRIP]]
];
const CARDIO = [N('level', 'Level', 'Level'), N('incline', 'Incline', 'Incline')];
const PLAIN = [SEAT, GRIP, STANCE];

/* the fields for an exercise: kind 'c' is cardio */
export function setupFields(name, kind) {
  if (kind === 'c') return CARDIO;
  for (const [re, f] of KINDS) if (re.test(String(name || ''))) return f;
  return PLAIN;
}
const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/* a setup line back into its fields; whatever isn't a field is the note */
export function parseSetup(text, fields) {
  const v = {}, rest = [];
  for (const part of String(text || '').split(' · ').map(x => x.trim()).filter(Boolean)) {
    let hit = false;
    for (const f of fields) {
      if (v[f.id] != null) continue;
      if (f.num) { const m = new RegExp(`^${reEsc(f.short)} (\\d{1,3}(?:[.,]\\d)?)$`, 'i').exec(part); if (m) { v[f.id] = +m[1].replace(',', '.'); hit = true; break; } }
      else { const o = f.opts.find(x => x[1].toLowerCase() === part.toLowerCase()); if (o) { v[f.id] = o[0]; hit = true; break; } }
    }
    if (!hit) rest.push(part);
  }
  return { v, note: rest.join(' · ') };
}
/* the line the card shows, at most 200 characters */
export function formatSetup(v, fields, note = '') {
  const parts = [];
  for (const f of fields) {
    const x = v && v[f.id]; if (x == null || x === '') continue;
    if (f.num) parts.push(`${f.short} ${x}`); else { const o = f.opts.find(y => y[0] === x); if (o) parts.push(o[1]); }
  }
  const n = String(note || '').replace(/\s+/g, ' ').trim(); if (n) parts.push(n);
  return parts.join(' · ').slice(0, 200);
}
/* "Add setup: hook, pins, stance" */
export const setupHint = fields => fields.slice(0, 3).map(f => (f.short || f.label).toLowerCase()).join(', ');
