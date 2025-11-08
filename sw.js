importScripts('https://unpkg.com/dexie@3.2.3/dist/dexie.js');
importScripts('/db.js');

const CACHE_NAME = 'cashsplitter-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  'https://cdn.jsdelivr.net/npm/bulma@0.9.4/css/bulma.min.css',
  'https://unpkg.com/htmx.org@1.9.10',
  'https://unpkg.com/dexie@3.2.3/dist/dexie.js',
  '/asp.js',
  '/db.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  if (url.pathname.startsWith('/api/fragment/')) {
    event.respondWith(handleApiRequest(event));
  } else {
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          return response || fetch(event.request);
        })
    );
  }
});

async function handleApiRequest(event) {
  try {
    const events = await db.events.toArray();
    const fragment = `
      <h2 class="subtitle">Events</h2>
      <ul>
        ${events.map(e => `<li>${e.eventType}: ${JSON.stringify(e.payload)}</li>`).join('')}
      </ul>
    `;
    return new Response(fragment, {
      headers: { 'Content-Type': 'text/html' }
    });
  } catch (error) {
    console.error('Failed to handle API request:', error);
    return new Response('Error generating fragment', { status: 500 });
  }
}
