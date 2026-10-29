/* Service worker EditSeru — dibuat oleh scripts/gen-sw.mjs saat build (versi dan daftar precache diisi otomatis).
   - Cangkang aplikasi (HTML/JS/CSS) disimpan saat dipasang → aplikasi terbuka tanpa internet.
   - Mesin & model AI (/ai/) disimpan begitu dipakai (dan disiapkan diam-diam saat senggang) → fitur AI jalan offline.
   - Hanya permintaan same-origin yang ditangani; unduhan model dari luar dikelola aplikasi sendiri. */
const VERSION = "bar5";
const SHELL = 'editseru-shell-' + VERSION;
const RUNTIME = 'editseru-runtime-v1';
const PRECACHE = [
  "./",
  "./THIRD_PARTY_NOTICES.txt",
  "./assets/FxPanels-CNQsYs9B.js",
  "./assets/ImageAI-gg6xUWjx.js",
  "./assets/PatternPanel-DaXImZ37.js",
  "./assets/RasterPanel-DUkDiDvw.js",
  "./assets/UTIF-BNj2SwFb.js",
  "./assets/imagefx.worker-Dj7lAgTH.js",
  "./assets/index-bar5.js",
  "./assets/index-bar5.css",
  "./assets/index-sL2J13RH.js",
  "./assets/instrument-sans-latin-wdth-normal-BVScPF0l.woff2",
  "./assets/jetbrains-mono-latin-wght-normal-B9CIFXIH.woff2",
  "./assets/lucide-DGXfS6CA.js",
  "./assets/overlay-CXkzHasa.js",
  "./assets/samtablet-DbSOjpkr.js",
  "./assets/vendor-paper-BshgD9E9.js",
  "./assets/vendor-react-CzRc2eCF.js",
  "./assets/vendor-ui-icons-C9aSDbGf.js",
  "./favicon.svg",
  "./icons/apple-touch-icon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/maskable-512.png",
  "./index.html",
  "./manifest.webmanifest"
];
const WARM = ['ai/ort.wasm.min.mjs', 'ai/ort-wasm-simd-threaded.mjs', 'ai/ort-wasm-simd-threaded.wasm', 'ai/u2netp-onnx.wasm', 'ai/sr/realesr-general-x4v3.onnx'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(SHELL)
      .then((c) => c.addAll(PRECACHE.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('editseru-shell-') && k !== SHELL).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'warm') {
    e.waitUntil(
      caches.open(RUNTIME).then(async (c) => {
        for (const p of WARM) {
          const url = new URL(p, self.registration.scope).href;
          if (await c.match(url)) continue;
          try {
            const r = await fetch(url);
            if (r.ok) await c.put(url, r);
          } catch {
            /* offline / gagal: dicoba lagi pada kunjungan berikut */
          }
        }
      }),
    );
  }
  if (e.data === 'skip') self.skipWaiting();
});

/* Hosting tanpa header kustom (mis. GitHub Pages): header isolasi lintas-origin ditambahkan di sini supaya mesin AI bisa
   memakai banyak thread. Berlaku mulai kunjungan kedua (setelah service worker aktif). */
const iso = (r) => {
  if (!r || r.status === 0 || r.type === 'opaque' || r.type === 'opaqueredirect' || r.status === 304) return r;
  const h = new Headers(r.headers);
  h.set('Cross-Origin-Opener-Policy', 'same-origin');
  h.set('Cross-Origin-Embedder-Policy', 'credentialless');
  return new Response(r.body, { status: r.status, statusText: r.statusText, headers: h });
};

const isRuntimeAsset = (p) => /\/(ai|vendor|assets|icons)\//.test(p);

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.headers.has('range')) return; // permintaan sebagian: biarkan browser

  if (req.mode === 'navigate') {
    // halaman: jaringan dulu (versi terbaru), cadangan dari cache bila offline
    e.respondWith(
      fetch(req)
        .then((r) => {
          if (r.ok) caches.open(SHELL).then((c) => c.put(new URL('./', self.registration.scope).href, r.clone()));
          return iso(r);
        })
        .catch(() => caches.match(new URL('./', self.registration.scope).href).then((r) => iso(r || undefined) || caches.match(new URL('index.html', self.registration.scope).href).then(iso))),
    );
    return;
  }

  if (isRuntimeAsset(url.pathname)) {
    // aset bernama-hash & model: cache dulu, isi dari jaringan bila belum ada
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          (hit && iso(hit)) ||
          fetch(req).then((r) => {
            if (r.ok && r.status === 200) {
              const copy = r.clone();
              caches.open(url.pathname.includes('/ai/') ? RUNTIME : SHELL).then((c) => c.put(req, copy));
            }
            return iso(r);
          }),
      ),
    );
    return;
  }

  e.respondWith(fetch(req).then(iso).catch(() => caches.match(req).then(iso)));
});
