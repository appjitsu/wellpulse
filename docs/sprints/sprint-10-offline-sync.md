# Sprint 10 - Offline Sync & Resilience

**Phase:** Phase 2 (Post-MVP Foundation) - Final MVP Sprint
**Goal:** Enable mobile field workers to operate offline with automatic sync when connectivity returns

**Sprint Duration:** 1 week
**Estimated Hours:** 32 hours
**Start Date:** Post-Sprint 9

---

## Sprint Objectives

### Primary Goal

Implement robust offline-first architecture enabling field operators to enter data at remote well sites without connectivity, with automatic conflict-free synchronization when connectivity returns.

### Success Metrics

- [ ] Mobile app works fully offline (create/edit/delete field entries)
- [ ] Data persists locally in SQLite when offline
- [ ] Automatic sync when connectivity restored
- [ ] Sync completes without conflicts for 99% of cases
- [ ] Sync UI shows progress (X of Y entries synced)
- [ ] Sync completes for 100 entries in < 30 seconds
- [ ] Connection quality detection (2G, 3G, 4G, WiFi)

---

## User Stories

### US-1401: Offline Field Entry Creation

**As a** field operator
**I want** to create and edit well field entries offline
**So that** I can work at remote well sites without cellular connectivity

**Acceptance Criteria:**

- [ ] Create new field entry while offline (all fields optional)
- [ ] Edit existing field entry while offline
- [ ] Delete field entry while offline
- [ ] All data persists locally in SQLite
- [ ] UI shows offline indicator (red banner or icon)
- [ ] Form validation works offline
- [ ] Checklist state persists offline
- [ ] Media (photos, PDFs) downloaded locally for offline viewing
- [ ] Offline data visible in well detail screen
- [ ] Entries marked as "pending sync" in list view

**Technical Implementation:**

- **Frontend (React Native):**
  - Local database: SQLite with `@react-native-sqlite-storage/react-native-sqlite-storage`
  - Schema: Mirror backend schema (fields, wells, checklists)
  - Hooks: `useOfflineStorage()` for CRUD operations
  - Component: Offline banner showing sync status
  - Context: `OfflineContext` manages offline state

- **Local Storage Schema:**

  ```typescript
  // SQLite tables
  field_entries_local: {
    id: UUID,
    well_id: UUID,
    sync_status: 'pending' | 'synced' | 'error',
    data: JSON (all field values),
    created_at: timestamp,
    updated_at: timestamp,
    server_response: JSON (error details if failed)
  }
  
  wells_local: {
    id: UUID,
    name: string,
    data: JSON (well details)
  }
  ```

- **Sync Trigger:**
  - Manual: "Sync Now" button in UI
  - Automatic: Detect connectivity change + 30 second debounce

- **Backend Changes:**
  - No changes (receives normal API requests)

**Patterns Used:**

- [x] Offline-First Pattern
- [x] Local Storage Pattern
- [x] Sync Pattern

**Testing:**

- [ ] Unit tests for local storage CRUD
- [ ] Unit tests for offline detection
- [ ] Integration tests: create entry offline, verify in SQLite
- [ ] E2E test: disable network, create entry, verify offline indicator
- [ ] Data persistence test: kill app, reopen, verify data still there

**Estimation:** 7 hours

---

### US-1402: Bidirectional Sync with Conflict Resolution

**As a** sync service
**I want** to synchronize offline data with server without conflicts
**So that** operators can confidently work offline knowing data will merge correctly

**Acceptance Criteria:**

- [ ] Sync detects all local pending entries
- [ ] Upload pending entries to server (batch request)
- [ ] Download new entries from server that were created by other users
- [ ] Merge local + remote entries without losing data
- [ ] Conflict detection: if entry modified on both sides, use "last write wins"
- [ ] Conflict UI: Show conflicted entries with resolution options
- [ ] Mark synced entries as "synced" in local database
- [ ] On sync success, update local timestamps to match server
- [ ] Retry failed entries with exponential backoff
- [ ] Show sync progress: "Syncing 5 of 12 entries..."

**Technical Implementation:**

- **Frontend (React Native):**
  - Service: `SyncService` orchestrates bidirectional sync
  - Algorithm:
    1. Query local entries with `sync_status = 'pending'`
    2. Upload via `POST /field-entries/batch` (array of entries)
    3. On success, mark as synced in local DB
    4. On error, store error message, show retry button
    5. Query for new remote entries: `GET /field-entries?since=lastSyncTime`
    6. Merge into local DB (insert or update)
    7. Update `lastSyncTime` to current timestamp

- **Conflict Resolution:**
  - Detection: Compare server version timestamp with local timestamp
  - Strategy: "Last write wins" (server timestamp is source of truth)
  - User notification: Show conflicted entry with option to:
    - Keep local version
    - Use server version
    - Merge manually (show diff)

- **Retry Logic:**
  - Attempt 1: Immediate
  - Attempt 2: 5 second delay
  - Attempt 3: 30 second delay
  - Attempt 4: 2 minute delay
  - After 4 attempts, show error and manual retry button

- **Backend Changes:**
  - Endpoint: `POST /field-entries/batch` for bulk upload
  - Request: `{ entries: [...], deviceId: string }`
  - Response: `{ synced: [...], errors: [...] }`
  - Endpoint: `GET /field-entries?since=ISO8601_timestamp` for new entries
  - Returns: Entries modified since timestamp

**Patterns Used:**

- [x] Offline-First Synchronization Pattern
- [x] Conflict Resolution Pattern
- [x] Retry with Exponential Backoff Pattern

**Testing:**

- [ ] Unit tests for sync algorithm
- [ ] Unit tests for conflict detection
- [ ] Integration tests: mock offline scenario, verify sync
- [ ] E2E test: create offline, sync when online, verify server has data
- [ ] E2E test: conflict scenario (modify same entry offline + online)
- [ ] Network test: simulate connection loss during sync (should retry)

**Estimation:** 9 hours

---

### US-1403: Connection Quality Detection

**As a** sync service
**I want** to detect network connection type and quality
**So that** I can optimize sync behavior (reduce payload on poor connections)

**Acceptance Criteria:**

- [ ] Detect connection type: WiFi, Cellular (2G/3G/4G/5G), None
- [ ] Detect connection quality: Good (< 100ms latency), Fair, Poor (> 500ms)
- [ ] UI indicator showing connection status + quality
- [ ] Adjust sync behavior based on quality:
  - Good: Full sync (all data + media)
  - Fair: Reduced payload (skip media, sync essential only)
  - Poor: Minimal sync (essential data only, retry frequently)
- [ ] Show "Waiting for better connection" message if poor quality

**Technical Implementation:**

- **Frontend (React Native):**
  - Library: `react-native-netinfo` for connection detection
  - Hook: `useNetworkQuality()` monitors connection quality
  - Service: `ConnectionQualityService` rates connection

- **Connection Detection:**

  ```typescript
  const getConnectionType = () => {
    // 2G, 3G, 4G, 5G, WiFi, or none
  };
  
  const getConnectionQuality = async () => {
    // Ping server, measure latency
    // < 100ms: Good
    // 100-500ms: Fair
    // > 500ms: Poor
  };
  ```

- **Adaptive Sync:**
  - Good: Upload all data, download with media
  - Fair: Upload all data, download without media
  - Poor: Upload only critical fields, skip download

**Patterns Used:**

- [x] Adaptive Behavior Pattern
- [x] Quality-of-Service Pattern

**Testing:**

- [ ] Unit tests for connection detection
- [ ] Unit tests for quality rating
- [ ] Integration tests with network simulation
- [ ] E2E test: verify UI updates on connection change

**Estimation:** 5 hours

---

### US-1404: Sync Status Indicator & Manual Controls

**As a** field operator
**I want** to see sync status and manually control sync
**So that** I can ensure critical data is uploaded before leaving well site

**Acceptance Criteria:**

- [ ] Sync indicator shows status: "Synced", "Syncing (5 of 12)", "Error (3 failed)"
- [ ] Status bar colors: Green (synced), Blue (syncing), Red (errors)
- [ ] "Sync Now" button to manually trigger sync
- [ ] "Retry Failed" button appears when sync errors exist
- [ ] Show sync log with details: entry name, status, error message
- [ ] Disable "Sync Now" button if already syncing
- [ ] Show estimated time remaining during sync

**Technical Implementation:**

- **Frontend (React Native):**
  - Component: `SyncIndicator.tsx` shows status
  - Component: `SyncDialog.tsx` shows sync log details
  - State: Track `syncStatus`, `totalEntries`, `syncedCount`, `failedCount`
  - Hook: `useSyncStatus()` subscribes to sync updates

- **Sync Event Emitter:**

  ```typescript
  // Emit progress events
  syncService.on('sync:start', () => {});
  syncService.on('sync:progress', (synced, total) => {});
  syncService.on('sync:success', () => {});
  syncService.on('sync:error', (error) => {});
  ```

**Patterns Used:**

- [x] Observer Pattern (event emitter)
- [x] Progress Tracking Pattern
- [x] Error Handling Pattern

**Testing:**

- [ ] Component tests for SyncIndicator
- [ ] Component tests for SyncDialog
- [ ] E2E test: trigger sync, verify indicator updates
- [ ] E2E test: simulate sync error, verify retry button appears

**Estimation:** 5 hours

---

### US-1405: Media Offline Caching

**As a** field operator
**I want** to view and interact with well photos offline
**So that** I can reference previous well inspections at remote sites

**Acceptance Criteria:**

- [ ] Photos downloaded to device storage when created
- [ ] Photos accessible offline from well detail screen
- [ ] Compression: Photos stored at reduced resolution (500px x 500px)
- [ ] Manual cache clear: "Clear offline cache" button (frees storage)
- [ ] Show cached photo count and storage size used
- [ ] Attachments (PDFs, reports) also cached if < 10MB
- [ ] Sync media metadata (but not full files) if poor connectivity

**Technical Implementation:**

- **Frontend (React Native):**
  - Library: `react-native-fs` for file system access
  - Storage location: `DocumentsDirectory/wellpulse/media/`
  - Caching logic:
    1. On entry creation/edit with media: Download to local storage
    2. Store path in SQLite media table
    3. On view: Load from local path if exists, fallback to API
  - Image compression: `react-native-image-resizer`

- **Media Table (SQLite):**

  ```typescript
  media_local: {
    id: UUID,
    entry_id: UUID,
    url: string,
    local_path: string,
    sync_status: 'pending' | 'synced',
    size_bytes: number,
    created_at: timestamp
  }
  ```

**Patterns Used:**

- [x] Caching Pattern
- [x] Fallback Pattern

**Testing:**

- [ ] Unit tests for media caching logic
- [ ] Integration tests: download photo, verify in file system
- [ ] E2E test: view photo offline, verify displays from cache

**Estimation:** 4 hours

---

### US-1406: Data Validation & Integrity on Sync

**As a** backend service
**I want** to validate all synced entries before persisting
**So that** database integrity is maintained even with offline-created data

**Acceptance Criteria:**

- [ ] Server validates all fields per nominal ranges (if applicable)
- [ ] Reject entries missing required fields (500 error)
- [ ] Return validation errors in response (client retries after fix)
- [ ] Log all validation failures for audit
- [ ] Duplicate detection: Don't create duplicate entries if sync retried
- [ ] Timestamp validation: Reject entries with future timestamps
- [ ] Well ID validation: Ensure well belongs to tenant

**Technical Implementation:**

- **Backend Changes:**
  - Middleware: Validate all batch entries before processing
  - Schema validation: Use `class-validator` DTOs
  - Duplicate detection: Use unique constraint on `(well_id, created_at, field_hash)`
  - Error response:

    ```json
    {
      "status": 400,
      "errors": [
        {
          "entryId": "uuid",
          "field": "oil_volume",
          "message": "oil_volume exceeds nominal maximum of 500 BOPD"
        }
      ]
    }
    ```

- **Patterns Used:**
  - [x] Validation Pattern
  - [x] Idempotency Pattern (prevent duplicates on retry)

**Testing:**

- [ ] Unit tests for validation logic
- [ ] Integration tests: batch upload with invalid data
- [ ] E2E test: sync entry with validation error, fix, retry

**Estimation:** 2 hours

---

## Technical Tasks

### Backend

- [ ] Create batch upload endpoint: `POST /field-entries/batch`
- [ ] Implement field entry query by timestamp: `GET /field-entries?since=`
- [ ] Add validation to batch endpoint
- [ ] Implement idempotency key handling
- [ ] Add sync metrics/logging
- [ ] Create duplicate detection logic

### Frontend - Mobile

- [ ] Set up SQLite local database with schema
- [ ] Create `useOfflineStorage()` hook
- [ ] Create `SyncService` with bidirectional sync
- [ ] Implement conflict resolution UI
- [ ] Create `SyncIndicator` and `SyncDialog` components
- [ ] Set up offline banner component
- [ ] Implement connection quality detection
- [ ] Add media caching logic
- [ ] Create sync logs viewer

### Database

- [ ] Add `sync_status` column to field_entries table (if tracking server-side)
- [ ] Add indexes on `created_at`, `updated_at` for sync queries

### DevOps

- [ ] Monitor batch endpoint performance (should handle 100+ entries)
- [ ] Set up sync error logging and alerting
- [ ] Configure database backup strategy (important given offline sync)

---

## Dependencies

### Blockers

- [ ] Sprint 9 must complete (user context needed for offline sync)
- [ ] Nominal ranges from Sprint 4 needed (for validation)

### External Dependencies

- [ ] `@react-native-sqlite-storage/react-native-sqlite-storage` npm package
- [ ] `react-native-netinfo` npm package
- [ ] `react-native-fs` npm package
- [ ] `react-native-image-resizer` npm package

---

## Definition of Done

### Code Quality

- [ ] TypeScript strict mode (no `any`)
- [ ] Lint passes
- [ ] Type check passes
- [ ] Build succeeds

### Testing

- [ ] Unit tests >80% coverage (sync logic, conflict resolution)
- [ ] Integration tests for batch upload
- [ ] E2E tests for complete offline workflow
- [ ] Network simulation tests (offline, poor connection, recovery)
- [ ] Data integrity tests (verify no duplicates on retry)

### Security

- [ ] Offline data encrypted on device (RN filesystem permissions)
- [ ] Sync uses HTTPS/TLS
- [ ] Batch upload validates tenant ownership
- [ ] Idempotency keys prevent duplicates

### Documentation

- [ ] API endpoints documented (batch upload, sync query)
- [ ] Sync algorithm documented (pseudocode)
- [ ] Conflict resolution strategy documented
- [ ] Offline-first architecture guide documented

### Review

- [ ] PR reviewed and approved
- [ ] CI/CD passing
- [ ] Demo-ready: offline workflow demonstrated
- [ ] Load tested: sync 100+ entries without issues

---

## Sprint Retrospective Template

### What Went Well

- [Item 1]
- [Item 2]

### What to Improve

- [Item 1]
- [Item 2]

### Action Items for Next Sprint

- [ ] [Action 1]
- [ ] [Action 2]

---

## Metrics

- **Planned Story Points:** 32 hours
- **Completed Story Points:** [X]
- **Velocity:** [X points]
- **Code Coverage:** [X%]
- **Sync Success Rate:** > 99%
- **Average Sync Time (100 entries):** < 30 seconds
- **Conflict Rate:** < 1%
- **Data Loss Incidents:** 0

---

## MVP Completion Summary

**Sprints 5-10 Completed: Full MVP Feature Set**

✅ **Core Functionality (Sprints 1-4):**

- User authentication & RBAC
- Well master data management
- Nominal ranges & alerts
- Field entry creation

✅ **Data Management (Sprint 5 - Enterprise Readiness):**

- SCADA integration preparation
- Production accounting framework

✅ **Analytics & Insights (Sprint 6):**

- Time-series aggregation
- Production trends
- Forecasting

✅ **Monitoring & Operations (Sprint 7):**

- Real-time dashboard
- Alert notifications
- Fleet status map

✅ **Compliance & Reporting (Sprint 8):**

- RRC Form generation
- Production accounting
- COPAS reporting

✅ **Team Collaboration (Sprint 9):**

- User management
- RBAC enforcement
- Activity audit trail

✅ **Offline Capability (Sprint 10):**

- Offline field entry
- Bidirectional sync
- Conflict resolution

**MVP Ready for Beta Launch!**

---

## Next Phase: Production Hardening (Sprints 11-17)

**Sprint 11:** Billing & Pricing Engine (24 hours)
**Sprint 12:** Production Infrastructure (24 hours)
**Sprint 13:** Observability & Monitoring (20 hours)
**Sprint 14:** Security Hardening (20 hours)
**Sprint 15:** Performance Optimization (24 hours)
**Sprint 16:** Documentation & Onboarding (16 hours)
**Sprint 17:** Beta Program & Launch (16 hours)

**Total Post-MVP:** ~144 hours (~18 days)
