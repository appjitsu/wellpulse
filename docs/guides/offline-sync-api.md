# Offline Sync API Documentation

**Version**: 1.0
**Last Updated**: October 25, 2025

## Overview

The Offline Sync API enables Electron and mobile apps to operate in offline environments by providing bidirectional data synchronization. Field operators can collect data at remote well sites without internet connectivity, and sync when they return to the office.

## Architecture

```
┌────────────────────────────────────────────────┐
│          Offline Device (Electron/Mobile)      │
│  ┌──────────────────────────────────────────┐  │
│  │  SQLite Database                         │  │
│  │  ├── wells (cached reference data)       │  │
│  │  ├── users (cached reference data)       │  │
│  │  ├── field_entries (pending sync)        │  │
│  │  └── sync_metadata (last sync times)     │  │
│  └──────────────────────────────────────────┘  │
└────────────────────────────────────────────────┘
                     │
                     │ HTTP/REST
                     ▼
┌────────────────────────────────────────────────┐
│              Cloud API                         │
│  GET  /sync/pull    - Download reference data │
│  POST /sync/push    - Upload field entries    │
│  GET  /sync/status  - Check sync status       │
└────────────────────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────┐
│         Tenant Database (PostgreSQL)           │
│  ├── wells                                     │
│  ├── users                                     │
│  └── field_entries (recordedAt, syncedAt)     │
└────────────────────────────────────────────────┘
```

## Endpoints

### 1. Pull Data (Download)

**GET** `/sync/pull`

Downloads wells and users for offline use on field devices.

#### Headers

```http
Authorization: Bearer <jwt_token>
X-Tenant-Subdomain: <tenant_subdomain> (optional, can use subdomain routing)
```

#### Response

```typescript
{
  wells: Array<{
    id: string;
    name: string;
    apiNumber: string;
    latitude: number;
    longitude: number;
    status: 'ACTIVE' | 'INACTIVE' | 'PLUGGED';
    lease: string | null;
    field: string | null;
    operator: string | null;
  }>;
  users: Array<{
    id: string;
    email: string;
    name: string;
    role: 'OPERATOR' | 'MANAGER' | 'ADMIN';
  }>;
  lastSyncTimestamp: string; // ISO 8601 timestamp
  tenantId: string;
}
```

#### Example Request

```bash
curl -X GET 'https://api.wellpulse.io/sync/pull' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' \
  -H 'X-Tenant-Subdomain: acme'
```

#### Example Response

```json
{
  "wells": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Spraberry Unit #1A",
      "apiNumber": "42-227-30001",
      "latitude": 31.9973,
      "longitude": -102.0779,
      "status": "ACTIVE",
      "lease": "Spraberry Unit",
      "field": "Spraberry Trend",
      "operator": "Permian Petroleum LLC"
    }
  ],
  "users": [
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "email": "operator@permianpetroleum.com",
      "name": "Jake Thompson",
      "role": "OPERATOR"
    }
  ],
  "lastSyncTimestamp": "2025-10-25T14:30:00.000Z",
  "tenantId": "770e8400-e29b-41d4-a716-446655440002"
}
```

#### Business Rules

- Only returns **active wells** (status = 'ACTIVE')
- Limits to **1000 wells** (pagination not yet implemented)
- User must have OPERATOR, MANAGER, or ADMIN role
- Tenant isolation enforced via JWT claims or subdomain

---

### 2. Push Data (Upload)

**POST** `/sync/push`

Uploads field entries collected offline to the cloud.

#### Headers

```http
Authorization: Bearer <jwt_token>
Content-Type: application/json
X-Tenant-Subdomain: <tenant_subdomain> (optional)
```

#### Request Body

```typescript
{
  deviceId: string; // Unique device identifier (for conflict resolution)
  entries: Array<{
    wellId: string;
    entryType: 'PRODUCTION' | 'INSPECTION' | 'MAINTENANCE';
    data: {
      // For PRODUCTION:
      oilVolume?: number; // Barrels per day
      gasVolume?: number; // MCF per day
      waterVolume?: number; // Barrels per day
      tubingPressure?: number; // PSI
      casingPressure?: number; // PSI
      chokeSize?: number; // 64ths of an inch
      runtime?: number; // Hours

      // For INSPECTION:
      equipmentStatus?: 'OPERATIONAL' | 'DEGRADED' | 'FAILED';
      leaksDetected?: boolean;
      safetyHazards?: boolean;
      visualCondition?: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
      inspectionType?: 'ROUTINE' | 'DETAILED' | 'EMERGENCY';
      nextInspectionDate?: string; // ISO 8601
      correctiveActions?: string[];

      // For MAINTENANCE:
      maintenanceType?: 'PREVENTIVE' | 'CORRECTIVE' | 'EMERGENCY';
      workPerformed?: string[];
      partsReplaced?: string[];
      downtime?: number; // Hours
      cost?: number; // USD
      vendorName?: string;
      nextMaintenanceDate?: string; // ISO 8601
    };
    recordedAt: string; // ISO 8601 timestamp (when operator recorded it)
    latitude?: number; // GPS coordinate
    longitude?: number; // GPS coordinate
    photos?: string[]; // Array of photo URLs (uploaded separately)
    notes?: string; // Freeform notes
  }>;
}
```

#### Response

```typescript
{
  succeeded: number; // Count of successfully uploaded entries
  failed: number; // Count of failed entries
  conflicts: Array<{
    entryId: string;
    wellId: string;
    recordedAt: string;
    reason: string;
    resolution: 'SERVER_WINS' | 'CLIENT_WINS' | 'MERGED';
  }>;
  errors: Array<{
    wellId: string;
    error: string;
  }>;
  syncedAt: string; // ISO 8601 timestamp
}
```

#### Example Request

```bash
curl -X POST 'https://api.wellpulse.io/sync/push' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' \
  -H 'Content-Type: application/json' \
  -H 'X-Tenant-Subdomain: acme' \
  -d '{
    "deviceId": "FIELD_TABLET_001",
    "entries": [
      {
        "wellId": "550e8400-e29b-41d4-a716-446655440000",
        "entryType": "PRODUCTION",
        "data": {
          "oilVolume": 82.3,
          "gasVolume": 375.8,
          "waterVolume": 28.4,
          "runtime": 24
        },
        "recordedAt": "2025-10-25T08:30:00.000Z",
        "latitude": 31.9973,
        "longitude": -102.0779,
        "notes": "Equipment running smoothly"
      }
    ]
  }'
```

#### Example Response

```json
{
  "succeeded": 1,
  "failed": 0,
  "conflicts": [],
  "errors": [],
  "syncedAt": "2025-10-25T14:35:00.000Z"
}
```

#### Business Rules

- **Conflict Resolution**: Last-write-wins (server authority)
- Duplicate detection: Same well + recordedAt + deviceId
- All entries validated against domain business rules
- GPS coordinates optional but recommended
- User must be the author (createdBy = current user ID)

---

### 3. Sync Status

**GET** `/sync/status?deviceId={deviceId}`

Checks sync status for a specific device.

#### Headers

```http
Authorization: Bearer <jwt_token>
X-Tenant-Subdomain: <tenant_subdomain> (optional)
```

#### Query Parameters

| Parameter | Type   | Required | Description              |
| --------- | ------ | -------- | ------------------------ |
| deviceId  | string | Yes      | Unique device identifier |

#### Response

```typescript
{
  deviceId: string;
  lastSyncAt: string | null; // ISO 8601 timestamp of last successful sync
  pendingEntries: number; // Count of entries on server pending client pull
}
```

#### Example Request

```bash
curl -X GET 'https://api.wellpulse.io/sync/status?deviceId=FIELD_TABLET_001' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' \
  -H 'X-Tenant-Subdomain: acme'
```

#### Example Response

```json
{
  "deviceId": "FIELD_TABLET_001",
  "lastSyncAt": "2025-10-25T14:35:00.000Z",
  "pendingEntries": 0
}
```

---

## Sync Workflow

### Recommended Sync Pattern

```typescript
// 1. Pull reference data (when app starts or user logs in)
async function syncPull() {
  const response = await fetch('/sync/pull', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const { wells, users, lastSyncTimestamp } = await response.json();

  // Save to local SQLite database
  await db.saveWells(wells);
  await db.saveUsers(users);
  await db.setSyncMetadata('wells', lastSyncTimestamp);
}

// 2. Push pending entries (when back online or manual sync)
async function syncPush() {
  const pendingEntries = await db.getPendingEntries();

  if (pendingEntries.length === 0) {
    return { succeeded: 0, failed: 0 };
  }

  const response = await fetch('/sync/push', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      deviceId: getDeviceId(),
      entries: pendingEntries,
    }),
  });

  const { succeeded, failed, conflicts, syncedAt } = await response.json();

  // Mark synced entries
  await db.markEntriesAsSynced(pendingEntries.slice(0, succeeded));

  return { succeeded, failed, conflicts };
}

// 3. Full bidirectional sync
async function performFullSync() {
  await syncPull(); // Download reference data first
  await syncPush(); // Then upload local changes
}
```

### Auto-Sync Strategy

```typescript
// Auto-sync every 5 minutes when online
setInterval(
  async () => {
    if (await isOnline()) {
      try {
        await performFullSync();
        console.log('✅ Auto-sync complete');
      } catch (error) {
        console.error('❌ Auto-sync failed:', error);
        // Will retry on next interval
      }
    }
  },
  5 * 60 * 1000,
);
```

---

## Error Handling

### HTTP Status Codes

| Code | Meaning      | Action                                    |
| ---- | ------------ | ----------------------------------------- |
| 200  | Success      | Process response data                     |
| 400  | Bad Request  | Fix request data, check validation errors |
| 401  | Unauthorized | Re-authenticate user                      |
| 403  | Forbidden    | User lacks required role                  |
| 404  | Not Found    | Check tenant/well exists                  |
| 409  | Conflict     | Handle conflict resolution                |
| 500  | Server Error | Retry with exponential backoff            |

### Example Error Response

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [
    {
      "field": "data.oilVolume",
      "message": "Oil volume cannot be negative"
    }
  ]
}
```

---

## Performance Considerations

### Pull Endpoint

- Returns up to 1000 wells (consider pagination for large operators)
- Response cached for 1 minute (CDN/Redis)
- Average response time: < 200ms

### Push Endpoint

- Batch limit: 1000 entries per request
- Processing time: ~50ms per entry
- Recommended: Sync in batches of 100 entries

### Optimization Tips

- **Incremental Pull**: Use `lastSync` query param for delta updates (future enhancement)
- **Batch Push**: Upload entries in chunks of 100-200 for best performance
- **Photo Upload**: Upload photos separately to `/upload` endpoint, then reference URLs in sync
- **Compression**: gzip compression reduces payload by ~70%

---

## Security

### Authentication

- JWT tokens required for all endpoints
- Tokens expire after 1 hour (refresh via `/auth/refresh`)
- Tenant isolation enforced via JWT `tenantId` claim

### Authorization

- **GET /sync/pull**: OPERATOR, MANAGER, ADMIN
- **POST /sync/push**: OPERATOR, MANAGER, ADMIN
- **GET /sync/status**: OPERATOR, MANAGER, ADMIN

### Rate Limiting

- Default: 10 requests per second per IP
- Sync endpoints: 30 requests per minute per user
- Exceeded limits return HTTP 429

---

## Testing

### Test Pull Endpoint

```bash
# Get auth token
TOKEN=$(curl -X POST 'http://localhost:4000/auth/login' \
  -H 'Content-Type: application/json' \
  -H 'X-Tenant-Subdomain: acme' \
  -d '{"email":"operator@permianpetroleum.com","password":"Test123!@#"}' \
  | jq -r '.accessToken')

# Pull data
curl -X GET 'http://localhost:4000/sync/pull' \
  -H "Authorization: Bearer $TOKEN" \
  -H 'X-Tenant-Subdomain: acme' \
  | jq
```

### Test Push Endpoint

```bash
# Push field entry
curl -X POST 'http://localhost:4000/sync/push' \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'X-Tenant-Subdomain: acme' \
  -d '{
    "deviceId": "TEST_DEVICE",
    "entries": [{
      "wellId": "550e8400-e29b-41d4-a716-446655440000",
      "entryType": "PRODUCTION",
      "data": {"oilVolume": 100, "gasVolume": 500, "waterVolume": 50, "runtime": 24},
      "recordedAt": "'$(date -u +%Y-%m-%dT%H:%M:%S.000Z)'"
    }]
  }' \
  | jq
```

---

## Migration from Previous Versions

### v0.x to v1.0

- No breaking changes yet (v1.0 is initial release)
- Field entry schema finalized

---

## Roadmap

### v1.1 (Planned)

- [ ] Incremental pull (delta sync based on `lastSync` timestamp)
- [ ] Pagination for wells (support 10,000+ wells)
- [ ] Conflict resolution options (client-wins, server-wins, merge)
- [ ] Photo upload integration
- [ ] Sync priority (critical entries first)

### v1.2 (Planned)

- [ ] Real-time sync via WebSocket
- [ ] Partial entry updates (edit synced entries)
- [ ] Selective sync (filter by well, date range, entry type)
- [ ] Sync analytics (bandwidth, success rate, latency)

---

## Support

**Documentation**: https://docs.wellpulse.io
**API Reference**: https://api.wellpulse.io/docs
**Support**: support@wellpulse.io

---

## Changelog

### v1.0 (October 25, 2025)

- ✨ Initial release
- ✨ GET /sync/pull - Download wells and users
- ✨ POST /sync/push - Upload field entries
- ✨ GET /sync/status - Check sync status
- ✨ Last-write-wins conflict resolution
- ✨ RBAC enforcement
