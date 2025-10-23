# Offline-First Batch Sync Pattern

**Category**: Architecture Pattern
**Complexity**: Advanced
**Status**: ✅ Production Ready
**Related Patterns**: Event Sourcing, SAGA, CQRS, Repository Pattern
**Industry Context**: Oil & Gas Field Data Entry

---

## Overview

The Offline-First Batch Sync pattern enables field operators to collect data in remote oil field locations with unreliable internet connectivity, then synchronize changes to the cloud at the end of their shift. This pattern ensures:

- **100% offline capability**: Apps work without any network connection
- **Data integrity**: No data loss even if sync fails
- **Efficient sync**: Batch uploads reduce network overhead
- **Conflict resolution**: Handle cases where multiple operators edit the same data

This pattern is critical for WellPulse because:
1. Oil field well sites often have **no electricity or internet**
2. Field operators need to record data **immediately** (equipment readings, inspection notes)
3. Cellular coverage in remote Permian Basin locations is spotty
4. Workers have natural "sync points" (end of shift, return to office)

---

## The Problem

**Scenario**: Field operator inspects 10 wells in remote locations over an 8-hour shift:

```
7:00 AM  - Leave office (online), authenticate Electron app
7:30 AM  - Arrive at Well Site A (offline)
7:45 AM  - Record production volumes, equipment temps
8:30 AM  - Arrive at Well Site B (offline)
8:45 AM  - Log equipment inspection, take photos
...
3:00 PM  - Return to office (online)
3:15 PM  - Sync all data collected during shift
```

**Challenges**:

❌ **Real-time sync doesn't work**:
```typescript
// Won't work in oil field
await api.post('/production-data', { wellId, volume }); // Network unavailable
```

❌ **Queueing for later is risky**:
```typescript
// What if app crashes before sync?
const queue = [entry1, entry2, entry3]; // Lost if not persisted
```

❌ **Naive sync causes data loss**:
```typescript
// If another operator synced first, this overwrites their data
await api.put(`/wells/${wellId}`, localData); // Conflict!
```

---

## The Solution

### Architecture Overview

```
┌────────────────────────────────────────────────────────────────┐
│             Field Device (Offline Capable)                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  UI Layer (React - Shared by Electron & React Native)   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           ↓                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Local Event Store (Append-Only Event Log)              │  │
│  │  - SQLite (Electron) or AsyncStorage (React Native)     │  │
│  │  - Stores events, not state                             │  │
│  │  - Events: WELL_READING_RECORDED, EQUIPMENT_INSPECTED   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           ↓                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Sync Engine                                             │  │
│  │  - Detects connectivity changes                          │  │
│  │  - Batches unsynced events                               │  │
│  │  - Handles conflicts with server                         │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
                           ↓ (When Online)
┌────────────────────────────────────────────────────────────────┐
│                  Cloud API (Azure - NestJS)                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Batch Sync Endpoint: POST /field-data/sync              │  │
│  │  - Receives array of events from device                  │  │
│  │  - Validates each event                                  │  │
│  │  - Detects conflicts with existing data                  │  │
│  │  - Applies events in order                               │  │
│  │  - Returns sync results (success, conflicts, errors)     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           ↓                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Tenant Database (PostgreSQL)                            │  │
│  │  - Stores final state (wells, production_data, etc.)     │  │
│  │  - Optional: Event log table for audit trail             │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

---

## Implementation

### 1. Local Event Store (Field Device)

**Event Structure**:

```typescript
// apps/electron/src/db/types.ts (or apps/mobile/src/db/types.ts)
export interface FieldDataEvent {
  id: string; // UUID v4
  type: FieldDataEventType;
  payload: any; // Event-specific data
  timestamp: Date; // When event occurred (device time)
  deviceId: string; // Unique device identifier
  userId: string; // Operator who created event
  synced: boolean; // Has this event been synced to cloud?
  syncAttempts: number; // How many times we tried to sync
  createdAt: Date; // When event was stored locally
}

export enum FieldDataEventType {
  WELL_READING_RECORDED = 'WELL_READING_RECORDED',
  EQUIPMENT_INSPECTED = 'EQUIPMENT_INSPECTED',
  PRODUCTION_LOGGED = 'PRODUCTION_LOGGED',
  PHOTO_ATTACHED = 'PHOTO_ATTACHED',
  NOTES_ADDED = 'NOTES_ADDED',
  EQUIPMENT_REPAIRED = 'EQUIPMENT_REPAIRED',
}

// Example event payloads
export interface WellReadingRecordedPayload {
  wellId: string;
  readingType: 'PRODUCTION' | 'PRESSURE' | 'TEMPERATURE';
  value: number;
  unit: string;
  recordedAt: Date;
}

export interface EquipmentInspectedPayload {
  wellId: string;
  equipmentId: string;
  inspectionType: 'ROUTINE' | 'SAFETY' | 'REPAIR';
  status: 'PASS' | 'FAIL' | 'NEEDS_ATTENTION';
  notes: string;
  inspectedAt: Date;
}
```

**SQLite Schema (Electron)**:

```sql
-- apps/electron/src/db/schema.sql
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  payload TEXT NOT NULL,  -- JSON stringified
  timestamp TEXT NOT NULL, -- ISO 8601 format
  device_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  synced INTEGER NOT NULL DEFAULT 0, -- 0 = false, 1 = true
  sync_attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_events_synced ON events(synced);
CREATE INDEX idx_events_timestamp ON events(timestamp);
```

**Event Store Service**:

```typescript
// apps/electron/src/db/event-store.service.ts
import { Database } from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { FieldDataEvent, FieldDataEventType } from './types';

export class LocalEventStore {
  constructor(private readonly db: Database) {}

  /**
   * Append a new event to the local store (offline-first).
   */
  async appendEvent(
    type: FieldDataEventType,
    payload: any,
    userId: string,
    deviceId: string,
  ): Promise<string> {
    const event: FieldDataEvent = {
      id: uuidv4(),
      type,
      payload,
      timestamp: new Date(),
      deviceId,
      userId,
      synced: false,
      syncAttempts: 0,
      createdAt: new Date(),
    };

    this.db
      .prepare(
        `INSERT INTO events (id, type, payload, timestamp, device_id, user_id, synced, sync_attempts, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        event.id,
        event.type,
        JSON.stringify(event.payload),
        event.timestamp.toISOString(),
        event.deviceId,
        event.userId,
        event.synced ? 1 : 0,
        event.syncAttempts,
        event.createdAt.toISOString(),
      );

    return event.id;
  }

  /**
   * Get all unsynced events (for batch sync).
   */
  async getUnsyncedEvents(): Promise<FieldDataEvent[]> {
    const rows = this.db
      .prepare('SELECT * FROM events WHERE synced = 0 ORDER BY timestamp ASC')
      .all();

    return rows.map(this.rowToEvent);
  }

  /**
   * Mark events as synced (after successful cloud sync).
   */
  async markEventsSynced(eventIds: string[]): Promise<void> {
    const placeholders = eventIds.map(() => '?').join(',');

    this.db
      .prepare(`UPDATE events SET synced = 1 WHERE id IN (${placeholders})`)
      .run(...eventIds);
  }

  /**
   * Increment sync attempts (for retry tracking).
   */
  async incrementSyncAttempts(eventIds: string[]): Promise<void> {
    const placeholders = eventIds.map(() => '?').join(',');

    this.db
      .prepare(`UPDATE events SET sync_attempts = sync_attempts + 1 WHERE id IN (${placeholders})`)
      .run(...eventIds);
  }

  /**
   * Get sync statistics (for UI display).
   */
  async getSyncStats(): Promise<{ unsynced: number; synced: number; total: number }> {
    const stats = this.db
      .prepare(
        `SELECT
          SUM(CASE WHEN synced = 0 THEN 1 ELSE 0 END) as unsynced,
          SUM(CASE WHEN synced = 1 THEN 1 ELSE 0 END) as synced,
          COUNT(*) as total
         FROM events`
      )
      .get() as any;

    return {
      unsynced: stats.unsynced || 0,
      synced: stats.synced || 0,
      total: stats.total || 0,
    };
  }

  private rowToEvent(row: any): FieldDataEvent {
    return {
      id: row.id,
      type: row.type as FieldDataEventType,
      payload: JSON.parse(row.payload),
      timestamp: new Date(row.timestamp),
      deviceId: row.device_id,
      userId: row.user_id,
      synced: row.synced === 1,
      syncAttempts: row.sync_attempts,
      createdAt: new Date(row.created_at),
    };
  }
}
```

---

### 2. Field Data Entry (Offline UI)

**Example: Record Well Production**:

```typescript
// apps/electron/src/features/production/RecordProductionForm.tsx
import React, { useState } from 'react';
import { useLocalEventStore } from '@/hooks/useLocalEventStore';
import { useAuth } from '@/hooks/useAuth';
import { FieldDataEventType } from '@/db/types';

export function RecordProductionForm({ wellId }: { wellId: string }) {
  const [volume, setVolume] = useState('');
  const [loading, setLoading] = useState(false);

  const { appendEvent } = useLocalEventStore();
  const { user, deviceId } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Store event locally (works offline)
      const eventId = await appendEvent(
        FieldDataEventType.PRODUCTION_LOGGED,
        {
          wellId,
          volume: parseFloat(volume),
          unit: 'barrels',
          recordedAt: new Date(),
        },
        user.id,
        deviceId,
      );

      console.log(`Production logged locally: ${eventId}`);

      // Clear form
      setVolume('');

      // Show success message
      alert('Production logged! Will sync when online.');
    } catch (error) {
      console.error('Failed to log production:', error);
      alert('Failed to save. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Production Volume (barrels):
        <input
          type="number"
          value={volume}
          onChange={(e) => setVolume(e.target.value)}
          required
        />
      </label>

      <button type="submit" disabled={loading}>
        {loading ? 'Saving...' : 'Log Production'}
      </button>

      <p className="text-sm text-gray-600">
        ✓ Saved locally. Will sync when connected.
      </p>
    </form>
  );
}
```

---

### 3. Connectivity Detection

```typescript
// apps/electron/src/services/connectivity.service.ts
import { EventEmitter } from 'events';

export class ConnectivityService extends EventEmitter {
  private isOnline: boolean = navigator.onLine;
  private checkInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();

    // Listen to browser online/offline events
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);

    // Poll for connectivity every 30 seconds (in case events don't fire)
    this.checkInterval = setInterval(this.checkConnectivity, 30000);
  }

  private handleOnline = () => {
    console.log('Device is online');
    this.isOnline = true;
    this.emit('online');
  };

  private handleOffline = () => {
    console.log('Device is offline');
    this.isOnline = false;
    this.emit('offline');
  };

  private checkConnectivity = async () => {
    try {
      // Ping the API server
      const response = await fetch('/api/health', {
        method: 'HEAD',
        cache: 'no-cache',
      });

      if (response.ok && !this.isOnline) {
        this.handleOnline();
      }
    } catch (error) {
      if (this.isOnline) {
        this.handleOffline();
      }
    }
  };

  public getIsOnline(): boolean {
    return this.isOnline;
  }

  public destroy(): void {
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }
}
```

---

### 4. Batch Sync Service (Field Device)

```typescript
// apps/electron/src/services/sync.service.ts
import { LocalEventStore } from '@/db/event-store.service';
import { ConnectivityService } from './connectivity.service';

export interface SyncResult {
  success: boolean;
  syncedCount: number;
  conflicts: Conflict[];
  errors: string[];
}

export interface Conflict {
  eventId: string;
  reason: string;
  localData: any;
  serverData: any;
}

export class FieldDataSyncService {
  private isSyncing: boolean = false;

  constructor(
    private readonly eventStore: LocalEventStore,
    private readonly connectivityService: ConnectivityService,
    private readonly apiUrl: string,
    private readonly authToken: string,
    private readonly tenantId: string,
    private readonly deviceId: string,
  ) {
    // Auto-sync when connectivity restored
    this.connectivityService.on('online', this.autoSync);
  }

  /**
   * Manually trigger sync (e.g., "End of Shift" button).
   */
  async syncNow(): Promise<SyncResult> {
    if (this.isSyncing) {
      return {
        success: false,
        syncedCount: 0,
        conflicts: [],
        errors: ['Sync already in progress'],
      };
    }

    if (!this.connectivityService.getIsOnline()) {
      return {
        success: false,
        syncedCount: 0,
        conflicts: [],
        errors: ['Device is offline'],
      };
    }

    this.isSyncing = true;

    try {
      return await this.performSync();
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Auto-sync when connectivity is restored (optional, can disable).
   */
  private autoSync = async () => {
    console.log('Connectivity restored. Auto-syncing...');
    await this.syncNow();
  };

  private async performSync(): Promise<SyncResult> {
    // Get all unsynced events
    const events = await this.eventStore.getUnsyncedEvents();

    if (events.length === 0) {
      console.log('No events to sync');
      return {
        success: true,
        syncedCount: 0,
        conflicts: [],
        errors: [],
      };
    }

    console.log(`Syncing ${events.length} events to cloud...`);

    try {
      // Batch upload to cloud API
      const response = await fetch(`${this.apiUrl}/field-data/sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json',
          'X-Device-Id': this.deviceId,
        },
        body: JSON.stringify({
          tenantId: this.tenantId,
          events,
          deviceInfo: {
            deviceId: this.deviceId,
            platform: 'electron', // or 'ios', 'android'
            appVersion: '1.0.0',
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Sync failed: ${response.status} ${response.statusText}`);
      }

      const result: SyncResponseDto = await response.json();

      // Mark successfully synced events
      if (result.syncedEventIds && result.syncedEventIds.length > 0) {
        await this.eventStore.markEventsSynced(result.syncedEventIds);
        console.log(`✓ Synced ${result.syncedEventIds.length} events`);
      }

      // Handle conflicts (will be resolved manually or auto-resolved)
      if (result.conflicts && result.conflicts.length > 0) {
        console.warn(`⚠ ${result.conflicts.length} conflicts detected`);
      }

      // Handle errors
      if (result.errors && result.errors.length > 0) {
        console.error(`✗ ${result.errors.length} errors during sync`);
      }

      return {
        success: true,
        syncedCount: result.syncedEventIds.length,
        conflicts: result.conflicts || [],
        errors: result.errors || [],
      };
    } catch (error) {
      // Network error or server failure
      console.error('Sync failed:', error);

      // Increment sync attempts for retry tracking
      const eventIds = events.map((e) => e.id);
      await this.eventStore.incrementSyncAttempts(eventIds);

      return {
        success: false,
        syncedCount: 0,
        conflicts: [],
        errors: [error.message],
      };
    }
  }
}
```

---

### 5. Cloud API: Batch Sync Endpoint

```typescript
// apps/api/src/presentation/field-data/dtos/sync-field-data.dto.ts
import { IsArray, IsString, IsNotEmpty, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class FieldDataEventDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  type: string;

  @IsNotEmpty()
  payload: any;

  @IsString()
  @IsNotEmpty()
  timestamp: string; // ISO 8601

  @IsString()
  @IsNotEmpty()
  deviceId: string;

  @IsString()
  @IsNotEmpty()
  userId: string;
}

export class SyncFieldDataDto {
  @IsString()
  @IsNotEmpty()
  tenantId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FieldDataEventDto)
  events: FieldDataEventDto[];

  @IsNotEmpty()
  deviceInfo: {
    deviceId: string;
    platform: 'electron' | 'ios' | 'android';
    appVersion: string;
  };
}

export class SyncResponseDto {
  syncedEventIds: string[];
  conflicts: any[];
  errors: string[];
}
```

**Controller**:

```typescript
// apps/api/src/presentation/field-data/field-data.controller.ts
import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { JwtAuthGuard } from '@/presentation/guards/jwt-auth.guard';
import { CurrentUser } from '@/presentation/decorators/current-user.decorator';
import { SyncFieldDataDto, SyncResponseDto } from './dtos/sync-field-data.dto';
import { SyncFieldDataCommand } from '@/application/field-data/commands/sync-field-data.command';

@Controller('field-data')
export class FieldDataController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('sync')
  @UseGuards(JwtAuthGuard)
  async syncFieldData(
    @Body() dto: SyncFieldDataDto,
    @CurrentUser() user: any,
  ): Promise<SyncResponseDto> {
    const command = new SyncFieldDataCommand(
      dto.tenantId,
      dto.events,
      dto.deviceInfo,
      user.id,
    );

    return this.commandBus.execute(command);
  }
}
```

**Command Handler**:

```typescript
// apps/api/src/application/field-data/commands/sync-field-data.handler.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { SyncFieldDataCommand } from './sync-field-data.command';
import { SyncResponseDto } from '@/presentation/field-data/dtos/sync-field-data.dto';
import { TenantDatabaseService } from '@/infrastructure/database/services/tenant-database.service';
import { productionDataTable } from '@/infrastructure/database/schema/tenant/production-data.schema';
import { v4 as uuidv4 } from 'uuid';

@CommandHandler(SyncFieldDataCommand)
export class SyncFieldDataHandler implements ICommandHandler<SyncFieldDataCommand> {
  constructor(private readonly tenantDbService: TenantDatabaseService) {}

  async execute(command: SyncFieldDataCommand): Promise<SyncResponseDto> {
    const syncedEventIds: string[] = [];
    const conflicts: any[] = [];
    const errors: string[] = [];

    // Get tenant database connection
    const db = await this.tenantDbService.getTenantDatabase(command.tenantId);

    // Process events in chronological order
    for (const event of command.events) {
      try {
        // Detect conflicts (e.g., duplicate entry for same well + timestamp)
        const conflict = await this.detectConflict(db, event);

        if (conflict) {
          conflicts.push({
            eventId: event.id,
            reason: conflict.reason,
            localData: event.payload,
            serverData: conflict.existingData,
          });
          continue; // Skip this event, will be resolved later
        }

        // Apply event to database
        await this.applyEvent(db, event, command.userId);

        syncedEventIds.push(event.id);
      } catch (error) {
        console.error(`Failed to apply event ${event.id}:`, error);
        errors.push(`Event ${event.id}: ${error.message}`);
      }
    }

    return {
      syncedEventIds,
      conflicts,
      errors,
    };
  }

  private async detectConflict(db: any, event: any): Promise<{ reason: string; existingData: any } | null> {
    // Example: Check if production data already exists for this well + timestamp
    if (event.type === 'PRODUCTION_LOGGED') {
      const { wellId, recordedAt } = event.payload;

      const existing = await db
        .select()
        .from(productionDataTable)
        .where(
          and(
            eq(productionDataTable.wellId, wellId),
            eq(productionDataTable.recordedAt, new Date(recordedAt))
          )
        )
        .limit(1);

      if (existing.length > 0) {
        return {
          reason: 'Production data already exists for this well and timestamp',
          existingData: existing[0],
        };
      }
    }

    return null; // No conflict
  }

  private async applyEvent(db: any, event: any, userId: string): Promise<void> {
    switch (event.type) {
      case 'PRODUCTION_LOGGED':
        await db.insert(productionDataTable).values({
          id: uuidv4(),
          wellId: event.payload.wellId,
          volume: event.payload.volume,
          unit: event.payload.unit,
          recordedAt: new Date(event.payload.recordedAt),
          recordedBy: userId,
          deviceId: event.deviceId,
          createdAt: new Date(event.timestamp),
        });
        break;

      case 'EQUIPMENT_INSPECTED':
        // Apply equipment inspection event
        await this.applyEquipmentInspectionEvent(db, event, userId);
        break;

      // ... handle other event types
    }
  }

  private async applyEquipmentInspectionEvent(db: any, event: any, userId: string): Promise<void> {
    // Implementation for equipment inspection
  }
}
```

---

### 6. End of Shift Sync UI

```typescript
// apps/electron/src/features/sync/EndOfShiftSyncScreen.tsx
import React, { useState, useEffect } from 'react';
import { useSyncService } from '@/hooks/useSyncService';
import { useLocalEventStore } from '@/hooks/useLocalEventStore';

export function EndOfShiftSyncScreen() {
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [stats, setStats] = useState({ unsynced: 0, synced: 0, total: 0 });

  const { syncNow } = useSyncService();
  const { getSyncStats } = useLocalEventStore();

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    const newStats = await getSyncStats();
    setStats(newStats);
  };

  const handleSync = async () => {
    setSyncStatus('syncing');

    const result = await syncNow();

    if (result.success) {
      setSyncStatus('success');
      await loadStats(); // Refresh stats
    } else {
      setSyncStatus('error');
    }

    setSyncResult(result);
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">End of Shift Sync</h1>

      {/* Sync Statistics */}
      <div className="bg-gray-100 p-4 rounded mb-6">
        <h2 className="text-lg font-semibold mb-2">Sync Status</h2>
        <p>Unsynced events: <strong>{stats.unsynced}</strong></p>
        <p>Synced events: <strong>{stats.synced}</strong></p>
        <p>Total events: <strong>{stats.total}</strong></p>
      </div>

      {/* Sync Button */}
      {syncStatus === 'idle' && (
        <div>
          <p className="text-gray-600 mb-4">
            Make sure you have internet connectivity before syncing.
          </p>
          <button
            onClick={handleSync}
            className="bg-blue-600 text-white px-6 py-3 rounded hover:bg-blue-700"
            disabled={stats.unsynced === 0}
          >
            Sync {stats.unsynced} Events
          </button>
        </div>
      )}

      {/* Syncing */}
      {syncStatus === 'syncing' && (
        <div className="flex items-center gap-3">
          <div className="spinner" />
          <span>Syncing {stats.unsynced} events to cloud...</span>
        </div>
      )}

      {/* Success */}
      {syncStatus === 'success' && (
        <div className="bg-green-50 border border-green-200 p-4 rounded">
          <p className="text-green-800 font-semibold">
            ✓ Successfully synced {syncResult?.syncedCount} events!
          </p>

          {syncResult?.conflicts && syncResult.conflicts.length > 0 && (
            <div className="mt-4">
              <p className="text-yellow-800">
                ⚠ {syncResult.conflicts.length} conflicts detected. These will be reviewed by a manager.
              </p>
              <ul className="list-disc ml-6 mt-2">
                {syncResult.conflicts.map((conflict, i) => (
                  <li key={i} className="text-sm text-yellow-700">
                    {conflict.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            onClick={() => window.location.reload()}
            className="mt-4 bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
          >
            Continue Working
          </button>
        </div>
      )}

      {/* Error */}
      {syncStatus === 'error' && (
        <div className="bg-red-50 border border-red-200 p-4 rounded">
          <p className="text-red-800 font-semibold">✗ Sync failed</p>
          <p className="text-sm text-red-600 mt-2">
            Your data is safe locally. The sync will be retried automatically when you're online.
          </p>

          {syncResult?.errors && syncResult.errors.length > 0 && (
            <ul className="list-disc ml-6 mt-2">
              {syncResult.errors.map((error, i) => (
                <li key={i} className="text-sm text-red-600">
                  {error}
                </li>
              ))}
            </ul>
          )}

          <button
            onClick={handleSync}
            className="mt-4 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            Retry Sync
          </button>
        </div>
      )}
    </div>
  );
}
```

---

## Benefits

### 1. **100% Offline Capability**

Field operators can work without any internet connection:

```typescript
// ✅ Works offline
await localEventStore.appendEvent('PRODUCTION_LOGGED', payload);

// ❌ Doesn't work offline
await api.post('/production-data', payload);
```

### 2. **No Data Loss**

Events are persisted locally before sync. Even if the app crashes or device dies:

```typescript
// All events are in SQLite database
// App can resume sync when restarted
```

### 3. **Efficient Bandwidth Usage**

Batch sync reduces network overhead:

```typescript
// Instead of 100 separate HTTP requests:
await api.post('/production-data', entry1);
await api.post('/production-data', entry2);
// ... 100 times

// Single batch upload:
await api.post('/field-data/sync', { events: [entry1, entry2, ..., entry100] });
```

### 4. **Natural Sync Points**

End-of-shift sync aligns with field worker workflow:

```
7:00 AM  - Start shift (offline)
3:00 PM  - End shift, return to office (trigger sync)
```

### 5. **Audit Trail via Event Sourcing**

Every change is stored as an event with metadata:

```typescript
{
  id: 'event-123',
  type: 'PRODUCTION_LOGGED',
  payload: { wellId: 'well-456', volume: 120 },
  timestamp: '2025-10-23T14:30:00Z',
  userId: 'operator-789',
  deviceId: 'laptop-001',
}
```

This creates a complete audit trail: "Who changed what, when, from which device?"

---

## Testing Strategy

### Unit Tests: Event Store

```typescript
describe('LocalEventStore', () => {
  let eventStore: LocalEventStore;
  let db: Database;

  beforeEach(() => {
    db = new Database(':memory:'); // In-memory SQLite for tests
    db.exec(/* create events table */);
    eventStore = new LocalEventStore(db);
  });

  it('should append event', async () => {
    const eventId = await eventStore.appendEvent(
      'PRODUCTION_LOGGED',
      { wellId: 'well-123', volume: 100 },
      'user-123',
      'device-123',
    );

    expect(eventId).toBeDefined();

    const unsynced = await eventStore.getUnsyncedEvents();
    expect(unsynced).toHaveLength(1);
    expect(unsynced[0].type).toBe('PRODUCTION_LOGGED');
  });

  it('should mark events as synced', async () => {
    const eventId1 = await eventStore.appendEvent(/* ... */);
    const eventId2 = await eventStore.appendEvent(/* ... */);

    await eventStore.markEventsSynced([eventId1, eventId2]);

    const unsynced = await eventStore.getUnsyncedEvents();
    expect(unsynced).toHaveLength(0);
  });
});
```

### Integration Tests: Sync Service

```typescript
describe('FieldDataSyncService (E2E)', () => {
  let syncService: FieldDataSyncService;
  let mockApiServer: any;

  beforeAll(() => {
    // Start mock API server
    mockApiServer = setupMockServer();
  });

  it('should sync unsynced events to cloud', async () => {
    // Create unsynced events
    await eventStore.appendEvent(/* ... */);
    await eventStore.appendEvent(/* ... */);

    // Trigger sync
    const result = await syncService.syncNow();

    expect(result.success).toBe(true);
    expect(result.syncedCount).toBe(2);

    // Verify events marked as synced locally
    const unsynced = await eventStore.getUnsyncedEvents();
    expect(unsynced).toHaveLength(0);
  });

  it('should handle sync failure gracefully', async () => {
    // Simulate API failure
    mockApiServer.setFailure(true);

    const result = await syncService.syncNow();

    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);

    // Events should remain unsynced
    const unsynced = await eventStore.getUnsyncedEvents();
    expect(unsynced.length).toBeGreaterThan(0);
  });
});
```

---

## Related Patterns

- **Event Sourcing**: Store changes as events, not state
- **SAGA Pattern**: Distributed transactions across field device + cloud
- **CQRS**: Separate command (sync events) from query (read local data)
- **Conflict Resolution Pattern**: Handle cases where multiple operators edit same data
- **Database-Per-Tenant Pattern**: Each tenant has separate cloud database

---

## When to Use This Pattern

### ✅ Use Offline-First Batch Sync When:

- **Connectivity is unreliable** (remote locations, intermittent network)
- **Users work in "sessions"** (clear start/end points like shifts)
- **Data integrity is critical** (can't afford data loss)
- **Bandwidth is limited** (batch uploads more efficient)
- **Audit trail required** (event sourcing provides complete history)

### ❌ Don't Use Offline-First Batch Sync When:

- **Real-time collaboration needed** (multiple users editing same data simultaneously)
- **Network is always reliable** (real-time sync is simpler)
- **Data is not critical** (losing a few entries is acceptable)
- **Storage is limited** (event log can grow large)

---

## Summary

The **Offline-First Batch Sync Pattern** enables WellPulse field operators to:

1. **Work offline** with 100% reliability (no internet required)
2. **Batch sync at end of shift** (efficient, aligns with workflow)
3. **Never lose data** (persisted locally before sync)
4. **Handle conflicts gracefully** (detect, flag for review)
5. **Maintain audit trail** (event sourcing tracks all changes)

**Critical Implementation Points**:
- Store events, not state (event sourcing)
- Persist to local database immediately (SQLite or AsyncStorage)
- Sync in batches when connectivity available
- Detect conflicts on server side
- Increment sync attempts for retry tracking

This pattern is essential for WellPulse because oil field locations have unreliable internet, and field workers can't wait for network requests to complete before recording critical data.

---

**Related Documentation**:
- [Database-Per-Tenant Multi-Tenancy Pattern](./69-Database-Per-Tenant-Multi-Tenancy-Pattern.md)
- [Conflict Resolution Pattern](./71-Conflict-Resolution-Pattern.md)
- [Azure Production Architecture](../deployment/azure-production-architecture.md)
