/* Onyx web: keep the app shell loadable offline (Bet 1). On a phone the JS
 * bundle is local; on the web build this service worker plays that role.
 * Same-origin GETs only, network-first, so an online load always gets the
 * newest code; the API (another origin) is never touched here. */
const CACHE = "onyx-shell-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// The page sends the URLs it already loaded (document, bundle, fonts, icons).
self.addEventListener("message", (event) => {
  const urls = event.data && event.data.type === "precache" ? event.data.urls : null;
  if (!Array.isArray(urls)) return;
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(
        urls.map((url) =>
          fetch(url, { cache: "force-cache" })
            .then((res) => (res.ok ? cache.put(url, res) : undefined))
            .catch(() => undefined)
        )
      )
    )
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(async () => {
        const cache = await caches.open(CACHE);
        const hit = await cache.match(req, { ignoreVary: true });
        if (hit) return hit;
        // Any route of the single-page app can boot from the cached root document.
        if (req.mode === "navigate") {
          const root =
            (await cache.match("/")) || (await cache.match(self.location.origin + "/"));
          if (root) return root;
          const keys = await cache.keys();
          const doc = keys.find(
            (k) => !/\.(js|css|ttf|png|ico|json|map)(\?|$)/.test(k.url)
          );
          if (doc) return cache.match(doc);
        }
        return Response.error();
      })
  );
});
