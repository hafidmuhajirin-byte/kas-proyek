/* Kas Proyek — service worker ringan (installable PWA, tanpa cache offline berat). */
const SW_VERSION = "kas-proyek-sw-v2";

self.addEventListener("install", (event) => {
  // Aktif segera — tidak meng-cache aset agar HP tetap ringan.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Bersihkan cache lama jika pernah ada dari versi sebelumnya.
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("kas-proyek") && k !== SW_VERSION)
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

// Network-only: biarkan browser/Next menangani request (hemat penyimpanan HP).
self.addEventListener("fetch", () => {
  // no-op
});
