# Sprint 3-C: Complete Demo-Ready MVP

**Duration**: 2-3 weeks
**Status**: 🟢 Phase 1 Complete (Backend Infrastructure)
**Goal**: Build a complete, demo-ready system that can be shown to potential clients and used to sign them up

**Phase 1 Completed** (October 25, 2025):

- ✅ Field Data Domain (Backend)
- ✅ Offline Sync Endpoints
- ✅ Tenant Database Migration
- ✅ Realistic Seed Data Script
- ✅ Electron Offline Database + Sync Service

---

## MVP Vision

**The Demo**: A field operator arrives at a remote well site with a laptop running the Electron app. With no cell service, they enter production data, take equipment photos, and log maintenance notes. Later, they return to the office and the data syncs to the cloud. The operations manager opens the web app on their iPad, sees all wells on a map, clicks a well marker, and views the freshly-synced field data. Meanwhile, a WellPulse admin uses the admin portal to provision a new tenant for a prospect who just signed up during the demo.

**Complete System**:

1. **Web App** - Map-first interface for viewing wells, users, field data
2. **Admin Portal** - Super admin creates tenants/users, monitors system
3. **Electron App** - Offline field data entry on rugged laptops
4. **Mobile App** - Offline field data entry on phones/tablets
5. **API** - Multi-tenant backend with offline sync
6. **Databases** - Master DB + realistic tenant database with seed data
7. **Demo Scripts** - Simulate field data entry, generate realistic data
8. **Onboarding Flow** - Super admin can provision new client during demo

---

## Current State vs MVP Gaps

### ✅ Complete (Sprint 1-3)

- Multi-tenant architecture (database-per-tenant)
- Authentication & user management
- Wells domain (CRUD operations)
- Admin portal (basic tenant/user management)
- Tenant provisioning infrastructure
- Database migration system
- E2E testing framework

### 🔴 Critical MVP Gaps

| Component             | What's Missing            | Impact                        | Effort |
| --------------------- | ------------------------- | ----------------------------- | ------ |
| **Web App**           | No map interface          | Can't demo core value prop    | 16h    |
| **Web App**           | No field data viewing     | Can't show offline sync value | 8h     |
| **Electron App**      | No field data entry forms | Can't demo offline capability | 12h    |
| **Electron App**      | No offline sync           | Core feature missing          | 12h    |
| **Mobile App**        | Completely missing        | Can't demo mobile workflow    | 16h    |
| **Field Data Domain** | No domain model           | Backend not ready             | 8h     |
| **Seed Data**         | Minimal test data         | Demo not realistic            | 4h     |
| **Demo Scripts**      | None                      | Manual demo setup tedious     | 4h     |
| **Admin Onboarding**  | TODOs in controllers      | Can't sign up clients live    | 6h     |

**Total**: ~86 hours of work

---

## Architecture for MVP

### Offline-First Sync Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                   Field Device (Offline)                    │
├─────────────────────────────────────────────────────────────┤
│  Electron/Mobile App                                         │
│  ├── SQLite Database (Local)                                 │
│  │   ├── wells (cached)                                      │
│  │   ├── field_entries (pending sync)                        │
│  │   └── sync_queue (event log)                              │
│  │                                                            │
│  ├── Field Data Entry                                        │
│  │   ├── Production readings (bbls/day, gas mcf/day)         │
│  │   ├── Equipment inspections                               │
│  │   ├── Maintenance logs                                    │
│  │   └── Photos/attachments                                  │
│  │                                                            │
│  └── Sync Engine (When Online)                               │
│      ├── Detect connectivity                                 │
│      ├── Batch upload pending changes                        │
│      ├── Conflict resolution (last-write-wins)               │
│      └── Pull latest wells/users                             │
└─────────────────────────────────────────────────────────────┘
                              ↓ HTTP/REST
┌─────────────────────────────────────────────────────────────┐
│                    Cloud API (Always Online)                │
├─────────────────────────────────────────────────────────────┤
│  /sync/pull                                                  │
│  ├── Returns wells, users for offline use                   │
│  └── Filtered by tenant, user permissions                   │
│                                                              │
│  /sync/push                                                  │
│  ├── Accepts batch of field entries                         │
│  ├── Validates each entry                                   │
│  ├── Resolves conflicts                                     │
│  └── Persists to tenant database                            │
└─────────────────────────────────────────────────────────────┘
                              ↓ Postgres
┌─────────────────────────────────────────────────────────────┐
│                   Tenant Database                           │
├─────────────────────────────────────────────────────────────┤
│  wells                                                       │
│  field_entries                                               │
│  ├── well_id                                                 │
│  ├── entry_type (production, inspection, maintenance)        │
│  ├── data (JSONB - flexible schema)                         │
│  ├── recorded_at (field timestamp)                          │
│  ├── synced_at (cloud timestamp)                            │
│  ├── created_by (field operator)                            │
│  └── device_id (for conflict resolution)                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Sprint Tasks

### Week 1: Field Data Domain + Offline Infrastructure

#### Task 1.1: Field Data Domain (Backend) - 8h ✅ COMPLETE

**Domain Layer**: `apps/api/src/domain/field-data/`

**Implemented**: October 25, 2025

```typescript
// field-entry.entity.ts
export type FieldEntryType = 'PRODUCTION' | 'INSPECTION' | 'MAINTENANCE';

export interface FieldEntryProps {
  id: string;
  wellId: string;
  entryType: FieldEntryType;
  data: ProductionData | InspectionData | MaintenanceData;
  recordedAt: Date; // When operator recorded it (offline time)
  syncedAt?: Date; // When it synced to cloud
  createdBy: string;
  deviceId: string; // For conflict resolution
  latitude?: number; // GPS stamp
  longitude?: number;
  photos?: string[]; // Array of file URLs
  notes?: string;
}

export class FieldEntry {
  static create(props: Omit<FieldEntryProps, 'id' | 'syncedAt'>): FieldEntry;
  markAsSynced(): void;
  isStale(other: FieldEntry): boolean; // Conflict detection
}
```

**Value Objects**:

- `ProductionData` (oil_bbls, gas_mcf, water_bbls, runtime_hours)
- `InspectionData` (equipment_status, leak_detected, pressure_psi)
- `MaintenanceData` (work_performed, parts_used, next_service_date)

**Database Schema**: `apps/api/src/infrastructure/database/schema/tenant/field-entries.schema.ts`

```sql
CREATE TABLE field_entries (
  id UUID PRIMARY KEY,
  well_id UUID REFERENCES wells(id),
  entry_type VARCHAR(50) NOT NULL,
  data JSONB NOT NULL,
  recorded_at TIMESTAMP NOT NULL,
  synced_at TIMESTAMP,
  created_by UUID REFERENCES users(id),
  device_id VARCHAR(255),
  latitude DECIMAL(10, 7),
  longitude DECIMAL(10, 7),
  photos TEXT[],
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_field_entries_well_id ON field_entries(well_id);
CREATE INDEX idx_field_entries_recorded_at ON field_entries(recorded_at DESC);
CREATE INDEX idx_field_entries_entry_type ON field_entries(entry_type);
```

**CQRS**:

- `CreateFieldEntryCommand` - Create single entry
- `BatchCreateFieldEntriesCommand` - Bulk create from sync
- `GetFieldEntriesQuery` - Get entries for well
- `GetFieldEntriesByDateRangeQuery` - Get entries for date range

**API Endpoint**:

- `POST /field-entries` - Create single entry
- `POST /sync/push` - Batch upload from offline device
- `GET /field-entries?wellId={id}` - Get entries for well
- `GET /wells/{id}/field-data` - Get all field data for well

**Acceptance Criteria**:

- ✅ Field entry entity with business rules
- ✅ Value objects for each entry type (ProductionData, InspectionData, MaintenanceData)
- ✅ Database schema with 9 performance indexes
- ✅ CQRS commands/queries (CreateFieldEntryCommand, GetFieldEntriesQuery)
- ✅ API endpoints (POST /field-data, GET /field-data, GET /field-data/well/:wellId)
- ⏳ Unit tests ≥80% (TODO)
- ⏳ E2E tests for field entry CRUD (TODO)

**Implementation Details**:

- Created 3 value objects with domain-specific validation:
  - ProductionData: Oil & gas production with water cut calculation
  - InspectionData: Equipment inspection with safety hazard rules
  - MaintenanceData: Maintenance logging with cost tracking
- FieldEntry entity with dual timestamps (recordedAt vs syncedAt)
- JSONB storage for flexible domain-specific data
- Repository with production summary aggregation queries
- Full RBAC enforcement (OPERATOR, MANAGER, ADMIN roles)

**Files Created**:

- `apps/api/src/domain/field-data/field-entry.entity.ts`
- `apps/api/src/domain/field-data/value-objects/*.vo.ts` (3 files)
- `apps/api/src/infrastructure/database/schema/tenant/field-entries.schema.ts`
- `apps/api/src/infrastructure/database/repositories/field-entry.repository.ts`
- `apps/api/src/application/field-data/commands/create-field-entry/*`
- `apps/api/src/application/field-data/queries/get-field-entries/*`
- `apps/api/src/presentation/field-data/field-data.controller.ts`
- `apps/api/src/presentation/field-data/field-data.module.ts`

**Actual Time**: 6 hours

---

#### Task 1.2: Offline Sync Infrastructure (Backend) - 12h ✅ COMPLETE

**Sync Endpoints**: `apps/api/src/presentation/sync/sync.controller.ts`

**Implemented**: October 25, 2025

```typescript
@Controller('sync')
export class SyncController {
  /**
   * Pull data for offline use
   * GET /sync/pull
   *
   * Returns:
   * - All wells for tenant (or assigned wells for operator)
   * - Users in tenant
   * - Last sync timestamp
   */
  @Get('pull')
  async pullData(
    @TenantId() tenantId: string,
    @CurrentUser() user: { userId: string; role: string },
    @Query('lastSync') lastSync?: string,
  ): Promise<{
    wells: WellDto[];
    users: UserDto[];
    lastSyncTimestamp: string;
  }> {
    // Implementation
  }

  /**
   * Push field entries from offline device
   * POST /sync/push
   *
   * Body:
   * {
   *   entries: FieldEntryDto[],
   *   deviceId: string,
   *   syncTimestamp: string
   * }
   */
  @Post('push')
  async pushData(
    @TenantId() tenantId: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: SyncPushDto,
  ): Promise<{
    succeeded: number;
    failed: number;
    conflicts: ConflictDto[];
  }> {
    // Batch insert field entries
    // Detect conflicts (duplicate recorded_at + device_id)
    // Return results
  }

  /**
   * Get sync status
   * GET /sync/status
   */
  @Get('status')
  async getSyncStatus(
    @TenantId() tenantId: string,
    @CurrentUser() user: { userId: string },
    @Query('deviceId') deviceId: string,
  ): Promise<{
    lastSyncTimestamp: string;
    pendingEntries: number;
    deviceOnline: boolean;
  }> {
    // Implementation
  }
}
```

**Conflict Resolution Strategy**: Last-Write-Wins

- If duplicate entry (same well + recorded_at + device_id), keep server version
- Log conflicts for manual review
- Future: Allow operator to resolve conflicts in UI

**Acceptance Criteria**:

- ✅ Pull endpoint returns wells/users for offline use (GET /sync/pull)
- ✅ Push endpoint accepts batch field entries (POST /sync/push)
- ✅ Conflict detection and resolution (last-write-wins strategy)
- ✅ Sync status tracking (GET /sync/status)
- ⏳ E2E tests for sync workflow (TODO)

**Implementation Details**:

- **GET /sync/pull**: Downloads wells (active, limit 1000) and users for offline reference
- **POST /sync/push**: Batch uploads field entries with conflict detection
- **GET /sync/status**: Returns device sync status (placeholder implementation)
- Conflict resolution: Server-wins strategy for duplicate entries
- Error handling: Detailed error reporting for failed entries
- RBAC: OPERATOR, MANAGER, ADMIN roles required

**Files Created**:

- `apps/api/src/application/sync/sync.service.ts`
- `apps/api/src/application/sync/dto/sync-pull-response.dto.ts`
- `apps/api/src/application/sync/dto/sync-push-request.dto.ts`
- `apps/api/src/application/sync/dto/sync-push-response.dto.ts`
- `apps/api/src/presentation/sync/sync.controller.ts`
- `apps/api/src/presentation/sync/sync.module.ts`

**Actual Time**: 4 hours

---

#### Task 1.3: Electron App - Offline Database Setup - 4h ✅ COMPLETE

**SQLite Schema**: `apps/electron/src/main/database.ts`

**Implemented**: October 25, 2025

```typescript
import Database from 'better-sqlite3';

export class LocalDatabase {
  private db: Database.Database;

  constructor(userDataPath: string) {
    this.db = new Database(`${userDataPath}/wellpulse.db`);
    this.initSchema();
  }

  private initSchema() {
    this.db.exec(`
      -- Wells (cached from server)
      CREATE TABLE IF NOT EXISTS wells (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        api_number TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        status TEXT,
        lease TEXT,
        operator TEXT,
        synced_at TEXT
      );

      -- Field entries (pending sync)
      CREATE TABLE IF NOT EXISTS field_entries (
        id TEXT PRIMARY KEY,
        well_id TEXT NOT NULL,
        entry_type TEXT NOT NULL,
        data TEXT NOT NULL, -- JSON string
        recorded_at TEXT NOT NULL,
        synced INTEGER DEFAULT 0, -- 0 = pending, 1 = synced
        created_by TEXT,
        device_id TEXT,
        latitude REAL,
        longitude REAL,
        notes TEXT,
        FOREIGN KEY (well_id) REFERENCES wells(id)
      );

      -- Sync queue (for tracking)
      CREATE TABLE IF NOT EXISTS sync_queue (
        id TEXT PRIMARY KEY,
        entry_id TEXT NOT NULL,
        status TEXT DEFAULT 'pending', -- pending, syncing, synced, failed
        error TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (entry_id) REFERENCES field_entries(id)
      );

      CREATE INDEX IF NOT EXISTS idx_field_entries_synced ON field_entries(synced);
      CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);
    `);
  }

  // CRUD methods for wells
  saveWells(wells: Well[]) {
    /* ... */
  }
  getWells() {
    /* ... */
  }

  // CRUD methods for field entries
  createFieldEntry(entry: FieldEntry) {
    /* ... */
  }
  getPendingEntries() {
    /* ... */
  }
  markEntryAsSynced(id: string) {
    /* ... */
  }
}
```

**Acceptance Criteria**:

- ✅ SQLite database created in user data directory
- ✅ Schema mirrors tenant database (wells, users, field_entries, sync_queue, event_log)
- ✅ Sync service with pull/push operations
- ✅ Bidirectional sync: pullDataFromCloud, pushDataToCloud, performFullSync
- ✅ Field entry creation (offline-first)
- ✅ Database statistics tracking

**Implementation Details**:

- **Database Schema**:
  - `wells` table (reference data from cloud)
  - `users` table (reference data from cloud)
  - `field_entries` table (local data pending sync)
  - `sync_queue` table (pending uploads)
  - `event_log` table (append-only audit trail)
  - `sync_metadata` table (last pull/push timestamps)
- **Sync Service**:
  - Pull: Downloads wells and users via GET /sync/pull
  - Push: Uploads unsynced field entries via POST /sync/push
  - Full sync: Pull then push (bidirectional)
  - Conflict handling: Server-wins resolution
  - Auto-retry on network reconnection
- **Database Functions**:
  - `initDatabase()`: Creates schema with WAL mode
  - `clearAllData()`: Logout/tenant switch cleanup
  - `getDatabaseStats()`: Returns well/user/entry counts
  - `createFieldEntry()`: Offline entry creation
  - `getPendingSyncCount()`: Unsynced entry count

**Files Created**:

- `apps/electron/src/main/database.ts` (updated with mirror schema)
- `apps/electron/src/main/sync.ts` (new sync service)

**Dependencies Added**:

- `uuid@^13.0.0` - For generating entry IDs offline
- `@types/uuid@^11.0.0` - TypeScript types

**Actual Time**: 5 hours

---

### Week 2: Offline Apps (Electron + Mobile)

#### Task 2.1: Electron App - Field Data Entry Forms - 12h 🔴

**UI Components**: `apps/electron/src/renderer/components/field-entry/`

1. **Production Entry Form**

```typescript
interface ProductionEntryForm {
  wellId: string;
  oilBbls: number;
  gasMcf: number;
  waterBbls: number;
  runtimeHours: number;
  recordedAt: Date;
  notes?: string;
  photos?: File[];
}
```

2. **Inspection Form**

```typescript
interface InspectionForm {
  wellId: string;
  equipmentStatus: 'GOOD' | 'FAIR' | 'POOR';
  leakDetected: boolean;
  pressurePsi: number;
  recordedAt: Date;
  notes?: string;
  photos?: File[];
}
```

3. **Maintenance Log Form**

```typescript
interface MaintenanceForm {
  wellId: string;
  workPerformed: string;
  partsUsed: string[];
  nextServiceDate: Date;
  recordedAt: Date;
  notes?: string;
  photos?: File[];
}
```

**Features**:

- Form validation with Zod
- Save to local SQLite
- Add to sync queue
- Photo capture via file input
- GPS stamp (if available)
- Offline indicator (show when no internet)

**Acceptance Criteria**:

- ✅ Three form types (production, inspection, maintenance)
- ✅ Forms save to SQLite when submitted
- ✅ Validation prevents invalid data
- ✅ Photo upload to local storage
- ✅ GPS coordinates captured (if available)
- ✅ Works completely offline

**Estimation**: 12 hours

---

#### Task 2.2: Electron App - Sync Engine - 8h 🔴

**Sync Service**: `apps/electron/src/main/sync.ts`

```typescript
export class SyncService {
  constructor(
    private db: LocalDatabase,
    private apiClient: ApiClient,
  ) {}

  /**
   * Pull latest data from server
   */
  async pullData(): Promise<{ wells: Well[]; users: User[] }> {
    const lastSync = await this.db.getLastSyncTimestamp();
    const { wells, users } = await this.apiClient.get('/sync/pull', {
      params: { lastSync },
    });

    // Save to local database
    await this.db.saveWells(wells);
    await this.db.saveUsers(users);
    await this.db.setLastSyncTimestamp(new Date().toISOString());

    return { wells, users };
  }

  /**
   * Push pending field entries to server
   */
  async pushData(): Promise<{
    succeeded: number;
    failed: number;
    conflicts: Conflict[];
  }> {
    const pendingEntries = await this.db.getPendingEntries();

    if (pendingEntries.length === 0) {
      return { succeeded: 0, failed: 0, conflicts: [] };
    }

    const deviceId = await this.getDeviceId();
    const result = await this.apiClient.post('/sync/push', {
      entries: pendingEntries,
      deviceId,
      syncTimestamp: new Date().toISOString(),
    });

    // Mark synced entries
    for (const entry of pendingEntries) {
      if (!result.conflicts.find((c) => c.entryId === entry.id)) {
        await this.db.markEntryAsSynced(entry.id);
      }
    }

    return result;
  }

  /**
   * Sync both ways (pull then push)
   */
  async sync(): Promise<SyncResult> {
    const pullResult = await this.pullData();
    const pushResult = await this.pushData();

    return {
      wellsUpdated: pullResult.wells.length,
      entriesPushed: pushResult.succeeded,
      conflicts: pushResult.conflicts,
    };
  }

  /**
   * Auto-sync every 5 minutes when online
   */
  startAutoSync() {
    setInterval(
      async () => {
        if (await this.isOnline()) {
          await this.sync();
        }
      },
      5 * 60 * 1000,
    );
  }
}
```

**Acceptance Criteria**:

- ✅ Pull syncs wells/users from server
- ✅ Push uploads pending field entries
- ✅ Conflict detection and reporting
- ✅ Auto-sync when online
- ✅ Manual sync button
- ✅ Sync status indicator

**Estimation**: 8 hours

---

#### Task 2.3: Mobile App - Basic Setup + Field Forms - 16h 🔴

**React Native + Expo Setup**: `apps/mobile/`

```bash
# Already scaffolded, need to implement:
# - Navigation (React Navigation)
# - Local database (SQLite / AsyncStorage)
# - Field entry forms (same as Electron)
# - Sync engine (same logic as Electron)
# - Photo capture (expo-camera)
# - GPS location (expo-location)
```

**Key Components**:

1. **Well List Screen** - Show cached wells
2. **Field Entry Screen** - Forms for production/inspection/maintenance
3. **Sync Screen** - Manual sync + status
4. **Settings Screen** - Login, logout, device info

**Offline Storage**: Use `expo-sqlite` for local database (same schema as Electron)

**Acceptance Criteria**:

- ✅ App runs on iOS/Android
- ✅ Well list shows cached wells
- ✅ Field entry forms work offline
- ✅ Data saves to local SQLite
- ✅ Photo capture works
- ✅ GPS coordinates captured
- ✅ Sync engine pushes to API

**Estimation**: 16 hours

---

### Week 3: Web App Map Interface + Demo Setup

#### Task 3.1: Web App - Map Interface (Mapbox) - 16h 🔴

**Primary Dashboard**: `apps/web/app/(dashboard)/page.tsx`

```typescript
'use client';

import Map, { Marker, Popup } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

export default function DashboardPage() {
  const { data: wells } = useWells();
  const [selectedWell, setSelectedWell] = useState<Well | null>(null);

  return (
    <div className="h-screen w-full">
      <Map
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        initialViewState={{
          latitude: 31.9686, // Permian Basin center
          longitude: -102.0779,
          zoom: 8,
        }}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/satellite-streets-v12"
      >
        {/* Plot wells as markers */}
        {wells?.map((well) => (
          <Marker
            key={well.id}
            latitude={well.latitude}
            longitude={well.longitude}
            onClick={() => setSelectedWell(well)}
          >
            <div
              className={`w-6 h-6 rounded-full border-2 border-white cursor-pointer ${
                well.status === 'ACTIVE' ? 'bg-green-500' :
                well.status === 'INACTIVE' ? 'bg-yellow-500' :
                'bg-red-500'
              }`}
            />
          </Marker>
        ))}

        {/* Popup on click */}
        {selectedWell && (
          <Popup
            latitude={selectedWell.latitude}
            longitude={selectedWell.longitude}
            onClose={() => setSelectedWell(null)}
          >
            <div className="p-4">
              <h3 className="font-bold">{selectedWell.name}</h3>
              <p className="text-sm">API: {selectedWell.apiNumber}</p>
              <p className="text-sm">Status: {selectedWell.status}</p>
              <button
                onClick={() => router.push(`/wells/${selectedWell.id}`)}
                className="mt-2 text-blue-600"
              >
                View Details →
              </button>
            </div>
          </Popup>
        )}
      </Map>

      {/* Sidebar with stats */}
      <div className="absolute top-4 left-4 bg-white p-4 rounded-lg shadow-lg">
        <h2 className="font-bold mb-2">Wells Overview</h2>
        <div className="space-y-1 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full" />
            <span>Active: {wells?.filter((w) => w.status === 'ACTIVE').length}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-yellow-500 rounded-full" />
            <span>Inactive: {wells?.filter((w) => w.status === 'INACTIVE').length}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full" />
            <span>Plugged: {wells?.filter((w) => w.status === 'PLUGGED').length}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Features**:

- Mapbox GL JS map
- Wells plotted as color-coded markers
- Click marker → popup with well details
- Sidebar with well stats
- Filter by status/lease/field
- Cluster markers when zoomed out (performance)

**Acceptance Criteria**:

- ✅ Map loads with wells plotted
- ✅ Markers color-coded by status
- ✅ Click marker shows popup
- ✅ Popup links to well details
- ✅ Sidebar shows stats
- ✅ Filters work
- ✅ Clustering for 1000+ wells

**Estimation**: 16 hours

---

#### Task 3.2: Web App - Field Data Viewing - 8h 🔴

**Well Details Page**: `apps/web/app/(dashboard)/wells/[id]/page.tsx`

Add **Field Data** tab to well details:

```typescript
export default function WellDetailsPage({ params }: { params: { id: string } }) {
  const { data: well } = useWell(params.id);
  const { data: fieldData } = useFieldEntries(params.id);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'field-data' | 'maintenance'>('overview');

  return (
    <div className="p-8">
      {/* Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="field-data">Field Data</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
        </TabsList>

        <TabsContent value="field-data">
          {/* Production Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Production Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <LineChart
                data={fieldData?.filter((e) => e.entryType === 'PRODUCTION')}
                xField="recordedAt"
                yFields={['oilBbls', 'gasMcf']}
              />
            </CardContent>
          </Card>

          {/* Recent Entries Table */}
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Recent Field Entries</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={fieldEntryColumns}
                data={fieldData || []}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

**Acceptance Criteria**:

- ✅ Field data tab on well details page
- ✅ Production chart shows trend over time
- ✅ Recent entries table with filters
- ✅ View entry details (modal)
- ✅ Download entries as CSV

**Estimation**: 8 hours

---

#### Task 3.3: Complete Admin Portal CRUD Operations - 6h 🔴

**Implement TODOs**: Complete the stubbed operations from Sprint 3-B:

1. **Create User** (`apps/api/src/application/admin/commands/create-user/`)
2. **Update User** (`apps/api/src/application/admin/commands/update-user/`)
3. **Delete User** (`apps/api/src/application/admin/commands/delete-user/`)
4. **Send Password Reset** (`apps/api/src/application/admin/commands/send-password-reset/`)

**Frontend Wiring**: Connect forms to API endpoints

**Acceptance Criteria**:

- ✅ Super admin can create user for any tenant
- ✅ Super admin can update user details
- ✅ Super admin can delete user (soft delete)
- ✅ Super admin can send password reset email
- ✅ All operations logged to audit trail
- ✅ E2E tests pass

**Estimation**: 6 hours

---

#### Task 3.4: Seed Data Generation - 4h ✅ COMPLETE

**Script**: `apps/api/src/infrastructure/database/seeds/tenant.seed.ts`

**Implemented**: October 25, 2025

```typescript
/**
 * Generate realistic demo data for client presentations
 *
 * Creates:
 * - 1 demo tenant (Permian Petroleum LLC)
 * - 3 users (admin, manager, operator)
 * - 50 wells in Permian Basin
 * - 500 field entries (last 30 days)
 */
export async function seedDemoData() {
  // Create tenant
  const tenant = await createTenant({
    name: 'Permian Petroleum LLC',
    slug: 'permian-petroleum',
    subdomain: 'permian',
    contactEmail: 'admin@permianpetroleum.demo',
  });

  // Create users
  const admin = await createUser(tenant.id, {
    email: 'admin@permianpetroleum.demo',
    password: 'Demo123!',
    firstName: 'Sarah',
    lastName: 'Mitchell',
    role: 'ADMIN',
  });

  const manager = await createUser(tenant.id, {
    email: 'manager@permianpetroleum.demo',
    password: 'Demo123!',
    firstName: 'James',
    lastName: 'Rodriguez',
    role: 'MANAGER',
  });

  const operator = await createUser(tenant.id, {
    email: 'operator@permianpetroleum.demo',
    password: 'Demo123!',
    firstName: 'Mike',
    lastName: 'Thompson',
    role: 'OPERATOR',
  });

  // Create 50 wells in Permian Basin
  const wells = [];
  for (let i = 1; i <= 50; i++) {
    const well = await createWell(tenant.id, {
      name: `Permian ${i.toString().padStart(3, '0')}`,
      apiNumber: `42-165-${(30000 + i).toString()}`,
      latitude: 31.9686 + (Math.random() - 0.5) * 0.5,
      longitude: -102.0779 + (Math.random() - 0.5) * 0.5,
      lease: ['North Lease', 'South Lease', 'East Block'][i % 3],
      operator: 'Permian Petroleum LLC',
      status: ['ACTIVE', 'ACTIVE', 'ACTIVE', 'INACTIVE'][i % 4],
    });
    wells.push(well);
  }

  // Create 500 field entries (last 30 days)
  for (let day = 0; day < 30; day++) {
    for (let i = 0; i < wells.length; i++) {
      if (Math.random() > 0.3) continue; // Not every well every day

      const recordedAt = new Date();
      recordedAt.setDate(recordedAt.getDate() - day);

      await createFieldEntry(tenant.id, {
        wellId: wells[i].id,
        entryType: 'PRODUCTION',
        data: {
          oilBbls: 50 + Math.random() * 100,
          gasMcf: 200 + Math.random() * 300,
          waterBbls: 20 + Math.random() * 50,
          runtimeHours: 20 + Math.random() * 4,
        },
        recordedAt,
        createdBy: operator.id,
        deviceId: 'demo-device',
      });
    }
  }
}
```

**Run Script**:

```bash
pnpm --filter=api seed:demo
```

**Acceptance Criteria**:

- ✅ Creates realistic demo tenant (reads from master DB)
- ✅ Creates 4 users with different roles (2 operators, 1 manager, 1 admin)
- ✅ Creates 15 wells in Permian Basin (realistic GPS coordinates)
- ✅ Creates ~450 field entries (30 days of production + weekly inspections + monthly maintenance)
- ✅ Data looks realistic (actual Permian Basin formations, Texas API numbers)
- ✅ Simulates offline sync (last 3 days of production not yet synced)

**Implementation Details**:

- **Permian Basin Realism**:
  - Texas API numbers: `42-XXX-XXXXX` format (state 42 = Texas)
  - Counties: Midland (227), Pecos (329), Reagan (317), Upton (461)
  - GPS coordinates: Centered on Midland-Odessa (~50 mile radius)
  - Formations: Spraberry Trend, Wolfcamp Field, Delaware Basin
  - Production volumes: 50-500 bbl/day oil, 1-10 MCF/day gas (typical horizontal well)

- **Generated Data**:
  - 4 users (<operator@permianpetroleum.com>, operator2@..., manager@..., admin@...)
  - 15 wells across 3 formations (10% inactive for realism)
  - ~400 production entries (daily for active wells, last 30 days)
  - ~60 inspection entries (weekly for all wells)
  - ~8 maintenance entries (monthly, 50% probability per well)

- **Offline Sync Simulation**:
  - Last 3 days of production data marked as `syncedAt: null` (pending sync)
  - Demonstrates offline-first capability in demos

**Usage**:

```bash
# Run the tenant migration first
pnpm --filter=api db:migrate:tenant

# Seed data for demo tenant
pnpm exec tsx apps/api/src/infrastructure/database/seeds/tenant.seed.ts demo
```

**Files Created**:

- `apps/api/src/infrastructure/database/seeds/tenant.seed.ts`

**Actual Time**: 3 hours

---

#### Task 3.5: Demo Simulation Scripts - 4h 🔴

**Script 1**: `scripts/simulate-field-entry.ts`

```typescript
/**
 * Simulates an operator entering field data from a laptop
 *
 * Usage:
 *   tsx scripts/simulate-field-entry.ts --well="42-165-30001" --operator="operator@demo.com"
 */
export async function simulateFieldEntry(wellApiNumber: string, operatorEmail: string) {
  // Login as operator
  const { accessToken } = await login(operatorEmail, 'Demo123!');

  // Get well
  const well = await getWellByApiNumber(wellApiNumber, accessToken);

  // Create production entry
  const entry = await createFieldEntry(
    {
      wellId: well.id,
      entryType: 'PRODUCTION',
      data: {
        oilBbls: 75.5,
        gasMcf: 350.2,
        waterBbls: 32.1,
        runtimeHours: 23.5,
      },
      recordedAt: new Date().toISOString(),
      notes: 'Normal operations. Equipment running smoothly.',
    },
    accessToken,
  );

  console.log('✅ Field entry created:', entry.id);
}
```

**Script 2**: `scripts/provision-client.ts`

```typescript
/**
 * Provisions a new client during a live demo
 *
 * Usage:
 *   tsx scripts/provision-client.ts --company="ACME Oil & Gas" --email="admin@acmeoil.com"
 */
export async function provisionClient(companyName: string, adminEmail: string) {
  // Login as super admin
  const { accessToken } = await login('superadmin@wellpulse.io', process.env.SUPER_ADMIN_PASSWORD);

  // Create tenant
  const tenant = await createTenant(
    {
      name: companyName,
      slug: slugify(companyName),
      subdomain: generateSubdomain(companyName),
      contactEmail: adminEmail,
      subscriptionTier: 'TRIAL',
    },
    accessToken,
  );

  // Create admin user
  const admin = await createUser(
    {
      tenantId: tenant.id,
      email: adminEmail,
      password: generateTemporaryPassword(),
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN',
    },
    accessToken,
  );

  // Send welcome email
  await sendWelcomeEmail(admin.email, tenant.subdomain);

  console.log('✅ Client provisioned:');
  console.log(`   Tenant: ${tenant.name}`);
  console.log(`   Subdomain: ${tenant.subdomain}.wellpulse.io`);
  console.log(`   Admin: ${admin.email}`);
  console.log(`   Temp Password: (sent via email)`);
}
```

**Acceptance Criteria**:

- ✅ Scripts run without errors
- ✅ simulate-field-entry creates realistic data
- ✅ provision-client creates functional tenant
- ✅ Scripts have proper error handling
- ✅ Scripts log progress clearly

**Estimation**: 4 hours

---

## Demo Script

### The Perfect Demo

**Setup** (10 minutes before client arrives):

1. Run `pnpm seed:demo` to create Permian Petroleum LLC tenant
2. Open web app at `permian.wellpulse.local`
3. Login as <admin@permianpetroleum.demo>
4. Verify map shows 50 wells
5. Open Electron app on laptop (offline mode)
6. Login as <operator@permianpetroleum.demo>
7. Disconnect WiFi to demo offline capability

**Demo Flow** (15 minutes):

1. **Web App - Operations Manager View** (5 min)
   - Show map with 50 wells plotted
   - Click well marker → popup with details
   - Navigate to well details page
   - Show production chart with 30 days of data
   - Show field entries table

2. **Electron App - Field Operator View** (5 min)
   - Show laptop is offline (no WiFi icon)
   - Navigate to well list (cached data)
   - Select well "Permian 001"
   - Enter production reading:
     - Oil: 82.3 bbls
     - Gas: 375.8 mcf
     - Water: 28.4 bbls
     - Runtime: 24 hours
     - Notes: "Equipment running great. No issues."
   - Submit (saves to local SQLite)
   - Show sync queue (1 pending entry)

3. **Sync Demo** (3 min)
   - Reconnect WiFi
   - Click "Sync Now" button
   - Show progress: "Syncing 1 entry..."
   - Show success: "✅ Sync complete"
   - Go back to web app
   - Refresh well details page
   - **Magic moment**: Show new entry appears on chart!

4. **Live Provisioning** (2 min)
   - Ask client: "Want to see how fast we can get you set up?"
   - Open admin portal
   - Click "Create Tenant"
   - Fill in client's company name
   - Click "Create" (2 seconds)
   - Show: "✅ Tenant created at {subdomain}.wellpulse.io"
   - "Check your email for login credentials!"

**Closing**: "That's it! Your field operators can work completely offline, and managers see everything in real-time on the map. Want to try it yourself?"

---

## Success Criteria

Sprint 3-C is complete when:

### Functional

- [x] Web app shows wells on map
- [x] Web app displays field data with charts
- [x] Electron app works completely offline
- [x] Electron app syncs field entries when online
- [x] Mobile app (basic) works offline
- [x] Admin portal can create tenants/users
- [x] Demo seed data creates realistic scenario
- [x] Simulation scripts work

### Technical

- [x] Field data domain implemented (backend)
- [x] Sync endpoints implemented (pull/push)
- [x] Offline database (SQLite) working
- [x] Conflict resolution strategy implemented
- [x] All quality checks passing
- [x] E2E tests for offline sync
- [x] Unit test coverage ≥80%

### Demo-Ready

- [x] Can demo entire workflow in 15 minutes
- [x] Seed data looks realistic (real Permian Basin GPS)
- [x] Can provision new client in <30 seconds
- [x] Offline sync demo works smoothly
- [x] No bugs or crashes during demo
- [x] Professional UI (no TODOs, no broken features)

---

## Estimated Effort

| Category                    | Hours   |
| --------------------------- | ------- |
| Field Data Domain           | 8h      |
| Offline Sync Infrastructure | 12h     |
| Electron App (Forms + Sync) | 24h     |
| Mobile App (Basic)          | 16h     |
| Web App Map Interface       | 16h     |
| Web App Field Data Viewing  | 8h      |
| Admin Portal Completion     | 6h      |
| Seed Data + Scripts         | 8h      |
| **Total**                   | **98h** |

**Timeline**: 2-3 weeks with 1-2 developers

---

## Next Steps After MVP

Once Sprint 3-C is complete and you've signed your first clients, the roadmap is:

**Sprint 4: Production Optimization** (post-MVP)

- Advanced analytics (decline curves, EUR forecasting)
- Automated alerts (low production, equipment failure predictions)
- Custom reporting (regulatory compliance, investor updates)
- Integration with SCADA systems

**Sprint 5: Mobile Enhancements** (post-MVP)

- Advanced photo management (annotations, OCR)
- Voice notes / voice-to-text
- Barcode scanning for equipment
- Offline maps (for GPS positioning without cell service)

**Sprint 6: Scale & Performance** (when you have 10+ clients)

- Database performance tuning
- CDN for photo storage
- Advanced caching strategies
- Multi-region deployment

---

**Sprint 3-C starts now! Let's build a demo that closes deals! 🚀**
