/* Going online: fold the data kept on this device into an account.

   The account allows one exercise per name, and the device may have its own copies of the same exercises
   (an offline account starts with the starter list, with its own ids). So exercises are matched by name:
   a device exercise that matches an account exercise takes the account's id, and every session and split
   that pointed at it is pointed at the account's id instead.

   What gets uploaded:
   - fresh (the device was never this account, or the account is new): everything on the device.
   - otherwise: what changed on the device while it was offline (the dirty keys), plus anything whose
     exercise references had to be rewritten. Deletions made offline are uploaded as deletions.
   Exercises that didn't change on the device keep the account's version. */

const nameKey = n => String(n || '').trim().toLowerCase();

export function planSync(local, serverLibrary, { fresh = false } = {}) {
  const dirty = local.dirty instanceof Set ? local.dirty : new Set(local.dirty || []);
  const changed = key => fresh || dirty.has(key);
  const upload = new Set();
  const byName = new Map(), library = new Map(), remap = new Map();
  for (const e of serverLibrary) { byName.set(nameKey(e.name), e); library.set(e.id, e); }

  for (const e of local.library) {
    const match = byName.get(nameKey(e.name)), id = match ? match.id : e.id;
    if (id !== e.id) remap.set(e.id, id);
    if (changed('x:' + e.id) || !library.has(id)) { library.set(id, { ...e, id }); upload.add('x:' + id); }
    if (!match) byName.set(nameKey(e.name), library.get(id));
  }
  /* exercises deleted on the device (dirty, but no longer there) */
  const localIds = new Set(local.library.map(e => e.id));
  for (const key of dirty) {
    if (!key.startsWith('x:')) continue;
    const id = key.slice(2);
    if (!localIds.has(id) && !remap.has(id)) { library.delete(id); upload.add(key); }
  }

  const ex = id => remap.get(id) || id;
  const sessions = local.sessions.map(s => {
    let moved = false;
    const items = s.items.map(it => { const id = ex(it.exId); if (id !== it.exId) moved = true; return { ...it, exId: id }; });
    if (changed('s:' + s.id) || moved) upload.add('s:' + s.id);
    return { ...s, items };
  });
  const splits = local.splits.map(p => {
    let moved = false;
    const days = p.days.map(d => ({ ...d, exercises: d.exercises.map(x => { const id = x.exId ? ex(x.exId) : x.exId; if (id !== x.exId) moved = true; return { ...x, exId: id }; }) }));
    if (changed('sp:' + p.id) || moved) upload.add('sp:' + p.id);
    return { ...p, days };
  });
  /* sessions and splits deleted on the device */
  const sIds = new Set(local.sessions.map(s => s.id)), pIds = new Set(local.splits.map(p => p.id));
  for (const key of dirty) {
    if (key.startsWith('s:') && !sIds.has(key.slice(2))) upload.add(key);
    if (key.startsWith('sp:') && !pIds.has(key.slice(3))) upload.add(key);
  }
  if (changed('p')) upload.add('p');

  return { library: [...library.values()], sessions, splits, profile: local.profile, upload, remapped: remap.size };
}
