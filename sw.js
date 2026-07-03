const CACHE_NAME = 'invoice-gen-v11';
const ASSETS = [
    './',
    './index.html',
    './css/style.css',
    './js/app.js',
    './js/pdf-builder.js',
    './manifest.json',
    './img/192x192.png',
    './img/192x192f.png',
    './img/512x512.png',
    './img/750x337.png',
    './robots.txt',
    // Local Fonts for Offline Support
    './font/AmsterdamHandwriting.ttf',
    './font/BastligaOne.ttf',
    './font/Palisade.otf',
    './font/Priestacy.otf',
    './font/Signatie.otf',
    './font/WhisperingSignature.ttf',
    './font/modernline.otf',
    // External Resources
    'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/pdfmake.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/vfs_fonts.js',
    'https://cdnjs.cloudflare.com/ajax/libs/localforage/1.10.0/localforage.min.js',
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

// Install: Cache all known assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
    self.skipWaiting();
});

// Activate: Clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch Strategy
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    // 1. Network First for index.html (ensure users get the latest app skeleton)
    if (url.pathname === '/' || url.pathname.endsWith('index.html')) {
        event.respondWith(
            fetch(event.request)
                .then((networkResponse) => {
                    const clonedResponse = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clonedResponse));
                    return networkResponse;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    // 2. Cache First for Fonts and Images (rarely change)
    if (
        url.pathname.endsWith('.png') ||
        url.pathname.endsWith('.jpg') ||
        url.pathname.endsWith('.ttf') ||
        url.pathname.endsWith('.otf') ||
        url.pathname.endsWith('.woff2') ||
        url.hostname === 'fonts.gstatic.com'
    ) {
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                return cachedResponse || fetch(event.request).then((networkResponse) => {
                    const clonedResponse = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clonedResponse));
                    return networkResponse;
                });
            })
        );
        return;
    }

    // 3. Stale-While-Revalidate for CSS, JS, and CDN assets
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            const fetchPromise = fetch(event.request).then((networkResponse) => {
                // Cache the fresh response dynamically
                const clonedResponse = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clonedResponse));
                return networkResponse;
            }).catch(() => {
                // Ignore network errors on background revalidation
            });

            // Return cached immediately if available, otherwise wait for network
            return cachedResponse || fetchPromise;
        })
    );
});
