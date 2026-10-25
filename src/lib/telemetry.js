/* Error reports and page-view stats.
   Errors go to the app's own database (report_error), only for signed-in users, a few per page load,
   without the contents of anything the user typed. Page views go to Vercel Web Analytics, which sets no
   cookies; ids in the address are replaced so no session or split id leaves the browser. */
import { inject } from '@vercel/analytics';

/* noise that says nothing about the app: browser extensions, cross-origin scripts, a benign layout warning */
export function isNoise(message, stack) {
  const m = String(message || ''), s = String(stack || '');
  return !m || /^Script error\.?$/.test(m) || /ResizeObserver loop/.test(m) || /(chrome|moz|safari)-extension:\/\//.test(s) || /AbortError/.test(m);
}
/* uuids and long ids in a path become :id, so reports and stats group by screen */
export const redactPath = p => String(p || '/').replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id').replace(/\/[A-Za-z0-9_-]{16,}(?=\/|$)/g, '/:id').slice(0, 200);

/* send({message, stack, path}) does the delivery; the caller decides whether anyone is signed in */
export function trackErrors(send, { max = 8 } = {}) {
  const seen = new Set(); let n = 0;
  const report = (message, stack) => {
    message = String(message || '').replace(/^Uncaught (\w*Error: )?/, (m, t) => t || '');
    if (isNoise(message, stack) || n >= max) return;
    /* the same message counts once per page load, wherever it was thrown from */
    const key = message.slice(0, 200);
    if (seen.has(key)) return; seen.add(key); n++;
    try { send({ message: String(message).slice(0, 500), stack: stack ? String(stack).slice(0, 4000) : null, path: redactPath(location.pathname) }); } catch {}
  };
  addEventListener('error', e => report(e.message || (e.error && e.error.message) || 'Error', e.error && e.error.stack));
  addEventListener('unhandledrejection', e => { const r = e.reason; report((r && r.message) || String(r), r && r.stack); });
  return report;
}

export function startAnalytics() {
  try { inject({ mode: 'production', beforeSend: ev => ({ ...ev, url: (() => { try { const u = new URL(ev.url); return u.origin + redactPath(u.pathname); } catch { return ev.url; } })() }) }); } catch {}
}
