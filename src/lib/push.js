/* Web push for workout reminders. The public key pairs with VAPID_PRIVATE_KEY on the server; it is public
   by design (every browser that subscribes receives it). */
export const VAPID_PUBLIC = 'BAFq31wYUWpR7ZStm0-xD9LCB_aE7FANEblISbPoygaRzpd8wi01WixzE8ZLiqvZwx9Za1dwWyTuuH2TqTWICts';

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
export const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

const keyBytes = b64 => { const s = atob((b64 + '='.repeat((4 - b64.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(s, c => c.charCodeAt(0)); };
const ready = ms => Promise.race([navigator.serviceWorker.ready, new Promise((_, rej) => setTimeout(() => rej(new Error('The app’s background worker isn’t running. Reload and try again.')), ms))]);

/* this device's subscription, creating it if needed: { endpoint, keys: { p256dh, auth } } */
export async function subscribe() {
  const reg = await ready(8000);
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC) });
  return sub.toJSON();
}
/* stop push on this device; returns the endpoint that was removed */
export async function unsubscribe() {
  if (!('serviceWorker' in navigator)) return null;
  const reg = await navigator.serviceWorker.getRegistration(); if (!reg) return null;
  const sub = await reg.pushManager.getSubscription(); if (!sub) return null;
  const ep = sub.endpoint; await sub.unsubscribe().catch(() => {}); return ep;
}

/* the reminder days are a bitmask, Monday = bit 0 … Sunday = bit 6 */
export const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
export const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
/* order: the bits in the order the user's week runs (Monday first unless set otherwise) */
export const daysText = (mask, order = [0, 1, 2, 3, 4, 5, 6]) => {
  if ((mask & 127) === 127) return 'Every day';
  if ((mask & 127) === 31) return 'Weekdays';
  if ((mask & 127) === 96) return 'Weekends';
  if (!(mask & 127)) return 'No days';
  return order.filter(i => mask & (1 << i)).map(i => DAY_NAMES[i].slice(0, 3)).join(', ');
};
export const timeText = hhmm => {
  const [h, m] = String(hhmm || '18:00').split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
};
