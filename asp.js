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
    const payload = { groupName, members };
    await this._saveEvent('GROUP_CREATED', aggregateId, payload);
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
          name: event.payload.groupName,
          members: event.payload.members
        };
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
  }
};
