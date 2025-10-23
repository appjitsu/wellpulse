# WellPulse Electron - Offline Field Data Entry

Desktop application for oil & gas field operators to enter production data and equipment readings on rugged laptops without internet connectivity.

## Features

- **100% Offline Operation**: Local SQLite database stores all data
- **Production Data Entry**: Record oil, gas, water volumes for wells
- **Equipment Readings**: Log pump jack RPM, tank levels, separator pressure
- **Photo Capture**: Take photos via laptop webcam for equipment inspections
- **Automatic Sync**: When internet is available, sync data to cloud API
- **Event Sourcing**: Append-only log ensures no data loss
- **Conflict Resolution**: Handles multi-device scenarios gracefully

## Tech Stack

- **Electron 28**: Desktop app framework
- **React 19**: UI framework
- **Vite**: Fast development server and build tool
- **TypeScript**: Type safety
- **better-sqlite3**: Local SQLite database (faster than native Node.js sqlite3)

## Development

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev

# Build for production
pnpm build
```

## Architecture

```
src/
├── main/           # Electron main process (Node.js)
│   ├── index.ts    # Window management, app lifecycle
│   └── database.ts # SQLite operations
├── preload/        # Preload script (sandboxed context bridge)
│   └── index.ts    # Safe API exposure to renderer
└── renderer/       # React frontend (web technologies)
    ├── App.tsx     # Main React component
    └── main.tsx    # React entry point
```

## Database Schema

### field_entries

- Production data for wells (oil, gas, water volumes)
- Equipment readings
- Photos and notes
- Sync status

### sync_queue

- Pending changes to upload when online
- Retry logic and error tracking

### event_log

- Append-only audit trail
- Used for conflict resolution

## Deployment

Electron apps are packaged as native applications:

- **macOS**: `.dmg` installer
- **Windows**: `.exe` installer (NSIS)
- **Linux**: `.AppImage`

Built applications are signed and distributed via auto-update server.

## Target Hardware

- Rugged laptops (Panasonic Toughbook, Dell Rugged Extreme)
- Large touch targets for glove-friendly operation
- High contrast for outdoor sunlight readability
- Supports offline operation for days/weeks
