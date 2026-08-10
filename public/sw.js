/* Kas Proyek — SW ringan: cache aset statis agar buka ulang di HP lebih cepat. */
const STATIC_CACHE = "kas-proyek-static-v3";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      try {
        await cache.addAll([
          "/icons/icon-192.png",
          "/icons/apple-touch-icon.png",
          "/login-bg.webp",
          "/login-bg.jpg",
        ]);
      } catch {
        // abaikan jika sebagian gagal
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("kas-proyek") && k !== STATIC_CACHE)
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

function isStaticAsset(url) {
  const p = url.pathname;
  if (p.startsWith("/_next/static/")) return true;
  if (p.startsWith("/icons/")) return true;
  if (p === "/login-bg.webp" || p === "/login-bg.jpg" || p === "/login-bg.png") {
    return true;
  }
  if (p === "/favicon.ico") return true;
  return false;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (!isStaticAsset(url)) return;

  // Cache-first untuk aset hash/statis — hemat kuota & cepat di HP
  event.respondWith(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      const cached = await cache.match(req);
      if (cached) return cached;
      try {
        const res = await fetch(req);
        if (res.ok) {
          void cache.put(req, res.clone());
        }
        return res;
      } catch (err) {
        if (cached) return cached;
        throw err;
      }
    })(),
  );
});
