// Offline support: the game runs entirely in the browser, so once cached it plays
// against robots with no connection. Online play still needs the network.
const CACHE = 'bean-machine-v1';
const ASSET_RE = /assets\/[^"')\s]+/g;
const scoped = (path) => new URL(path, self.registration.scope).href;

const add = async (cache, url) => {
  if (!(await cache.match(url, { ignoreVary: true }))) await cache.add(url).catch(() => {});
};

/** Store a fresh copy of the page plus any of its hashed files we don't have, and forget older releases. */
async function storeShell(res) {
  const cache = await caches.open(CACHE);
  const html = await res.clone().text();
  await cache.put(self.registration.scope, res);
  const keep = new Set([...new Set(html.match(ASSET_RE) ?? [])].map(scoped));
  for (const url of [...keep]) {
    await add(cache, url);
    if (!url.endsWith('.css')) continue;
    // Fonts are referenced from the stylesheet, not the page.
    const css = await (await cache.match(url, { ignoreVary: true }))?.text();
    for (const [, ref] of css?.matchAll(/url\((\.\/[^)]+)\)/g) ?? []) {
      const font = new URL(ref, url).href;
      keep.add(font);
      if (font.endsWith('.woff2')) await add(cache, font);
    }
  }
  for (const req of await cache.keys()) if (req.url.includes('/assets/') && !keep.has(req.url)) await cache.delete(req);
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const res = await fetch(self.registration.scope, { cache: 'no-cache' });
      if (res.ok) await storeShell(res);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || url.pathname.endsWith('/ws') || url.pathname.endsWith('/health')) return;

  // The page: network first so a new release shows at once, the cached copy when offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && url.href.split(/[?#]/)[0] === self.registration.scope) event.waitUntil(storeShell(res.clone()));
          return res;
        })
        .catch(async () => (await caches.match(self.registration.scope, { ignoreVary: true })) ?? Response.error()),
    );
    return;
  }

  // Hashed files never change: cache first. Icons and the manifest: cached copy, refreshed behind.
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(req, { ignoreVary: true });
      if (hit && url.pathname.includes('/assets/')) return hit;
      const refresh = fetch(req).then((res) => {
        if (res.ok) void cache.put(req, res.clone());
        return res;
      });
      if (hit) {
        event.waitUntil(refresh.catch(() => {}));
        return hit;
      }
      return refresh;
    })(),
  );
});
