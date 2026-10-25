/* The on-device store for offline mode: IndexedDB, one object store per kind of record plus a small
   key/value store for the profile and the list of changes waiting to go online. */
const NAME = 'synergym', VERSION = 1, STORES = ['sessions', 'exercises', 'splits'];
let dbp = null;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    let req;
    try { req = indexedDB.open(NAME, VERSION); } catch (e) { reject(e); return; }
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' });
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
    };
    req.onsuccess = () => { const db = req.result; db.onversionchange = () => { db.close(); dbp = null; }; resolve(db); };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Storage is busy in another tab'));
  });
  dbp.catch(() => { dbp = null; });
  return dbp;
}
const done = tx => new Promise((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error || new Error('Write cancelled')); });
const req = r => new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });

/* true when this browser can keep data on the device (private modes sometimes can't) */
export async function localSupported() {
  try { const db = await open(); const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(Date.now(), 'probe'); await done(tx); return true; } catch { return false; }
}
export async function getAll(store) { const db = await open(); return req(db.transaction(store).objectStore(store).getAll()); }
export async function kvGet(key) { const db = await open(); return req(db.transaction('kv').objectStore('kv').get(key)); }
export async function kvSet(key, value) { const db = await open(); const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(value, key); return done(tx); }
export async function put(store, value) { const db = await open(); const tx = db.transaction(store, 'readwrite'); tx.objectStore(store).put(value); return done(tx); }
export async function del(store, id) { const db = await open(); const tx = db.transaction(store, 'readwrite'); tx.objectStore(store).delete(id); return done(tx); }

/* everything at once, in one transaction: the store is either fully replaced or left as it was */
export async function replaceAll({ profile, exercises, sessions, splits, dirty }) {
  const db = await open(), tx = db.transaction([...STORES, 'kv'], 'readwrite');
  for (const s of STORES) tx.objectStore(s).clear();
  for (const e of exercises) tx.objectStore('exercises').put(e);
  for (const s of sessions) tx.objectStore('sessions').put(s);
  for (const s of splits) tx.objectStore('splits').put(s);
  tx.objectStore('kv').put(profile, 'profile');
  tx.objectStore('kv').put([...dirty], 'dirty');
  return done(tx);
}
export async function loadAllLocal() {
  const [profile, exercises, sessions, splits, dirty] = await Promise.all([kvGet('profile'), getAll('exercises'), getAll('sessions'), getAll('splits'), kvGet('dirty')]);
  return { profile: profile || null, exercises, sessions, splits, dirty: new Set(Array.isArray(dirty) ? dirty : []) };
}
export async function clearLocal() {
  const db = await open(), tx = db.transaction([...STORES, 'kv'], 'readwrite');
  for (const s of [...STORES, 'kv']) tx.objectStore(s).clear();
  return done(tx);
}
