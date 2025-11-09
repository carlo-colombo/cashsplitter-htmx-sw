importScripts('https://unpkg.com/dexie@3.2.3/dist/dexie.js');

const db = new Dexie('LedgerDB');

db.version(1).stores({
  events: '++event_id,timestamp,eventType,aggregateId',
  projections: 'projection_key'
});

console.log('Database setup complete.');

const App = {
  generateUUID: function() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  },

  calculateChecksum: function(payload) {
    const str = JSON.stringify(payload);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
  },

  _saveEvent: async function(eventType, aggregateId, payload) {
    const event = {
      timestamp: new Date().toISOString(),
      eventType: eventType,
      aggregateId: aggregateId,
      payload: payload,
      checksum: this.calculateChecksum(payload)
    };
    await db.events.add(event);
    console.log(`Event ${eventType} saved successfully.`);
  },

  saveGroupCreatedEvent: async function(groupName, groupMembers) {
    const aggregateId = this.generateUUID();
    const members = groupMembers.split(',').map(m => m.trim());
    const payload = { name: groupName, members };
    await this._saveEvent('GROUP_CREATED', aggregateId, payload);
    return aggregateId;
  },

  saveGroupDeletedEvent: async function(groupId) {
    await this._saveEvent('GROUP_DELETED', groupId, {});
  },

  recalculateProjections: async function() {
    const events = await db.events.orderBy('timestamp').toArray();
    const groupListProjection = {
      projection_key: 'group_list',
      groups: {}
    };

    for (const event of events) {
      if (event.eventType === 'GROUP_CREATED') {
        groupListProjection.groups[event.aggregateId] = {
          id: event.aggregateId,
          name: event.payload.name,
          members: event.payload.members
        };
      } else if (event.eventType === 'GROUP_DELETED') {
        delete groupListProjection.groups[event.aggregateId];
      }
    }
    await db.projections.put(groupListProjection);
    console.log('Projections recalculated.');
  },

  renderGroupList: async function() {
    const projection = await db.projections.get('group_list');
    if (!projection || Object.keys(projection.groups).length === 0) {
      return '<div id="group-list"><p>No groups yet. Create one!</p></div>';
    }

    let cardsHtml = Object.values(projection.groups).map(group => `
      <div class="card mb-4">
        <header class="card-header">
          <p class="card-header-title">${group.name}</p>
          <button class="button is-danger is-small card-header-icon" hx-delete="api/groups/${group.id}" hx-target="#group-list" hx-swap="outerHTML" hx-confirm="Are you sure you want to delete this group?">
            Delete
          </button>
        </header>
        <div class="card-content">
          <div class="content">
            <strong>Members:</strong>
            <ul>
              ${group.members.map(m => `<li>${m}</li>`).join('')}
            </ul>
          </div>
        </div>
      </div>
    `).join('');

    return `<div id="group-list">${cardsHtml}</div>`;
  },

  renderGroupDetail: async function(groupId) {
    const projection = await db.projections.get('group_list');
    const group = projection.groups[groupId];

    if (!group) {
      return '<p>Group not found.</p>';
    }

    return `
      <div id="group-detail">
        <a href="#" hx-get="api/fragment/group-list" hx-target="#app-content" hx-swap="innerHTML" class="is-link">← Back to Groups</a>
        <h2 class="title mt-4">${group.name}</h2>
        <div class="content">
          <strong>Members:</strong>
          <ul>
            ${group.members.map(m => `<li>${m}</li>`).join('')}
          </ul>
        </div>
      </div>
    `;
  }
};

const CACHE_NAME = 'cashsplitter-cache-v1';
const urlsToCache = [
  './',
  'index.html',
  'https://cdn.jsdelivr.net/npm/bulma@0.9.4/css/bulma.min.css',
  'https://unpkg.com/htmx.org@1.9.10',
  'https://unpkg.com/dexie@3.2.3/dist/dexie.js'
];

self.addEventListener('install', event => {
  console.log('[SW] Install event');
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching assets');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('activate', event => {
  console.log('[SW] Activate event');
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  console.log(`[SW] Fetching: ${url.pathname}`);

  if (url.pathname.includes('/api/')) {
    console.log('[SW] API request detected, handling...');
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
    if (url.pathname.endsWith('/api/fragment/group-list') && event.request.method === 'GET') {
      await App.recalculateProjections(); // Ensure projections are up to date
      const fragment = await App.renderGroupList();
      return new Response(fragment, { headers: { 'Content-Type': 'text/html' } });
    }

    if (url.pathname.endsWith('/api/groups') && event.request.method === 'POST') {
      const formData = await event.request.formData();
      const groupName = formData.get('groupName');
      const groupMembers = formData.get('groupMembers');

      const newGroupId = await App.saveGroupCreatedEvent(groupName, groupMembers);
      await App.recalculateProjections();

      return new Response(null, {
        status: 204,
        headers: { 'HX-Redirect': `api/fragment/group-detail/${newGroupId}` }
      });
    }

    const groupDetailMatch = url.pathname.match(/\/api\/fragment\/group-detail\/(.*)/);
    if (groupDetailMatch && event.request.method === 'GET') {
      const groupId = groupDetailMatch[1];
      const fragment = await App.renderGroupDetail(groupId);
      return new Response(fragment, { headers: { 'Content-Type': 'text/html' } });
    }

    const groupDeleteMatch = url.pathname.match(/\/api\/groups\/(.*)/);
    if (groupDeleteMatch && event.request.method === 'DELETE') {
      const groupId = groupDeleteMatch[1];
      await App.saveGroupDeletedEvent(groupId);
      await App.recalculateProjections();
      const fragment = await App.renderGroupList();
      return new Response(fragment, { headers: { 'Content-Type': 'text/html' }});
    }

    return new Response('Not Found', { status: 404 });
  } catch (error) {
    console.error(`Error handling ${event.request.method} ${event.request.url}:`, error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
