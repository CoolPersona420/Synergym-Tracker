import { uuid } from './util.js';
import { num, cleanSession, cleanDays } from './sanitize.js';
import { DEFAULT_PROFILE, profFromDb, profToDb } from './profile.js';

/* import replaces everything: the file is read and checked here, a warning shows what will be lost, and the
   swap happens in one database transaction (import_replace), so a failure leaves the current data untouched.
   Every row gets a fresh id so a file from another account can't collide with existing rows */
export function parseImport(d, fallbackBw = 75) {
  if (!d || typeof d !== 'object' || (d.app && d.app !== 'Synergym')) return null;
  const lib = Array.isArray(d.library) ? d.library : [], ss = Array.isArray(d.sessions) ? d.sessions : [], sps = Array.isArray(d.splits) ? d.splits : [];
  if (!lib.length && !ss.length && !sps.length) return null;
  const exId = new Map(), byName = new Map(), library = [];
  for (const x of lib.slice(0, 2000)) {
    if (!x || typeof x !== 'object') continue;
    const name = String(x.name || '').trim().slice(0, 60); if (!name) continue;
    let e = byName.get(name.toLowerCase());
    if (!e) {
      e = { id: uuid(), name, muscle: String(x.muscle || 'Full body').trim().slice(0, 30) || 'Full body', kind: x.kind === 'bw' ? 'bw' : 'w', archived: !!x.archived, isDefault: !!x.isDefault, oneRm: num(x.oneRm) > 0 && num(x.oneRm) < 2000 ? num(x.oneRm) : null, oneRmAt: num(x.oneRmAt) };
      byName.set(name.toLowerCase(), e); library.push(e);
    }
    exId.set(String(x.id), e.id);
  }
  const spId = new Map(), splits = [];
  for (const x of sps.slice(0, 200)) {
    if (!x || typeof x !== 'object') continue;
    const id = uuid(); spId.set(String(x.id), id);
    const days = cleanDays(x.days); for (const dd of days) for (const e of dd.exercises) e.exId = e.exId ? exId.get(String(e.exId)) || null : null;
    splits.push({ id, name: String(x.name || '').trim().slice(0, 60) || 'Untitled split', description: String(x.description || '').slice(0, 1000), days, shareToken: null, copiedFrom: x.copiedFrom ? String(x.copiedFrom).slice(0, 40) : null });
  }
  const sessions = [];
  for (const raw of ss.slice(0, 20000)) {
    const s = cleanSession(raw); if (!s) continue;
    s.id = uuid(); s.splitId = s.splitId ? spId.get(String(s.splitId)) || null : null; if (!s.splitId) s.splitDay = null;
    s.items = s.items.filter(it => exId.has(String(it.exId))).map(it => ({ ...it, exId: exId.get(String(it.exId)) }));
    if (!s.endedAt) s.endedAt = s.startedAt + 3600000;
    sessions.push(s);
  }
  const p = d.profile && typeof d.profile === 'object' ? { ...DEFAULT_PROFILE, ...profFromDb(profToDb({ ...DEFAULT_PROFILE, ...d.profile, bw: num(d.profile.bw) || fallbackBw })) } : null;
  if (p && p.nextDay) p.nextDay = spId.has(String(p.nextDay.sp)) ? { ...p.nextDay, sp: spId.get(String(p.nextDay.sp)) } : null;
  if (p && Array.isArray(p.widgets)) p.widgets = p.widgets.filter(w => typeof w === 'string');
  return { library, sessions, splits, profile: p, exportedAt: Date.parse(d.exportedAt) || null };
}
