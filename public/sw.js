/* Synergym service worker.
   - Opens the app without a connection: pages are network-first with the last good copy as a fallback;
     hashed build files are cache-first (their names change whenever their contents do).
   - Fonts (Google's and the app's own title face) and icons are served from cache and refreshed in the background.
   Database and auth requests (Supabase) are never cached. */
const SHELL = 'sg-shell-v1', ASSETS = 'sg-assets-v1', STATIC = 'sg-static-v1';
const KEEP = [SHELL, ASSETS, STATIC];

/* the build files a page needs (its script and stylesheet) */
const builds = html => [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map(m => m[1]);
/* fetch and keep a page's build files; true only when every one is there. Right after a release a new page can
   arrive a few seconds before its files do, and a page without them is a blank screen. */
async function haveBuilds(urls) {
  const assets = await caches.open(ASSETS);
  for (const u of urls) {
    if (await assets.match(u, { ignoreVary: true })) continue;
    try { const r = await fetch(u); if (!r.ok) return false; await assets.put(u, r); } catch { return false; }
  }
  return true;
}

/* cache the page and every file it references, so the first offline launch works. A new page is only kept once
   all its build files are; until then the last good page and its files stay. */
async function cacheShell() {
  const res = await fetch('/', { cache: 'no-store' });
  if (!res.ok) return;
  const html = await res.clone().text(), live = builds(html);
  if (!(await haveBuilds(live))) return;
  const cache = await caches.open(SHELL);
  await cache.put('/', res);
  const others = [...html.matchAll(/(?:src|href)="(\/[^"]+)"/g)].map(m => m[1]).filter(u => !u.startsWith('//') && !u.startsWith('/assets/'));
  await Promise.all(others.map(async u => { try { const r = await fetch(u); if (r.ok) await cache.put(u, r); } catch {} }));
  /* drop build files the current page no longer uses */
  const keep = new Set(live), assets = await caches.open(ASSETS);
  for (const req of await assets.keys()) { const p = new URL(req.url).pathname; if (!keep.has(p)) assets.delete(req); }
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
  /* pages: try the network (briefly), fall back to the cached app. A new page is used only when its build files
     can be had; otherwise the last good page opens, and the new files are fetched for next time. */
  if (req.mode === 'navigate' && url.origin === location.origin) {
    e.respondWith((async () => {
      const last = () => caches.match('/', { cacheName: SHELL });
      let res;
      try { res = await timeout(fetch(req), 4000); } catch { return (await last()) || Response.error(); }
      if (!res.ok) return res;
      const urls = builds(await res.clone().text()), ready = haveBuilds(urls);
      let ok = false;
      try { ok = await timeout(ready, 4000); } catch {}
      if (ok) { const c = await caches.open(SHELL); await c.put('/', res.clone()); return res; }
      /* still coming (or not there yet): keep fetching in the background, and open what worked last time */
      e.waitUntil(ready.then(done => done && caches.open(SHELL).then(c => c.put('/', res.clone()))).catch(() => {}));
      return (await last()) || res;
    })());
    return;
  }
  /* build files never change once published */
  if (url.origin === location.origin && url.pathname.startsWith('/assets/')) {
    e.respondWith(caches.match(req, { cacheName: ASSETS, ignoreVary: true }).then(hit => hit || fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(ASSETS).then(c => c.put(req, copy)); }
      return res;
    })));
    return;
  }
  /* icons, manifest, theme script, the title font and Google Fonts: cached copy now, fresh copy for next time */
  const own = url.origin === location.origin && /^\/(icon|apple-touch-icon|manifest\.webmanifest|theme\.js|fonts\/)/.test(url.pathname);
  const fonts = url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com';
  if (own || fonts) {
    e.respondWith((async () => {
      const cache = await caches.open(STATIC), hit = await cache.match(req);
      const net = fetch(req).then(res => { if (res.ok || res.type === 'opaque') cache.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    })());
  }
});
