/**
 * Field Entry Context
 * Centralizes form state management to avoid prop drilling
 */

import React, { createContext, useContext, ReactNode } from 'react';
import { TextInput } from 'react-native';
import type { PermissionResponse } from 'expo-camera';
import * as Location from 'expo-location';
import { DropdownItem } from '../SearchableDropdown';
import { FieldEntry, Photo, Well } from '../../src/db/schema';
import type { BarcodeScanResult } from '../BarcodeScannerModal';

export interface ChecklistState {
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
}

interface FieldEntryContextType {
  // Form State
  wellName: string;
  setWellName: (value: string) => void;
  selectedWell: Well | null; // Full well object with wellType for context-aware forms
  setSelectedWell: (well: Well | null) => void;

  // Production volumes
  productionVolume: string;
  setProductionVolume: (value: string) => void;
  gasVolume: string;
  setGasVolume: (value: string) => void;
  waterVolume: string;
  setWaterVolume: (value: string) => void;
  waterCut: string;
  setWaterCut: (value: string) => void;

  // Well measurements
  pressure: string;
  setPressure: (value: string) => void;
  temperature: string;
  setTemperature: (value: string) => void;
  tankLevel: string;
  setTankLevel: (value: string) => void;
  bsw: string;
  setBsw: (value: string) => void;
  gor: string;
  setGor: (value: string) => void;
  fluidLevel: string;
  setFluidLevel: (value: string) => void;
  casingPressure: string;
  setCasingPressure: (value: string) => void;
  tubingPressure: string;
  setTubingPressure: (value: string) => void;

  // Operational data
  pumpStatus: 'operating' | 'down' | 'maintenance';
  setPumpStatus: (value: 'operating' | 'down' | 'maintenance') => void;
  downtimeHours: string;
  setDowntimeHours: (value: string) => void;
  downtimeReason: string;
  setDowntimeReason: (value: string) => void;
  runTicket: string;
  setRunTicket: (value: string) => void;
  waterHaul: string;
  setWaterHaul: (value: string) => void;

  // Beam Pump specific fields
  pumpRuntime: string;
  setPumpRuntime: (value: string) => void;
  strokesPerMinute: string;
  setStrokesPerMinute: (value: string) => void;
  strokeLength: string;
  setStrokeLength: (value: string) => void;
  engineHours: string;
  setEngineHours: (value: string) => void;
  engineTemp: string;
  setEngineTemp: (value: string) => void;

  // PCP/Submersible specific fields
  motorAmps: string;
  setMotorAmps: (value: string) => void;
  motorVoltage: string;
  setMotorVoltage: (value: string) => void;
  motorTemp: string;
  setMotorTemp: (value: string) => void;
  motorRpm: string;
  setMotorRpm: (value: string) => void;
  motorRunningHours: string;
  setMotorRunningHours: (value: string) => void;
  dischargePressure: string;
  setDischargePressure: (value: string) => void;

  // Gas Lift specific fields
  gasInjectionVolume: string;
  setGasInjectionVolume: (value: string) => void;
  injectionPressure: string;
  setInjectionPressure: (value: string) => void;
  backpressure: string;
  setBackpressure: (value: string) => void;
  orificeSize: string;
  setOrificeSize: (value: string) => void;

  // Plunger Lift specific fields
  cycleTime: string;
  setCycleTime: (value: string) => void;
  surfacePressure: string;
  setSurfacePressure: (value: string) => void;
  plungerArrival: string;
  setPlungerArrival: (value: string) => void;

  notes: string;
  setNotes: (value: string) => void;
  photos: Photo[];
  setPhotos: React.Dispatch<React.SetStateAction<Photo[]>>;
  checklist: ChecklistState;
  setChecklist: React.Dispatch<React.SetStateAction<ChecklistState>>;

  // Edit Mode
  editingEntryId: string | null;

  // UI State
  isSaving: boolean;
  isOnline: boolean;
  networkType: string;

  // Wells & Previous Readings
  wells: DropdownItem[];
  previousReading: FieldEntry | null;
  allPreviousReadings: FieldEntry[];
  readingsForSelectedDate: FieldEntry[];
  currentReadingIndex: number;
  selectedReadingDate: string | null;
  isReadingCardCollapsed: boolean;
  showDatePicker: boolean;
  setIsReadingCardCollapsed: (value: boolean) => void;
  setShowDatePicker: (value: boolean) => void;

  // Validation
  validationWarnings: {
    productionVolume?: boolean;
    pressure?: boolean;
    temperature?: boolean;
    gasVolume?: boolean;
    waterCut?: boolean;
  };

  // Camera & Location
  cameraPermission: PermissionResponse | null;
  location: Location.LocationObject | null;
  locationPermission: boolean;
  showBarcodeScanner: boolean;
  setShowBarcodeScanner: (value: boolean) => void;

  // Refs
  wellNameRef: React.RefObject<TextInput | null>;
  productionVolumeRef: React.RefObject<TextInput | null>;
  gasVolumeRef: React.RefObject<TextInput | null>;
  pressureRef: React.RefObject<TextInput | null>;
  temperatureRef: React.RefObject<TextInput | null>;
  waterVolumeRef: React.RefObject<TextInput | null>;
  waterCutRef: React.RefObject<TextInput | null>;
  tankLevelRef: React.RefObject<TextInput | null>;
  bswRef: React.RefObject<TextInput | null>;
  gorRef: React.RefObject<TextInput | null>;
  fluidLevelRef: React.RefObject<TextInput | null>;
  casingPressureRef: React.RefObject<TextInput | null>;
  tubingPressureRef: React.RefObject<TextInput | null>;
  runTicketRef: React.RefObject<TextInput | null>;
  waterHaulRef: React.RefObject<TextInput | null>;
  downtimeHoursRef: React.RefObject<TextInput | null>;
  downtimeReasonRef: React.RefObject<TextInput | null>;
  notesRef: React.RefObject<TextInput | null>;

  // Form Validation
  isFormComplete: () => boolean;

  // Handlers
  handleSave: () => Promise<void>;
  handleCancelEdit: () => void;
  handleChecklistToggle: (key: keyof ChecklistState) => Promise<void>;
  handleTakePhoto: () => Promise<void>;
  handlePickFromGallery: () => Promise<void>;
  handleRemovePhoto: (index: number) => Promise<void>;
  handleGetLocation: () => Promise<void>;
  handleCopyLocation: () => Promise<void>;
  handleBarcodeLookup: () => Promise<void>;
  handleScanBarcode: () => Promise<void>;
  handleBarcodeScanSuccess: (result: BarcodeScanResult) => Promise<void>;
  handleBarcodeScannerClose: () => void;
  handlePreviousReading: () => Promise<void>;
  handleNextReading: () => Promise<void>;
  handleEditReading: (reading: FieldEntry) => void;
  handleDateSelect: (dateStr: string) => void;
  getAvailableDates: () => string[];
  getCalendarMonth: () => (Date | null)[];
  dateHasReadings: (date: Date | null) => boolean;
  isDateSelected: (date: Date | null) => boolean;
}

const FieldEntryContext = createContext<FieldEntryContextType | undefined>(undefined);

export function useFieldEntry() {
  const context = useContext(FieldEntryContext);
  if (!context) {
    throw new Error('useFieldEntry must be used within a FieldEntryProvider');
  }
  return context;
}

interface FieldEntryProviderProps {
  children: ReactNode;
  value: FieldEntryContextType;
}

export function FieldEntryProvider({ children, value }: FieldEntryProviderProps) {
  return <FieldEntryContext.Provider value={value}>{children}</FieldEntryContext.Provider>;
}
