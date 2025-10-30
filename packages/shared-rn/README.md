# @wellpulse/shared-rn

**Shared React Native Package for WellPulse Field**

Cross-platform components, hooks, and business logic shared across **iOS**, **Android**, **macOS**, and **Windows** apps.

---

## 🎯 Purpose

This package enables **75-85% code reuse** across all 4 platforms by providing:

- ✅ **Shared UI Components** (NativeWind + Tailwind CSS)
- ✅ **Data Access Layer** (SQLite repositories)
- ✅ **Business Logic** (hooks, utilities)
- ✅ **Type Definitions** (TypeScript interfaces)
- ✅ **Consistent Styling** (Tailwind CSS via NativeWind)

---

## 📦 Structure

```
packages/shared-rn/
├── src/
│   ├── components/         # Shared UI components
│   │   ├── Button.tsx      # Example: Cross-platform button
│   │   └── index.ts
│   ├── hooks/              # Custom React hooks (TODO)
│   ├── repositories/       # Data access layer
│   │   └── FieldEntryRepository.ts  # SQLite CRUD operations
│   ├── types/              # TypeScript type definitions
│   │   └── index.ts        # FieldEntry, Well, etc.
│   ├── utils/              # Utility functions (TODO)
│   ├── global.css          # NativeWind/Tailwind CSS styles
│   ├── nativewind-env.d.ts # NativeWind TypeScript types
│   └── index.ts            # Main package exports
├── babel.config.js         # Babel config with NativeWind plugin
├── tailwind.config.js      # Tailwind CSS configuration
├── tsconfig.json           # TypeScript configuration
└── package.json
```

---

## 🚀 Installation

This package is already configured in the monorepo. Apps can import it using:

```typescript
import { Button, FieldEntryRepository } from '@wellpulse/shared-rn';
import type { FieldEntry, CreateFieldEntryDTO } from '@wellpulse/shared-rn';
```

---

## 🎨 NativeWind + Tailwind CSS

### Configuration

NativeWind is configured to use **Tailwind CSS 3.4.17** for consistent styling across all platforms.

**Tailwind Config** (`tailwind.config.js`):

```javascript
module.exports = {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    '../../apps/desktop/**/*.{js,jsx,ts,tsx}',
    '../../apps/mobile/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1E40AF', // Blue-700
          700: '#1E40AF',
        },
        secondary: {
          DEFAULT: '#F59E0B', // Amber-500
          500: '#F59E0B',
        },
      },
    },
  },
};
```

### Using NativeWind Classes

NativeWind translates Tailwind CSS utility classes into React Native `StyleSheet`:

```tsx
// ✅ Use className prop with Tailwind classes
<View className="flex-1 bg-white p-4">
  <Text className="text-2xl font-bold text-gray-900">Hello WellPulse</Text>
  <Button title="Submit" variant="primary" className="mt-4" />
</View>
```

**Supported Classes:**

- Layout: `flex`, `flex-1`, `items-center`, `justify-center`, `gap-4`
- Spacing: `p-4`, `px-6`, `py-3`, `m-2`, `mt-4`, `mb-8`
- Typography: `text-xl`, `font-bold`, `text-gray-900`
- Colors: `bg-white`, `bg-primary-700`, `text-secondary-500`
- Borders: `rounded-lg`, `border`, `border-gray-200`
- Shadows: `shadow-sm`, `shadow-md`

---

## 🧩 Components

### Button

Cross-platform button with multiple variants and states.

**Props:**

```typescript
interface ButtonProps extends TouchableOpacityProps {
  title: string; // Button text
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean; // Show loading spinner
  fullWidth?: boolean; // Full width button
}
```

**Usage:**

```tsx
import { Button } from '@wellpulse/shared-rn';

<Button
  title="Submit Entry"
  variant="primary"
  size="lg"
  loading={isSubmitting}
  onPress={handleSubmit}
  fullWidth
/>;
```

**Variants:**

- `primary` - Blue background, white text
- `secondary` - Amber background, white text
- `outline` - Transparent with blue border
- `ghost` - Transparent, blue text

---

## 💾 Data Access Layer

### FieldEntryRepository

SQLite repository for offline field data storage. Works on **all 4 platforms** via `react-native-quick-sqlite`.

**Methods:**

```typescript
class FieldEntryRepository {
  async initialize(): Promise<void>;
  async save(dto: CreateFieldEntryDTO): Promise<FieldEntry>;
  async findAll(limit?: number): Promise<FieldEntry[]>;
  async findRecent(limit?: number): Promise<FieldEntry[]>;
  async findById(id: string): Promise<FieldEntry | null>;
  async findUnsynced(): Promise<FieldEntry[]>;
  async countUnsynced(): Promise<number>;
  async markSynced(id: string): Promise<void>;
  async delete(id: string): Promise<void>;
  async deleteAll(): Promise<void>;
}
```

**Usage:**

```tsx
import { FieldEntryRepository } from '@wellpulse/shared-rn';
import type { CreateFieldEntryDTO } from '@wellpulse/shared-rn';

// Initialize repository
const repo = new FieldEntryRepository('wellpulse.db');
await repo.initialize();

// Save a new entry
const dto: CreateFieldEntryDTO = {
  wellName: 'TX-450',
  operatorName: 'John Smith',
  entryDate: '2025-10-25',
  productionVolume: 425.5,
  pressure: 850,
  temperature: 140,
  notes: 'Normal operations',
};
const entry = await repo.save(dto);

// Find unsynced entries
const unsynced = await repo.findUnsynced();
console.log(`Pending sync: ${unsynced.length} entries`);

// Mark as synced after upload
await repo.markSynced(entry.id);
```

**Database Schema:**

```sql
CREATE TABLE field_entries (
  id TEXT PRIMARY KEY NOT NULL,          -- UUID v4
  well_name TEXT NOT NULL,
  operator_name TEXT NOT NULL,
  entry_date TEXT NOT NULL,              -- ISO 8601 date
  production_volume REAL NOT NULL,       -- Barrels per day
  pressure REAL,                         -- PSI (optional)
  temperature REAL,                      -- Fahrenheit (optional)
  notes TEXT,                            -- Freeform notes
  synced INTEGER DEFAULT 0,              -- 0 = pending, 1 = synced
  created_at TEXT NOT NULL,              -- ISO 8601 timestamp
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_field_entries_well ON field_entries(well_name);
CREATE INDEX idx_field_entries_date ON field_entries(entry_date);
CREATE INDEX idx_field_entries_synced ON field_entries(synced);
```

---

## 📘 Type Definitions

### FieldEntry

```typescript
interface FieldEntry {
  id: string; // UUID v4
  wellName: string; // e.g., "TX-450"
  operatorName: string; // Field operator/technician name
  entryDate: string; // ISO 8601 date (e.g., "2025-10-25")
  productionVolume: number; // Barrels per day
  pressure?: number; // PSI (optional)
  temperature?: number; // Fahrenheit (optional)
  notes?: string; // Freeform notes
  synced: boolean; // false = pending, true = synced
  createdAt: string; // ISO 8601 timestamp
  updatedAt: string; // ISO 8601 timestamp
}
```

### CreateFieldEntryDTO

```typescript
interface CreateFieldEntryDTO {
  wellName: string;
  operatorName: string;
  entryDate: string;
  productionVolume: number;
  pressure?: number;
  temperature?: number;
  notes?: string;
}
```

### Well

```typescript
interface Well {
  id: string;
  name: string; // e.g., "TX-450"
  operator?: string; // Operator/lease name
  latitude?: number;
  longitude?: number;
}
```

### SyncStatus

```typescript
interface SyncStatus {
  pendingCount: number; // Number of unsynced entries
  lastSyncAt?: string; // Last successful sync timestamp
  isSyncing: boolean; // Currently syncing
  error?: string; // Sync error message
}
```

---

## 🛠️ Development

### Adding a New Component

1. Create component file in `src/components/`:

```tsx
// src/components/TextField.tsx
import React from 'react';
import { TextInput, View, Text } from 'react-native';

export interface TextFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

export const TextField: React.FC<TextFieldProps> = ({
  label,
  value,
  onChangeText,
  placeholder,
}) => {
  return (
    <View className="mb-4">
      <Text className="text-sm font-semibold text-gray-700 mb-2">{label}</Text>
      <TextInput
        className="bg-white border border-gray-300 rounded-lg px-4 py-3 text-base"
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
      />
    </View>
  );
};
```

2. Export in `src/components/index.ts`:

```typescript
export { TextField, type TextFieldProps } from './TextField';
```

3. Import in apps:

```typescript
import { TextField } from '@wellpulse/shared-rn';
```

### Type Checking

```bash
cd packages/shared-rn
pnpm type-check
```

### Linting

```bash
cd packages/shared-rn
pnpm lint
```

---

## 🧪 Testing

### Running Tests (TODO)

```bash
cd packages/shared-rn
pnpm test
```

### Testing on Platforms

**iOS:**

```bash
cd apps/desktop
npm run ios
```

**Android:**

```bash
cd apps/desktop
npm run android
```

**macOS:**

```bash
cd apps/desktop
npm run start:macos
```

**Windows:**

```bash
cd apps/desktop
npm run windows
```

---

## 📱 Platform-Specific Code

When you need platform-specific behavior, use React Native's `Platform` API or file extensions:

### Using Platform API

```tsx
import { Platform } from 'react-native';

const Button = () => {
  const padding = Platform.select({
    ios: 12,
    android: 10,
    macos: 14,
    windows: 14,
    default: 12,
  });

  return <View style={{ padding }}>{/* ... */}</View>;
};
```

### Using File Extensions

```
components/
├── DatePicker.tsx          # Shared implementation
├── DatePicker.ios.tsx      # iOS-specific
├── DatePicker.android.tsx  # Android-specific
├── DatePicker.macos.tsx    # macOS-specific
└── DatePicker.windows.tsx  # Windows-specific
```

React Native will automatically pick the correct file for each platform.

---

## 🎨 Styling Best Practices

### ✅ DO Use NativeWind Classes

```tsx
<View className="flex-1 bg-white p-4">
  <Text className="text-2xl font-bold text-gray-900">Production Data</Text>
</View>
```

### ✅ DO Extend Theme Colors

Use custom brand colors defined in `tailwind.config.js`:

```tsx
<View className="bg-primary-700">
  <Text className="text-white">Primary Brand Color</Text>
</View>
```

### ❌ DON'T Mix StyleSheet with NativeWind

```tsx
// ❌ Bad: Mixing approaches
<View style={styles.container} className="p-4">

// ✅ Good: Use NativeWind only
<View className="flex-1 bg-white p-4">
```

### ✅ DO Use Consistent Spacing

Follow Tailwind's spacing scale (`p-2`, `p-4`, `p-6`, `p-8`):

```tsx
<View className="p-4 gap-4">
  <Text className="mb-2">Label</Text>
  <TextInput className="px-4 py-3" />
</View>
```

---

## 📚 Resources

- **NativeWind Docs**: https://www.nativewind.dev
- **Tailwind CSS Docs**: https://tailwindcss.com/docs
- **React Native Docs**: https://reactnative.dev
- **React Native Quick SQLite**: https://github.com/ospfranco/react-native-quick-sqlite

---

## 🚀 Next Steps

1. ✅ **NativeWind Setup Complete** - Tailwind CSS working on all platforms
2. ✅ **Button Component** - Example cross-platform component
3. ✅ **SQLite Repository** - Offline data storage ready
4. 🔜 **Port Field Entry Form** - Migrate from Tauri to React Native
5. 🔜 **Add Form Components** - TextField, Select, DatePicker, etc.
6. 🔜 **Build Production Screens** - Well list, entry list, sync status
7. 🔜 **Test on All Platforms** - Validate 75-85% code reuse

---

## 📝 Version

**Current Version**: `0.1.0`

**Platform Compatibility:**

- iOS: ✅ (React Native 0.79.6)
- Android: ✅ (React Native 0.79.6)
- macOS: ✅ (React Native macOS 0.79.0)
- Windows: ✅ (React Native Windows 0.79.4)

---

## 📄 License

UNLICENSED - Internal WellPulse package
