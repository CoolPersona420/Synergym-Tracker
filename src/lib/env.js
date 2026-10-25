/* What the device and browser can do; read once at startup. */
export const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
/* low-end devices (few cores, little memory, data saver) get the same motion with cheaper effects */
export const LITE = (() => { try {
  const n = navigator, c = n.connection;
  if (c && c.saveData) return true;
  /* Brave randomises the core count and memory to resist fingerprinting, so they say nothing about the device there */
  if (n.brave) return false;
  return (n.deviceMemory && n.deviceMemory <= 2) || (n.hardwareConcurrency && n.hardwareConcurrency <= 4 && (!n.deviceMemory || n.deviceMemory <= 4));
} catch { return false; } })();
if (LITE) document.documentElement.classList.add('lite');
if (!document.startViewTransition) document.documentElement.classList.add('no-vt');
