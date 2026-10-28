// Offline app shell: stale-while-revalidate for same-origin GETs, cached index.html for navigations.
// Weather/TTC calls are cross-origin or /api/ and are never cached here (the game caches them itself).
const CACHE = 'tss-shell-v1'

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.add('/index.html')).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  const url = new URL(req.url)
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put('/index.html', copy)); return res })
        .catch(() => caches.match('/index.html')),
    )
    return
  }

  e.respondWith(
    caches.open(CACHE).then(async (c) => {
      const hit = await c.match(req)
      const net = fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()); return res }).catch(() => hit)
      return hit ?? net
    }),
  )
})
