# WellPulse Field - Mobile App

**Offline-First iOS & Android Field Data Entry**

---

## Overview

React Native mobile app for field operators with offline capabilities.

**Platforms:**

- 📱 **iOS** - iPhone and iPad (iOS 13+)
- 🤖 **Android** - Phones and tablets (API 21+)

**Code Reuse**: 98.4% shared with `@wellpulse/shared-rn` package

---

## Quick Start

### Prerequisites

1. **Install Dependencies:**

   ```bash
   cd /Users/jason/projects/wellpulse
   pnpm install
   ```

2. **Configure Environment:**

   ```bash
   cd apps/mobile
   cp .env.example .env
   ```

   Edit `.env` and set your local network IP (NOT localhost):

   ```bash
   # Find your Mac's local IP address:
   # System Settings → Network → Wi-Fi → Details → TCP/IP → IPv4 Address
   # Example: 192.168.1.174

   EXPO_PUBLIC_API_URL=http://192.168.1.174:4000
   ```

   **Note**: Tenant ID is no longer in `.env` - users enter it on the login screen.

   **Why local IP instead of localhost?**
   - Physical iOS/Android devices can't reach `localhost` (refers to the device itself)
   - Simulators/emulators CAN use `localhost`, but physical devices need your Mac's IP address
   - Both devices must be on the same WiFi network

3. **Start Backend API:**

   ```bash
   # In a separate terminal, from project root:
   cd apps/api
   pnpm dev
   ```

   The API must be running at `http://localhost:4000` on your Mac. The mobile app will connect using your local IP address.

### Run App

**Start Dev Server:**

```bash
cd apps/mobile
pnpm start
```

**Run on Physical iOS Device:**

1. Install **Expo Go** app from App Store on your iPhone/iPad
2. Start the dev server: `pnpm start`
3. Scan the QR code with Camera app (iOS 11+) or Expo Go app
4. All native features work: Camera, GPS, Biometric, SQLite

**Run on iOS Simulator:**

```bash
cd apps/mobile
pnpm ios
```

> **Note**: Requires Xcode installed and iOS Simulator runtimes downloaded. First time setup:
>
> 1. Open Xcode.app from Applications
> 2. Go to Settings → Platforms → Download iOS 18.x Simulator
> 3. Wait for download/install (~8-12 GB)

**Run on Android:**

```bash
cd apps/mobile
pnpm android
```

**Test on Web (Limited Features):**

```bash
# Metro serves at http://localhost:8081
# Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows/Linux)
# Note: Camera, GPS, Biometric, SQLite disabled on web
```

---

## Features

### 🔐 Authentication & Security

**Secure Token Storage:**

- iOS: iOS Keychain (hardware-backed encryption)
- Android: EncryptedSharedPreferences (AES-256)
- Web: localStorage (development only)

**Persistent Authentication:**

- Token stored on device after first login
- Auto-login on app launch if token exists
- Never-expiring tokens for mobile field use
- Secure user data storage

**Biometric Authentication:**

- Face ID (iOS, newer Android)
- Touch ID / Fingerprint (iOS, Android)
- Iris Scan (supported Android devices)
- Fallback to device passcode

### 📸 Field Data Entry

**Native Capabilities:**

- Camera: Equipment photos with compression (expo-image-picker)
- GPS: Automatic location tagging with accuracy (expo-location)
- Offline SQLite: Store entries when no signal (expo-sqlite)
- Batch Sync: Upload queued data when online (SyncService)

**Platform-Aware:**

- Native features automatically disabled on web (`Platform.OS === 'web'` checks)
- Graceful degradation with user-friendly messages
- Full functionality on iOS and Android devices

**Form Fields:**

- Well selection with search/filter
- Production volumes (oil, gas, water)
- Equipment readings (pressure, temperature)
- Notes with character counter
- Photo attachments with preview
- GPS coordinates (auto-captured)

### 🗄️ Offline-First Database

**SQLite Storage:**

- Local database: `wellpulse.db`
- Automatic schema creation on first launch
- CRUD operations for field entries
- Sync status tracking (pending/syncing/synced/failed)

**Sync Service:**

- Background sync when connected to internet
- Sequential entry upload (prevents race conditions)
- Per-entry error handling and retry logic
- Progress tracking (0-100%)

---

## Architecture

```
apps/mobile/
├── index.ts                # Expo Router entry point
├── app.json                # Expo configuration
├── babel.config.js         # Babel configuration
├── metro.config.js         # Metro bundler config
├── .env                    # Environment variables (API URL, tenant subdomain)
├── app/                    # Expo Router pages (file-based routing)
│   ├── index.tsx           # Root: Auth check & redirect
│   ├── _layout.tsx         # Root layout
│   ├── (auth)/             # Auth route group
│   │   └── login.tsx       # Login screen with biometric
│   ├── (tabs)/             # Tab navigation group
│   │   ├── _layout.tsx     # Tab bar configuration
│   │   ├── index.tsx       # Wells list (search, filter, navigation)
│   │   ├── entry.tsx       # Field data entry (camera/GPS)
│   │   ├── history.tsx     # Entry history with sync status
│   │   ├── sync.tsx        # Manual sync trigger
│   │   └── profile.tsx     # User profile & logout
│   └── well/               # Well detail screens
│       └── [id].tsx        # Dynamic route for well details
├── src/                    # Business logic & services
│   ├── services/
│   │   ├── auth.ts         # Authentication & token storage
│   │   └── sync.ts         # API sync service
│   └── db/
│       ├── schema.ts       # SQLite database schema
│       └── database.ts     # Database service (singleton)
└── assets/                 # Icons, splash screens
```

### Navigation Flow

```
App Launch
   ↓
index.tsx (Auth Check)
   ↓
├─ Authenticated? YES → (tabs)/ [Tab Navigation]
│                          ├─ index.tsx (Wells List)
│                          │     ↓ [Tap Well Card]
│                          │     ↓
│                          │  well/[id].tsx (Well Detail)
│                          │     ↓ [Quick Entry Button]
│                          │     ↓
│                          ├─ entry.tsx (Field Data Entry)
│                          ├─ history.tsx (Entry History)
│                          ├─ sync.tsx (Sync Management)
│                          └─ profile.tsx (User Profile)
│
└─ Authenticated? NO → (auth)/login.tsx
                          ↓ [Login Success]
                          ↓
                       (tabs)/ [Tab Navigation]
```

**Tech Stack:**

- Expo SDK 54.0.20 (React Native 0.81.5)
- React 19.1.0
- Expo Router 6.0.13 (file-based routing)
- expo-secure-store 15.0.7 (iOS Keychain/Android EncryptedSharedPreferences)
- expo-sqlite 16.0.8 (local database)
- expo-camera 17.0.8 (camera integration)
- expo-location 19.0.7 (GPS tagging)
- expo-local-authentication 17.0.7 (biometric auth)

---

## Database

**SQLite Database**: `wellpulse.db`

**Schema** (see `src/db/schema.ts`):

```typescript
interface FieldEntry {
  id: string;
  wellName: string;
  operatorName: string;
  entryDate: string;
  productionVolume: number;
  gasVolume: number;
  waterVolume: number;
  pressure: number;
  temperature: number;
  notes: string;
  photoUri?: string;
  gpsLatitude?: number;
  gpsLongitude?: number;
  syncStatus: 'pending' | 'syncing' | 'synced' | 'failed';
  createdAt: number;
  updatedAt: number;
}
```

**Usage** (see `src/db/database.ts`):

```typescript
import { databaseService } from './src/db/database';

// Initialize on app startup
await databaseService.initialize();

// Create entry
const entry = await databaseService.createFieldEntry({
  wellName: 'TX-450',
  operatorName: 'Peter Pumper',
  entryDate: '2025-10-25',
  productionVolume: 245.5,
  gasVolume: 1250,
  waterVolume: 32,
  pressure: 1245,
  temperature: 185,
  notes: 'Normal operation',
  photoUri: 'file:///path/to/photo.jpg',
  gpsLatitude: 31.9686,
  gpsLongitude: -102.0779,
  syncStatus: 'pending',
});

// Get pending entries for sync
const pendingEntries = await databaseService.getPendingEntries();

// Update sync status
await databaseService.updateSyncStatus(entry.id, 'synced');
```

---

## Shared Components

```tsx
import { FieldEntryScreen } from '@wellpulse/shared-rn';
import '@wellpulse/shared-rn/src/global.css';

export default function App() {
  return <FieldEntryScreen dbName="wellpulse.db" showHeader />;
}
```

---

## Expo Plugins

- **expo-router** - File-based routing
- **expo-sqlite** - SQLite database
- **expo-camera** - Camera access
- **expo-location** - GPS tagging

---

## Build for Production

**iOS:**

```bash
eas build --platform ios
eas submit --platform ios
```

**Android:**

```bash
eas build --platform android
eas submit --platform android
```

---

## Authentication & Multi-Tenancy

**Multi-Tenant Architecture:**

Mobile apps use **X-Tenant-ID** and **X-Tenant-Secret** headers for tenant identification (can't use subdomain routing like web apps).

**Tenant ID Format**: `COMPANY-RANDOM`

- Company code: 1-8 uppercase letters (e.g., `DEMO`, `ACMEOIL`, `TEXASOIL`)
- Random suffix: 6 alphanumeric characters (e.g., `A5L32W`)
- Example: `DEMO-A5L32W`, `ACMEOIL-9K2P4H`

**Authentication Flow:**

1. **First Login**: User enters tenant ID, email, password
2. **Server Response**: Returns access token + tenant secret key
3. **Secure Storage**: Both tenant ID and secret key saved to device
4. **Future Requests**: All API calls include both headers:
   - `X-Tenant-ID`: Public tenant identifier
   - `X-Tenant-Secret`: Server-issued credential (like an API key)
5. **Logout**: Token cleared, but tenant ID and secret **persist**
6. **Next Login**: Tenant ID auto-populated, secret key sent automatically

```typescript
// See src/services/auth.ts:163-196
const response = await fetch(`${API_URL}/api/auth/login`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Tenant-ID': tenantId,              // Public tenant identifier
    'X-Tenant-Secret': existingSecret,    // Secret key from previous login (if available)
  },
  body: JSON.stringify({email, password}),
});

// Server returns:
{
  accessToken: "jwt_token...",
  user: {...},
  tenantSecret: "server_issued_secret"  // Saved for future API requests
}
```

**Using Auth Headers in API Requests:**

```typescript
// Get headers with Authorization, X-Tenant-ID, and X-Tenant-Secret
const headers = await authService.getAuthHeaders();

const response = await fetch(`${API_URL}/api/wells`, {
  method: 'GET',
  headers, // Includes all required headers
});
```

**Demo Credentials:**

- Tenant ID: `DEMO-A5L32W`
- Email: `peter@demo.com`
- Password: `demo123`

**Security Notes:**

- Tenant ID: Entered once, persists forever (only super admin can change in admin app)
- Tenant Secret: Server-issued, can be rotated by super admin for security
- Both stored in secure storage (iOS Keychain, Android EncryptedSharedPreferences)
- Secret never expires but can be rotated if compromised

---

## Navigation Patterns

### Wells List → Well Detail → Entry Form

**User Flow:**

1. **Browse Wells**: Tap tab bar "Wells" → `app/(tabs)/index.tsx`
2. **Search/Filter**: Search by well name or filter by status (Active, Maintenance)
3. **View Details**: Tap well card → `app/well/[id].tsx` (shows history, latest readings)
4. **Quick Entry**: Tap "Quick Entry" button → `app/(tabs)/entry.tsx` (pre-fills well info)
5. **Navigate**: Tap "Navigate" button → Opens device maps app (Apple Maps/Google Maps)

**Implementation Details:**

```typescript
// Wells list (app/(tabs)/index.tsx:37-48)
const handleWellPress = (wellId: string) => {
  router.push(`/well/${wellId}`); // Navigate to detail screen
};

const handleQuickEntry = (wellId: string, wellName: string) => {
  router.push({
    pathname: '/(tabs)/entry',
    params: { wellId, wellName }, // Pre-fill well info
  });
};
```

```typescript
// Well detail (app/well/[id].tsx:141-166)
const handleNavigate = async () => {
  const { latitude, longitude } = well.location;

  // Platform-specific map URLs
  let url: string;
  if (Platform.OS === 'ios') {
    url = `maps:?q=${label}&ll=${latitude},${longitude}`;
  } else {
    url = `geo:${latitude},${longitude}?q=${latitude},${longitude}(${label})`;
  }

  const supported = await Linking.canOpenURL(url);
  if (supported) {
    await Linking.openURL(url); // Opens native maps app
  }
};
```

---

## Troubleshooting

### "Login failed: Cannot POST /auth/login"

**Cause**: Mobile device can't reach `localhost`

**Fix**: Use your Mac's local IP address in `.env`:

```bash
# Find IP: System Settings → Network → Wi-Fi → Details
EXPO_PUBLIC_API_URL=http://192.168.1.174:4000
```

### Metro bundler cache issues

**Symptoms**: Old code still running, changes not appearing

**Fix**:

```bash
rm -rf .expo
pnpm start --clear --reset-cache
```

### "Unable to resolve module"

**Cause**: Dependency not installed or Metro cache stale

**Fix**:

```bash
pnpm install
rm -rf node_modules/.cache
pnpm start --clear
```

---

## Links

- **Feature Specification**: `../../docs/apps/mobile-feature-specification.md`
- **Offline Sync Pattern**: `../../docs/patterns/70-Offline-Batch-Sync-Pattern.md`
- **Conflict Resolution Pattern**: `../../docs/patterns/71-Conflict-Resolution-Pattern.md`
- **Expo Docs**: <https://docs.expo.dev>
- **Expo Router**: <https://docs.expo.dev/router/introduction/>
- **React Native**: <https://reactnative.dev>

---

**Version**: 0.1.0
**Expo SDK**: 54.0.20
**React Native**: 0.81.5
