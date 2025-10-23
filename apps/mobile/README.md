# WellPulse Mobile - Offline Field Data Entry

React Native mobile app for iOS and Android field operators to enter production data and equipment readings with offline-first capabilities.

## Features

- **100% Offline Operation**: Local SQLite database stores all data
- **GPS Auto-Tagging**: Automatically tag field entries with GPS coordinates
- **Superior Camera Quality**: Native camera integration vs laptop webcams
- **QR/Barcode Scanning**: Quickly identify equipment
- **Voice-to-Text**: Hands-free note entry
- **Push Notifications**: Alerts for equipment issues and sync status
- **Biometric Authentication**: Face ID (iOS), Touch ID, fingerprint (Android)
- **Automatic Sync**: Batch upload when connectivity restored

## Tech Stack

- **Expo SDK 54**: React Native framework with managed workflow
- **Expo Router**: File-based routing
- **React Native 0.81**: Cross-platform mobile framework
- **React 19**: Latest React with New Architecture
- **TypeScript**: Type safety
- **expo-sqlite**: Local database (AsyncStorage + SQLite)
- **expo-location**: GPS integration
- **expo-camera**: Native camera access

## Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm start

# Run on iOS simulator
pnpm ios

# Run on Android emulator
pnpm android

# Run on physical device via Expo Go
# Scan QR code from terminal
```

## Device Requirements

### iOS

- iOS 13.4+
- iPhone 8 or newer
- iPad Air 2 or newer
- Camera and location permissions

### Android

- Android 6.0+ (API 23+)
- Camera and location permissions
- GPS enabled

## Expo Plugins

- **expo-router**: File-based navigation
- **expo-sqlite**: Local database
- **expo-camera**: Camera access with permissions
- **expo-location**: GPS access with permissions

## Permissions

### iOS (Info.plist)

- `NSCameraUsageDescription`: Equipment photo capture
- `NSLocationWhenInUseUsageDescription`: GPS tagging of field data

### Android (AndroidManifest.xml)

- `CAMERA`: Equipment photo capture
- `ACCESS_FINE_LOCATION`: Precise GPS coordinates
- `ACCESS_COARSE_LOCATION`: Approximate location fallback

## Build & Deploy

```bash
# Build for iOS (requires macOS)
eas build --platform ios

# Build for Android
eas build --platform android

# Submit to App Store
eas submit --platform ios

# Submit to Google Play
eas submit --platform android
```

## Architecture

```
app/
├── _layout.tsx       # Root layout with navigation
├── index.tsx         # Home screen
├── (tabs)/           # Tab-based navigation (future)
│   ├── wells.tsx
│   ├── sync.tsx
│   └── settings.tsx
└── [wellId]/         # Dynamic routes for well details
    └── entry.tsx
```

## Local Database Schema

### Tables (expo-sqlite)

- `field_entries`: Production data, equipment readings
- `sync_queue`: Pending uploads
- `event_log`: Append-only audit trail

## Key Advantages Over Desktop App

1. **GPS Integration**: Automatic location tagging (vs manual entry on laptop)
2. **Camera Quality**: Superior to laptop webcams
3. **Mobility**: Fits in pocket, always available
4. **Biometric Auth**: Faster than password entry
5. **Push Notifications**: Proactive alerts vs checking desktop app
6. **QR Scanning**: Quick equipment identification

## Target Users

- Field operators walking well sites
- Pumpers checking multiple locations per day
- Maintenance technicians responding to equipment issues
