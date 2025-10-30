# Electron Field Data Entry Feature Specification (apps/electron)

**Version**: 1.0
**Last Updated**: October 23, 2025
**Tech Stack**: Electron, React 19, Tailwind CSS 4, SQLite (local database), React Query

---

## Overview

The WellPulse Electron app is a **desktop application for laptop-based field data entry** at remote oil & gas well sites. Designed for harsh field environments with unreliable or no internet connectivity, the app provides a **fully offline-first experience** with batch synchronization when connectivity is available.

**Target Users**: Field operators, lease operators, pumpers, production technicians

**Use Cases:**

- Record daily production data (oil, gas, water) at well sites
- Log equipment inspections and maintenance activities
- Capture equipment photos and notes
- Record pressure and temperature readings
- Document safety incidents
- Track field activities and time spent

**Key Features:**

- Works 100% offline (internet not required during field work)
- Local SQLite database stores all data
- Automatic sync when internet connection detected
- Conflict resolution when multiple operators work on same well
- Large touch-friendly buttons for gloved hands
- Rugged UI design for outdoor visibility (high contrast)

---

## Architecture

### Local Data Storage (SQLite)

```
local_database.db
├── wells (synced from cloud)
├── equipment (synced from cloud)
├── production_records (local + synced)
├── field_events (append-only event log)
├── maintenance_logs
├── photos (file paths, actual files in local folder)
├── sync_queue (pending events to upload)
├── conflicts (unresolved data conflicts)
└── device_info (device ID, last sync time)
```

**Event Sourcing Pattern**: All field data entries are stored as immutable events in `field_events` table. This enables:

- Complete audit trail
- Conflict detection and resolution
- Batch sync with retry logic

### Offline-First Sync Strategy

```
Field Operator Workflow:
1. Launch app → Check for sync (if online)
2. Work offline all day → Write to local SQLite
3. End of shift → Connect to internet → Automatic batch sync
4. Conflicts detected → Operator resolves via UI
5. Sync complete → Data appears in cloud dashboard
```

**Sync Modes:**

- **Automatic sync**: When internet detected (WiFi, mobile hotspot)
- **Manual sync**: Operator clicks "Sync Now" button
- **Scheduled sync**: Every 4 hours if online (background)

---

## Core Features

### 1. Authentication & Login

**Triple-Credential Authentication:**

Desktop apps use the same three-layer security system as mobile apps:

1. **X-Tenant-ID Header** (Format: `DEMO-A5L32W`)
   - Public identifier for the tenant
   - Stored in encrypted electron-store after first login
   - Included in all API requests

2. **X-Tenant-Secret Header** (Server-issued credential)
   - Received ONCE during first login
   - Stored in Electron's `safeStorage` API (OS-level encryption - Keychain on macOS, Credential Vault on Windows, Secret Service on Linux)
   - Never logged or displayed in app UI
   - Rotatable by super admin if device compromised

3. **User Email/Password + JWT** (Standard authentication)
   - User-specific credentials
   - JWT access token (15 min expiration)
   - JWT refresh token (7 day expiration, stored in encrypted storage)

**Offline-First Login:**

- First-time login requires internet (download tenant data + receive tenant secret)
- Subsequent logins work offline (cached credentials validated locally)
- All three credentials cached in encrypted storage
- Remember device option (auto-login with cached credentials)

**Login Screen:**

```
┌─────────────────────────────────────┐
│         WellPulse Field App         │
│                                     │
│  Email:    [___________________]   │
│  Password: [___________________]   │
│                                     │
│  [x] Remember this device           │
│                                     │
│  [        Log In        ]           │
│                                     │
│  Connection: ● Online               │
│             (or ● Offline)          │
└─────────────────────────────────────┘
```

**Security:**

- Triple-credential authentication (X-Tenant-ID + X-Tenant-Secret + User JWT)
- Tenant Secret stored using Electron's safeStorage API (OS-level encryption)
- JWT tokens stored in encrypted electron-store
- Auto-logout after 12 hours of inactivity (field shift length)
- PIN code option for quick re-auth (4-digit, unlocks cached credentials)

---

### 2. Home Dashboard

**Purpose**: Quick overview of daily work and sync status

```
┌─────────────────────────────────────────────────┐
│ WellPulse Field App        [Sync] [Profile] [•••] │
├─────────────────────────────────────────────────┤
│                                                 │
│  Good morning, John! ☀️                         │
│  October 23, 2025 | Tuesday                    │
│                                                 │
│  Sync Status: ● Offline                        │
│  Last sync: 8 hours ago (7:00 AM)              │
│  Pending sync: 12 records                      │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │     Today's Production: 0/15 wells      │   │
│  ├─────────────────────────────────────────┤   │
│  │  Wells recorded: 0                       │   │
│  │  Wells remaining: 15                     │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │          Quick Actions                  │   │
│  ├─────────────────────────────────────────┤   │
│  │  [  📋 Record Production  ]             │   │
│  │  [  🔧 Log Maintenance    ]             │   │
│  │  [  📸 Take Equipment Photo ]           │   │
│  │  [  ⚠️  Report Issue       ]             │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │       Recent Activity                   │   │
│  ├─────────────────────────────────────────┤   │
│  │  9:15 AM  Production recorded (Well #3)│   │
│  │  9:30 AM  Maintenance logged (Pump #12)│   │
│  │  10:00 AM Photo captured (Tank #5)      │   │
│  └─────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

**Features:**

- Sync status indicator (online/offline, pending count)
- Daily production progress (wells completed vs. total)
- Quick action buttons (large, touch-friendly)
- Recent activity feed (last 10 actions)

---

### 3. Wells List (Offline Data)

**Purpose**: Browse wells assigned to operator (synced from cloud)

```
┌─────────────────────────────────────────────────┐
│ ← Back                    Wells (15 total)       │
├─────────────────────────────────────────────────┤
│  🔍 Search:  [______________]  [Filter ▼]       │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │ 🟢 Smith Ranch #3            ACTIVE      │   │
│  │ API: 42-165-12345           ✓ Recorded  │   │
│  │ Lease: Smith Ranch  |  Oil well         │   │
│  │ Last production: Today 9:15 AM          │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │ 🟢 Jones Lease #7            ACTIVE      │   │
│  │ API: 42-165-67890           ⏱ Pending   │   │
│  │ Lease: Jones Lease  |  Gas well         │   │
│  │ Last production: Yesterday              │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  [... 13 more wells ...]                       │
│                                                 │
│  [Load More]                                    │
└─────────────────────────────────────────────────┘
```

**Features:**

- Offline search (local SQLite query)
- Filter by lease, status, recorded today
- Status badges: ✓ Recorded today, ⏱ Pending, ⚠️ Issue reported
- Tap well to view details or record production

**Data Sync:**

- Wells synced from cloud on app launch (if online)
- Stored locally in SQLite for offline access
- Updated during daily sync

---

### 4. Record Production (Core Feature)

**Purpose**: Capture daily production data for a well

**Flow**: Wells List → Select Well → Record Production

```
┌─────────────────────────────────────────────────┐
│ ← Back           Record Production              │
├─────────────────────────────────────────────────┤
│                                                 │
│  Well: Smith Ranch #3                          │
│  API: 42-165-12345                             │
│  Date: October 23, 2025                        │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │ Oil Production (barrels)                │   │
│  │ [____________] bbl                      │   │
│  │                                          │   │
│  │ Large numpad for easy entry:            │   │
│  │ ┌───┬───┬───┐                          │   │
│  │ │ 1 │ 2 │ 3 │                          │   │
│  │ ├───┼───┼───┤                          │   │
│  │ │ 4 │ 5 │ 6 │                          │   │
│  │ ├───┼───┼───┤                          │   │
│  │ │ 7 │ 8 │ 9 │                          │   │
│  │ ├───┼───┼───┤                          │   │
│  │ │ . │ 0 │ ⌫ │                          │   │
│  │ └───┴───┴───┘                          │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  Gas Production (mcf)                          │
│  [____________] mcf                            │
│                                                 │
│  Water Production (barrels)                    │
│  [____________] bbl                            │
│                                                 │
│  Runtime (hours)                               │
│  [____________] hrs                            │
│                                                 │
│  ─────────────────────────────────────────     │
│  Pressure Readings (Optional)                  │
│  ─────────────────────────────────────────     │
│                                                 │
│  Tubing Pressure: [____] psi                   │
│  Casing Pressure: [____] psi                   │
│  Line Pressure:   [____] psi                   │
│                                                 │
│  ─────────────────────────────────────────     │
│  Notes (Optional)                              │
│  ─────────────────────────────────────────     │
│                                                 │
│  [_____________________________________]       │
│  [_____________________________________]       │
│                                                 │
│  [Add Photo]  [Record Voice Note]              │
│                                                 │
│  [        Save Production Record        ]      │
│                                                 │
│  Saved locally. Will sync when online.         │
└─────────────────────────────────────────────────┘
```

**Features:**

- Large input fields (easy for gloved hands)
- Custom numpad (faster than keyboard)
- Auto-save draft (prevent data loss)
- Photo attachment (stored locally, synced later)
- Voice notes (transcribed to text if online, stored as audio if offline)
- Validation: Required fields, reasonable ranges
- Timestamp capture (exact time of reading)

**Local Storage:**

```javascript
// Stored as event in field_events table
{
  id: "event-uuid-123",
  type: "PRODUCTION_RECORDED",
  wellId: "well-456",
  timestamp: "2025-10-23T09:15:00Z",
  deviceId: "laptop-789",
  userId: "operator-012",
  payload: {
    date: "2025-10-23",
    oil: 45.5,
    gas: 123.0,
    water: 12.3,
    runtime: 24.0,
    pressures: { tubing: 350, casing: 200, line: 50 },
    notes: "Pump running smoothly",
    photos: ["photo-abc.jpg"],
  },
  synced: false,
  syncAttempts: 0,
}
```

---

### 5. Log Maintenance

**Purpose**: Record equipment maintenance activities

```
┌─────────────────────────────────────────────────┐
│ ← Back             Log Maintenance              │
├─────────────────────────────────────────────────┤
│                                                 │
│  Equipment: Pump Jack #12                      │
│  Well: Smith Ranch #3                          │
│  Date: October 23, 2025                        │
│                                                 │
│  Maintenance Type *                            │
│  ○ Preventive (scheduled)                      │
│  ● Corrective (repair)                         │
│  ○ Inspection only                             │
│                                                 │
│  Issue Description *                           │
│  [_____________________________________]       │
│  [_____________________________________]       │
│  [_____________________________________]       │
│                                                 │
│  Action Taken *                                │
│  [_____________________________________]       │
│  [_____________________________________]       │
│  [_____________________________________]       │
│                                                 │
│  Parts Replaced                                │
│  [+ Add Part]                                  │
│  │                                              │
│  ├─ Bearing (Qty: 2)           [Remove]       │
│  └─ Belt (Qty: 1)               [Remove]       │
│                                                 │
│  Time Spent (hours)                            │
│  [____] hrs                                    │
│                                                 │
│  Cost (optional)                               │
│  $[________]                                   │
│                                                 │
│  Photos                                        │
│  ┌────────┐ ┌────────┐ [+ Add Photo]          │
│  │ Before │ │ After  │                        │
│  │ photo  │ │ photo  │                        │
│  └────────┘ └────────┘                        │
│                                                 │
│  [      Save Maintenance Log      ]            │
└─────────────────────────────────────────────────┘
```

**Features:**

- Maintenance type selection (preventive/corrective/inspection)
- Issue and action text areas
- Parts inventory tracking
- Time and cost logging
- Before/after photos (stored locally)
- Timestamp and operator signature

---

### 6. Equipment Photo Capture

**Purpose**: Document equipment condition with photos

**Features:**

- Native camera integration (if laptop has webcam)
- Or file upload from external camera/phone
- Photo annotations (draw arrows, add text notes)
- Auto-tag with GPS location (if available)
- Auto-tag with well/equipment name
- Compress images for faster sync (reduce file size)

**Photo Storage:**

- Original photos: `~/.wellpulse/photos/original/`
- Compressed for sync: `~/.wellpulse/photos/compressed/`
- SQLite stores file paths + metadata
- Synced to Azure Blob Storage when online

---

### 7. Sync Management

**Purpose**: Control when and how data syncs to cloud

**Sync Screen:**

```
┌─────────────────────────────────────────────────┐
│ ← Back               Sync Status                │
├─────────────────────────────────────────────────┤
│                                                 │
│  Connection Status: ● Online                   │
│  Signal Strength: ████░ Good                   │
│                                                 │
│  Last Sync: 8 hours ago (7:00 AM)              │
│  Next Auto-Sync: When online                   │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │      Pending Sync (12 items)            │   │
│  ├─────────────────────────────────────────┤   │
│  │  Production records:       8            │   │
│  │  Maintenance logs:         2            │   │
│  │  Photos:                   2            │   │
│  │                                          │   │
│  │  Estimated upload size: 15.3 MB        │   │
│  │  Estimated time: ~2 minutes             │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  [       Sync Now       ]                      │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │      Sync History                       │   │
│  ├─────────────────────────────────────────┤   │
│  │  ✓ Synced 8 items    | Today 7:00 AM   │   │
│  │  ✓ Synced 15 items   | Yesterday 6:30 PM│   │
│  │  ⚠️ 2 conflicts      | Oct 21 5:00 PM  │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │      Sync Settings                      │   │
│  ├─────────────────────────────────────────┤   │
│  │  [x] Auto-sync when online              │   │
│  │  [x] Sync only on WiFi (save data)     │   │
│  │  [ ] Sync photos immediately            │   │
│  │  [x] Compress photos before sync        │   │
│  └─────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

**Sync Process:**

1. Check internet connectivity
2. Fetch latest well/equipment data from cloud (delta sync)
3. Upload pending events batch
4. Detect conflicts (server-side)
5. Display conflicts for resolution (if any)
6. Mark synced events as complete
7. Show sync success notification

**Conflict Resolution:**

- If conflict detected → Pause sync, show conflict screen
- Operator chooses resolution strategy:
  - Use my data (local wins)
  - Use server data (server wins)
  - Manual merge (review both, create hybrid)
- Resume sync after resolution

---

### 8. Conflict Resolution Screen

**Purpose**: Resolve data conflicts when multiple operators edit same record

```
┌─────────────────────────────────────────────────┐
│ ← Back           Data Conflicts (2)             │
├─────────────────────────────────────────────────┤
│                                                 │
│  Conflict 1 of 2                               │
│                                                 │
│  Well: Smith Ranch #3                          │
│  Date: October 22, 2025                        │
│  Field: Oil Production                         │
│                                                 │
│  ┌─────────────────┬─────────────────┐         │
│  │  Your Data      │  Server Data    │         │
│  ├─────────────────┼─────────────────┤         │
│  │  45.5 bbl       │  47.2 bbl       │         │
│  │  9:15 AM today  │  10:30 AM today │         │
│  │  (newer)        │  (older)        │         │
│  └─────────────────┴─────────────────┘         │
│                                                 │
│  Recommended: Use your data (newer timestamp)  │
│                                                 │
│  Choose Resolution:                            │
│  ○ Use my data (45.5 bbl)                     │
│  ○ Use server data (47.2 bbl)                 │
│  ○ Manual entry: [_____] bbl                  │
│                                                 │
│  [    Resolve Conflict    ]                    │
│                                                 │
│  [Next Conflict →]  [Skip for Now]            │
└─────────────────────────────────────────────────┘
```

**Conflict Resolution Strategies (Auto-Applied When Possible):**

- **Newest Wins**: For sensor readings (default)
- **Highest Value**: For production volumes (regulatory requirement)
- **Manual Review**: For safety-critical data (always)

---

### 9. Settings

**Purpose**: Configure app behavior and sync preferences

**Settings Screen:**

```
┌─────────────────────────────────────────────────┐
│ ← Back               Settings                   │
├─────────────────────────────────────────────────┤
│                                                 │
│  Account                                       │
│  ─────────────────────────────────────────     │
│  Name: John Doe                                │
│  Email: john.doe@acmeoil.com                   │
│  Role: Field Operator                          │
│  [Change Password]  [Log Out]                  │
│                                                 │
│  Sync Settings                                 │
│  ─────────────────────────────────────────     │
│  [x] Auto-sync when online                     │
│  [x] Sync only on WiFi                         │
│  [ ] Sync photos immediately                   │
│  [x] Compress photos                           │
│  Sync frequency: [Every 4 hours ▼]            │
│                                                 │
│  Display Settings                              │
│  ─────────────────────────────────────────     │
│  Theme: [Light ▼] (Dark, High Contrast)       │
│  Font size: [Large ▼] (Small, Medium, Large)  │
│  [x] Large buttons (for gloves)               │
│                                                 │
│  Data Management                               │
│  ─────────────────────────────────────────     │
│  Local storage used: 245 MB                    │
│  [Clear Cache]  [Export Local Data]            │
│                                                 │
│  Device Info                                   │
│  ─────────────────────────────────────────     │
│  Device ID: laptop-789                         │
│  App Version: 1.0.0                            │
│  Last Sync: 8 hours ago                        │
│  [Check for Updates]                           │
└─────────────────────────────────────────────────┘
```

---

## Technical Implementation

### Electron Main Process

**Responsibilities:**

- Window management (main window, modals)
- SQLite database operations (via better-sqlite3)
- File system operations (photo storage)
- Auto-updater (for app updates)
- System tray icon (background sync indicator)
- Inter-process communication (IPC) with renderer

### Electron Renderer Process (React)

**Responsibilities:**

- UI rendering (React components)
- User interactions (forms, navigation)
- Local state management (Zustand)
- Data fetching (React Query with local SQLite adapter)
- Photo capture (navigator.mediaDevices API)

### Local Database Schema (SQLite)

```sql
CREATE TABLE wells (
  id TEXT PRIMARY KEY,
  api_number TEXT NOT NULL,
  name TEXT NOT NULL,
  lease TEXT,
  status TEXT,
  location_lat REAL,
  location_lng REAL,
  synced_at DATETIME,
  UNIQUE(api_number)
);

CREATE TABLE field_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL, -- PRODUCTION_RECORDED, MAINTENANCE_LOGGED, etc.
  well_id TEXT,
  equipment_id TEXT,
  timestamp DATETIME NOT NULL,
  device_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  payload JSON NOT NULL, -- Event data as JSON
  synced BOOLEAN DEFAULT 0,
  sync_attempts INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE photos (
  id TEXT PRIMARY KEY,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  compressed_path TEXT,
  event_id TEXT, -- Link to field_event
  well_id TEXT,
  equipment_id TEXT,
  synced BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE conflicts (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  local_data JSON,
  server_data JSON,
  resolution_strategy TEXT,
  resolved BOOLEAN DEFAULT 0,
  resolved_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE device_info (
  key TEXT PRIMARY KEY,
  value TEXT
);
-- Stores: device_id, last_sync_time, user_id, auth_token, etc.
```

### Sync API Integration

```typescript
// Batch sync endpoint
POST /field-data/sync
Body:
{
  deviceId: "laptop-789",
  events: [
    {
      id: "event-uuid-123",
      type: "PRODUCTION_RECORDED",
      wellId: "well-456",
      timestamp: "2025-10-23T09:15:00Z",
      payload: { oil: 45.5, gas: 123.0, ... },
    },
    // ... more events
  ],
  photos: [
    {
      id: "photo-abc",
      eventId: "event-uuid-123",
      base64Data: "...", // Or multipart upload
    },
  ],
}

Response:
{
  success: true,
  syncedEvents: ["event-uuid-123", ...],
  conflicts: [
    {
      eventId: "event-uuid-456",
      localData: { oil: 45.5 },
      serverData: { oil: 47.2 },
      recommendedStrategy: "NEWEST_WINS",
    },
  ],
}
```

---

## Performance & Optimization

### Startup Performance

- Load critical data first (wells, equipment)
- Lazy load sync history, settings
- Cache React components for faster navigation

### Database Performance

- Index on `well_id`, `timestamp`, `synced` columns
- Vacuum database weekly (cleanup)
- Limit local storage to last 30 days (archive older data)

### Photo Optimization

- Compress photos to < 1MB each (JPEG quality 80%)
- Generate thumbnails for UI display (< 100KB)
- Upload compressed versions, keep originals locally

### Battery Optimization

- Reduce background sync frequency on battery power
- Disable auto-sync if battery < 20%
- Low-power mode available in settings

---

## Security

### Data Encryption

- SQLite database encrypted (SQLCipher)
- Triple-credential authentication (X-Tenant-ID + X-Tenant-Secret + User JWT)
- Tenant Secret stored using Electron's safeStorage API (OS-level keychain)
- JWT tokens encrypted in electron-store
- Photos encrypted at rest

### Authentication

**Triple-Credential System:**

- Layer 1: X-Tenant-ID (public identifier, stored encrypted)
- Layer 2: X-Tenant-Secret (server-issued, stored in OS keychain via safeStorage)
- Layer 3: User JWT (15 min access token, 7 day refresh token)

**Network Communication:**

- HTTPS only (certificate pinning for wellpulse.app)
- API Base URL: `https://api.wellpulse.app`
- All API requests include three headers:
  - `X-Tenant-ID`: Tenant identifier (e.g., DEMO-A5L32W)
  - `X-Tenant-Secret`: Server-issued credential (from OS keychain)
  - `Authorization`: Bearer JWT access token

**Offline Authentication:**

- Cached credentials allow offline login (validated against local hash)
- Offline JWT valid for up to 7 days (refresh token expiration)
- Re-authenticate when online to refresh tokens
- Optional PIN code for quick re-auth (4-digit, unlocks cached credentials)

### Audit Trail

- All local actions logged with timestamp
- Device ID tracked for multi-device audit
- Immutable event log (cannot be edited once created)

---

## Distribution

### Installation

- Windows: `.exe` installer (NSIS)
- macOS: `.dmg` disk image (code-signed)
- Linux: `.AppImage` or `.deb` package

### Auto-Updates

- Electron auto-updater checks for updates daily
- Download updates in background
- Prompt user to install on next launch
- Rollback capability if update fails

---

## Testing

- **Unit tests**: SQLite operations, sync logic, conflict resolution
- **Integration tests**: End-to-end workflows (record production → sync)
- **Offline tests**: Ensure full functionality without internet
- **Sync tests**: Test all conflict resolution strategies
- **UI tests**: Playwright for Electron

---

## Deployment

### Build Process

```bash
# Install dependencies
pnpm install

# Build React app
pnpm build:renderer

# Package Electron app
pnpm build:electron

# Generate installers
pnpm dist
```

### Distribution Channels

- Direct download from wellpulse.io/download
- Auto-update from GitHub Releases
- Microsoft Store (future)

---

## Related Documentation

- [Mobile Feature Specification](./mobile-feature-specification.md)
- [Offline Batch Sync Pattern](../patterns/70-Offline-Batch-Sync-Pattern.md)
- [Conflict Resolution Pattern](../patterns/71-Conflict-Resolution-Pattern.md)
- [API Feature Specification](./api-feature-specification.md)

---

**Next Steps:**

1. Set up Electron project structure
2. Implement SQLite database layer
3. Build core UI components (production form, sync screen)
4. Implement offline-first sync logic
5. Test in field conditions (no internet, poor connectivity)
