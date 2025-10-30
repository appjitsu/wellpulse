/**
 * SQLite Database Service
 * Manages local database connection and operations
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import { CREATE_TABLES_SQL, FieldEntry, Photo, Well, WellReading } from './schema';

class DatabaseService {
  private db: SQLite.SQLiteDatabase | null = null;
  private isInitialized = false;

  /**
   * Get direct access to the SQLite database instance
   * Useful for custom queries not covered by the service methods
   */
  async getDatabase(): Promise<SQLite.SQLiteDatabase> {
    if (Platform.OS === 'web') {
      throw new Error('Database not available on web platform');
    }

    if (!this.db) {
      await this.initialize();
    }

    if (!this.db) {
      throw new Error('Database failed to initialize');
    }

    return this.db;
  }

  initialize = async (): Promise<void> => {
    if (this.isInitialized) return;

    // Skip database initialization on web
    if (Platform.OS === 'web') {
      console.warn('SQLite is not available on web platform');
      return;
    }

    try {
      this.db = await SQLite.openDatabaseAsync('wellpulse.db');
      await this.db.execAsync(CREATE_TABLES_SQL);
      this.isInitialized = true;
      console.log('Database initialized successfully');

      // Seed database with sample data if empty
      await this.seedIfEmpty();
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw error;
    }
  };

  async saveFieldEntry(
    entry: Omit<FieldEntry, 'id' | 'createdAt' | 'updatedAt' | 'syncStatus'>,
  ): Promise<string> {
    // Web: Save directly to API
    if (Platform.OS === 'web') {
      const API_URL = 'http://localhost:4000';

      // Get auth headers from auth service
      try {
        const { authService } = await import('../services/auth');
        const headers = await authService.getAuthHeaders();

        const response = await fetch(`${API_URL}/api/field-data`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            wellName: entry.wellName,
            productionVolume: parseFloat(entry.productionVolume),
            gasVolume: entry.gasVolume ? parseFloat(entry.gasVolume) : undefined,
            waterVolume: entry.waterVolume ? parseFloat(entry.waterVolume) : undefined,
            waterCut: entry.waterCut ? parseFloat(entry.waterCut) : undefined,
            pressure: entry.pressure ? parseFloat(entry.pressure) : undefined,
            temperature: entry.temperature ? parseFloat(entry.temperature) : undefined,
            tankLevel: entry.tankLevel ? parseFloat(entry.tankLevel) : undefined,
            bsw: entry.bsw ? parseFloat(entry.bsw) : undefined,
            gor: entry.gor ? parseFloat(entry.gor) : undefined,
            fluidLevel: entry.fluidLevel ? parseFloat(entry.fluidLevel) : undefined,
            casingPressure: entry.casingPressure ? parseFloat(entry.casingPressure) : undefined,
            tubingPressure: entry.tubingPressure ? parseFloat(entry.tubingPressure) : undefined,
            pumpStatus: entry.pumpStatus,
            downtimeHours: entry.downtimeHours ? parseFloat(entry.downtimeHours) : undefined,
            downtimeReason: entry.downtimeReason,
            runTicket: entry.runTicket,
            waterHaul: entry.waterHaul ? parseFloat(entry.waterHaul) : undefined,
            notes: entry.notes,
            photos: entry.photos,
            location: entry.location,
            checklist: entry.checklist,
          }),
        });

        if (!response.ok) {
          const errorData = await response
            .json()
            .catch(() => ({ message: 'Failed to save entry' }));
          throw new Error(errorData.message || 'Failed to save entry to server');
        }

        const data = await response.json();
        return data.id || `entry_${Date.now()}`;
      } catch (error) {
        console.error('[Database] Failed to save entry on web:', error);
        throw error;
      }
    }

    // Mobile: Save to SQLite
    if (!this.db) {
      throw new Error('Database not available');
    }

    const id = `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const createdAt = new Date().toISOString();
    const updatedAt = createdAt; // Set updatedAt = createdAt on initial save

    await this.db.runAsync(
      `INSERT INTO field_entries (
        id, wellName, productionVolume, gasVolume, waterVolume, waterCut, pressure, temperature,
        tankLevel, bsw, gor, fluidLevel, casingPressure, tubingPressure,
        pumpStatus, downtimeHours, downtimeReason, runTicket, waterHaul,
        notes, photos, location, checklist, createdAt, updatedAt, syncStatus
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        entry.wellName,
        entry.productionVolume,
        entry.gasVolume || null,
        entry.waterVolume || null,
        entry.waterCut || null,
        entry.pressure || null,
        entry.temperature || null,
        entry.tankLevel || null,
        entry.bsw || null,
        entry.gor || null,
        entry.fluidLevel || null,
        entry.casingPressure || null,
        entry.tubingPressure || null,
        entry.pumpStatus || null,
        entry.downtimeHours || null,
        entry.downtimeReason || null,
        entry.runTicket || null,
        entry.waterHaul || null,
        entry.notes || null,
        JSON.stringify(entry.photos),
        entry.location ? JSON.stringify(entry.location) : null,
        JSON.stringify(entry.checklist),
        createdAt,
        updatedAt,
        'pending',
      ],
    );

    return id;
  }

  async getAllEntries(): Promise<FieldEntry[]> {
    if (Platform.OS === 'web' || !this.db) {
      return [];
    }

    const rows = await this.db.getAllAsync<any>(
      'SELECT * FROM field_entries ORDER BY createdAt DESC',
    );

    return rows.map((row) => this.rowToEntry(row));
  }

  /**
   * Get paginated entries for history screen
   * Supports infinite scroll with LIMIT/OFFSET
   */
  async getEntriesPaginated(limit: number = 20, offset: number = 0): Promise<FieldEntry[]> {
    if (Platform.OS === 'web' || !this.db) {
      return [];
    }

    const rows = await this.db.getAllAsync<any>(
      'SELECT * FROM field_entries ORDER BY createdAt DESC LIMIT ? OFFSET ?',
      [limit, offset],
    );

    return rows.map((row) => this.rowToEntry(row));
  }

  /**
   * Get total count of entries (for pagination UI)
   */
  async getEntriesCount(): Promise<number> {
    if (Platform.OS === 'web' || !this.db) {
      return 0;
    }

    const result = await this.db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM field_entries',
    );

    return result?.count || 0;
  }

  async getEntryById(id: string): Promise<FieldEntry | null> {
    if (Platform.OS === 'web' || !this.db) {
      return null;
    }

    const row = await this.db.getFirstAsync<any>('SELECT * FROM field_entries WHERE id = ?', [id]);

    return row ? this.rowToEntry(row) : null;
  }

  async getPendingEntries(): Promise<FieldEntry[]> {
    if (Platform.OS === 'web' || !this.db) {
      return [];
    }

    const rows = await this.db.getAllAsync<any>(
      `SELECT * FROM field_entries WHERE syncStatus IN ('pending', 'failed') ORDER BY createdAt ASC`,
    );

    return rows.map((row) => this.rowToEntry(row));
  }

  async getConflictedEntries(): Promise<FieldEntry[]> {
    if (Platform.OS === 'web' || !this.db) {
      return [];
    }

    const rows = await this.db.getAllAsync<any>(
      `SELECT * FROM field_entries WHERE syncStatus = 'conflict' ORDER BY createdAt DESC`,
    );

    return rows.map((row) => this.rowToEntry(row));
  }

  async updateSyncStatus(
    id: string,
    status: 'pending' | 'syncing' | 'synced' | 'failed' | 'conflict',
    error?: string,
  ): Promise<void> {
    if (Platform.OS === 'web' || !this.db) {
      return;
    }

    const syncedAt = status === 'synced' ? new Date().toISOString() : null;

    await this.db.runAsync(
      'UPDATE field_entries SET syncStatus = ?, syncedAt = ?, syncError = ? WHERE id = ?',
      [status, syncedAt, error || null, id],
    );
  }

  async updateEntry(
    id: string,
    entry: Omit<
      FieldEntry,
      'id' | 'createdAt' | 'updatedAt' | 'syncStatus' | 'syncedAt' | 'syncError'
    >,
  ): Promise<void> {
    if (Platform.OS === 'web' || !this.db) {
      return;
    }

    const updatedAt = new Date().toISOString(); // Set updatedAt to current timestamp

    await this.db.runAsync(
      `UPDATE field_entries SET
        wellName = ?, productionVolume = ?, gasVolume = ?, waterVolume = ?, waterCut = ?,
        pressure = ?, temperature = ?, tankLevel = ?, bsw = ?, gor = ?, fluidLevel = ?,
        casingPressure = ?, tubingPressure = ?, pumpStatus = ?, downtimeHours = ?,
        downtimeReason = ?, runTicket = ?, waterHaul = ?, notes = ?, photos = ?,
        location = ?, checklist = ?, updatedAt = ?
      WHERE id = ?`,
      [
        entry.wellName,
        entry.productionVolume,
        entry.gasVolume || null,
        entry.waterVolume || null,
        entry.waterCut || null,
        entry.pressure || null,
        entry.temperature || null,
        entry.tankLevel || null,
        entry.bsw || null,
        entry.gor || null,
        entry.fluidLevel || null,
        entry.casingPressure || null,
        entry.tubingPressure || null,
        entry.pumpStatus || null,
        entry.downtimeHours || null,
        entry.downtimeReason || null,
        entry.runTicket || null,
        entry.waterHaul || null,
        entry.notes || null,
        JSON.stringify(entry.photos),
        entry.location ? JSON.stringify(entry.location) : null,
        JSON.stringify(entry.checklist),
        updatedAt,
        id,
      ],
    );
  }

  async deleteEntry(id: string): Promise<void> {
    if (Platform.OS === 'web' || !this.db) {
      return;
    }

    await this.db.runAsync('DELETE FROM field_entries WHERE id = ?', [id]);
  }

  async getSyncStats(): Promise<{
    total: number;
    pending: number;
    synced: number;
    failed: number;
  }> {
    if (Platform.OS === 'web' || !this.db) {
      return { total: 0, pending: 0, synced: 0, failed: 0 };
    }

    const stats = await this.db.getFirstAsync<{
      total: number;
      pending: number;
      synced: number;
      failed: number;
    }>(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN syncStatus IN ('pending', 'failed') THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN syncStatus = 'synced' THEN 1 ELSE 0 END) as synced,
        SUM(CASE WHEN syncStatus = 'failed' THEN 1 ELSE 0 END) as failed
      FROM field_entries
    `);

    return stats || { total: 0, pending: 0, synced: 0, failed: 0 };
  }

  /**
   * Update entry with conflict data from server
   */
  async updateEntryWithConflict(
    id: string,
    conflictData: Partial<FieldEntry>,
    serverVersion: string,
  ): Promise<void> {
    if (Platform.OS === 'web' || !this.db) {
      return;
    }

    await this.db.runAsync(
      `UPDATE field_entries SET
        syncStatus = 'conflict',
        serverVersion = ?,
        conflictData = ?
      WHERE id = ?`,
      ['conflict', serverVersion, JSON.stringify(conflictData), id],
    );
  }

  /**
   * Update entry with resolved conflict
   */
  async updateEntryWithResolution(id: string, resolvedEntry: FieldEntry): Promise<void> {
    if (Platform.OS === 'web' || !this.db) {
      return;
    }

    await this.db.runAsync(
      `UPDATE field_entries SET
        wellName = ?, productionVolume = ?, gasVolume = ?, waterVolume = ?, waterCut = ?,
        pressure = ?, temperature = ?, tankLevel = ?, bsw = ?, gor = ?, fluidLevel = ?,
        casingPressure = ?, tubingPressure = ?, pumpStatus = ?, downtimeHours = ?,
        downtimeReason = ?, runTicket = ?, waterHaul = ?, notes = ?, photos = ?,
        location = ?, checklist = ?, updatedAt = ?,
        syncStatus = ?, serverVersion = ?, conflictData = ?
      WHERE id = ?`,
      [
        resolvedEntry.wellName,
        resolvedEntry.productionVolume,
        resolvedEntry.gasVolume || null,
        resolvedEntry.waterVolume || null,
        resolvedEntry.waterCut || null,
        resolvedEntry.pressure || null,
        resolvedEntry.temperature || null,
        resolvedEntry.tankLevel || null,
        resolvedEntry.bsw || null,
        resolvedEntry.gor || null,
        resolvedEntry.fluidLevel || null,
        resolvedEntry.casingPressure || null,
        resolvedEntry.tubingPressure || null,
        resolvedEntry.pumpStatus || null,
        resolvedEntry.downtimeHours || null,
        resolvedEntry.downtimeReason || null,
        resolvedEntry.runTicket || null,
        resolvedEntry.waterHaul || null,
        resolvedEntry.notes || null,
        JSON.stringify(resolvedEntry.photos),
        resolvedEntry.location ? JSON.stringify(resolvedEntry.location) : null,
        JSON.stringify(resolvedEntry.checklist),
        resolvedEntry.updatedAt,
        resolvedEntry.syncStatus,
        resolvedEntry.serverVersion || null,
        null, // Clear conflictData after resolution
        id,
      ],
    );
  }

  /**
   * Update entry photos with remote URLs after successful upload
   * Maintains both localUri (offline access) and remoteUrl (online performance)
   */
  async updateEntryPhotos(id: string, photos: Photo[]): Promise<void> {
    if (Platform.OS === 'web' || !this.db) {
      return;
    }

    await this.db.runAsync('UPDATE field_entries SET photos = ? WHERE id = ?', [
      JSON.stringify(photos),
      id,
    ]);
  }

  // ===== Wells Methods =====

  async getAllWells(): Promise<Well[]> {
    // On web, fetch from API since SQLite is not available
    if (Platform.OS === 'web') {
      try {
        const { authService } = await import('../services/auth');
        const headers = await authService.getAuthHeaders();
        // Use localhost for web, network IP for mobile devices
        const API_URL =
          Platform.OS === 'web'
            ? 'http://localhost:4000'
            : process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

        const response = await fetch(`${API_URL}/api/wells`, {
          method: 'GET',
          headers,
        });

        if (!response.ok) {
          console.error('[Database] API error fetching wells:', response.status);
          return [];
        }

        const data = await response.json();

        // API returns { wells: [...], total: number }
        const wellsArray = Array.isArray(data) ? data : data.wells || [];

        // Transform API response to Well schema format
        return wellsArray.map((well: any) => ({
          id: well.id,
          name: well.name,
          status: well.status.toLowerCase(),
          location:
            well.latitude && well.longitude
              ? {
                  latitude: parseFloat(well.latitude),
                  longitude: parseFloat(well.longitude),
                }
              : { latitude: 0, longitude: 0 },
          operator: well.operator || null,
          lastReading: well.lastReadingDate || null,
          syncedAt: new Date().toISOString(),
        }));
      } catch (error) {
        console.error('[Database] Failed to fetch wells from API:', error);
        return [];
      }
    }

    // On native, use local SQLite database
    if (!this.db) {
      return [];
    }

    const rows = await this.db.getAllAsync<any>('SELECT * FROM wells ORDER BY name ASC');

    return rows.map((row) => this.rowToWell(row));
  }

  async getWellById(id: string): Promise<Well | null> {
    if (Platform.OS === 'web' || !this.db) {
      return null;
    }

    const row = await this.db.getFirstAsync<any>('SELECT * FROM wells WHERE id = ?', [id]);

    return row ? this.rowToWell(row) : null;
  }

  async getWellsByStatus(status: 'active' | 'maintenance' | 'suspended'): Promise<Well[]> {
    if (Platform.OS === 'web' || !this.db) {
      return [];
    }

    const rows = await this.db.getAllAsync<any>(
      'SELECT * FROM wells WHERE status = ? ORDER BY name ASC',
      [status],
    );

    return rows.map((row) => this.rowToWell(row));
  }

  async saveWell(well: Omit<Well, 'syncedAt'>): Promise<void> {
    if (Platform.OS === 'web' || !this.db) {
      return;
    }

    const syncedAt = new Date().toISOString();

    await this.db.runAsync(
      `INSERT OR REPLACE INTO wells (
        id, name, wellType, status, location, operator, lastReading, syncedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        well.id,
        well.name,
        well.wellType,
        well.status,
        JSON.stringify(well.location),
        well.operator,
        well.lastReading ? JSON.stringify(well.lastReading) : null,
        syncedAt,
      ],
    );
  }

  async updateWell(id: string, updates: Partial<Omit<Well, 'id'>>): Promise<void> {
    if (Platform.OS === 'web' || !this.db) {
      return;
    }

    const fields: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.wellType !== undefined) {
      fields.push('wellType = ?');
      values.push(updates.wellType);
    }
    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
    }
    if (updates.location !== undefined) {
      fields.push('location = ?');
      values.push(JSON.stringify(updates.location));
    }
    if (updates.operator !== undefined) {
      fields.push('operator = ?');
      values.push(updates.operator);
    }
    if (updates.lastReading !== undefined) {
      fields.push('lastReading = ?');
      values.push(updates.lastReading ? JSON.stringify(updates.lastReading) : null);
    }

    fields.push('syncedAt = ?');
    values.push(new Date().toISOString());

    values.push(id);

    await this.db.runAsync(`UPDATE wells SET ${fields.join(', ')} WHERE id = ?`, values);
  }

  async deleteWell(id: string): Promise<void> {
    if (Platform.OS === 'web' || !this.db) {
      return;
    }

    await this.db.runAsync('DELETE FROM wells WHERE id = ?', [id]);
  }

  // ===== Well Readings Methods =====

  async getWellReadings(wellId: string, limit: number = 10): Promise<WellReading[]> {
    if (Platform.OS === 'web' || !this.db) {
      return [];
    }

    const rows = await this.db.getAllAsync<any>(
      'SELECT * FROM well_readings WHERE wellId = ? ORDER BY date DESC LIMIT ?',
      [wellId, limit],
    );

    return rows.map((row) => this.rowToWellReading(row));
  }

  async saveWellReading(reading: Omit<WellReading, 'syncedAt'>): Promise<void> {
    if (Platform.OS === 'web' || !this.db) {
      return;
    }

    const syncedAt = new Date().toISOString();

    await this.db.runAsync(
      `INSERT OR REPLACE INTO well_readings (
        id, wellId, date, production, gasVolume, pressure, temperature, waterCut, status, syncedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        reading.id,
        reading.wellId,
        reading.date,
        reading.production,
        reading.gasVolume || null,
        reading.pressure || null,
        reading.temperature || null,
        reading.waterCut || null,
        reading.status,
        syncedAt,
      ],
    );
  }

  async deleteWellReadings(wellId: string): Promise<void> {
    if (Platform.OS === 'web' || !this.db) {
      return;
    }

    await this.db.runAsync('DELETE FROM well_readings WHERE wellId = ?', [wellId]);
  }

  // ===== Seed Data Methods =====

  /**
   * Force re-seed the database (useful for development/testing)
   * This will clear all data and re-seed with sample data
   */
  async forceSeed(): Promise<void> {
    if (Platform.OS === 'web' || !this.db) {
      return;
    }

    console.log('Force re-seeding database...');

    // Clear all existing data
    await this.db.runAsync('DELETE FROM field_entries');
    await this.db.runAsync('DELETE FROM well_readings');
    await this.db.runAsync('DELETE FROM wells');

    // Re-seed
    await this.seedIfEmpty();
  }

  private seedIfEmpty = async (): Promise<void> => {
    if (Platform.OS === 'web' || !this.db) {
      return;
    }

    try {
      // Check if database already has wells
      const count = await this.db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM wells',
      );

      if (count && count.count > 0) {
        console.log('Database already seeded, skipping...');
        return;
      }

      console.log('Seeding database with sample wells...');

      // Seed Wells - Permian Basin locations with various well types
      const wells: Omit<Well, 'syncedAt'>[] = [
        {
          id: 'well-001',
          name: 'Midland Basin #1A',
          wellType: 'beam-pump', // Most common for small operators
          status: 'active',
          location: { latitude: 31.9973, longitude: -102.0779 }, // Midland, TX
          operator: 'Pioneer Natural Resources',
          lastReading: {
            date: '2025-10-25',
            production: '247 bbl/day',
            gasVolume: '1,842 Mcf/day',
            pressure: '2,450 psi',
            temperature: '195°F',
            waterCut: '12%',
          },
        },
        {
          id: 'well-002',
          name: 'Delaware Basin #3B',
          wellType: 'pcp', // Progressive Cavity Pump - growing in popularity
          status: 'active',
          location: { latitude: 32.0021, longitude: -103.5548 }, // Loving County, TX
          operator: 'Chevron Corporation',
          lastReading: {
            date: '2025-10-25',
            production: '312 bbl/day',
            gasVolume: '2,145 Mcf/day',
            pressure: '2,890 psi',
            temperature: '203°F',
            waterCut: '8%',
          },
        },
        {
          id: 'well-003',
          name: 'Spraberry Trend #7C',
          wellType: 'beam-pump', // Beam pumps dominate small operators
          status: 'active',
          location: { latitude: 32.2985, longitude: -101.8782 }, // Midland County, TX
          operator: 'ExxonMobil',
          lastReading: {
            date: '2025-10-24',
            production: '189 bbl/day',
            gasVolume: '1,523 Mcf/day',
            pressure: '2,210 psi',
            temperature: '187°F',
            waterCut: '15%',
          },
        },
        {
          id: 'well-004',
          name: 'Wolfcamp A #12D',
          wellType: 'submersible', // Electric submersible pump
          status: 'maintenance',
          location: { latitude: 31.8456, longitude: -102.3675 }, // Howard County, TX
          operator: 'Diamondback Energy',
          lastReading: {
            date: '2025-10-23',
            production: '156 bbl/day',
            gasVolume: '1,289 Mcf/day',
            pressure: '2,050 psi',
            temperature: '182°F',
            waterCut: '18%',
          },
        },
        {
          id: 'well-005',
          name: 'Bone Spring #5A',
          wellType: 'beam-pump', // Beam pumps dominate
          status: 'active',
          location: { latitude: 32.1234, longitude: -103.7821 }, // Eddy County, NM
          operator: 'Occidental Petroleum',
          lastReading: {
            date: '2025-10-25',
            production: '278 bbl/day',
            gasVolume: '1,967 Mcf/day',
            pressure: '2,650 psi',
            temperature: '198°F',
            waterCut: '10%',
          },
        },
        {
          id: 'well-006',
          name: 'Avalon Shale #9B',
          wellType: 'gas-lift', // Gas lift for testing
          status: 'active',
          location: { latitude: 32.0567, longitude: -103.2341 }, // Lea County, NM
          operator: 'ConocoPhillips',
          lastReading: {
            date: '2025-10-25',
            production: '223 bbl/day',
            gasVolume: '1,698 Mcf/day',
            pressure: '2,380 psi',
            temperature: '191°F',
            waterCut: '14%',
          },
        },
      ];

      // Save all wells
      for (const well of wells) {
        await this.saveWell(well);
      }

      // Seed Well Readings (historical data for each well)
      const readings: Omit<WellReading, 'syncedAt'>[] = [
        // Midland Basin #1A - readings
        {
          id: 'reading-001-1',
          wellId: 'well-001',
          date: '2025-10-24',
          production: '252 bbl/day',
          gasVolume: '1,876 Mcf/day',
          pressure: '2,465 psi',
          temperature: '196°F',
          waterCut: '12%',
          status: 'normal',
        },
        {
          id: 'reading-001-2',
          wellId: 'well-001',
          date: '2025-10-23',
          production: '245 bbl/day',
          gasVolume: '1,821 Mcf/day',
          pressure: '2,455 psi',
          temperature: '194°F',
          waterCut: '11%',
          status: 'normal',
        },
        {
          id: 'reading-001-3',
          wellId: 'well-001',
          date: '2025-10-22',
          production: '249 bbl/day',
          gasVolume: '1,845 Mcf/day',
          pressure: '2,460 psi',
          temperature: '195°F',
          waterCut: '12%',
          status: 'normal',
        },
        // Delaware Basin #3B - readings
        {
          id: 'reading-002-1',
          wellId: 'well-002',
          date: '2025-10-24',
          production: '305 bbl/day',
          gasVolume: '2,098 Mcf/day',
          pressure: '2,875 psi',
          temperature: '202°F',
          waterCut: '8%',
          status: 'normal',
        },
        {
          id: 'reading-002-2',
          wellId: 'well-002',
          date: '2025-10-23',
          production: '318 bbl/day',
          gasVolume: '2,176 Mcf/day',
          pressure: '2,895 psi',
          temperature: '204°F',
          waterCut: '7%',
          status: 'normal',
        },
        // Spraberry Trend #7C - readings
        {
          id: 'reading-003-1',
          wellId: 'well-003',
          date: '2025-10-23',
          production: '192 bbl/day',
          gasVolume: '1,556 Mcf/day',
          pressure: '2,225 psi',
          temperature: '188°F',
          waterCut: '14%',
          status: 'normal',
        },
        {
          id: 'reading-003-2',
          wellId: 'well-003',
          date: '2025-10-22',
          production: '186 bbl/day',
          gasVolume: '1,498 Mcf/day',
          pressure: '2,205 psi',
          temperature: '186°F',
          waterCut: '15%',
          status: 'normal',
        },
        // Wolfcamp A #12D - readings (maintenance status)
        {
          id: 'reading-004-1',
          wellId: 'well-004',
          date: '2025-10-22',
          production: '162 bbl/day',
          gasVolume: '1,312 Mcf/day',
          pressure: '2,065 psi',
          temperature: '183°F',
          waterCut: '17%',
          status: 'maintenance',
        },
        {
          id: 'reading-004-2',
          wellId: 'well-004',
          date: '2025-10-21',
          production: '148 bbl/day',
          gasVolume: '1,245 Mcf/day',
          pressure: '2,035 psi',
          temperature: '181°F',
          waterCut: '19%',
          status: 'alert',
        },
        // Bone Spring #5A - readings
        {
          id: 'reading-005-1',
          wellId: 'well-005',
          date: '2025-10-24',
          production: '282 bbl/day',
          gasVolume: '1,989 Mcf/day',
          pressure: '2,665 psi',
          temperature: '199°F',
          waterCut: '9%',
          status: 'normal',
        },
        // Avalon Shale #9B - readings
        {
          id: 'reading-006-1',
          wellId: 'well-006',
          date: '2025-10-24',
          production: '228 bbl/day',
          gasVolume: '1,723 Mcf/day',
          pressure: '2,395 psi',
          temperature: '192°F',
          waterCut: '13%',
          status: 'normal',
        },
      ];

      // Save all readings
      for (const reading of readings) {
        await this.saveWellReading(reading);
      }

      // Seed Field Entries (for previous readings feature)
      console.log('Seeding field entries for previous readings...');

      const fieldEntries = [
        // Midland Basin #1A - recent entries
        {
          wellName: 'Midland Basin #1A',
          productionVolume: '247',
          gasVolume: '1842',
          pressure: '2450',
          temperature: '195',
          waterCut: '12',
          notes: 'Normal operations. All systems functioning properly.',
          photos: [],
          location: { latitude: 31.9973, longitude: -102.0779, accuracy: 10 },
          checklist: {
            pumpOperating: true,
            noLeaks: true,
            gaugesWorking: true,
            safetyEquipment: true,
            tankLevelsChecked: true,
            separatorOperating: true,
            noAbnormalSounds: true,
            valvePositionsCorrect: true,
            heaterTreaterOperating: true,
            noVisibleCorrosion: true,
            ventLinesClear: true,
            chemicalInjectionWorking: true,
            secondaryContainmentOk: true,
            wellSiteSecure: true,
            spillKitsAvailable: true,
          },
          createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
        },
        {
          wellName: 'Midland Basin #1A',
          productionVolume: '252',
          gasVolume: '1876',
          pressure: '2465',
          temperature: '196',
          waterCut: '12',
          notes: 'Slight increase in production. Weather conditions favorable.',
          photos: [],
          location: { latitude: 31.9973, longitude: -102.0779, accuracy: 8 },
          checklist: {
            pumpOperating: true,
            noLeaks: true,
            gaugesWorking: true,
            safetyEquipment: true,
            tankLevelsChecked: true,
            separatorOperating: true,
            noAbnormalSounds: true,
            valvePositionsCorrect: true,
            heaterTreaterOperating: true,
            noVisibleCorrosion: true,
            ventLinesClear: true,
            chemicalInjectionWorking: true,
            secondaryContainmentOk: true,
            wellSiteSecure: true,
            spillKitsAvailable: true,
          },
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
        },
        {
          wellName: 'Midland Basin #1A',
          productionVolume: '245',
          gasVolume: '1821',
          pressure: '2455',
          temperature: '194',
          waterCut: '11',
          notes: 'Routine maintenance completed. Equipment running smoothly.',
          photos: [],
          location: { latitude: 31.9973, longitude: -102.0779, accuracy: 12 },
          checklist: {
            pumpOperating: true,
            noLeaks: true,
            gaugesWorking: true,
            safetyEquipment: true,
            tankLevelsChecked: true,
            separatorOperating: true,
            noAbnormalSounds: true,
            valvePositionsCorrect: true,
            heaterTreaterOperating: true,
            noVisibleCorrosion: true,
            ventLinesClear: true,
            chemicalInjectionWorking: true,
            secondaryContainmentOk: true,
            wellSiteSecure: true,
            spillKitsAvailable: true,
          },
          createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
        },
        // Delaware Basin #3B - recent entries
        {
          wellName: 'Delaware Basin #3B',
          productionVolume: '312',
          gasVolume: '2145',
          pressure: '2890',
          temperature: '203',
          waterCut: '8',
          notes: 'Excellent production day. New pump performing well.',
          photos: [],
          location: { latitude: 32.0021, longitude: -103.5548, accuracy: 9 },
          checklist: {
            pumpOperating: true,
            noLeaks: true,
            gaugesWorking: true,
            safetyEquipment: true,
            tankLevelsChecked: true,
            separatorOperating: true,
            noAbnormalSounds: true,
            valvePositionsCorrect: true,
            heaterTreaterOperating: true,
            noVisibleCorrosion: true,
            ventLinesClear: true,
            chemicalInjectionWorking: true,
            secondaryContainmentOk: true,
            wellSiteSecure: true,
            spillKitsAvailable: true,
          },
          createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          wellName: 'Delaware Basin #3B',
          productionVolume: '305',
          gasVolume: '2098',
          pressure: '2875',
          temperature: '202',
          waterCut: '8',
          notes: 'Consistent performance. No issues detected.',
          photos: [],
          location: { latitude: 32.0021, longitude: -103.5548, accuracy: 11 },
          checklist: {
            pumpOperating: true,
            noLeaks: true,
            gaugesWorking: true,
            safetyEquipment: true,
            tankLevelsChecked: true,
            separatorOperating: true,
            noAbnormalSounds: true,
            valvePositionsCorrect: true,
            heaterTreaterOperating: true,
            noVisibleCorrosion: true,
            ventLinesClear: true,
            chemicalInjectionWorking: true,
            secondaryContainmentOk: true,
            wellSiteSecure: true,
            spillKitsAvailable: true,
          },
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        },
        // Spraberry Trend #7C - recent entries
        {
          wellName: 'Spraberry Trend #7C',
          productionVolume: '189',
          gasVolume: '1523',
          pressure: '2210',
          temperature: '187',
          waterCut: '15',
          notes: 'Minor pressure fluctuations observed. Monitoring closely.',
          photos: [],
          location: { latitude: 32.2985, longitude: -101.8782, accuracy: 10 },
          checklist: {
            pumpOperating: true,
            noLeaks: true,
            gaugesWorking: true,
            safetyEquipment: true,
            tankLevelsChecked: true,
            separatorOperating: true,
            noAbnormalSounds: true,
            valvePositionsCorrect: true,
            heaterTreaterOperating: true,
            noVisibleCorrosion: true,
            ventLinesClear: true,
            chemicalInjectionWorking: true,
            secondaryContainmentOk: true,
            wellSiteSecure: true,
            spillKitsAvailable: true,
          },
          createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          wellName: 'Spraberry Trend #7C',
          productionVolume: '192',
          gasVolume: '1556',
          pressure: '2225',
          temperature: '188',
          waterCut: '14',
          notes: 'Pressure stabilized. Production within expected range.',
          photos: [],
          location: { latitude: 32.2985, longitude: -101.8782, accuracy: 8 },
          checklist: {
            pumpOperating: true,
            noLeaks: true,
            gaugesWorking: true,
            safetyEquipment: true,
            tankLevelsChecked: true,
            separatorOperating: true,
            noAbnormalSounds: true,
            valvePositionsCorrect: true,
            heaterTreaterOperating: true,
            noVisibleCorrosion: true,
            ventLinesClear: true,
            chemicalInjectionWorking: true,
            secondaryContainmentOk: true,
            wellSiteSecure: true,
            spillKitsAvailable: true,
          },
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        },
        // Multiple entries on same day for Midland Basin #1A (to test carousel)
        {
          wellName: 'Midland Basin #1A',
          productionVolume: '241',
          gasVolume: '1805',
          pressure: '2448',
          temperature: '194',
          waterCut: '12',
          notes: 'Morning reading - normal start to day.',
          photos: [],
          location: { latitude: 31.9973, longitude: -102.0779, accuracy: 10 },
          checklist: {
            pumpOperating: true,
            noLeaks: true,
            gaugesWorking: true,
            safetyEquipment: true,
            tankLevelsChecked: true,
            separatorOperating: true,
            noAbnormalSounds: true,
            valvePositionsCorrect: true,
            heaterTreaterOperating: true,
            noVisibleCorrosion: true,
            ventLinesClear: true,
            chemicalInjectionWorking: true,
            secondaryContainmentOk: true,
            wellSiteSecure: true,
            spillKitsAvailable: true,
          },
          createdAt: new Date(
            Date.now() - 4 * 24 * 60 * 60 * 1000 - 8 * 60 * 60 * 1000,
          ).toISOString(), // 4 days ago, morning
        },
        {
          wellName: 'Midland Basin #1A',
          productionVolume: '248',
          gasVolume: '1838',
          pressure: '2453',
          temperature: '195',
          waterCut: '12',
          notes: 'Afternoon reading - production increased slightly.',
          photos: [],
          location: { latitude: 31.9973, longitude: -102.0779, accuracy: 9 },
          checklist: {
            pumpOperating: true,
            noLeaks: true,
            gaugesWorking: true,
            safetyEquipment: true,
            tankLevelsChecked: true,
            separatorOperating: true,
            noAbnormalSounds: true,
            valvePositionsCorrect: true,
            heaterTreaterOperating: true,
            noVisibleCorrosion: true,
            ventLinesClear: true,
            chemicalInjectionWorking: true,
            secondaryContainmentOk: true,
            wellSiteSecure: true,
            spillKitsAvailable: true,
          },
          createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), // 4 days ago, afternoon
        },
      ];

      // Save all field entries
      for (const entry of fieldEntries) {
        await this.saveFieldEntry(entry);
      }

      console.log(
        `Database seeded successfully with ${wells.length} wells, ${readings.length} well readings, and ${fieldEntries.length} field entries`,
      );
    } catch (error) {
      console.error('Failed to seed database:', error);
      // Don't throw - allow app to continue even if seeding fails
    }
  };

  // ===== Private Helper Methods =====

  private rowToWell(row: any): Well {
    return {
      id: row.id,
      name: row.name,
      wellType: row.wellType,
      status: row.status,
      location: JSON.parse(row.location),
      operator: row.operator,
      lastReading: row.lastReading ? JSON.parse(row.lastReading) : undefined,
      syncedAt: row.syncedAt,
    };
  }

  private rowToWellReading(row: any): WellReading {
    return {
      id: row.id,
      wellId: row.wellId,
      date: row.date,
      production: row.production,
      gasVolume: row.gasVolume,
      pressure: row.pressure,
      temperature: row.temperature,
      waterCut: row.waterCut,
      status: row.status,
      syncedAt: row.syncedAt,
    };
  }

  private rowToEntry(row: any): FieldEntry {
    return {
      id: row.id,
      wellName: row.wellName,
      productionVolume: row.productionVolume,
      gasVolume: row.gasVolume,
      waterVolume: row.waterVolume,
      waterCut: row.waterCut,
      pressure: row.pressure,
      temperature: row.temperature,
      tankLevel: row.tankLevel,
      bsw: row.bsw,
      gor: row.gor,
      fluidLevel: row.fluidLevel,
      casingPressure: row.casingPressure,
      tubingPressure: row.tubingPressure,
      pumpStatus: row.pumpStatus,
      downtimeHours: row.downtimeHours,
      downtimeReason: row.downtimeReason,
      runTicket: row.runTicket,
      waterHaul: row.waterHaul,
      notes: row.notes,
      photos: row.photos ? JSON.parse(row.photos) : [],
      location: row.location ? JSON.parse(row.location) : undefined,
      checklist: JSON.parse(row.checklist),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      syncStatus: row.syncStatus,
      syncedAt: row.syncedAt,
      syncError: row.syncError,
      serverVersion: row.serverVersion,
      conflictData: row.conflictData ? JSON.parse(row.conflictData) : undefined,
    };
  }
}

export const db = new DatabaseService();
