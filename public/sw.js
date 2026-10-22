const CACHE_NAME = 'is-akisi-v3'
const STATIC_CACHE = 'is-akisi-static-v3'

// Install: pre-cache app shell
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(['/', '/auth/login']))
    )
    self.skipWaiting()
})

// Activate: clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME && k !== STATIC_CACHE).map((k) => caches.delete(k)))
        )
    )
    self.clients.claim()
})

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return

    const url = new URL(event.request.url)

    // Skip Supabase API calls — always network
    if (url.hostname.includes('supabase')) return

    // Static assets (JS, CSS, fonts, images) → Cache-First
    if (
        url.pathname.startsWith('/_next/static/') ||
        url.pathname.startsWith('/icons/') ||
        url.pathname.endsWith('.png') ||
        url.pathname.endsWith('.jpg') ||
        url.pathname.endsWith('.svg') ||
        url.pathname.endsWith('.woff2')
    ) {
        event.respondWith(
            caches.open(STATIC_CACHE).then(async (cache) => {
                const cached = await cache.match(event.request)
                if (cached) return cached
                const response = await fetch(event.request)
                if (response.ok) cache.put(event.request, response.clone())
                return response
            })
        )
        return
    }

    // Sayfalar → Network-First: veriler (alacak, görev) her açılışta güncel gelir.
    // Önbellek sadece internet yokken yedek olarak kullanılır.
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                if (response.ok && event.request.mode === 'navigate') {
                    const copy = response.clone()
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy))
                }
                return response
            })
            .catch(async () => {
                const cached = await caches.match(event.request)
                return cached || new Response('Offline', { status: 503 })
            })
    )
})
