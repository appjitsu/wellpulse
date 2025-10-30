/**
 * Field Data Entry Screen - WellPulse Field Mobile
 * Main screen for pumpers to record production data, readings, and observations
 * Enhanced with: Keep Awake, Haptics, Network Status, Barcode Scanner, Clipboard, Sharing
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  StyleSheet,
  Alert,
  Platform,
  KeyboardAvoidingView,
  FlatList,
  useWindowDimensions,
  TouchableOpacity,
} from 'react-native';
import { useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import * as Network from 'expo-network';
import * as KeepAwake from 'expo-keep-awake';
import * as Device from 'expo-device';
import { toast } from '@backpackapp-io/react-native-toast';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { db } from '../../src/db/database';
import { FieldEntry, Photo, Well } from '../../src/db/schema';
import { showErrorAlert } from '../../src/utils/error-alert';
import { validateFieldEntry, formatValidationErrors } from '../../src/utils/validation';
import { DropdownItem } from '../../components/SearchableDropdown';
import {
  FieldEntryProvider,
  StatusBanners,
  WellSelectionSection,
  PreviousReadingCard,
  ProductionDataForm,
  WellTypeSpecificFields,
  DailyChecklistSection,
  NotesAndMediaSection,
  FormActions,
} from '../../components/field-entry';
import { BarcodeScannerModal, BarcodeScanResult } from '../../components/BarcodeScannerModal';

export default function FieldDataEntryScreen() {
  // Get well info from navigation params (when coming from wells list or editing from sync queue)
  const params = useLocalSearchParams<{ wellId?: string; wellName?: string; editId?: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 768; // Tablet and above

  // Form State
  const [wellName, setWellName] = useState('');
  const [selectedWell, setSelectedWell] = useState<Well | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);

  // Production volumes
  const [productionVolume, setProductionVolume] = useState('');
  const [gasVolume, setGasVolume] = useState('');
  const [waterVolume, setWaterVolume] = useState('');
  const [waterCut, setWaterCut] = useState('');

  // Well measurements
  const [pressure, setPressure] = useState('');
  const [temperature, setTemperature] = useState('');
  const [tankLevel, setTankLevel] = useState('');
  const [bsw, setBsw] = useState('');
  const [gor, setGor] = useState('');
  const [fluidLevel, setFluidLevel] = useState('');
  const [casingPressure, setCasingPressure] = useState('');
  const [tubingPressure, setTubingPressure] = useState('');

  // Operational data
  const [pumpStatus, setPumpStatus] = useState<'operating' | 'down' | 'maintenance'>('operating');
  const [downtimeHours, setDowntimeHours] = useState('');
  const [downtimeReason, setDowntimeReason] = useState('');
  const [runTicket, setRunTicket] = useState('');
  const [waterHaul, setWaterHaul] = useState('');

  // Beam Pump specific fields
  const [pumpRuntime, setPumpRuntime] = useState('');
  const [strokesPerMinute, setStrokesPerMinute] = useState('');
  const [strokeLength, setStrokeLength] = useState('');
  const [engineHours, setEngineHours] = useState('');
  const [engineTemp, setEngineTemp] = useState('');

  // PCP/Submersible specific fields
  const [motorAmps, setMotorAmps] = useState('');
  const [motorVoltage, setMotorVoltage] = useState('');
  const [motorTemp, setMotorTemp] = useState('');
  const [motorRpm, setMotorRpm] = useState('');
  const [motorRunningHours, setMotorRunningHours] = useState('');
  const [dischargePressure, setDischargePressure] = useState('');

  // Gas Lift specific fields
  const [gasInjectionVolume, setGasInjectionVolume] = useState('');
  const [injectionPressure, setInjectionPressure] = useState('');
  const [backpressure, setBackpressure] = useState('');
  const [orificeSize, setOrificeSize] = useState('');

  // Plunger Lift specific fields
  const [cycleTime, setCycleTime] = useState('');
  const [surfacePressure, setSurfacePressure] = useState('');
  const [plungerArrival, setPlungerArrival] = useState('');

  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Checklist State
  const [checklist, setChecklist] = useState<{
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
  }>({
    pumpOperating: false,
    noLeaks: false,
    gaugesWorking: false,
    safetyEquipment: false,
    tankLevelsChecked: false,
    separatorOperating: false,
    noAbnormalSounds: false,
    valvePositionsCorrect: false,
    heaterTreaterOperating: false,
    noVisibleCorrosion: false,
    ventLinesClear: false,
    chemicalInjectionWorking: false,
    secondaryContainmentOk: false,
    wellSiteSecure: false,
    spillKitsAvailable: false,
  });

  // Camera and media
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);

  // GPS location
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [locationPermission, setLocationPermission] = useState(false);

  // Network status
  const [isOnline, setIsOnline] = useState(true);
  const [networkType, setNetworkType] = useState<string>('');

  // Wells list for dropdown
  const [wells, setWells] = useState<DropdownItem[]>([]);
  const [allWellsData, setAllWellsData] = useState<Well[]>([]); // Full well objects for wellType lookup

  // Previous reading data
  const [previousReading, setPreviousReading] = useState<FieldEntry | null>(null);
  const [allPreviousReadings, setAllPreviousReadings] = useState<FieldEntry[]>([]);
  const [selectedReadingDate, setSelectedReadingDate] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isReadingCardCollapsed, setIsReadingCardCollapsed] = useState(true);
  const [readingsForSelectedDate, setReadingsForSelectedDate] = useState<FieldEntry[]>([]);
  const [currentReadingIndex, setCurrentReadingIndex] = useState(0);

  // Validation warnings for outlier values
  const [validationWarnings, setValidationWarnings] = useState<{
    productionVolume?: boolean;
    pressure?: boolean;
    temperature?: boolean;
    gasVolume?: boolean;
    waterCut?: boolean;
  }>({});

  // Refs for keyboard navigation and scrolling
  const scrollViewRef = useRef<ScrollView>(null);
  const flatListRef = useRef<FlatList>(null);
  const wellNameRef = useRef<TextInput>(null);
  const productionVolumeRef = useRef<TextInput>(null);
  const gasVolumeRef = useRef<TextInput>(null);
  const pressureRef = useRef<TextInput>(null);
  const temperatureRef = useRef<TextInput>(null);
  const waterVolumeRef = useRef<TextInput>(null);
  const waterCutRef = useRef<TextInput>(null);
  const tankLevelRef = useRef<TextInput>(null);
  const bswRef = useRef<TextInput>(null);
  const gorRef = useRef<TextInput>(null);
  const fluidLevelRef = useRef<TextInput>(null);
  const casingPressureRef = useRef<TextInput>(null);
  const tubingPressureRef = useRef<TextInput>(null);
  const runTicketRef = useRef<TextInput>(null);
  const waterHaulRef = useRef<TextInput>(null);
  const downtimeHoursRef = useRef<TextInput>(null);
  const downtimeReasonRef = useRef<TextInput>(null);
  const notesRef = useRef<TextInput>(null);

  // Show toast notification
  const showToast = (message: string) => {
    setToastMessage(message);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 3000);
  };

  // Keep screen awake during data entry
  useEffect(() => {
    KeepAwake.activateKeepAwakeAsync();
    return () => {
      KeepAwake.deactivateKeepAwake();
    };
  }, []);

  // Update wellName when params change (when navigating from well card)
  useEffect(() => {
    if (params.wellName) {
      setWellName(params.wellName);
    }
  }, [params.wellName]);

  // Load entry data when editing (coming from sync queue)
  useEffect(() => {
    if (params.editId && Platform.OS !== 'web') {
      (async () => {
        try {
          const entry = await db.getEntryById(params.editId!);
          if (entry) {
            // Pre-fill all form fields
            setWellName(entry.wellName);
            setProductionVolume(entry.productionVolume);
            setGasVolume(entry.gasVolume || '');
            setPressure(entry.pressure || '');
            setTemperature(entry.temperature || '');
            setWaterCut(entry.waterCut || '');

            // Beam Pump specific fields
            setPumpRuntime(entry.pumpRuntime || '');
            setStrokesPerMinute(entry.strokesPerMinute || '');
            setStrokeLength(entry.strokeLength || '');
            setEngineHours(entry.engineHours || '');
            setEngineTemp(entry.engineTemp || '');

            // PCP/Submersible specific fields
            setMotorAmps(entry.motorAmps || '');
            setMotorVoltage(entry.motorVoltage || '');
            setMotorTemp(entry.motorTemp || '');
            setMotorRpm(entry.motorRpm || '');
            setMotorRunningHours(entry.motorRunningHours || '');
            setDischargePressure(entry.dischargePressure || '');

            // Gas Lift specific fields
            setGasInjectionVolume(entry.gasInjectionVolume || '');
            setInjectionPressure(entry.injectionPressure || '');
            setBackpressure(entry.backpressure || '');
            setOrificeSize(entry.orificeSize || '');

            // Plunger Lift specific fields
            setCycleTime(entry.cycleTime || '');
            setSurfacePressure(entry.surfacePressure || '');
            setPlungerArrival(entry.plungerArrival || '');

            setNotes(entry.notes || '');
            setPhotos(entry.photos || []);
            setChecklist(entry.checklist);

            // Set location if available
            if (entry.location) {
              setLocation({
                coords: {
                  latitude: entry.location.latitude,
                  longitude: entry.location.longitude,
                  altitude: null,
                  accuracy: entry.location.accuracy || null,
                  altitudeAccuracy: null,
                  heading: null,
                  speed: null,
                },
                timestamp: Date.now(),
              });
            }

            // Set editing mode
            setEditingEntryId(entry.id);

            console.log('[Entry] Loaded entry for editing:', entry.id);
          } else {
            Alert.alert('Error', 'Entry not found');
          }
        } catch (error) {
          console.error('[Entry] Failed to load entry for editing:', error);
          showErrorAlert({
            title: 'Load Error',
            message: 'Failed to load entry for editing. Please try again.',
            error: error instanceof Error ? error : new Error(String(error)),
          });
        }
      })();
    }
  }, [params.editId]);

  // Request location permission and auto-fetch GPS on mount
  useEffect(() => {
    (async () => {
      if (Platform.OS === 'web') return; // Skip on web
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status === 'granted');

      // Auto-fetch GPS location if permission granted
      if (status === 'granted') {
        try {
          const currentLocation = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          setLocation(currentLocation);
          console.log('[Entry] Auto-tagged GPS location on mount');
        } catch (error) {
          console.error('[Entry] Failed to auto-fetch GPS:', error);
        }
      }
    })();
  }, []);

  // Monitor network status
  useEffect(() => {
    (async () => {
      if (Platform.OS === 'web') return;
      const networkState = await Network.getNetworkStateAsync();
      setIsOnline(networkState.isConnected ?? true);
      setNetworkType(networkState.type || 'UNKNOWN');
    })();
  }, []);

  // Load wells from database (works on both native and web)
  useEffect(() => {
    (async () => {
      try {
        await db.initialize();
        const allWells = await db.getAllWells();
        // Store full well objects for wellType lookup
        setAllWellsData(allWells);
        // Include operator and ID to distinguish wells with duplicate names
        const wellItems: DropdownItem[] = allWells.map((well) => {
          const shortId = well.id.slice(-6).toUpperCase();
          return {
            label: `${well.name} - ${well.operator} [${shortId}]`,
            value: well.id,
          };
        });
        setWells(wellItems);
        console.log(`[Entry] Loaded ${wellItems.length} wells for dropdown`);
      } catch (error) {
        console.error('[Entry] Failed to load wells:', error);
      }
    })();
  }, []);

  // Development mode: Fill with comprehensive test data (manually triggered)
  const fillWithTestData = async () => {
    if (wells.length === 0) {
      Alert.alert('No Wells', 'Please sync wells data first');
      return;
    }

    // Haptic feedback
    if (Platform.OS !== 'web') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    // 1. Select random well first (enables well-type-specific fields)
    const randomWell = wells[Math.floor(Math.random() * wells.length)];
    handleWellSelection(randomWell.label);

    // 2. Generate production data (30% chance of out-of-range values)
    setProductionVolume(
      String(
        Math.random() > 0.7 ? Math.floor(Math.random() * 1000) : Math.floor(Math.random() * 200),
      ),
    );
    setGasVolume(
      String(
        Math.random() > 0.7 ? Math.floor(Math.random() * 10000) : Math.floor(Math.random() * 2000),
      ),
    );
    setWaterVolume(String(Math.floor(Math.random() * 100)));
    setWaterCut(
      String((Math.random() > 0.6 ? Math.random() * 100 : Math.random() * 50).toFixed(2)),
    );

    // 3. Generate pressure/temperature (30% chance of out-of-range values)
    setPressure(
      String(
        Math.random() > 0.7 ? Math.floor(Math.random() * 5000) : Math.floor(Math.random() * 3000),
      ),
    );
    setTemperature(String(Math.floor(Math.random() * 300)));

    // 4. Generate additional production metrics (some violate rules)
    setTankLevel(String(Math.floor(Math.random() * 100)));
    setBsw(String((Math.random() * 12).toFixed(2))); // Some > 1% (violates sales requirement)
    setGor(String(Math.floor(Math.random() * 15000))); // Some > 6000 (high GOR warning)
    setFluidLevel(String(Math.floor(Math.random() * 5000)));
    setCasingPressure(String(Math.random() > 0.8 ? Math.floor(Math.random() * 500) : 0)); // Some with abnormal pressure
    setTubingPressure(String(Math.floor(Math.random() * 2500)));

    // 5. Generate operational data
    const statuses: Array<'operating' | 'down' | 'maintenance'> = [
      'operating',
      'down',
      'maintenance',
    ];
    const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
    setPumpStatus(randomStatus);

    if (randomStatus === 'down' || randomStatus === 'maintenance') {
      setDowntimeHours(String(Math.floor(Math.random() * 72)));
      const reasons = [
        'Pump failure',
        'Rod parted',
        'Electrical issue',
        'Scheduled maintenance',
        'Weather delay',
      ];
      setDowntimeReason(reasons[Math.floor(Math.random() * reasons.length)]);
    } else {
      setDowntimeHours('');
      setDowntimeReason('');
    }

    setRunTicket(String(Math.floor(Math.random() * 500)));
    setWaterHaul(String(Math.floor(Math.random() * 200)));

    // 6. Generate well-type-specific fields based on selected well
    const well = allWellsData.find((w) => w.id === randomWell.value);
    if (well) {
      // Reset all equipment fields first
      setPumpRuntime('');
      setStrokesPerMinute('');
      setStrokeLength('');
      setEngineHours('');
      setEngineTemp('');
      setMotorAmps('');
      setMotorVoltage('');
      setMotorTemp('');
      setMotorRpm('');
      setMotorRunningHours('');
      setDischargePressure('');
      setGasInjectionVolume('');
      setInjectionPressure('');
      setBackpressure('');
      setOrificeSize('');
      setCycleTime('');
      setSurfacePressure('');
      setPlungerArrival('');

      // Populate fields specific to this well type
      switch (well.wellType) {
        case 'beam-pump':
          setPumpRuntime(String(Math.floor(Math.random() * 24)));
          setStrokesPerMinute(String(Math.floor(Math.random() * 30)));
          setStrokeLength(String(Math.floor(Math.random() * 120)));
          setEngineHours(String(Math.floor(Math.random() * 25000)));
          setEngineTemp(String(Math.floor(Math.random() * 350)));
          break;

        case 'pcp':
          setMotorAmps(String((Math.random() * 150).toFixed(1)));
          setMotorVoltage(String(Math.floor(Math.random() * 600)));
          setMotorTemp(String(Math.floor(Math.random() * 300)));
          setMotorRpm(String(Math.floor(Math.random() * 500)));
          setMotorRunningHours(String(Math.floor(Math.random() * 15000)));
          setDischargePressure(String(Math.floor(Math.random() * 2000)));
          break;

        case 'submersible':
          setMotorAmps(String((Math.random() * 200).toFixed(1)));
          setMotorVoltage(String(Math.floor(Math.random() * 3000)));
          setMotorTemp(String(Math.floor(Math.random() * 300)));
          setMotorRunningHours(String(Math.floor(Math.random() * 20000)));
          setDischargePressure(String(Math.floor(Math.random() * 2500)));
          break;

        case 'gas-lift': {
          setGasInjectionVolume(String(Math.floor(Math.random() * 600)));
          setInjectionPressure(String(Math.floor(Math.random() * 1500)));
          setBackpressure(String(Math.floor(Math.random() * 1000)));
          const orifices = ['1/4', '3/8', '1/2', '5/8', '3/4'];
          setOrificeSize(orifices[Math.floor(Math.random() * orifices.length)]);
          break;
        }

        case 'plunger-lift': {
          setCycleTime(String(Math.floor(Math.random() * 90)));
          setSurfacePressure(String(Math.floor(Math.random() * 800)));
          const hour = Math.floor(Math.random() * 12) + 1;
          const minute = String(Math.floor(Math.random() * 60)).padStart(2, '0');
          const ampm = Math.random() > 0.5 ? 'AM' : 'PM';
          setPlungerArrival(`${hour}:${minute} ${ampm}`);
          break;
        }
      }

      console.log('[Entry] Test data generated for', well.name, '(Type:', well.wellType, ')');
    }

    // 7. Check all checklist items
    setChecklist({
      pumpOperating: true,
      noLeaks: true,
      gaugesWorking: true,
      safetyEquipment: true,
      tankLevelsChecked: true,
      separatorOperating: true,
      noAbnormalSounds: true,
      valvePositionsCorrect: true,
      heaterTreaterOperating: true,
      noVisibleCorrosion: true,
      ventLinesClear: true,
      chemicalInjectionWorking: true,
      secondaryContainmentOk: true,
      wellSiteSecure: true,
      spillKitsAvailable: true,
    });

    // 8. Add test notes
    setNotes(
      `Test entry for ${randomWell.label} - Generated at ${new Date().toLocaleTimeString()}`,
    );

    // Success feedback
    toast.success('Test data generated! (Some values intentionally out of range)', {
      duration: 4000,
    });
    if (Platform.OS !== 'web') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  // Load previous readings when well is selected
  const loadPreviousReading = async (selectedWellName: string) => {
    if (Platform.OS === 'web') return;

    try {
      const entries = await db.getAllEntries();
      const previousEntries = entries.filter((entry) => entry.wellName === selectedWellName);

      if (previousEntries.length > 0) {
        // Sort by date (most recent first)
        const sorted = previousEntries.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        setAllPreviousReadings(sorted);

        // If no date selected, show all readings from today
        if (!selectedReadingDate) {
          const today = new Date().toDateString();
          const todayReadings = sorted.filter((entry) => {
            const entryDate = new Date(entry.createdAt).toDateString();
            return entryDate === today;
          });

          if (todayReadings.length > 0) {
            setReadingsForSelectedDate(todayReadings);
            setPreviousReading(todayReadings[0]);
            setCurrentReadingIndex(0);
          } else {
            // If no readings today, show most recent reading
            setReadingsForSelectedDate([sorted[0]]);
            setPreviousReading(sorted[0]);
            setCurrentReadingIndex(0);
          }
        } else {
          // Find all readings for selected date
          const readingsOnDate = sorted.filter((entry) => {
            const entryDate = new Date(entry.createdAt).toDateString();
            const selectedDate = new Date(selectedReadingDate).toDateString();
            return entryDate === selectedDate;
          });

          if (readingsOnDate.length > 0) {
            setReadingsForSelectedDate(readingsOnDate);
            setPreviousReading(
              readingsOnDate[Math.min(currentReadingIndex, readingsOnDate.length - 1)],
            );
          } else {
            setReadingsForSelectedDate([sorted[0]]);
            setPreviousReading(sorted[0]);
            setCurrentReadingIndex(0);
          }
        }

        console.log('[Entry] Loaded', sorted.length, 'previous readings for', selectedWellName);
      } else {
        setAllPreviousReadings([]);
        setReadingsForSelectedDate([]);
        setPreviousReading(null);
        console.log('[Entry] No previous readings found for', selectedWellName);
      }
    } catch (error) {
      console.error('[Entry] Failed to load previous reading:', error);
      setAllPreviousReadings([]);
      setReadingsForSelectedDate([]);
      setPreviousReading(null);
    }
  };

  // Validate current values against historical averages
  const validateAgainstHistory = () => {
    // Skip validation if no historical data or well not selected
    if (allPreviousReadings.length === 0 || !wellName) {
      setValidationWarnings({});
      return;
    }

    const warnings: typeof validationWarnings = {};
    const OUTLIER_THRESHOLD = 0.3; // 30% deviation threshold

    // Calculate average for each field
    const calculateAverage = (
      field: keyof Pick<
        FieldEntry,
        'productionVolume' | 'pressure' | 'temperature' | 'gasVolume' | 'waterCut'
      >,
    ) => {
      const values = allPreviousReadings
        .map((entry) => parseFloat(entry[field] || '0'))
        .filter((v) => !isNaN(v) && v > 0);

      if (values.length === 0) return null;

      const sum = values.reduce((acc, val) => acc + val, 0);
      return sum / values.length;
    };

    // Check production volume
    if (productionVolume.trim()) {
      const currentValue = parseFloat(productionVolume);
      const avgValue = calculateAverage('productionVolume');
      if (avgValue && !isNaN(currentValue) && currentValue > 0) {
        const deviation = Math.abs(currentValue - avgValue) / avgValue;
        warnings.productionVolume = deviation > OUTLIER_THRESHOLD;
      }
    }

    // Check pressure
    if (pressure.trim()) {
      const currentValue = parseFloat(pressure);
      const avgValue = calculateAverage('pressure');
      if (avgValue && !isNaN(currentValue) && currentValue > 0) {
        const deviation = Math.abs(currentValue - avgValue) / avgValue;
        warnings.pressure = deviation > OUTLIER_THRESHOLD;
      }
    }

    // Check temperature
    if (temperature.trim()) {
      const currentValue = parseFloat(temperature);
      const avgValue = calculateAverage('temperature');
      if (avgValue && !isNaN(currentValue) && currentValue > 0) {
        const deviation = Math.abs(currentValue - avgValue) / avgValue;
        warnings.temperature = deviation > OUTLIER_THRESHOLD;
      }
    }

    // Check gas volume
    if (gasVolume.trim()) {
      const currentValue = parseFloat(gasVolume);
      const avgValue = calculateAverage('gasVolume');
      if (avgValue && !isNaN(currentValue) && currentValue > 0) {
        const deviation = Math.abs(currentValue - avgValue) / avgValue;
        warnings.gasVolume = deviation > OUTLIER_THRESHOLD;
      }
    }

    // Check water cut
    if (waterCut.trim()) {
      const currentValue = parseFloat(waterCut);
      const avgValue = calculateAverage('waterCut');
      if (avgValue && !isNaN(currentValue) && currentValue > 0) {
        const deviation = Math.abs(currentValue - avgValue) / avgValue;
        warnings.waterCut = deviation > OUTLIER_THRESHOLD;
      }
    }

    setValidationWarnings(warnings);
  };

  // Watch for well name changes and load previous reading
  useEffect(() => {
    if (wellName && Platform.OS !== 'web') {
      loadPreviousReading(wellName);
    } else {
      setAllPreviousReadings([]);
      setPreviousReading(null);
      setSelectedReadingDate(null);
    }
  }, [wellName]);

  // Watch for date selection changes
  useEffect(() => {
    if (wellName && selectedReadingDate) {
      loadPreviousReading(wellName);
    }
  }, [selectedReadingDate]);

  // Validate values whenever they change
  useEffect(() => {
    validateAgainstHistory();
  }, [productionVolume, pressure, temperature, gasVolume, waterCut, allPreviousReadings]);

  // FlatList viewability configuration for tracking current reading
  // Disabled for now - uncomment if implementing reading carousel swipe functionality
  // const viewabilityConfig = useRef({
  //   viewAreaCoveragePercentThreshold: 50,
  //   minimumViewTime: 100,
  // }).current;

  // const onViewableItemsChanged = useRef(({viewableItems}: {viewableItems: Array<{index: number}>}) => {
  //   if (viewableItems.length > 0) {
  //     const newIndex = viewableItems[0].index;
  //     if (newIndex !== currentReadingIndex) {
  //       setCurrentReadingIndex(newIndex);
  //       setPreviousReading(readingsForSelectedDate[newIndex]);
  //       // Provide haptic feedback on swipe
  //       if (Platform.OS !== 'web') {
  //         Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  //       }
  //     }
  //   }
  // }).current;

  // Get unique dates that have readings for the current well
  const getAvailableDates = (): string[] => {
    const uniqueDates = new Set<string>();
    allPreviousReadings.forEach((entry) => {
      const dateStr = new Date(entry.createdAt).toDateString();
      uniqueDates.add(dateStr);
    });
    return Array.from(uniqueDates).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  };

  // Get calendar month data for custom calendar view
  const getCalendarMonth = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();

    // Get first day of month and total days
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Create array of all dates in month
    const dates: (Date | null)[] = [];

    // Add empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
      dates.push(null);
    }

    // Add all days in month
    for (let day = 1; day <= daysInMonth; day++) {
      dates.push(new Date(year, month, day));
    }

    return dates;
  };

  // Check if a date has readings
  const dateHasReadings = (date: Date | null): boolean => {
    if (!date) return false;
    const dateStr = date.toDateString();
    return getAvailableDates().includes(dateStr);
  };

  // Check if date is selected
  const isDateSelected = (date: Date | null): boolean => {
    if (!date || !selectedReadingDate) return false;
    return date.toDateString() === new Date(selectedReadingDate).toDateString();
  };

  const handleDateSelect = (dateStr: string) => {
    setSelectedReadingDate(dateStr);
    setCurrentReadingIndex(0); // Reset to first reading of the day
    setShowDatePicker(false);
  };

  // Navigate to previous reading in carousel
  const handlePreviousReading = async () => {
    if (currentReadingIndex > 0) {
      const newIndex = currentReadingIndex - 1;
      setCurrentReadingIndex(newIndex);
      setPreviousReading(readingsForSelectedDate[newIndex]);

      // Scroll FlatList to previous item on mobile
      if (Platform.OS !== 'web' && flatListRef.current) {
        flatListRef.current.scrollToIndex({
          index: newIndex,
          animated: true,
        });
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }
  };

  // Navigate to next reading in carousel
  const handleNextReading = async () => {
    if (currentReadingIndex < readingsForSelectedDate.length - 1) {
      const newIndex = currentReadingIndex + 1;
      setCurrentReadingIndex(newIndex);
      setPreviousReading(readingsForSelectedDate[newIndex]);

      // Scroll FlatList to next item on mobile
      if (Platform.OS !== 'web' && flatListRef.current) {
        flatListRef.current.scrollToIndex({
          index: newIndex,
          animated: true,
        });
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }
  };

  // Navigate to edit a previous reading
  const handleEditReading = (reading: FieldEntry) => {
    router.push({
      pathname: '/(tabs)/entry',
      params: {
        editId: reading.id,
      },
    });
  };

  // Barcode/QR lookup from backend (using enhanced scanner)
  const handleBarcodeLookup = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Scanner Not Available', 'Barcode scanner is only available on mobile devices');
      return;
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowBarcodeScanner(true);
  };

  const handleChecklistToggle = async (key: keyof typeof checklist) => {
    if (Platform.OS !== 'web') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleScanBarcode = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Scanner Not Available', 'Barcode scanner is only available on mobile devices');
      return;
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowBarcodeScanner(true);
  };

  // Handle successful barcode scan from enhanced scanner
  const handleBarcodeScanSuccess = async (result: BarcodeScanResult) => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setWellName(result.wellName);

    // Show cross-platform success toast
    toast.success(`${result.wellName} (API: ${result.apiNumber})`, { duration: 4000 });

    console.log('[Entry] Barcode scan successful:', result);
  };

  // Handle barcode scanner close
  const handleBarcodeScannerClose = () => {
    setShowBarcodeScanner(false);
  };

  const handleCopyLocation = async () => {
    if (!location) {
      Alert.alert('No Location', 'Please tag GPS location first');
      return;
    }

    const locationText = `${location.coords.latitude.toFixed(6)}, ${location.coords.longitude.toFixed(6)}`;
    await Clipboard.setStringAsync(locationText);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Copied', 'GPS coordinates copied to clipboard');
  };

  const handlePickFromGallery = async () => {
    // expo-image-picker works on web via file input fallback
    if (Platform.OS !== 'web') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets.length > 0) {
      const newPhotos: Photo[] = result.assets.map((asset) => ({
        localUri: asset.uri,
        uploadStatus: 'pending' as const,
      }));
      setPhotos((prev) => [...prev, ...newPhotos]);

      if (Platform.OS !== 'web') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      // Platform-appropriate success message
      const itemLabel = Platform.OS === 'web' ? 'file(s)' : 'photo(s)';
      toast.success(`${newPhotos.length} ${itemLabel} added to entry`, { duration: 3000 });
    }
  };

  const handleCancelEdit = () => {
    // Navigate back to entry screen with well name, clearing edit mode
    router.replace({
      pathname: '/(tabs)/entry',
      params: {
        wellName: wellName,
      },
    });
  };

  const handleSave = async () => {
    // Validate all form data before saving
    const validationErrors = validateFieldEntry({
      wellName,
      productionVolume,
      gasVolume,
      pressure,
      temperature,
      waterCut,
      notes,
    });

    if (validationErrors.length > 0) {
      const errorMessage = formatValidationErrors(validationErrors);
      Alert.alert('Validation Error', errorMessage);
      return;
    }

    setIsSaving(true);

    try {
      const entryData = {
        wellName,
        productionVolume,
        gasVolume: gasVolume || undefined,
        waterVolume: waterVolume || undefined,
        waterCut: waterCut || undefined,
        pressure: pressure || undefined,
        temperature: temperature || undefined,
        tankLevel: tankLevel || undefined,
        bsw: bsw || undefined,
        gor: gor || undefined,
        fluidLevel: fluidLevel || undefined,
        casingPressure: casingPressure || undefined,
        tubingPressure: tubingPressure || undefined,
        pumpStatus: pumpStatus || undefined,
        downtimeHours: downtimeHours || undefined,
        downtimeReason: downtimeReason || undefined,
        runTicket: runTicket || undefined,
        waterHaul: waterHaul || undefined,
        // Beam Pump specific fields
        pumpRuntime: pumpRuntime || undefined,
        strokesPerMinute: strokesPerMinute || undefined,
        strokeLength: strokeLength || undefined,
        engineHours: engineHours || undefined,
        engineTemp: engineTemp || undefined,
        // PCP/Submersible specific fields
        motorAmps: motorAmps || undefined,
        motorVoltage: motorVoltage || undefined,
        motorTemp: motorTemp || undefined,
        motorRpm: motorRpm || undefined,
        motorRunningHours: motorRunningHours || undefined,
        dischargePressure: dischargePressure || undefined,
        // Gas Lift specific fields
        gasInjectionVolume: gasInjectionVolume || undefined,
        injectionPressure: injectionPressure || undefined,
        backpressure: backpressure || undefined,
        orificeSize: orificeSize || undefined,
        // Plunger Lift specific fields
        cycleTime: cycleTime || undefined,
        surfacePressure: surfacePressure || undefined,
        plungerArrival: plungerArrival || undefined,
        notes: notes || undefined,
        photos,
        location: location
          ? {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              accuracy: location.coords.accuracy || undefined,
            }
          : undefined,
        checklist,
      };

      if (editingEntryId) {
        // Update existing entry
        await db.updateEntry(editingEntryId, entryData);
        showToast('✓ Entry updated successfully');

        // Clear editing mode
        setEditingEntryId(null);

        // Navigate back to entry screen with well name to show updated entry in previous readings
        router.replace({
          pathname: '/(tabs)/entry',
          params: {
            wellName: wellName,
            // Don't pass editId to ensure we're not in edit mode
          },
        });
        return; // Exit early to prevent form reset
      } else {
        // Create new entry
        await db.saveFieldEntry(entryData);
      }

      // Reset form (only for new entries)
      setWellName('');
      setProductionVolume('');
      setPressure('');
      setTemperature('');
      setGasVolume('');
      setWaterCut('');
      setNotes('');
      setPhotos([]);
      setLocation(null);
      setPreviousReading(null);
      setChecklist({
        pumpOperating: false,
        noLeaks: false,
        gaugesWorking: false,
        safetyEquipment: false,
        tankLevelsChecked: false,
        separatorOperating: false,
        noAbnormalSounds: false,
        valvePositionsCorrect: false,
        heaterTreaterOperating: false,
        noVisibleCorrosion: false,
        ventLinesClear: false,
        chemicalInjectionWorking: false,
        secondaryContainmentOk: false,
        wellSiteSecure: false,
        spillKitsAvailable: false,
      });

      // Scroll to top and focus well name for next entry
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      setTimeout(() => wellNameRef.current?.focus(), 300);
    } catch (error) {
      console.error('Save error:', error);
      showErrorAlert({
        title: editingEntryId ? 'Update Error' : 'Save Error',
        message: editingEntryId
          ? 'Failed to update entry. Please try again.'
          : 'Failed to save entry. Please try again.',
        error: error instanceof Error ? error : new Error(String(error)),
        technicalDetails:
          'Check database connection and storage permissions. Entry data may not have been saved.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTakePhoto = async () => {
    // Camera works on web (WebRTC) and mobile, but permissions differ
    if (Platform.OS !== 'web') {
      // Request camera permission on mobile
      if (!cameraPermission) {
        const { status } = await requestCameraPermission();
        if (status !== 'granted') {
          toast.error('Camera permission is required to take photos', { duration: 3000 });
          return;
        }
      }

      if (!cameraPermission?.granted) {
        toast.error('Camera permission is required to take photos', { duration: 3000 });
        return;
      }

      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    // Use Image Picker with camera (works on web via WebRTC)
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setPhotos((prev) => [
          ...prev,
          {
            localUri: result.assets[0].uri,
            uploadStatus: 'pending' as const,
          },
        ]);

        if (Platform.OS !== 'web') {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }

        // Platform-appropriate success message
        const itemLabel = Platform.OS === 'web' ? 'Image' : 'Photo';
        toast.success(`${itemLabel} added to entry`, { duration: 3000 });
      }
    } catch (error) {
      // Check if running on simulator (camera not available)
      if (!Device.isDevice) {
        toast.error(
          'Camera not available on simulator. Use a physical device or choose from library.',
          { duration: 4000 },
        );
      } else {
        // Other camera errors
        const errorMessage = error instanceof Error ? error.message : 'Failed to open camera';
        toast.error(errorMessage, { duration: 3000 });
      }
    }
  };

  const handleGetLocation = async () => {
    if (Platform.OS === 'web') {
      // Use browser geolocation API
      if (!navigator.geolocation) {
        Alert.alert('GPS Not Available', 'Geolocation is not supported by your browser');
        return;
      }

      try {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const currentLocation: Location.LocationObject = {
              coords: {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                altitude: position.coords.altitude,
                accuracy: position.coords.accuracy,
                altitudeAccuracy: position.coords.altitudeAccuracy,
                heading: position.coords.heading,
                speed: position.coords.speed,
              },
              timestamp: position.timestamp,
            };
            setLocation(currentLocation);
            Alert.alert(
              'GPS Tagged',
              `Location: ${currentLocation.coords.latitude.toFixed(6)}, ${currentLocation.coords.longitude.toFixed(6)}\nAccuracy: ${currentLocation.coords.accuracy?.toFixed(1)}m`,
            );
          },
          (error) => {
            console.error('Browser geolocation error:', error);
            Alert.alert(
              'GPS Error',
              error.code === 1
                ? 'Location permission denied. Please enable location access in your browser settings.'
                : error.code === 2
                  ? 'Location unavailable. Please check your internet connection and try again.'
                  : error.code === 3
                    ? 'Location request timed out. Please try again.'
                    : 'Failed to get GPS location. Please try again.',
            );
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0,
          },
        );
      } catch (error) {
        console.error('Geolocation error:', error);
        Alert.alert('GPS Error', 'Failed to get GPS location. Please try again.');
      }
      return;
    }

    // Mobile: Use Expo Location
    if (!locationPermission) {
      Alert.alert('Permission Denied', 'Location permission is required');
      return;
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLocation(currentLocation);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'GPS Tagged',
        `Location: ${currentLocation.coords.latitude.toFixed(6)}, ${currentLocation.coords.longitude.toFixed(6)}\nAccuracy: ${currentLocation.coords.accuracy?.toFixed(1)}m`,
      );
    } catch (error) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showErrorAlert({
        title: 'GPS Error',
        message:
          'Failed to get GPS location. Please try again or ensure location services are enabled.',
        error: error instanceof Error ? error : new Error(String(error)),
        technicalDetails: 'Check device location settings and GPS signal strength.',
      });
    }
  };

  const handleRemovePhoto = async (index: number) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  // Handler to set both wellName and selectedWell when well is chosen from dropdown
  const handleWellSelection = (wellLabel: string) => {
    setWellName(wellLabel);

    // Find the matching well object by comparing the dropdown item value (well.id)
    // The wellLabel passed from dropdown is the full label, but we need to find by ID
    const selectedItem = wells.find((item) => item.label === wellLabel);
    if (selectedItem) {
      const matchingWell = allWellsData.find((well) => well.id === selectedItem.value);
      setSelectedWell(matchingWell || null);
      console.log('[Entry] Selected well:', matchingWell?.name, 'Type:', matchingWell?.wellType);
    } else {
      setSelectedWell(null);
    }
  };

  // Form validation helper
  const isFormComplete = () => {
    // Required fields: wellName and productionVolume
    return wellName.trim() !== '' && productionVolume.trim() !== '';
  };

  // Build context value object
  const contextValue = {
    // Form State
    wellName,
    setWellName: handleWellSelection, // Use wrapper that also sets selectedWell
    selectedWell,
    setSelectedWell,

    // Production volumes
    productionVolume,
    setProductionVolume,
    gasVolume,
    setGasVolume,
    waterVolume,
    setWaterVolume,
    waterCut,
    setWaterCut,

    // Well measurements
    pressure,
    setPressure,
    temperature,
    setTemperature,
    tankLevel,
    setTankLevel,
    bsw,
    setBsw,
    gor,
    setGor,
    fluidLevel,
    setFluidLevel,
    casingPressure,
    setCasingPressure,
    tubingPressure,
    setTubingPressure,

    // Operational data
    pumpStatus,
    setPumpStatus,
    downtimeHours,
    setDowntimeHours,
    downtimeReason,
    setDowntimeReason,
    runTicket,
    setRunTicket,
    waterHaul,
    setWaterHaul,

    // Beam Pump specific fields
    pumpRuntime,
    setPumpRuntime,
    strokesPerMinute,
    setStrokesPerMinute,
    strokeLength,
    setStrokeLength,
    engineHours,
    setEngineHours,
    engineTemp,
    setEngineTemp,

    // PCP/Submersible specific fields
    motorAmps,
    setMotorAmps,
    motorVoltage,
    setMotorVoltage,
    motorTemp,
    setMotorTemp,
    motorRpm,
    setMotorRpm,
    motorRunningHours,
    setMotorRunningHours,
    dischargePressure,
    setDischargePressure,

    // Gas Lift specific fields
    gasInjectionVolume,
    setGasInjectionVolume,
    injectionPressure,
    setInjectionPressure,
    backpressure,
    setBackpressure,
    orificeSize,
    setOrificeSize,

    // Plunger Lift specific fields
    cycleTime,
    setCycleTime,
    surfacePressure,
    setSurfacePressure,
    plungerArrival,
    setPlungerArrival,

    notes,
    setNotes,
    photos,
    setPhotos,
    checklist,
    setChecklist,

    // Edit Mode
    editingEntryId,

    // UI State
    isSaving,
    isOnline,
    networkType,

    // Wells & Previous Readings
    wells,
    previousReading,
    allPreviousReadings,
    readingsForSelectedDate,
    currentReadingIndex,
    selectedReadingDate,
    isReadingCardCollapsed,
    showDatePicker,
    setIsReadingCardCollapsed,
    setShowDatePicker,

    // Validation
    validationWarnings,

    // Camera & Location
    cameraPermission,
    location,
    locationPermission,
    showBarcodeScanner,
    setShowBarcodeScanner,

    // Refs
    wellNameRef,
    productionVolumeRef,
    gasVolumeRef,
    pressureRef,
    temperatureRef,
    waterVolumeRef,
    waterCutRef,
    tankLevelRef,
    bswRef,
    gorRef,
    fluidLevelRef,
    casingPressureRef,
    tubingPressureRef,
    runTicketRef,
    waterHaulRef,
    downtimeHoursRef,
    downtimeReasonRef,
    notesRef,

    // Handlers
    handleSave,
    handleCancelEdit,
    handleChecklistToggle,
    handleTakePhoto,
    handlePickFromGallery,
    handleRemovePhoto,
    handleGetLocation,
    handleCopyLocation,
    handleBarcodeLookup,
    handleScanBarcode,
    handleBarcodeScanSuccess,
    handleBarcodeScannerClose,
    handlePreviousReading,
    handleNextReading,
    handleEditReading,
    handleDateSelect,
    getAvailableDates,
    getCalendarMonth,
    dateHasReadings,
    isDateSelected,

    // Form Validation
    isFormComplete,
  };

  return (
    <>
      <FieldEntryProvider value={contextValue}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <ScrollView
            ref={scrollViewRef}
            style={styles.container}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.content}>
              <StatusBanners />

              {/* Development Mode: Test Data Button */}
              {__DEV__ && Platform.OS !== 'web' && (
                <View style={styles.testDataButtonContainer}>
                  <TouchableOpacity style={styles.testDataButton} onPress={fillWithTestData}>
                    <Text style={styles.testDataIcon}>🎲</Text>
                    <Text style={styles.testDataButtonText}>Fill with Test Data</Text>
                  </TouchableOpacity>
                </View>
              )}

              <WellSelectionSection />
              <PreviousReadingCard />

              {/* Responsive Layout: Horizontal on large screens, vertical on small */}
              <View style={isLargeScreen ? styles.responsiveRow : styles.responsiveColumn}>
                <View style={isLargeScreen ? styles.responsiveHalf : styles.responsiveFull}>
                  <ProductionDataForm />
                </View>
                <View style={isLargeScreen ? styles.responsiveHalf : styles.responsiveFull}>
                  <DailyChecklistSection />
                </View>
              </View>

              {/* Well-Type-Specific Equipment Fields (conditionally rendered) */}
              <WellTypeSpecificFields />

              <NotesAndMediaSection />
              <FormActions />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </FieldEntryProvider>

      {/* Enhanced Barcode Scanner Modal */}
      <BarcodeScannerModal
        visible={showBarcodeScanner}
        onClose={handleBarcodeScannerClose}
        onScanSuccess={handleBarcodeScanSuccess}
      />

      {/* Toast Notification - OUTSIDE provider */}
      {toastVisible && (
        <View style={styles.toastContainer}>
          <View style={styles.toast}>
            <Text style={styles.toastText}>{toastMessage}</Text>
          </View>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    padding: 16,
  },
  responsiveRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 0,
  },
  responsiveColumn: {
    flexDirection: 'column',
  },
  responsiveHalf: {
    flex: 1,
  },
  responsiveFull: {
    width: '100%',
  },
  toastContainer: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    zIndex: 99999,
  },
  toast: {
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 4,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  // Test Data Button (Development Only)
  testDataButtonContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FEF3C7', // Light yellow background
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#FDE047',
    borderStyle: 'dashed',
  },
  testDataButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FBBF24', // Amber
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  testDataIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  testDataButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#78350F', // Dark amber
  },
});
