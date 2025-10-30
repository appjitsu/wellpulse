# WellPulse Field - Desktop App

**Cross-Platform Field Data Entry**
Supports iOS, Android, macOS, and Windows

---

## Overview

The WellPulse Field desktop app is a React Native application that runs on **4 platforms** using a single codebase:

- 📱 **iOS** - iPhone and iPad
- 🤖 **Android** - Phones and tablets
- 💻 **macOS** - Desktop computers
- 🪟 **Windows** - Desktop computers

**Code Reuse**: 96.3% shared with `@wellpulse/shared-rn` package

---

## Quick Start

### Install Dependencies

```bash
cd /Users/jason/projects/wellpulse
pnpm install
```

### Run on Platforms

**iOS:**

```bash
cd apps/desktop
pnpm ios
```

**Android:**

```bash
cd apps/desktop
pnpm android
```

**macOS:**

```bash
cd apps/desktop
pnpm start:macos
```

**Windows:**

```bash
cd apps/desktop
pnpm windows
```

---

## Architecture

```
apps/desktop/
├── App.tsx                 # Entry point (17 lines)
├── babel.config.js         # Babel + NativeWind
├── metro.config.js         # Metro + Windows/macOS config
├── ios/                    # iOS native project
├── android/                # Android native project
├── macos/                  # macOS native project
└── windows/                # Windows native project
```

**Dependencies:**

- `@wellpulse/shared-rn` - Shared components
- `react-native` 0.79.6
- `react-native-macos` 0.79.0
- `react-native-windows` 0.79.4
- `nativewind` 4.2.1
- `react-native-quick-sqlite` 8.2.7

---

## Database

**SQLite Database**: `wellpulse.db`

**Repository:**

```tsx
import {FieldEntryRepository} from '@wellpulse/shared-rn';

const repo = new FieldEntryRepository('wellpulse.db');
await repo.initialize();

const entry = await repo.save({
  wellName: 'TX-450',
  operatorName: 'John Doe',
  entryDate: '2025-10-25',
  productionVolume: 245.5,
});
```

---

## Shared Components

```tsx
import {FieldEntryScreen} from '@wellpulse/shared-rn';
import '@wellpulse/shared-rn/src/global.css';

export default function App() {
  return <FieldEntryScreen dbName="wellpulse.db" showHeader />;
}
```

---

## Links

- **Shared Package**: `../../packages/shared-rn/README.md`
- **Code Metrics**: `../../docs/analysis/code-reuse-metrics.md`
- **React Native**: https://reactnative.dev
- **NativeWind**: https://www.nativewind.dev

---

**Version**: 0.1.0
