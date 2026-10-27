/* Synergym service worker.
   - Opens the app without a connection: pages are network-first with the last good copy as a fallback;
     hashed build files are cache-first (their names change whenever their contents do).
   - Fonts and icons are served from cache and refreshed in the background.
   - Shows workout reminders sent as web push.
   Database and auth requests (Supabase) are never cached. */
const SHELL = 'sg-shell-v1', ASSETS = 'sg-assets-v1', STATIC = 'sg-static-v1';
const KEEP = [SHELL, ASSETS, STATIC];

/* cache the page and every file it references, so the first offline launch works */
async function cacheShell() {
  const cache = await caches.open(SHELL), res = await fetch('/', { cache: 'no-store' });
  if (!res.ok) return;
  const html = await res.clone().text();
  await cache.put('/', res);
  const urls = [...html.matchAll(/(?:src|href)="(\/[^"]+)"/g)].map(m => m[1]).filter(u => !u.startsWith('//'));
  const assets = await caches.open(ASSETS);
  await Promise.all(urls.map(async u => {
    const store = u.startsWith('/assets/') ? assets : cache;
    if (store === assets && await assets.match(u)) return;
    try { const r = await fetch(u); if (r.ok) await store.put(u, r); } catch {}
  }));
  /* drop build files the current page no longer uses */
  const live = new Set(urls.filter(u => u.startsWith('/assets/')));
  for (const req of await assets.keys()) { const p = new URL(req.url).pathname; if (!live.has(p)) assets.delete(req); }
}

self.addEventListener('install', e => { e.waitUntil(cacheShell().catch(() => {}).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (!KEEP.includes(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener('message', e => { if (e.data === 'refresh-shell') e.waitUntil(cacheShell().catch(() => {})); });

const timeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  /* pages: try the network (briefly), fall back to the cached app */
  if (req.mode === 'navigate' && url.origin === location.origin) {
    e.respondWith((async () => {
      try {
        const res = await timeout(fetch(req), 4000);
        if (res.ok) { const c = await caches.open(SHELL); c.put('/', res.clone()); }
        return res;
      } catch {
        return (await caches.match('/', { cacheName: SHELL })) || Response.error();
      }
    })());
    return;
  }
  /* build files never change once published */
  if (url.origin === location.origin && url.pathname.startsWith('/assets/')) {
    e.respondWith(caches.match(req, { cacheName: ASSETS }).then(hit => hit || fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(ASSETS).then(c => c.put(req, copy)); }
      return res;
    })));
    return;
  }
  /* icons, manifest, theme script and Google Fonts: cached copy now, fresh copy for next time */
  const own = url.origin === location.origin && /^\/(icon|apple-touch-icon|manifest\.webmanifest|theme\.js)/.test(url.pathname);
  const fonts = url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com';
  if (own || fonts) {
    e.respondWith((async () => {
      const cache = await caches.open(STATIC), hit = await cache.match(req);
      const net = fetch(req).then(res => { if (res.ok || res.type === 'opaque') cache.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    })());
  }
});

/* ---------- reminders ---------- */
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data && e.data.text() }; }
  const title = d.title || 'Time to train';
  e.waitUntil(self.registration.showNotification(title, {
    body: d.body || 'Your next session is waiting.', icon: '/icon-192.png', badge: '/icon-192.png',
    tag: d.tag || 'reminder', renotify: false, data: { url: d.url || '/' }
  }));
});
/* tapping a reminder opens the page it's about (Home, the Coach, a goal). An open app is brought forward and asked
   to go there itself, which keeps its state and works where a window can't be navigated from here (iOS). */
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || '/', location.origin);
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) if (new URL(w.url).origin === location.origin) { await w.focus(); w.postMessage({ open: url.pathname }); return; }
    return self.clients.openWindow(url.href);
  })());
});
