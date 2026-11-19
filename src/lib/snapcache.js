/* The copy of an online account's data kept on this device, so the app opens straight away (on a slow connection,
   or none) and then refreshes from the server in the background. One record per account, in its own small
   database, apart from offline mode's. Signing out deletes them all. */
const DB = 'sg-snap', STORE = 'snap', VERSION = 1;
let dbp = null;
function open() {
  if (!dbp) dbp = new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }).catch(e => { dbp = null; throw e; });
  return dbp;
}
const run = (mode, fn) => open().then(db => new Promise((res, rej) => {
  const tx = db.transaction(STORE, mode), q = fn(tx.objectStore(STORE));
  tx.oncomplete = () => res(q && 'result' in q ? q.result : undefined); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error);
}));
/* the account's copy, or null (none yet, from an older app, or this device won't keep data) */
export async function readSnap(uid) {
  try { const d = await run('readonly', st => st.get(uid)); return d && d.v === VERSION && d.uid === uid ? d : null; } catch { return null; }
}
export async function writeSnap(uid, data) { try { await run('readwrite', st => st.put({ ...data, v: VERSION, uid, at: Date.now() }, uid)); } catch {} }
export async function clearSnaps() { try { await run('readwrite', st => st.clear()); } catch {} }
