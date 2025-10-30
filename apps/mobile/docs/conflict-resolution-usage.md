# Conflict Resolution Usage Guide

## Overview

The conflict resolution system automatically detects and resolves offline edit conflicts during sync. When a field entry is modified both locally and on the server, the system uses a **safety-bias strategy** to auto-resolve most conflicts, only requiring user intervention for complex cases.

## How It Works

### 1. Automatic Conflict Detection

When syncing entries, the API compares `updatedAt` timestamps:

```typescript
// Client sends
{
  updatedAt: "2025-10-26T10:30:00Z",
  // ... entry data
}

// Server detects conflict (409 Conflict response)
{
  conflict: true,
  serverVersion: { /* server's version */ },
  updatedAt: "2025-10-26T11:00:00Z"
}
```

### 2. Safety-Bias Auto-Resolution

The system automatically applies safety-bias rules:

**Safety-Critical Fields** (prefer values indicating potential issues):

- **Pressure**: Prefer HIGHER value (potential safety issue)
- **Temperature**: Prefer HIGHER value (potential overheating)
- **Water Cut**: Prefer HIGHER value (more water = problem)

**Production Fields** (prefer conservative estimates):

- **Production Volume**: Prefer LOWER value
- **Gas Volume**: Prefer LOWER value

**Safety Checklist** (prefer "false" = issue detected):

- `pumpOperating`: false AND false = false
- `noLeaks`: false OR false = false
- `gaugesWorking`: false OR false = false
- `safetyEquipment`: false OR false = false

**Other Fields**:

- **Notes**: Merge both versions
- **Photos**: Union of both arrays
- **Location**: Prefer more accurate GPS reading

### 3. User Resolution (Complex Conflicts)

If auto-resolution cannot safely resolve the conflict, the user is prompted via `ConflictResolutionModal`.

## Usage Examples

### Example 1: Displaying Conflicts to User

```tsx
import { useState, useEffect } from 'react';
import { syncService } from '../src/services/sync';
import { db } from '../src/db/database';
import { ConflictResolutionModal } from '../components/ConflictResolutionModal';
import { prepareConflictForUI } from '../src/utils/conflict-resolution';

function SyncScreen() {
  const [conflictInfo, setConflictInfo] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // Check for conflicts after sync
  useEffect(() => {
    checkForConflicts();
  }, []);

  const checkForConflicts = async () => {
    const conflicts = await db.getConflictedEntries();
    if (conflicts.length > 0) {
      const entry = conflicts[0];
      const info = prepareConflictForUI(entry, entry.conflictData!);
      setConflictInfo(info);
      setShowModal(true);
    }
  };

  const handleResolve = async (choice: 'local' | 'server' | 'merge') => {
    if (!conflictInfo) return;

    try {
      await syncService.resolveConflict(conflictInfo.entryId, choice);
      setShowModal(false);
      setConflictInfo(null);

      // Check for more conflicts
      checkForConflicts();
    } catch (error) {
      console.error('Failed to resolve conflict:', error);
    }
  };

  return (
    <View>
      {/* Your sync UI */}

      <ConflictResolutionModal
        visible={showModal}
        conflictInfo={conflictInfo}
        onResolve={handleResolve}
        onCancel={() => setShowModal(false)}
      />
    </View>
  );
}
```

### Example 2: Manual Conflict Resolution

```typescript
import { syncService } from '../src/services/sync';

// Resolve conflict by keeping local version
await syncService.resolveConflict('entry_123', 'local');

// Resolve conflict by accepting server version
await syncService.resolveConflict('entry_123', 'server');

// Resolve conflict using smart merge (safety-bias)
await syncService.resolveConflict('entry_123', 'merge');
```

### Example 3: Getting Conflicted Entries

```typescript
import { db } from '../src/db/database';

// Get all entries with conflicts
const conflicts = await db.getConflictedEntries();

console.log(`Found ${conflicts.length} conflicts`);

conflicts.forEach((entry) => {
  console.log(`Entry: ${entry.id}`);
  console.log(`Well: ${entry.wellName}`);
  console.log(`Server Version: ${entry.serverVersion}`);
  console.log(`Conflict Data:`, entry.conflictData);
});
```

## Resolution Strategies

### 1. Keep Local (`'local'`)

- Preserves all local changes
- Marks entry as `pending` for re-sync
- Server version will be overwritten

**Use when:**

- User is confident their local data is correct
- Server data is outdated or incorrect

### 2. Use Server (`'server'`)

- Accepts all server changes
- Marks entry as `synced`
- Local changes are discarded

**Use when:**

- Server data is authoritative
- User wants to discard local edits

### 3. Smart Merge (`'merge'`)

- Uses safety-bias strategy
- Intelligently merges both versions
- Marks as `synced` after merge

**Use when:**

- Both versions have valuable data
- Prefer automated safety-focused resolution

## Database Schema

```sql
CREATE TABLE field_entries (
  -- ... other fields
  updatedAt TEXT NOT NULL,        -- Last update timestamp
  serverVersion TEXT,             -- Server's version timestamp
  conflictData TEXT,              -- JSON object with server's version
  syncStatus TEXT NOT NULL        -- 'pending' | 'syncing' | 'synced' | 'failed' | 'conflict'
);
```

## Conflict Flow Diagram

```
┌─────────────────┐
│  Sync Entry     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Check Server    │◄─── Include updatedAt in request
└────────┬────────┘
         │
         ▼
    ┌────────┐
    │Conflict?│
    └───┬──┬─┘
        │  │
     No │  │ Yes (409 response)
        │  │
        │  └──────┐
        │         ▼
        │    ┌─────────────────────┐
        │    │ Auto-Resolve        │
        │    │ (Safety-Bias)       │
        │    └────────┬────────────┘
        │             │
        │             ▼
        │        ┌─────────┐
        │        │Resolved?│
        │        └────┬──┬─┘
        │             │  │
        │          Yes│  │No
        │             │  │
        │             │  └────────┐
        │             │           ▼
        │             │      ┌──────────────────┐
        │             │      │ Mark as 'conflict'│
        │             │      │ Show User Modal   │
        │             │      └─────────┬─────────┘
        │             │                │
        │             │                ▼
        │             │      ┌──────────────────┐
        │             │      │ User Chooses:    │
        │             │      │ • Local          │
        │             │      │ • Server         │
        │             │      │ • Merge          │
        │             │      └─────────┬─────────┘
        │             │                │
        ▼             ▼                ▼
    ┌───────────────────────────────────┐
    │ Update Local DB & Mark Synced     │
    └───────────────────────────────────┘
```

## Testing Conflict Resolution

### Simulate a Conflict

1. Create an entry offline
2. Sync it to server
3. Modify the entry locally (don't sync)
4. Modify the same entry on server (via web dashboard)
5. Attempt to sync again
6. Conflict should be detected

### Example Test

```typescript
// 1. Create entry
const entryId = await db.saveFieldEntry({
  wellName: 'Test Well #1',
  productionVolume: '100',
  pressure: '2000',
  // ... other fields
});

// 2. Sync to server
await syncService.syncPendingEntries();

// 3. Modify locally
await db.updateEntry(entryId, {
  pressure: '2100', // Local change
  // ... other fields
});

// 4. Modify on server (manually via API/dashboard)
// Server now has pressure: '2200'

// 5. Sync again - conflict detected
await syncService.syncPendingEntries();

// 6. Check conflict
const entry = await db.getEntryById(entryId);
console.log(entry.syncStatus); // 'conflict' or 'synced' (if auto-resolved)
```

## Best Practices

1. **Always sync before end of shift** - Reduces likelihood of conflicts
2. **Review auto-resolved conflicts** - Check sync logs for safety-bias resolutions
3. **Train users on conflict resolution** - Ensure they understand the three options
4. **Monitor conflict frequency** - High conflict rate may indicate workflow issues
5. **Add conflict badges in UI** - Show visual indicator for entries with conflicts

## Troubleshooting

### Conflict Not Detected

- Ensure `updatedAt` is being sent in sync request
- Check server returns 409 status code for conflicts
- Verify `updatedAt` is being updated on local edits

### Auto-Resolution Not Working

- Check console logs for resolution strategy execution
- Verify `autoResolveConflict()` is called with correct parameters
- Ensure safety-bias rules are appropriate for your use case

### Modal Not Showing

- Verify `getConflictedEntries()` returns entries
- Check `prepareConflictForUI()` is called correctly
- Ensure modal `visible` prop is set to `true`
