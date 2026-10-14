/*
 * Cartas service worker. Hand-written, like the manifest and the icons: the app
 * needs exactly three behaviours, and a generated worker would bring a build
 * step and a dependency for each of them.
 *
 * It also earns its keep twice. Without a worker that answers `fetch`, Chrome
 * never fires `beforeinstallprompt`, so the app could not offer to install
 * itself at all — the manifest alone is not enough. And the match panel has to
 * survive a locked screen in a bar with no signal, which means the shell has to
 * come from somewhere other than the network.
 *
 * Bump VERSION to retire every cache from the previous release.
 */
const VERSION = 'v1'
const SHELL = `cartas-shell-${VERSION}`
const ASSETS = `cartas-assets-${VERSION}`

/* The entry point, kept so a cold start with no signal still paints the app. */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.add(new Request('/', { cache: 'reload' })))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  )
})

/* A new worker owns the page straight away, and the old caches go. */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith('cartas-') && name !== SHELL && name !== ASSETS)
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event

  // Supabase, the edge functions and anything else off-origin go straight to
  // the network, untouched. Caching somebody's session or their match rows here
  // would be a privacy bug, not a feature.
  if (request.method !== 'GET') return
  if (new URL(request.url).origin !== self.location.origin) return

  // Routes are drawn by the app, so every navigation wants index.html. Network
  // first: otherwise a deploy would be invisible until the cache expired.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          void caches.open(SHELL).then((cache) => cache.put('/', copy))
          return response
        })
        .catch(async () => (await caches.match('/')) ?? Response.error()),
    )
    return
  }

  // Built assets carry a content hash in the name, so a hit is always correct
  // and a miss is always a new file.
  if (request.url.includes('/assets/')) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ??
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone()
              void caches.open(ASSETS).then((cache) => cache.put(request, copy))
            }
            return response
          }),
      ),
    )
  }
})
