# Phase 2: Field Operations & Offline Sync

**Timeline**: Weeks 9-16 (Sprints 5-8)
**Duration**: 8 weeks
**Goal**: Field operators can track production and equipment, with offline capability
**Deliverable**: Field operators can enter data offline on laptops/phones and sync when online

---

## Overview

Phase 2 builds on the foundation from Phase 1 by adding the core operational features that oil & gas field operators need daily: production tracking and equipment management. More importantly, this phase introduces offline-first data entry capabilities through dedicated Electron (desktop) and React Native (mobile) applications.

**Why Offline-First Matters**: Field operators work in remote locations with spotty or no internet connectivity. They need to capture production data, log equipment maintenance, and take photos regardless of network availability. When they return to the office or regain connectivity, all data syncs automatically.

### Phase 2 Applications

```
┌─────────────────────────────────────────────────────────┐
│                    Phase 2 Stack                        │
├─────────────────────────────────────────────────────────┤
│  Existing (from Phase 1):                               │
│    - API (NestJS)          - REST API with JWT auth     │
│    - Web (Next.js)         - Operator dashboard         │
│                                                          │
│  New in Phase 2:                                        │
│    - Electron              - Offline desktop app        │
│    - Mobile (React Native) - iOS/Android offline app    │
│    - Batch Sync Service    - Backend sync processing    │
└─────────────────────────────────────────────────────────┘
```

---

## Sprint 5: Production Tracking (Weeks 9-10)

### Objectives

Enable operators to enter and visualize daily production data (oil, gas, water volumes) with time-series charts and variance alerts.

### Deliverables

1. **Production Domain Entity** (Backend)
   - Oil volume (barrels)
   - Gas volume (MCF)
   - Water volume (barrels)
   - Production date
   - Associated well
   - Entry method (manual, SCADA import)

2. **Production API Endpoints**
   - `POST /wells/:wellId/production` - Create production record
   - `GET /wells/:wellId/production` - List production history (paginated)
   - `GET /wells/:wellId/production/:date` - Get specific date
   - `PUT /wells/:wellId/production/:id` - Update production record
   - `DELETE /wells/:wellId/production/:id` - Soft delete record
   - `GET /wells/:wellId/production/summary` - Aggregated stats

3. **Production Entry Form** (Frontend)
   - Date picker (defaults to today)
   - Oil/gas/water volume inputs
   - Notes field (optional)
   - Validation (no future dates, volumes > 0)
   - Bulk entry (enter 7 days at once)

4. **Production Charts**
   - Time series line chart (last 30/90/365 days)
   - Oil/gas/water toggle
   - Cumulative production chart
   - Daily variance alerts (>20% from previous day)

### Database Schema

**Table**: `production_data`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | Primary key |
| `well_id` | UUID | Foreign key to wells |
| `production_date` | DATE | NOT NULL, indexed |
| `oil_volume` | DECIMAL(10,2) | Barrels |
| `gas_volume` | DECIMAL(10,2) | MCF (thousand cubic feet) |
| `water_volume` | DECIMAL(10,2) | Barrels |
| `entry_method` | ENUM | 'MANUAL', 'SCADA', 'MOBILE', 'ELECTRON' |
| `notes` | TEXT | Optional |
| `created_by` | UUID | User who entered data |
| `created_at` | TIMESTAMP | Auto-generated |
| `updated_at` | TIMESTAMP | Auto-updated |
| `deleted_at` | TIMESTAMP | Soft delete |

**Indexes**:
- `idx_production_well_date` on `(well_id, production_date)` - Primary query pattern
- `idx_production_date` on `production_date` - Range queries

### Domain Entity Example

```typescript
// apps/api/src/domain/production/production-data.entity.ts
export class ProductionData {
  private constructor(
    public readonly id: string,
    private _wellId: string,
    private _productionDate: Date,
    private _oilVolume: Volume,     // Value Object
    private _gasVolume: Volume,     // Value Object
    private _waterVolume: Volume,   // Value Object
    private _entryMethod: EntryMethod,
    private _notes: string | null,
    public readonly createdBy: string,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  static create(params: CreateProductionDataParams): ProductionData {
    // Validate no future dates
    if (params.productionDate > new Date()) {
      throw new Error('Production date cannot be in the future');
    }

    return new ProductionData(
      uuid(),
      params.wellId,
      params.productionDate,
      Volume.create(params.oilVolume, 'BARRELS'),
      Volume.create(params.gasVolume, 'MCF'),
      Volume.create(params.waterVolume, 'BARRELS'),
      params.entryMethod,
      params.notes ?? null,
      params.createdBy,
      new Date(),
      new Date(),
    );
  }

  calculateVariance(previousDayData: ProductionData): number {
    const currentOil = this._oilVolume.amount;
    const previousOil = previousDayData._oilVolume.amount;
    return ((currentOil - previousOil) / previousOil) * 100;
  }
}
```

### Success Criteria

- [ ] Operators can enter production data for any well
- [ ] Production history displays in table (sortable, filterable)
- [ ] Time-series chart renders in < 1 second (90 days of data)
- [ ] Variance alerts trigger for >20% daily changes
- [ ] 500 production records created (test data)

---

## Sprint 6: Equipment Management (Weeks 11-12)

### Objectives

Track equipment inventory (pump jacks, tanks, separators), log maintenance activities with photo uploads, and monitor equipment status.

### Deliverables

1. **Equipment Domain Entity** (Backend)
   - Equipment type (pump jack, tank, separator, etc.)
   - Serial number / asset tag
   - Installation date
   - Associated well
   - Status (operational, maintenance, failed)
   - Maintenance history

2. **Equipment API Endpoints**
   - `POST /wells/:wellId/equipment` - Add equipment to well
   - `GET /wells/:wellId/equipment` - List well equipment
   - `GET /equipment/:id` - Get equipment details
   - `PUT /equipment/:id` - Update equipment
   - `POST /equipment/:id/maintenance` - Log maintenance event
   - `GET /equipment/:id/maintenance` - Maintenance history
   - `POST /equipment/:id/photos` - Upload maintenance photo

3. **Equipment Inventory UI** (Frontend)
   - Equipment list (per well)
   - Equipment detail page
   - Add/edit equipment form
   - Status badges (color-coded)
   - Equipment search (by type, serial number)

4. **Maintenance Logging**
   - Maintenance form (date, type, notes)
   - Photo upload (Azure Blob Storage)
   - Maintenance history timeline
   - Next maintenance due date calculation

### Database Schema

**Table**: `equipment`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | Primary key |
| `well_id` | UUID | Foreign key to wells |
| `equipment_type` | ENUM | 'PUMP_JACK', 'TANK', 'SEPARATOR', etc. |
| `serial_number` | VARCHAR(100) | Unique |
| `manufacturer` | VARCHAR(255) | Optional |
| `model` | VARCHAR(255) | Optional |
| `installation_date` | DATE | Optional |
| `status` | ENUM | 'OPERATIONAL', 'MAINTENANCE', 'FAILED' |
| `created_at` | TIMESTAMP | Auto-generated |
| `updated_at` | TIMESTAMP | Auto-updated |
| `deleted_at` | TIMESTAMP | Soft delete |

**Table**: `equipment_maintenance`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | Primary key |
| `equipment_id` | UUID | Foreign key to equipment |
| `maintenance_date` | DATE | NOT NULL |
| `maintenance_type` | ENUM | 'ROUTINE', 'REPAIR', 'INSPECTION' |
| `description` | TEXT | Required |
| `technician` | VARCHAR(255) | Optional |
| `cost` | DECIMAL(10,2) | Optional |
| `next_maintenance_date` | DATE | Optional |
| `photo_urls` | TEXT[] | Array of Azure Blob URLs |
| `created_by` | UUID | User who logged maintenance |
| `created_at` | TIMESTAMP | Auto-generated |

### Photo Upload Flow (Azure Blob Storage)

```typescript
// 1. Frontend requests upload URL
POST /equipment/:id/photos/upload-url
Response: {
  uploadUrl: "https://wellpulseprod.blob.core.windows.net/tenants/acme/equipment/...",
  blobName: "acme/equipment/123/maintenance/uuid.jpg",
  expiresAt: "2025-10-23T15:00:00Z"
}

// 2. Frontend uploads directly to Azure Blob Storage
PUT {uploadUrl}
Body: <image binary>

// 3. Frontend confirms upload to API
POST /equipment/:id/maintenance
Body: {
  maintenanceDate: "2025-10-23",
  maintenanceType: "REPAIR",
  description: "Replaced motor belt",
  photoUrls: ["{blobName}"]
}
```

### Success Criteria

- [ ] 100 equipment items tracked across test wells
- [ ] Maintenance logs with photos successfully uploaded
- [ ] Equipment status changes reflect in UI immediately
- [ ] Maintenance history timeline displays correctly
- [ ] Photo upload completes in < 5 seconds (1 MB photo)

---

## Sprint 7: Electron Offline App (Weeks 13-14)

### Objectives

Build standalone desktop application for offline field data entry using Electron with local SQLite database and event sourcing pattern.

### Deliverables

1. **Electron App Scaffold**
   - Electron 28+ with React frontend
   - SQLite database (better-sqlite3)
   - IPC communication (main ↔ renderer)
   - Auto-updater (for future updates)

2. **Local Database Schema**
   - Mirror cloud schema (wells, production, equipment)
   - Event log table (event sourcing)
   - Sync status table (pending, synced, failed)

3. **Offline Data Entry**
   - Production entry form (identical to web app)
   - Equipment maintenance logging
   - Photo capture (from webcam or file)
   - All changes stored as events

4. **Event Sourcing Implementation**
   - Every action = immutable event
   - Event types: `PRODUCTION_CREATED`, `EQUIPMENT_UPDATED`, etc.
   - Events stored in `event_log` table
   - Replay events to reconstruct state

### Event Sourcing Example

```typescript
// Event structure
interface Event {
  id: string;
  tenantId: string;
  eventType: string;
  aggregateId: string;  // Well ID, Equipment ID, etc.
  payload: Record<string, any>;
  timestamp: Date;
  userId: string;
  syncStatus: 'PENDING' | 'SYNCED' | 'FAILED';
}

// Example events
{
  id: "evt-001",
  tenantId: "acme",
  eventType: "PRODUCTION_CREATED",
  aggregateId: "well-123",
  payload: {
    productionDate: "2025-10-20",
    oilVolume: 42.5,
    gasVolume: 120.0,
    waterVolume: 8.2,
  },
  timestamp: "2025-10-20T14:30:00Z",
  userId: "user-456",
  syncStatus: "PENDING"
}

{
  id: "evt-002",
  eventType: "EQUIPMENT_MAINTENANCE_LOGGED",
  aggregateId: "equip-789",
  payload: {
    maintenanceType: "REPAIR",
    description: "Replaced motor belt",
    photoPath: "/local/photos/uuid.jpg"  // Local path
  },
  timestamp: "2025-10-21T09:15:00Z",
  userId: "user-456",
  syncStatus: "PENDING"
}
```

### Local SQLite Schema

```sql
-- Event log (append-only, immutable)
CREATE TABLE event_log (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  payload TEXT NOT NULL,  -- JSON
  timestamp TEXT NOT NULL,
  user_id TEXT NOT NULL,
  sync_status TEXT DEFAULT 'PENDING',
  synced_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Sync status tracking
CREATE TABLE sync_queue (
  event_id TEXT PRIMARY KEY,
  retry_count INTEGER DEFAULT 0,
  last_error TEXT,
  next_retry_at TEXT,
  FOREIGN KEY (event_id) REFERENCES event_log(id)
);

-- Materialized views (reconstructed from events)
CREATE TABLE production_data (
  id TEXT PRIMARY KEY,
  well_id TEXT NOT NULL,
  production_date TEXT NOT NULL,
  oil_volume REAL,
  gas_volume REAL,
  water_volume REAL,
  created_at TEXT
);
```

### UI/UX Considerations

**Large Touch Targets**: Field operators often wear gloves
- Buttons: 60x60px minimum
- Form inputs: 50px height
- Spacing: 20px between elements

**Offline Indicator**: Always visible
```
┌─────────────────────────────────────┐
│  WellPulse Field Entry              │
│  🔴 Offline - 5 pending syncs       │
└─────────────────────────────────────┘
```

**Sync Queue Visibility**: Show pending actions
```
Pending Sync (5 items):
- Production entry for Well 123 (Oct 20)
- Equipment maintenance for Pump Jack 456 (Oct 21)
- 3 photos (2.4 MB total)
```

### Success Criteria

- [ ] Electron app runs on Windows 10/11 and macOS
- [ ] 100 production entries created offline
- [ ] 50 equipment maintenance logs with photos
- [ ] SQLite database < 100 MB (1000 events)
- [ ] Event log queryable for audit trail
- [ ] App startup time < 3 seconds

---

## Sprint 8: Mobile App & Sync (Weeks 15-16)

### Objectives

Build iOS/Android mobile app with GPS tagging, native camera integration, and implement batch sync service for Electron + Mobile.

### Deliverables

1. **React Native Mobile App** (iOS/Android)
   - Expo SDK 50+ (managed workflow)
   - AsyncStorage + expo-sqlite
   - Native camera access
   - GPS location tagging
   - Offline-first architecture

2. **GPS Location Tagging**
   - Capture GPS coordinates for production entries
   - Geofence validation (warn if >500ft from well)
   - Location accuracy indicator
   - Automatic location capture (opt-in)

3. **Native Camera Integration**
   - Take photo with device camera
   - Photo preview before saving
   - Compress image (max 2 MB)
   - Store locally until synced

4. **Batch Sync Service** (Backend)
   - `POST /sync/batch` - Accept array of events
   - Idempotent processing (duplicate event IDs ignored)
   - Conflict detection (same well, same date)
   - Photo upload coordination

5. **Conflict Resolution**
   - Last-write-wins (default)
   - User prompt (if conflict detected)
   - Merge strategy (for non-overlapping fields)

### Mobile App Architecture

```
┌─────────────────────────────────────────────────────────┐
│              React Native Mobile App                    │
├─────────────────────────────────────────────────────────┤
│  Presentation Layer:                                    │
│    - Screens (ProductionEntry, EquipmentList, etc.)     │
│    - Components (WellCard, PhotoPicker, etc.)           │
│                                                          │
│  Business Logic Layer:                                  │
│    - Event creators (createProductionEvent)             │
│    - Sync coordinator (batchSync, conflict resolver)    │
│                                                          │
│  Data Layer:                                            │
│    - SQLite (expo-sqlite)                               │
│    - AsyncStorage (user preferences, auth tokens)       │
│    - FileSystem (local photo storage)                   │
│                                                          │
│  Native Integrations:                                   │
│    - expo-location (GPS)                                │
│    - expo-camera (native camera)                        │
│    - expo-file-system (file management)                 │
└─────────────────────────────────────────────────────────┘
```

### GPS Location Tagging Example

```typescript
// Capture location when creating production entry
import * as Location from 'expo-location';

const captureProductionData = async (wellId: string, data: ProductionData) => {
  // Request location permission
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    // Proceed without location
    return createEvent('PRODUCTION_CREATED', { ...data, location: null });
  }

  // Get current location
  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });

  // Get well location from local DB
  const well = await getWellById(wellId);

  // Calculate distance
  const distance = calculateDistance(
    { lat: location.coords.latitude, lon: location.coords.longitude },
    { lat: well.latitude, lon: well.longitude },
  );

  // Warn if >500ft from well
  if (distance > 500) {
    const proceed = await Alert.alert(
      'Location Warning',
      `You are ${Math.round(distance)}ft from this well. Continue?`,
      [{ text: 'Cancel' }, { text: 'Continue', onPress: () => true }],
    );
    if (!proceed) return;
  }

  // Create event with location
  return createEvent('PRODUCTION_CREATED', {
    ...data,
    location: {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy,
      timestamp: location.timestamp,
    },
  });
};
```

### Batch Sync API

```typescript
// POST /sync/batch
interface BatchSyncRequest {
  events: Event[];
  photos: PhotoUpload[];
}

interface PhotoUpload {
  eventId: string;        // Reference to event
  localPath: string;      // For logging only
  base64Data: string;     // Photo as base64
  filename: string;
  contentType: string;
}

interface BatchSyncResponse {
  synced: string[];       // Event IDs successfully synced
  conflicts: Conflict[];  // Events with conflicts
  failed: Failed[];       // Events that failed
}

interface Conflict {
  eventId: string;
  reason: string;         // e.g., "Production data already exists for 2025-10-20"
  existingData: any;      // Server's current data
  incomingData: any;      // Client's data
  resolution: 'MERGE' | 'OVERWRITE' | 'SKIP' | 'USER_PROMPT';
}
```

### Conflict Resolution Strategy

**Scenario 1: Same production date entered on multiple devices**

```
Device A (Electron):  Oct 20 - 42.5 bbls oil
Device B (Mobile):    Oct 20 - 45.0 bbls oil

Resolution: Last-write-wins (timestamp)
Result: 45.0 bbls (if Mobile synced later)
```

**Scenario 2: Equipment maintenance logged offline, equipment deleted online**

```
Offline:  Maintenance logged for Equipment 123
Online:   Equipment 123 deleted

Resolution: Reject maintenance log, notify user
Result: Failed sync, user must re-enter or skip
```

**Scenario 3: Non-overlapping fields (merge possible)**

```
Electron: Production entry with oil/gas volumes
Mobile:   Same date, updated notes field

Resolution: Merge
Result: Oil/gas from Electron + notes from Mobile
```

### Mobile UI/UX

**Home Screen**:
```
┌─────────────────────────────────────┐
│  WellPulse Field Entry              │
│  ✅ Online - All synced             │
│  📍 Location: Enabled               │
├─────────────────────────────────────┤
│  Quick Actions:                     │
│  [ Enter Production ]               │
│  [ Log Maintenance ]                │
│  [ Take Photo ]                     │
├─────────────────────────────────────┤
│  My Wells (5):                      │
│  ├─ Acme Well #1 (42-165-12345)    │
│  ├─ Acme Well #2 (42-165-12346)    │
│  └─ ...                             │
└─────────────────────────────────────┘
```

**Production Entry Screen**:
```
┌─────────────────────────────────────┐
│  ← Enter Production                 │
├─────────────────────────────────────┤
│  Well: Acme Well #1                 │
│  Date: Oct 23, 2025                 │
│                                     │
│  Oil (bbls):   [___________]        │
│  Gas (MCF):    [___________]        │
│  Water (bbls): [___________]        │
│                                     │
│  📍 Location: 31.8457, -102.3676   │
│      (125ft from well)              │
│                                     │
│  Notes: [____________________]      │
│                                     │
│  [ Cancel ]      [ Save Entry ]     │
└─────────────────────────────────────┘
```

### Success Criteria

- [ ] Mobile app runs on iOS 15+ and Android 10+
- [ ] GPS tagging captures coordinates with <50ft accuracy
- [ ] Camera captures and compresses photos to <2 MB
- [ ] Batch sync handles 100 events in <10 seconds
- [ ] Conflict resolution prompts user when needed
- [ ] 500 production records entered via mobile (test)
- [ ] 100 maintenance logs with GPS-tagged photos

---

## Phase 2 Integration & Testing

### Integration Points

```
┌─────────────────────────────────────────────────────────┐
│                   Phase 2 Data Flow                     │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Field Operator (Electron)                              │
│       │                                                  │
│       ├─ Enters production data offline                 │
│       ├─ Logs equipment maintenance                     │
│       ├─ Takes photos (webcam/upload)                   │
│       └─ Events stored in local SQLite                  │
│                                                          │
│  Field Operator (Mobile)                                │
│       │                                                  │
│       ├─ Enters production data with GPS                │
│       ├─ Logs maintenance with native camera            │
│       └─ Events stored in expo-sqlite                   │
│                                                          │
│       [When internet available]                         │
│                 │                                        │
│                 ├─ POST /sync/batch                     │
│                 │   (100 events, 10 photos)             │
│                 ↓                                        │
│                                                          │
│  API (Batch Sync Service)                               │
│       │                                                  │
│       ├─ Validate events (idempotency)                  │
│       ├─ Detect conflicts                               │
│       ├─ Process photos (upload to Azure Blob)          │
│       ├─ Apply events to PostgreSQL                     │
│       └─ Return sync results                            │
│                                                          │
│       [Updates Web Dashboard]                           │
│                 │                                        │
│                 ↓                                        │
│                                                          │
│  Web Dashboard                                          │
│       │                                                  │
│       ├─ Production charts update (React Query)         │
│       ├─ Equipment status refreshes                     │
│       └─ Manager sees real-time field data              │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### End-to-End Test Scenarios

**Test 1: Offline Production Entry → Sync → Web Visualization**

1. Disconnect Electron app from internet
2. Enter 7 days of production data for Well #1
3. Reconnect to internet
4. Trigger sync (manual or automatic)
5. Verify 7 records appear in Web dashboard
6. Verify production chart updates correctly

**Test 2: Multi-Device Conflict Resolution**

1. Enter production for Oct 20 on Electron (42.5 bbls)
2. Sync Electron data
3. Offline on Mobile, enter production for Oct 20 (45.0 bbls)
4. Sync Mobile data
5. Verify conflict detected
6. Verify last-write-wins (or user prompted)
7. Verify final data matches expected resolution

**Test 3: GPS-Tagged Maintenance with Photos**

1. Use mobile app at well location
2. Log equipment maintenance
3. Take 3 photos with native camera
4. Verify GPS coordinates captured
5. Sync to cloud
6. Verify photos appear in Web dashboard
7. Verify GPS coordinates display on map

**Test 4: Large Sync (100 events, 50 photos)**

1. Create 100 production/maintenance events offline
2. Capture 50 photos (total 75 MB)
3. Trigger sync
4. Verify all events synced successfully
5. Verify sync completes in <60 seconds
6. Verify no data loss or corruption

### Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| **Electron app startup** | < 3 seconds | Cold start on Windows 10 |
| **Mobile app startup** | < 2 seconds | iOS/Android |
| **SQLite write** | < 10ms | Single event insert |
| **SQLite query** | < 50ms | 1000 events |
| **Batch sync (100 events)** | < 10 seconds | No photos |
| **Batch sync (10 photos)** | < 30 seconds | 10 MB total |
| **Photo upload** | < 5 seconds | 2 MB photo to Azure Blob |
| **Production chart render** | < 1 second | 90 days of data |

### Security Considerations

**Electron App**:
- Encrypt SQLite database (sqlite-cipher)
- Store JWT tokens in secure storage (electron-store with encryption)
- Auto-lock after 15 minutes of inactivity
- Require re-authentication on app restart

**Mobile App**:
- Encrypt AsyncStorage (expo-secure-store)
- Biometric authentication (FaceID, TouchID, fingerprint)
- Certificate pinning (prevent MITM attacks)
- Disable screenshots for sensitive screens

**Batch Sync**:
- JWT authentication required
- Rate limiting (10 sync requests per minute per user)
- Event signature verification (HMAC)
- Idempotency keys (prevent duplicate processing)

---

## Phase 2 Success Metrics

### User Success

- [ ] 500 production records entered (online + offline)
- [ ] Electron app syncs 100% of offline data
- [ ] Mobile app tested on 5 iOS + 5 Android devices
- [ ] Conflict resolution handles 20 test scenarios
- [ ] Field operators report <1 minute training time (intuitive UI)

### Technical Success

- [ ] Event sourcing pattern correctly implemented
- [ ] SQLite databases remain <100 MB (1000 events)
- [ ] Batch sync handles 100 events in <10 seconds
- [ ] Zero data loss across sync operations
- [ ] GPS accuracy <50 feet
- [ ] Photo compression reduces size by 70%

### Performance Success

- [ ] Electron app startup <3 seconds
- [ ] Mobile app startup <2 seconds
- [ ] Production chart renders in <1 second
- [ ] Batch sync completes in <60 seconds (100 events + 50 photos)

---

## Risk Management

### High Risks 🔴

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|-----------|
| **Offline sync conflicts underestimated** | High | Medium | Prototype conflict resolution in Sprint 7, iterate based on user feedback |
| **SQLite performance degrades with large datasets** | High | Low | Implement pagination, archiving (>6 months old), and database vacuuming |
| **Mobile app store rejection** | Medium | Low | Follow Apple/Google guidelines strictly, avoid prohibited features |
| **GPS accuracy insufficient** | Medium | Medium | Test in real field locations, fallback to manual location entry |

### Medium Risks 🟡

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|-----------|
| **Electron app size too large (>500 MB)** | Medium | Medium | Use electron-builder compression, exclude unnecessary assets |
| **React Native version compatibility** | Medium | Low | Lock dependencies, test on multiple iOS/Android versions |
| **Photo storage costs exceed budget** | Low | Medium | Implement image compression, lifecycle management (archive after 1 year) |

### Low Risks 🟢

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|-----------|
| **Users forget to sync** | Low | Medium | Implement auto-sync on network detection, sync reminders |
| **Camera permissions denied** | Low | Medium | Graceful fallback to file upload, clear permission prompts |

---

## Documentation & Patterns

### Relevant Patterns

- [Pattern 69: Database-Per-Tenant Multi-Tenancy](../patterns/69-Database-Per-Tenant-Multi-Tenancy-Pattern.md)
- [Pattern 70: Offline Batch Sync](../patterns/70-Offline-Batch-Sync-Pattern.md)
- [Pattern 71: Conflict Resolution](../patterns/71-Conflict-Resolution-Pattern.md)
- [Pattern 49: Event Sourcing](../patterns/49-Event-Sourcing-Pattern.md)
- [Pattern 44: File Upload/Download](../patterns/44-File-Upload-Download-Patterns.md)

### Sprint Documentation

- [Sprint 5: Production Tracking](../sprints/sprint-05-production-tracking.md) *(to be created)*
- [Sprint 6: Equipment Management](../sprints/sprint-06-equipment-management.md) *(to be created)*
- [Sprint 7: Electron Offline App](../sprints/sprint-07-electron-app.md) *(to be created)*
- [Sprint 8: Mobile App & Sync](../sprints/sprint-08-mobile-sync.md) *(to be created)*

---

## Next Steps

After Phase 2 completion, proceed to **Phase 3: Intelligence & Scale** (Weeks 17-24):

- Sprint 9: ML Service & ESG Compliance
- Sprint 10: Admin Portal & Production Deployment

See [Phase 3: Intelligence & Scale](./phase-3-intelligence.md) for details.

---

**Phase 2 Complete**: Field operators can enter production/equipment data offline on desktop and mobile, with automatic sync when online. Foundation ready for ML predictions and production deployment.
