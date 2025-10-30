# Expo Modules Cross-Platform Compatibility Strategy

**Purpose**: Guide for handling Expo modules across iOS, Android, Web, and Desktop (Electron/Tauri)

---

## Expo Modules Inventory

### ✅ Fully Cross-Platform (Works Everywhere)

| Module            | iOS | Android | Web | Desktop | Notes                             |
| ----------------- | --- | ------- | --- | ------- | --------------------------------- |
| `expo-router`     | ✅  | ✅      | ✅  | ✅      | Navigation works on all platforms |
| `expo-status-bar` | ✅  | ✅      | ⚠️  | ⚠️      | Limited/no effect on web/desktop  |

### ⚠️ Partial Support (Needs Fallbacks)

| Module             | iOS | Android | Web | Desktop | Web/Desktop Fallback                        |
| ------------------ | --- | ------- | --- | ------- | ------------------------------------------- |
| `expo-clipboard`   | ✅  | ✅      | ✅  | ✅      | Use `navigator.clipboard` API               |
| `expo-network`     | ✅  | ✅      | ✅  | ✅      | Use `navigator.onLine`                      |
| `expo-keep-awake`  | ✅  | ✅      | ✅  | ⚠️      | Use Wake Lock API (limited browser support) |
| `expo-sqlite`      | ✅  | ✅      | ⚠️  | ⚠️      | Use IndexedDB or WebSQL (deprecated)        |
| `expo-file-system` | ✅  | ✅      | ❌  | ⚠️      | Use File System Access API (Chrome only)    |

### ❌ Native-Only (No Web/Desktop Support)

| Module                      | iOS | Android | Web | Desktop | Recommendation                                |
| --------------------------- | --- | ------- | --- | ------- | --------------------------------------------- |
| `expo-camera`               | ✅  | ✅      | ❌  | ❌      | Hide feature or use WebRTC `getUserMedia()`   |
| `expo-haptics`              | ✅  | ✅      | ❌  | ❌      | Gracefully degrade (no-op)                    |
| `expo-local-authentication` | ✅  | ✅      | ❌  | ❌      | Use Web Authentication API (WebAuthn)         |
| `expo-secure-store`         | ✅  | ✅      | ❌  | ❌      | Use `localStorage` (less secure) or IndexedDB |
| `expo-location`             | ✅  | ✅      | ✅  | ⚠️      | Use Geolocation API (requires HTTPS)          |
| `expo-image-picker`         | ✅  | ✅      | ⚠️  | ⚠️      | Use `<input type="file">`                     |
| `expo-notifications`        | ✅  | ✅      | ⚠️  | ⚠️      | Use Push API + Service Workers                |
| `expo-sharing`              | ✅  | ✅      | ⚠️  | ❌      | Use Web Share API (limited support)           |

---

## Implementation Strategies

### Strategy 1: Platform-Specific Service Files (Recommended)

Create separate implementations for each platform using file extensions:

```
src/services/
├── haptics.native.ts    # iOS/Android implementation
├── haptics.web.ts       # Web/Desktop implementation
└── haptics.ts           # TypeScript interface
```

**Example - Haptics Service:**

```typescript
// src/services/haptics.ts (interface)
export interface HapticsService {
  impact(style: 'light' | 'medium' | 'heavy'): Promise<void>;
  notification(type: 'success' | 'warning' | 'error'): Promise<void>;
}

// src/services/haptics.native.ts
import * as Haptics from 'expo-haptics';

export const hapticsService: HapticsService = {
  async impact(style) {
    const styleMap = {
      light: Haptics.ImpactFeedbackStyle.Light,
      medium: Haptics.ImpactFeedbackStyle.Medium,
      heavy: Haptics.ImpactFeedbackStyle.Heavy,
    };
    await Haptics.impactAsync(styleMap[style]);
  },

  async notification(type) {
    const typeMap = {
      success: Haptics.NotificationFeedbackType.Success,
      warning: Haptics.NotificationFeedbackType.Warning,
      error: Haptics.NotificationFeedbackType.Error,
    };
    await Haptics.notificationAsync(typeMap[type]);
  },
};

// src/services/haptics.web.ts (no-op fallback)
export const hapticsService: HapticsService = {
  async impact() {
    // No haptic feedback on web - silent fallback
    console.log('[Haptics] Web platform - no haptic feedback available');
  },

  async notification() {
    // No haptic feedback on web - silent fallback
    console.log('[Haptics] Web platform - no haptic feedback available');
  },
};
```

**Usage in Components:**

```typescript
import { hapticsService } from '../services/haptics';

// Works on all platforms - native has haptics, web is silent
await hapticsService.impact('medium');
```

### Strategy 2: Runtime Platform Checks

For simpler cases, use inline platform checks:

```typescript
import { Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';

export async function copyToClipboard(text: string) {
  if (Platform.OS === 'web') {
    // Use web API
    await navigator.clipboard.writeText(text);
  } else {
    // Use Expo module on native
    await Clipboard.setStringAsync(text);
  }
}
```

### Strategy 3: Feature Detection

Check for API availability at runtime:

```typescript
export async function requestLocationPermission() {
  if (Platform.OS === 'web') {
    // Check if geolocation is available
    if ('geolocation' in navigator) {
      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          () => resolve({ status: 'granted' }),
          () => resolve({ status: 'denied' }),
        );
      });
    }
    return { status: 'unavailable' };
  }

  // Use Expo Location on native
  return await Location.requestForegroundPermissionsAsync();
}
```

### Strategy 4: Conditional Component Rendering

Hide features that don't work on web/desktop:

```typescript
{Platform.OS !== 'web' && (
  <TouchableOpacity onPress={handleBarcodeScan}>
    <Text>Scan Barcode</Text>
  </TouchableOpacity>
)}
```

---

## Module-Specific Migration Guide

### expo-camera → Web Fallback

**Native:** Use `expo-camera` for CameraView component and permissions
**Web:** `expo-image-picker` automatically uses WebRTC `getUserMedia()` for camera access

**Implementation:**

```typescript
// Platform-adaptive camera permissions
if (Platform.OS !== 'web') {
  // Request camera permission on mobile
  const { status } = await requestCameraPermission();
  if (status !== 'granted') {
    toast.error('Camera permission required');
    return;
  }
}

// launchCameraAsync works on all platforms
const result = await ImagePicker.launchCameraAsync({
  quality: 0.8,
  allowsEditing: true,
});
```

### expo-secure-store → Web Fallback

**Native:** Use `expo-secure-store` (encrypted keychain)
**Web:** Use `localStorage` or IndexedDB (⚠️ less secure)

```typescript
// src/services/storage.native.ts
import * as SecureStore from 'expo-secure-store';
export const secureStorage = {
  setItem: SecureStore.setItemAsync,
  getItem: SecureStore.getItemAsync,
  removeItem: SecureStore.deleteItemAsync,
};

// src/services/storage.web.ts
export const secureStorage = {
  async setItem(key: string, value: string) {
    localStorage.setItem(key, value);
  },
  async getItem(key: string) {
    return localStorage.getItem(key);
  },
  async removeItem(key: string) {
    localStorage.removeItem(key);
  },
};
```

### expo-sqlite → Web Fallback

**Native:** Use `expo-sqlite`
**Web:** Use IndexedDB (Dexie.js library recommended)

```typescript
// Option 1: Use @op-engineering/op-sqlite (has web support)
// Option 2: Create database abstraction layer with IndexedDB fallback
```

### expo-haptics → Web Fallback

**Native:** Use `expo-haptics`
**Web:** No-op (silent fallback)

Already shown in Strategy 1 example above.

---

## Recommended Action Plan

### Phase 1: Immediate (COMPLETED ✅)

1. ✅ Replace `react-native-toast-message` with `@backpackapp-io/react-native-toast` (has web support)
2. ✅ Remove platform checks since new library works everywhere
3. ✅ Add SafeAreaProvider for web compatibility (required by expo-router)
4. ✅ Make onboarding steps platform-adaptive (skip photo library permission on web)
5. ✅ Update photo/camera functionality to work on all platforms with appropriate messaging

### Phase 2: Core Services (High Priority)

1. Create platform-specific service files for:
   - `haptics` (native vs no-op)
   - `storage` (SecureStore vs localStorage)
   - `clipboard` (Expo vs navigator.clipboard)
   - `network` (Expo vs navigator.onLine)

### Phase 3: Feature-Specific (Medium Priority)

1. Camera/Barcode Scanner:
   - Keep native implementation (expo-camera)
   - Hide feature on web/desktop OR implement WebRTC fallback

2. Location:
   - Keep expo-location for native
   - Use Geolocation API for web/desktop

3. Image Picker:
   - Keep expo-image-picker for native
   - Use `<input type="file" accept="image/*">` for web

### Phase 4: Advanced (Low Priority)

1. Biometric Authentication:
   - Keep expo-local-authentication for native
   - Use WebAuthn API for web (passkeys)

2. Push Notifications:
   - Keep expo-notifications for native
   - Use Push API + Service Workers for web

3. SQLite Database:
   - Keep expo-sqlite for native
   - Migrate to IndexedDB wrapper (Dexie.js) for web

---

## Testing Strategy

**Per-Platform Testing:**

- iOS: Test on simulator + physical device
- Android: Test on emulator + physical device
- Web: Test on Chrome, Firefox, Safari
- Desktop: Test on Electron/Tauri build

**Feature Degradation Testing:**

- Ensure features gracefully degrade on unsupported platforms
- No crashes or errors when Expo modules unavailable
- Clear UI feedback when features are disabled

---

## References

- [Expo Web Support](https://docs.expo.dev/workflow/web/)
- [React Native Web](https://necolas.github.io/react-native-web/)
- [Platform-Specific Code](https://reactnative.dev/docs/platform-specific-code)
- [Web APIs (MDN)](https://developer.mozilla.org/en-US/docs/Web/API)
