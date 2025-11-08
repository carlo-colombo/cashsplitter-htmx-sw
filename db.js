const db = new Dexie('LedgerDB');

db.version(1).stores({
  events: '++event_id,timestamp,eventType,aggregateId',
  projections: 'projection_key'
});

console.log('Database setup complete.');
