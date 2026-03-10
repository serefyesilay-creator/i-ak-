const CACHE_NAME = 'is-akisi-v2'
const STATIC_CACHE = 'is-akisi-static-v2'

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

    // Navigation & API routes → Stale-While-Revalidate
    event.respondWith(
        caches.open(CACHE_NAME).then(async (cache) => {
            const cached = await cache.match(event.request)
            const networkFetch = fetch(event.request).then((response) => {
                if (response.ok && event.request.mode === 'navigate') {
                    cache.put(event.request, response.clone())
                }
                return response
            }).catch(() => cached || new Response('Offline', { status: 503 }))

            // Return cache immediately if available, update in background
            return cached || networkFetch
        })
    )
})
