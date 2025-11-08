importScripts('https://unpkg.com/dexie@3.2.3/dist/dexie.js');
importScripts('/db.js');
importScripts('/asp.js');

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

self.addEventListener('activate', event => {
  console.log('ServiceWorker activated');
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(event));
  } else {
    event.respondWith(
      caches.match(event.request).then(response => {
        return response || fetch(event.request);
      })
    );
  }
});

async function handleApiRequest(event) {
  const url = new URL(event.request.url);

  try {
    if (url.pathname === '/api/fragment/group-list' && event.request.method === 'GET') {
      await App.recalculateProjections(); // Ensure projections are up to date
      const fragment = await App.renderGroupList();
      return new Response(fragment, { headers: { 'Content-Type': 'text/html' } });
    }

    if (url.pathname === '/api/groups' && event.request.method === 'POST') {
      const formData = await event.request.formData();
      const groupName = formData.get('groupName');
      const groupMembers = formData.get('groupMembers');

      await App.saveGroupCreatedEvent(groupName, groupMembers);
      await App.recalculateProjections();

      const fragment = await App.renderGroupList();
      return new Response(fragment, { headers: { 'Content-Type': 'text/html' } });
    }

    return new Response('Not Found', { status: 404 });
  } catch (error) {
    console.error(`Error handling ${event.request.method} ${event.request.url}:`, error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
