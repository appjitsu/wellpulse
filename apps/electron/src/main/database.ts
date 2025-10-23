import Database from 'better-sqlite3';
import * as path from 'path';
import { app } from 'electron';

let db: Database.Database | null = null;

/**
 * Initialize SQLite database for offline data storage
 *
 * Stores:
 * - Field data entries (production, equipment readings)
 * - Sync queue (pending changes to upload)
 * - Event log (append-only audit trail)
 */
export function initDatabase(): Database.Database {
  if (db) return db;

  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, 'wellpulse-field.db');

  db = new Database(dbPath);

  // Enable WAL mode for better concurrency
  db.pragma('journal_mode = WAL');

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS field_entries (
      id TEXT PRIMARY KEY,
      well_id TEXT NOT NULL,
      entry_date TEXT NOT NULL,
      production_data TEXT, -- JSON
      equipment_readings TEXT, -- JSON
      notes TEXT,
      photos TEXT, -- JSON array of photo paths
      created_at TEXT NOT NULL,
      synced BOOLEAN DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL, -- 'CREATE', 'UPDATE', 'DELETE'
      entity_type TEXT NOT NULL, -- 'field_entry', 'equipment_reading', etc.
      entity_id TEXT NOT NULL,
      payload TEXT NOT NULL, -- JSON
      created_at TEXT NOT NULL,
      retry_count INTEGER DEFAULT 0,
      last_error TEXT
    );

    CREATE TABLE IF NOT EXISTS event_log (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      payload TEXT, -- JSON
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_field_entries_well_date
      ON field_entries(well_id, entry_date);
    CREATE INDEX IF NOT EXISTS idx_field_entries_synced
      ON field_entries(synced);
    CREATE INDEX IF NOT EXISTS idx_sync_queue_created
      ON sync_queue(created_at);
  `);

  console.log('[Database] Initialized at:', dbPath);

  return db;
}

/**
 * Close database connection
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
    console.log('[Database] Closed');
  }
}

/**
 * Get database instance
 */
export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}
