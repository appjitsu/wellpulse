/**
 * SQLite Database Schema for WellPulse Mobile
 * Stores field entries offline for sync when online
 */

export type WellType =
  | 'beam-pump'
  | 'pcp'
  | 'submersible'
  | 'gas-lift'
  | 'plunger-lift'
  | 'natural-flow';

export interface Well {
  id: string;
  name: string;
  wellType: WellType; // Determines which fields are shown in data entry
  status: 'active' | 'maintenance' | 'suspended';
  location: {
    latitude: number;
    longitude: number;
  };
  operator: string;
  lastReading?: {
    date: string;
    production: string;
    gasVolume?: string;
    pressure?: string;
    temperature?: string;
    waterCut?: string;
  };
  syncedAt?: string;
}

export interface WellReading {
  id: string;
  wellId: string;
  date: string;
  production: string;
  gasVolume?: string;
  pressure?: string;
  temperature?: string;
  waterCut?: string;
  status: 'normal' | 'maintenance' | 'alert';
  syncedAt?: string;
}

export interface Photo {
  localUri: string; // Local file path - NEVER deleted for offline access
  remoteUrl?: string; // CDN URL after upload - used when online
  uploadStatus: 'pending' | 'uploading' | 'uploaded' | 'failed';
  uploadedAt?: string;
  error?: string;
}

export interface FieldEntry {
  id: string;
  wellName: string;
  productionVolume: string; // Oil production (bbl/day)
  gasVolume?: string; // Gas production (mcf/day)
  waterVolume?: string; // Water production (bbl/day)
  waterCut?: string; // Water cut percentage (%)
  pressure?: string; // Well pressure (psi)
  temperature?: string; // Temperature (°F)

  // Additional production metrics
  tankLevel?: string; // Tank level (inches or %)
  bsw?: string; // Basic Sediment & Water (% - must be ≤1% for oil sales)
  gor?: string; // Gas-to-Oil Ratio (MCF/BBL)
  fluidLevel?: string; // Fluid level (feet - echometer readings)

  // Pressure measurements
  casingPressure?: string; // Casinghead pressure (psi)
  tubingPressure?: string; // Tubinghead pressure (psi)

  // Operational data
  pumpStatus?: 'operating' | 'down' | 'maintenance'; // Pump status
  downtimeHours?: string; // Downtime duration (hours)
  downtimeReason?: string; // Reason for downtime
  runTicket?: string; // Haul ticket number/volume
  waterHaul?: string; // Water disposal volume (bbl)

  // Beam Pump specific fields (when wellType = 'beam-pump')
  pumpRuntime?: string; // Pump runtime hours
  strokesPerMinute?: string; // Pump strokes per minute (SPM)
  strokeLength?: string; // Stroke length (inches)
  engineHours?: string; // Engine hours meter reading
  engineTemp?: string; // Engine temperature (°F)

  // PCP specific fields (when wellType = 'pcp')
  motorAmps?: string; // Motor current draw (amps)
  motorVoltage?: string; // Motor voltage
  motorTemp?: string; // Motor temperature (°F)
  motorRpm?: string; // Motor RPM
  motorRunningHours?: string; // Motor running hours
  dischargePressure?: string; // Discharge pressure (psi)

  // Submersible specific fields (when wellType = 'submersible')
  // Uses same fields as PCP: motorAmps, motorVoltage, motorTemp, motorRunningHours, dischargePressure

  // Gas Lift specific fields (when wellType = 'gas-lift')
  gasInjectionVolume?: string; // Gas injection volume (MCF)
  injectionPressure?: string; // Injection pressure (psi)
  backpressure?: string; // Backpressure (psi)
  orificeSize?: string; // Orifice size

  // Plunger Lift specific fields (when wellType = 'plunger-lift')
  cycleTime?: string; // Plunger cycle time (minutes)
  surfacePressure?: string; // Surface pressure (psi)
  plungerArrival?: string; // Last plunger arrival time

  notes?: string;
  photos: Photo[]; // Array of photo objects with both local and remote URIs
  location?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  checklist: {
    pumpOperating: boolean;
    noLeaks: boolean;
    gaugesWorking: boolean;
    safetyEquipment: boolean;
    tankLevelsChecked: boolean;
    separatorOperating: boolean;
    noAbnormalSounds: boolean;
    valvePositionsCorrect: boolean;
    heaterTreaterOperating: boolean;
    noVisibleCorrosion: boolean;
    ventLinesClear: boolean;
    chemicalInjectionWorking: boolean;
    secondaryContainmentOk: boolean;
    wellSiteSecure: boolean;
    spillKitsAvailable: boolean;
  };
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp - for conflict detection
  syncStatus: 'pending' | 'syncing' | 'synced' | 'failed' | 'conflict';
  syncedAt?: string;
  syncError?: string;
  serverVersion?: string; // Server's version timestamp for conflict detection
  conflictData?: Partial<FieldEntry>; // Server's version of conflicting data
}

export const CREATE_TABLES_SQL = `
  CREATE TABLE IF NOT EXISTS wells (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    wellType TEXT NOT NULL, -- beam-pump, pcp, submersible, gas-lift, plunger-lift, natural-flow
    status TEXT NOT NULL,
    location TEXT NOT NULL, -- JSON object {latitude, longitude}
    operator TEXT NOT NULL,
    lastReading TEXT, -- JSON object with latest reading data
    syncedAt TEXT
  );

  CREATE TABLE IF NOT EXISTS well_readings (
    id TEXT PRIMARY KEY,
    wellId TEXT NOT NULL,
    date TEXT NOT NULL,
    production TEXT NOT NULL,
    gasVolume TEXT,
    pressure TEXT,
    temperature TEXT,
    waterCut TEXT,
    status TEXT NOT NULL DEFAULT 'normal',
    syncedAt TEXT,
    FOREIGN KEY (wellId) REFERENCES wells(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS field_entries (
    id TEXT PRIMARY KEY,
    wellName TEXT NOT NULL,
    productionVolume TEXT NOT NULL,
    gasVolume TEXT,
    waterVolume TEXT,
    waterCut TEXT,
    pressure TEXT,
    temperature TEXT,
    tankLevel TEXT,
    bsw TEXT,
    gor TEXT,
    fluidLevel TEXT,
    casingPressure TEXT,
    tubingPressure TEXT,
    pumpStatus TEXT,
    downtimeHours TEXT,
    downtimeReason TEXT,
    runTicket TEXT,
    waterHaul TEXT,
    -- Beam Pump specific
    pumpRuntime TEXT,
    strokesPerMinute TEXT,
    strokeLength TEXT,
    engineHours TEXT,
    engineTemp TEXT,
    -- PCP/Submersible specific
    motorAmps TEXT,
    motorVoltage TEXT,
    motorTemp TEXT,
    motorRpm TEXT,
    motorRunningHours TEXT,
    dischargePressure TEXT,
    -- Gas Lift specific
    gasInjectionVolume TEXT,
    injectionPressure TEXT,
    backpressure TEXT,
    orificeSize TEXT,
    -- Plunger Lift specific
    cycleTime TEXT,
    surfacePressure TEXT,
    plungerArrival TEXT,
    notes TEXT,
    photos TEXT, -- JSON array
    location TEXT, -- JSON object
    checklist TEXT NOT NULL, -- JSON object
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL, -- For conflict detection
    syncStatus TEXT NOT NULL DEFAULT 'pending',
    syncedAt TEXT,
    syncError TEXT,
    serverVersion TEXT, -- Server's version timestamp
    conflictData TEXT -- JSON object with server's version
  );

  CREATE INDEX IF NOT EXISTS idx_wells_status ON wells(status);
  CREATE INDEX IF NOT EXISTS idx_wells_name ON wells(name);
  CREATE INDEX IF NOT EXISTS idx_well_readings_well_id ON well_readings(wellId);
  CREATE INDEX IF NOT EXISTS idx_well_readings_date ON well_readings(date DESC);
  CREATE INDEX IF NOT EXISTS idx_sync_status ON field_entries(syncStatus);
  CREATE INDEX IF NOT EXISTS idx_created_at ON field_entries(createdAt DESC);
`;
