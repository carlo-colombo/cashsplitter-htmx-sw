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

  saveEvent: async function(eventType, aggregateId, payload) {
    const event = {
      timestamp: new Date().toISOString(),
      eventType: eventType,
      aggregateId: aggregateId,
      payload: payload,
      checksum: this.calculateChecksum(payload)
    };

    try {
      await db.events.add(event);
      console.log('Event saved successfully.');
    } catch (error) {
      console.error('Failed to save event:', error);
    }
  }
};
