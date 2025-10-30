/**
 * Field Entry Repository - SQLite Data Access
 * Shared across iOS, Android, macOS, Windows
 */

import { open, type QuickSQLiteConnection } from 'react-native-quick-sqlite';
import type { FieldEntry, FieldEntryRow, CreateFieldEntryDTO } from '../types';

export class FieldEntryRepository {
  private db: QuickSQLiteConnection;
  private initialized = false;

  constructor(dbName: string = 'wellpulse.db') {
    this.db = open({ name: dbName });
  }

  /**
   * Initialize database schema and indexes
   * Call this once when app starts
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Create field_entries table
      await this.db.execute(`
        CREATE TABLE IF NOT EXISTS field_entries (
          id TEXT PRIMARY KEY NOT NULL,
          well_name TEXT NOT NULL,
          operator_name TEXT NOT NULL,
          entry_date TEXT NOT NULL,
          production_volume REAL NOT NULL,
          pressure REAL,
          temperature REAL,
          notes TEXT,
          synced INTEGER DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);

      // Create indexes for performance
      await this.db.execute(`
        CREATE INDEX IF NOT EXISTS idx_field_entries_well
        ON field_entries(well_name)
      `);

      await this.db.execute(`
        CREATE INDEX IF NOT EXISTS idx_field_entries_date
        ON field_entries(entry_date)
      `);

      await this.db.execute(`
        CREATE INDEX IF NOT EXISTS idx_field_entries_synced
        ON field_entries(synced)
      `);

      this.initialized = true;
      console.log('[FieldEntryRepository] Database initialized');
    } catch (error) {
      console.error('[FieldEntryRepository] Initialization failed:', error);
      throw new Error(`Failed to initialize database: ${error}`);
    }
  }

  /**
   * Save a new field entry
   */
  async save(dto: CreateFieldEntryDTO): Promise<FieldEntry> {
    await this.ensureInitialized();

    const id = this.generateUUID();
    const now = new Date().toISOString();

    const entry: FieldEntry = {
      id,
      wellName: dto.wellName,
      operatorName: dto.operatorName,
      entryDate: dto.entryDate,
      productionVolume: dto.productionVolume,
      pressure: dto.pressure,
      temperature: dto.temperature,
      notes: dto.notes,
      synced: false,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await this.db.execute(
        `INSERT INTO field_entries
         (id, well_name, operator_name, entry_date, production_volume, pressure, temperature, notes, synced, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          entry.id,
          entry.wellName,
          entry.operatorName,
          entry.entryDate,
          entry.productionVolume,
          entry.pressure ?? null,
          entry.temperature ?? null,
          entry.notes ?? null,
          entry.synced ? 1 : 0,
          entry.createdAt,
          entry.updatedAt,
        ],
      );

      console.log('[FieldEntryRepository] Entry saved:', entry.id);
      return entry;
    } catch (error) {
      console.error('[FieldEntryRepository] Save failed:', error);
      throw new Error(`Failed to save entry: ${error}`);
    }
  }

  /**
   * Find all entries (most recent first, limited to 100)
   */
  async findAll(limit: number = 100): Promise<FieldEntry[]> {
    await this.ensureInitialized();

    try {
      const result = await this.db.execute(
        `SELECT * FROM field_entries
         ORDER BY entry_date DESC, created_at DESC
         LIMIT ?`,
        [limit],
      );

      const rows = result.rows?._array ?? [];
      return rows.map((row) => this.mapRowToEntity(row));
    } catch (error) {
      console.error('[FieldEntryRepository] FindAll failed:', error);
      throw new Error(`Failed to fetch entries: ${error}`);
    }
  }

  /**
   * Find recent entries (last 10 by default)
   */
  async findRecent(limit: number = 10): Promise<FieldEntry[]> {
    return this.findAll(limit);
  }

  /**
   * Find entry by ID
   */
  async findById(id: string): Promise<FieldEntry | null> {
    await this.ensureInitialized();

    try {
      const result = await this.db.execute('SELECT * FROM field_entries WHERE id = ? LIMIT 1', [
        id,
      ]);

      const rows = result.rows?._array ?? [];
      if (rows.length === 0) return null;

      return this.mapRowToEntity(rows[0]);
    } catch (error) {
      console.error('[FieldEntryRepository] FindById failed:', error);
      throw new Error(`Failed to fetch entry: ${error}`);
    }
  }

  /**
   * Find unsynced entries (for batch sync)
   */
  async findUnsynced(): Promise<FieldEntry[]> {
    await this.ensureInitialized();

    try {
      const result = await this.db.execute(
        `SELECT * FROM field_entries
         WHERE synced = 0
         ORDER BY created_at ASC`,
      );

      const rows = result.rows?._array ?? [];
      return rows.map((row) => this.mapRowToEntity(row));
    } catch (error) {
      console.error('[FieldEntryRepository] FindUnsynced failed:', error);
      throw new Error(`Failed to fetch unsynced entries: ${error}`);
    }
  }

  /**
   * Count unsynced entries
   */
  async countUnsynced(): Promise<number> {
    await this.ensureInitialized();

    try {
      const result = await this.db.execute(
        'SELECT COUNT(*) as count FROM field_entries WHERE synced = 0',
      );

      const rows = result.rows?._array ?? [];
      return rows[0]?.count ?? 0;
    } catch (error) {
      console.error('[FieldEntryRepository] CountUnsynced failed:', error);
      return 0;
    }
  }

  /**
   * Mark entry as synced
   */
  async markSynced(id: string): Promise<void> {
    await this.ensureInitialized();

    try {
      await this.db.execute('UPDATE field_entries SET synced = 1, updated_at = ? WHERE id = ?', [
        new Date().toISOString(),
        id,
      ]);

      console.log('[FieldEntryRepository] Entry marked as synced:', id);
    } catch (error) {
      console.error('[FieldEntryRepository] MarkSynced failed:', error);
      throw new Error(`Failed to mark entry as synced: ${error}`);
    }
  }

  /**
   * Delete entry by ID
   */
  async delete(id: string): Promise<void> {
    await this.ensureInitialized();

    try {
      await this.db.execute('DELETE FROM field_entries WHERE id = ?', [id]);
      console.log('[FieldEntryRepository] Entry deleted:', id);
    } catch (error) {
      console.error('[FieldEntryRepository] Delete failed:', error);
      throw new Error(`Failed to delete entry: ${error}`);
    }
  }

  /**
   * Delete all entries (use with caution!)
   */
  async deleteAll(): Promise<void> {
    await this.ensureInitialized();

    try {
      await this.db.execute('DELETE FROM field_entries');
      console.log('[FieldEntryRepository] All entries deleted');
    } catch (error) {
      console.error('[FieldEntryRepository] DeleteAll failed:', error);
      throw new Error(`Failed to delete all entries: ${error}`);
    }
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    try {
      // react-native-quick-sqlite doesn't have explicit close
      // Connection is managed automatically
      this.initialized = false;
      console.log('[FieldEntryRepository] Database connection closed');
    } catch (error) {
      console.error('[FieldEntryRepository] Close failed:', error);
    }
  }

  // ==================== Private Methods ====================

  /**
   * Ensure database is initialized before operations
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Map database row to domain entity
   */
  private mapRowToEntity(row: FieldEntryRow): FieldEntry {
    return {
      id: row.id,
      wellName: row.well_name,
      operatorName: row.operator_name,
      entryDate: row.entry_date,
      productionVolume: row.production_volume,
      pressure: row.pressure ?? undefined,
      temperature: row.temperature ?? undefined,
      notes: row.notes ?? undefined,
      synced: row.synced === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Generate UUID v4 (compatible with all platforms)
   */
  private generateUUID(): string {
    // Simple UUID v4 implementation
    // In production, consider using a library like 'uuid'
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}
