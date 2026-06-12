/* PTCG Probability Lab service worker — full offline capability (docs/06
 * Phase 6). Strategy per request kind:
 *  - navigations: NETWORK-first (a deploy replaces hashed asset names, so a
 *    stale index.html points at files that no longer exist → blank page);
 *    the cache is the offline fallback only.
 *  - card catalog JSON: stale-while-revalidate (big, unversioned filename —
 *    serve instantly, refresh in the background for the next session).
 *  - everything else (hashed assets, fonts): cache-first; content-hashed
 *    names make staleness impossible.
 * Versioned cache so activating a new worker drops every older cache. */

const CACHE = "ppl-v2";
const CORE = ["./", "./index.html", "./manifest.webmanifest", "./favicon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(CORE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() =>
          caches.match(req).then((hit) => hit ?? caches.match("./index.html")),
        ),
    );
    return;
  }

  if (new URL(req.url).pathname.endsWith("/catalog/cards-zh-Hant.json")) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const hit = await cache.match(req);
        const refresh = fetch(req).then((res) => {
          if (res.ok) cache.put(req, res.clone());
          return res;
        });
        if (hit) {
          event.waitUntil(refresh.catch(() => undefined));
          return hit;
        }
        return refresh;
      })(),
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ??
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
