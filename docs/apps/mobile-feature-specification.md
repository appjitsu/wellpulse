# Mobile Field Data Entry Feature Specification (apps/mobile)

**Version**: 1.0
**Last Updated**: October 23, 2025
**Tech Stack**: React Native, Expo, TypeScript, AsyncStorage (local), React Query, Zustand

---

## Overview

The WellPulse Mobile app brings the **same offline-first field data entry capabilities to iOS and Android smartphones and tablets**. Designed for operators who prefer mobile devices over laptops in the field, offering enhanced portability, built-in camera, GPS, and touch-optimized UI.

**Target Users**: Field operators, lease operators, pumpers using smartphones/tablets

**Key Advantages Over Electron:**
- ✅ Native GPS integration (automatic well location tagging)
- ✅ Better camera quality (device native cameras)
- ✅ Smaller, more portable devices
- ✅ Touch-optimized gestures (swipe, pinch-to-zoom)
- ✅ Push notifications for alerts

**Feature Parity with Electron**: 95% identical functionality, optimized for mobile UX

---

## Platform Support

- **iOS**: iOS 13+ (iPhone, iPad)
- **Android**: Android 8.0+ (phones, tablets)
- **Distribution**:
  - Apple App Store (iOS)
  - Google Play Store (Android)
  - TestFlight for beta testing (iOS)

---

## Core Features (Same as Electron)

### 1. Offline-First Architecture
- Local data storage: AsyncStorage + SQLite (via expo-sqlite)
- Event sourcing pattern for all field entries
- Batch sync when connectivity available
- Conflict resolution UI

### 2. Authentication
- OAuth / Email-password login
- Biometric authentication (Face ID, Touch ID, Android biometrics)
- Remember device (auto-login)
- Offline login with cached credentials

### 3. Production Data Entry
- Same form as Electron app
- Mobile-optimized numeric keyboard
- Large touch targets (iOS HIG / Material Design compliant)
- Voice-to-text for notes (native integration)

### 4. Equipment Maintenance Logging
- Maintenance type selection
- Issue description with voice input
- Photos with native camera integration
- Parts inventory tracking

### 5. Photo Capture
- **Native camera integration** (superior to laptop webcams)
- Front/rear camera support
- Flash control
- Photo annotations (drawing, text)
- Auto-tag with GPS location
- Auto-tag with well/equipment name

### 6. Sync Management
- Auto-sync when online (WiFi or cellular)
- Manual sync button
- Sync settings (WiFi-only option to save data)
- Sync progress indicator
- Conflict resolution workflow

---

## Mobile-Specific Features

### 1. GPS Integration

**Automatic Location Tagging:**
- Capture GPS coordinates for every field entry
- Verify operator is at correct well site (geofence validation)
- Track route for the day (optional, for mileage reports)

**Geofence Alerts:**
- Alert if operator records data for a well while not physically present
- Configurable radius (e.g., 500ft tolerance)
- Override option for remote entries (with justification note)

**Location Permission Flow:**
```
App Launch → Request "Allow location when using the app"
                ↓
    User Grants → Background location tracking enabled
                ↓
    Record Production → Auto-capture GPS coordinates
                ↓
    Geofence Check → ✓ Within 500ft of well → Proceed
                   → ✗ Outside radius → Warning: "You appear to be away from this well. Continue anyway?"
```

### 2. Native Camera Integration

**Features:**
- High-resolution photo capture (device-dependent, up to 12MP+)
- Video recording (for equipment sounds, leaks, etc.)
- QR code scanning (for equipment identification)
- Barcode scanning (for parts inventory)

**Photo Workflow:**
```
Tap [Take Photo] → Native Camera Opens
                       ↓
               Capture Photo → Preview Screen
                       ↓
               [Retake] or [Use Photo]
                       ↓
               Add Annotation (optional)
                       ↓
               Saved Locally → Synced Later
```

### 3. Push Notifications

**Use Cases:**
- "Reminder: Record today's production (3 wells remaining)"
- "Equipment #12 requires maintenance (predicted failure in 7 days)"
- "Sync complete: 15 records uploaded successfully"
- "Conflict detected: Review and resolve"

**Notification Settings:**
- Enable/disable per notification type
- Quiet hours (e.g., no notifications 8 PM - 6 AM)
- Notification sound customization

### 4. Barcode/QR Code Scanning

**Purpose**: Quickly identify wells and equipment without manual entry

**Flow:**
```
Wells List → Tap [Scan QR Code]
                ↓
          Camera Opens (QR scanner mode)
                ↓
          Scan Well QR Code → Auto-navigate to production form
                ↓
          Pre-fill well information → Operator enters production data
```

**QR Code Format:**
```json
{
  "type": "WELL",
  "id": "well-456",
  "apiNumber": "42-165-12345",
  "name": "Smith Ranch #3"
}
```

### 5. Voice Input

**Native Speech-to-Text:**
- Supported languages: English, Spanish
- Use cases: Notes, issue descriptions, action taken
- Microphone button on all text fields
- Real-time transcription (if online) or stored audio (if offline)

**Example:**
```
Maintenance Form → Issue Description field
                     ↓
           Tap [🎤 Microphone Icon]
                     ↓
           "Pump jack making unusual grinding noise"
                     ↓
           Text automatically filled → Edit if needed
```

### 6. Offline Maps (Future Enhancement)

**Use Case**: Navigate to well sites without internet

**Implementation:**
- Download offline map tiles for operator's region
- Show wells as pins on map
- Tap pin → View well details or navigate
- Integration: Mapbox, Google Maps, or OpenStreetMap

---

## Mobile UI/UX Differences from Electron

### Navigation Pattern
- **Electron**: Sidebar navigation (desktop paradigm)
- **Mobile**: Bottom tab bar (iOS) or top tab bar (Android)

### Tab Bar Structure:
```
┌─────────────────────────────────────────┐
│                                         │
│           Main Content Area             │
│                                         │
│                                         │
└─────────────────────────────────────────┘
  [🏠 Home] [📋 Wells] [🔧 Logs] [⚙️ Sync]
```

### Gestures
- **Swipe left/right**: Navigate between tabs
- **Pull-to-refresh**: Refresh wells list (if online)
- **Long-press**: Context menu (edit, delete, share)
- **Pinch-to-zoom**: On maps (future)

### Form Entry
- **Native keyboard types**: `numeric`, `decimal`, `phone`, `email`
- **iOS picker wheels**: For dropdowns (equipment type, maintenance type)
- **Android spinners**: Material Design dropdown style

---

## Local Storage (React Native)

### AsyncStorage (Key-Value Store)
- User auth token (encrypted)
- User preferences (theme, sync settings)
- Device ID
- Last sync timestamp

### SQLite Database (Structured Data)
- Wells (synced from cloud)
- Field events (production, maintenance, photos)
- Sync queue
- Conflicts

**Library**: `expo-sqlite` (Expo's SQLite wrapper)

**Schema**: Same as Electron app (see Electron spec)

---

## Sync Implementation

### Network Detection
- Use `@react-native-community/netinfo` for connectivity monitoring
- Listen for network changes (WiFi, cellular, offline)
- Trigger auto-sync on connectivity restoration

**Example:**
```typescript
import NetInfo from '@react-native-community/netinfo';

const unsubscribe = NetInfo.addEventListener(state => {
  if (state.isConnected && state.isInternetReachable) {
    // Trigger sync
    syncService.sync();
  }
});
```

### Background Sync (iOS/Android)
- Use Expo Task Manager for background tasks
- Register background fetch task (runs every 4 hours if online)
- Upload pending data even if app closed

**iOS Limitations:**
- Background fetch interval controlled by OS (minimum ~15 minutes)
- Limited to 30 seconds execution time

**Android:**
- More flexible background task scheduling
- Can use WorkManager for guaranteed execution

---

## Performance Optimizations

### App Size
- **Target**: < 50MB download size
- Use Expo managed workflow (avoids bloat of bare React Native)
- Tree-shake unused libraries
- Compress images and assets

### Startup Time
- **Target**: < 2 seconds on mid-range devices
- Lazy load non-critical screens
- Cache frequently accessed data
- Use React Navigation for efficient screen transitions

### Battery Optimization
- Reduce GPS polling frequency (only when recording data)
- Disable auto-sync on low battery (< 20%)
- Use efficient SQLite queries (indexed columns)

### Memory Management
- Limit photo cache size (100MB max)
- Clear old photos after successful sync
- Unload off-screen components (React Navigation handles this)

---

## Security

### Data Encryption
- Encrypted SQLite database (via `expo-sqlite` with cipher)
- Encrypted AsyncStorage (via `expo-secure-store`)
- Encrypted photos at rest

### Biometric Authentication
- Face ID / Touch ID (iOS)
- Fingerprint / Face Unlock (Android)
- Fallback to PIN if biometrics fail

### Secure Network Communication
- HTTPS only (certificate pinning)
- JWT tokens with short expiration (15 min access, 7 day refresh)
- Logout on token expiration (force re-auth)

---

## Distribution & Updates

### App Stores

**Apple App Store:**
- iOS app bundle (`.ipa`)
- App Store Connect submission
- Apple review process (~1-3 days)
- Version updates via App Store

**Google Play Store:**
- Android app bundle (`.aab`)
- Google Play Console submission
- Automated review (usually < 1 hour)
- Staged rollout (5% → 50% → 100%)

### Over-the-Air (OTA) Updates

**Expo Updates (JavaScript Layer):**
- Push non-native code updates instantly (no app store review)
- Update React Native JavaScript bundle, assets
- Users get updates on next app launch
- Rollback capability if update breaks

**Native Updates (Requires App Store):**
- Updates to native modules (camera, GPS, SQLite)
- New Expo SDK versions
- iOS/Android OS compatibility updates

---

## Testing

### Unit Tests
- SQLite operations (CRUD, sync logic)
- Conflict resolution strategies
- Data validation

### Integration Tests
- End-to-end workflows (login → record production → sync)
- Offline/online transitions
- Geofence validation

### Device Testing
- **iOS**: Simulator + physical devices (iPhone 12+, iPad)
- **Android**: Emulator + physical devices (Pixel, Samsung Galaxy)
- **Screen sizes**: Small phones (5.5"), large phones (6.7"), tablets (10")

### Field Testing
- Test in actual field conditions (no internet, GPS accuracy, sunlight visibility)
- Battery drain testing (8-hour shift simulation)
- Camera quality in various lighting

---

## Accessibility

### iOS (VoiceOver)
- Accessibility labels for all interactive elements
- VoiceOver navigation support
- Dynamic Type (font scaling)

### Android (TalkBack)
- Content descriptions for all buttons/images
- TalkBack navigation support
- Accessibility focus management

### General
- Minimum touch target size: 44x44pt (iOS), 48x48dp (Android)
- High contrast mode support
- Color-blind friendly palettes

---

## Deployment Checklist

### Pre-Launch
- [ ] App Store listing created (name, description, screenshots)
- [ ] Privacy policy and terms of service published
- [ ] App icons generated (all required sizes)
- [ ] Push notification certificates configured (iOS)
- [ ] Signing certificates/provisioning profiles set up
- [ ] Beta testing completed (TestFlight, Google Play Beta)

### Launch
- [ ] Submit to Apple App Store
- [ ] Submit to Google Play Store
- [ ] Monitor crash reports (Sentry, Bugsnag)
- [ ] Monitor user reviews
- [ ] Prepare customer support documentation

---

## Future Enhancements

### Phase 2 Features
- Offline maps for navigation
- Apple Watch app (quick production entry)
- Android Wear app
- Siri/Google Assistant shortcuts ("Record production for Well #3")
- Widgets (iOS 14+, Android) showing daily progress

### Phase 3 Features
- Augmented Reality (AR) for equipment identification
- Bluetooth beacon integration (auto-detect well when in range)
- Integration with wearable safety sensors (gas detectors, PPE compliance)

---

## Related Documentation

- [Electron Feature Specification](./electron-feature-specification.md) (95% feature parity)
- [API Feature Specification](./api-feature-specification.md)
- [Offline Batch Sync Pattern](../patterns/70-Offline-Batch-Sync-Pattern.md)
- [Conflict Resolution Pattern](../patterns/71-Conflict-Resolution-Pattern.md)

---

**Next Steps:**
1. Initialize Expo project (`expo init apps/mobile`)
2. Set up React Navigation (tab navigation + stack navigation)
3. Implement SQLite database layer (expo-sqlite)
4. Build core screens (Home, Wells, Production Form, Sync)
5. Implement camera integration
6. Test on physical iOS/Android devices
