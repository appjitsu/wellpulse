/**
 * Production Data Form Component
 * Handles all production input fields (oil, gas, pressure, temperature, water cut)
 * with historical validation and stats display
 */

import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, ActivityIndicator } from 'react-native';
import { useFieldEntry } from './FieldEntryContext';
import {
  validateBSW,
  validateWaterCut,
  validateTemperature,
  validateCasingPressure,
  validateProductionDecline,
  validateGOR,
  validatePressureDifferential,
  validateWithNominalRanges,
  type ValidationResult,
  type NominalRange,
} from '../../utils/productionValidation';
import { nominalRangesRepository } from '../../src/repositories/nominalRanges.repository';

export function ProductionDataForm() {
  const {
    productionVolume,
    setProductionVolume,
    gasVolume,
    setGasVolume,
    waterVolume,
    setWaterVolume,
    waterCut,
    setWaterCut,
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
    pumpStatus,
    // setPumpStatus,
    downtimeHours,
    setDowntimeHours,
    downtimeReason,
    setDowntimeReason,
    runTicket,
    setRunTicket,
    waterHaul,
    setWaterHaul,
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
    // validationWarnings,
    allPreviousReadings,
    selectedWell,
  } = useFieldEntry();

  // State for nominal ranges
  const [nominalRanges, setNominalRanges] = useState<NominalRange[]>([]);
  const [isLoadingRanges, setIsLoadingRanges] = useState(false);

  // Fetch nominal ranges when well is selected
  useEffect(() => {
    if (!selectedWell?.id) {
      setNominalRanges([]);
      return;
    }

    const fetchRanges = async () => {
      setIsLoadingRanges(true);
      try {
        const ranges = await nominalRangesRepository.getEffectiveRanges(selectedWell.id, true);
        setNominalRanges(ranges);
        console.log(
          `[ProductionDataForm] Loaded ${ranges.length} nominal ranges for well ${selectedWell.name}`,
        );
      } catch (error) {
        console.error('[ProductionDataForm] Error loading nominal ranges:', error);
        setNominalRanges([]);
      } finally {
        setIsLoadingRanges(false);
      }
    };

    fetchRanges();
  }, [selectedWell?.id]);

  // Calculate historical stats
  const historicalStats = useMemo(() => {
    if (allPreviousReadings.length === 0) {
      return {
        productionVolume: null,
        pressure: null,
        temperature: null,
        gasVolume: null,
        waterCut: null,
      };
    }

    const calculateStats = (
      field: 'productionVolume' | 'pressure' | 'temperature' | 'gasVolume' | 'waterCut',
    ) => {
      const values = allPreviousReadings
        .map((entry) => parseFloat(entry[field] || '0'))
        .filter((v) => !isNaN(v) && v > 0);

      if (values.length === 0) return null;

      const sum = values.reduce((acc, val) => acc + val, 0);
      const avg = sum / values.length;
      const last = values[0]; // Most recent (already sorted)

      return { avg, last };
    };

    return {
      productionVolume: calculateStats('productionVolume'),
      pressure: calculateStats('pressure'),
      temperature: calculateStats('temperature'),
      gasVolume: calculateStats('gasVolume'),
      waterCut: calculateStats('waterCut'),
    };
  }, [allPreviousReadings]);

  // Calculate validation warnings using nominal ranges (with fallback to hardcoded thresholds)
  const fieldValidations = useMemo(() => {
    const previousProductionVolume = historicalStats.productionVolume?.last.toString();

    // Helper to validate with nominal ranges first, fallback to hardcoded
    const validateField = (
      fieldName: string,
      value: string | undefined,
      fallbackValidator: (value: string | undefined) => ValidationResult,
    ): ValidationResult => {
      if (!value || value === '') return { level: 'normal' };

      const numValue = parseFloat(value);
      if (isNaN(numValue)) return { level: 'normal' };

      // Try nominal ranges first if available
      if (nominalRanges.length > 0) {
        const rangeResult = validateWithNominalRanges(fieldName, numValue, nominalRanges);
        if (rangeResult.level !== 'normal') {
          // Add expected range to message
          const range = nominalRanges.find((r) => r.fieldName === fieldName);
          if (range) {
            return {
              ...rangeResult,
              message: `${rangeResult.message}\nExpected: ${range.min}-${range.max} ${range.unit}`,
            };
          }
          return rangeResult;
        }
      }

      // Fallback to hardcoded thresholds
      return fallbackValidator(value);
    };

    return {
      bsw: validateField('bsw', bsw, validateBSW),
      waterCut: validateField('waterCut', waterCut, validateWaterCut),
      temperature: validateField('temperature', temperature, validateTemperature),
      casingPressure: validateField('casingPressure', casingPressure, validateCasingPressure),
      productionVolume: validateField('oilRate', productionVolume, () =>
        validateProductionDecline(productionVolume, previousProductionVolume),
      ),
      productionDecline: validateProductionDecline(productionVolume, previousProductionVolume),
      gasVolume: validateField('gasRate', gasVolume, () => ({ level: 'normal' })),
      gor: validateField('gor', gor, validateGOR),
      pressure: validateField('pressure', pressure, () => ({ level: 'normal' })),
      pressureDifferential: validatePressureDifferential(tubingPressure, casingPressure),
    };
  }, [
    bsw,
    waterCut,
    temperature,
    casingPressure,
    productionVolume,
    gasVolume,
    pressure,
    historicalStats.productionVolume?.last,
    gor,
    tubingPressure,
    nominalRanges,
  ]);

  // Helper component for validation badge
  const ValidationBadge = ({ validation }: { validation: ValidationResult }) => {
    if (validation.level === 'normal') return null;

    const isWarning = validation.level === 'warning';
    const isCritical = validation.level === 'critical';

    return (
      <View style={styles.validationContainer}>
        <View
          style={[
            styles.validationBadge,
            isWarning && styles.validationWarning,
            isCritical && styles.validationCritical,
          ]}
        >
          <Text style={styles.validationIcon}>{isWarning ? '⚠️' : '🚨'}</Text>
          <Text style={styles.validationLevel}>{validation.level.toUpperCase()}</Text>
        </View>
        {validation.message && <Text style={styles.validationMessage}>{validation.message}</Text>}
      </View>
    );
  };

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Production Readings</Text>
        {isLoadingRanges && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#1E40AF" />
            <Text style={styles.loadingText}>Loading ranges...</Text>
          </View>
        )}
      </View>

      <View style={styles.row}>
        <View style={styles.inputGroupHalf}>
          <Text style={styles.label}>
            Oil Production (bbl) <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            ref={productionVolumeRef}
            style={[
              styles.input,
              (fieldValidations.productionVolume.level !== 'normal' ||
                fieldValidations.productionDecline.level !== 'normal') &&
                styles.inputWarning,
              fieldValidations.productionVolume.level === 'critical' && styles.inputCritical,
            ]}
            placeholder="245.50"
            value={productionVolume}
            onChangeText={setProductionVolume}
            keyboardType="decimal-pad"
            returnKeyType="next"
            onSubmitEditing={() => gasVolumeRef.current?.focus()}
          />
          {historicalStats.productionVolume && (
            <Text style={styles.historyText}>
              Avg: {historicalStats.productionVolume.avg.toFixed(1)} | Last:{' '}
              {historicalStats.productionVolume.last.toFixed(1)}
            </Text>
          )}
          <ValidationBadge validation={fieldValidations.productionVolume} />
          <ValidationBadge validation={fieldValidations.productionDecline} />
        </View>

        <View style={styles.inputGroupHalf}>
          <Text style={styles.label}>Gas Volume (mcf)</Text>
          <TextInput
            ref={gasVolumeRef}
            style={[
              styles.input,
              fieldValidations.gasVolume.level !== 'normal' && styles.inputWarning,
              fieldValidations.gasVolume.level === 'critical' && styles.inputCritical,
            ]}
            placeholder="125.00"
            value={gasVolume}
            onChangeText={setGasVolume}
            keyboardType="decimal-pad"
            returnKeyType="next"
            onSubmitEditing={() => pressureRef.current?.focus()}
          />
          {historicalStats.gasVolume && (
            <Text style={styles.historyText}>
              Avg: {historicalStats.gasVolume.avg.toFixed(1)} | Last:{' '}
              {historicalStats.gasVolume.last.toFixed(1)}
            </Text>
          )}
          <ValidationBadge validation={fieldValidations.gasVolume} />
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.inputGroupHalf}>
          <Text style={styles.label}>Pressure (psi)</Text>
          <TextInput
            ref={pressureRef}
            style={[
              styles.input,
              fieldValidations.pressure.level !== 'normal' && styles.inputWarning,
              fieldValidations.pressure.level === 'critical' && styles.inputCritical,
            ]}
            placeholder="2850.00"
            value={pressure}
            onChangeText={setPressure}
            keyboardType="decimal-pad"
            returnKeyType="next"
            onSubmitEditing={() => temperatureRef.current?.focus()}
          />
          {historicalStats.pressure && (
            <Text style={styles.historyText}>
              Avg: {historicalStats.pressure.avg.toFixed(0)} | Last:{' '}
              {historicalStats.pressure.last.toFixed(0)}
            </Text>
          )}
          <ValidationBadge validation={fieldValidations.pressure} />
        </View>

        <View style={styles.inputGroupHalf}>
          <Text style={styles.label}>Temperature (°F)</Text>
          <TextInput
            ref={temperatureRef}
            style={[
              styles.input,
              fieldValidations.temperature.level !== 'normal' && styles.inputWarning,
            ]}
            placeholder="85.50"
            value={temperature}
            onChangeText={setTemperature}
            keyboardType="decimal-pad"
            returnKeyType="next"
            onSubmitEditing={() => waterVolumeRef.current?.focus()}
          />
          {historicalStats.temperature && (
            <Text style={styles.historyText}>
              Avg: {historicalStats.temperature.avg.toFixed(1)} | Last:{' '}
              {historicalStats.temperature.last.toFixed(1)}
            </Text>
          )}
          <ValidationBadge validation={fieldValidations.temperature} />
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.inputGroupHalf}>
          <Text style={styles.label}>Water Production (bbl)</Text>
          <TextInput
            ref={waterVolumeRef}
            style={styles.input}
            placeholder="30.00"
            value={waterVolume}
            onChangeText={setWaterVolume}
            keyboardType="decimal-pad"
            returnKeyType="next"
            onSubmitEditing={() => waterCutRef.current?.focus()}
          />
        </View>

        <View style={styles.inputGroupHalf}>
          <Text style={styles.label}>Water Cut (%)</Text>
          <TextInput
            ref={waterCutRef}
            style={[
              styles.input,
              fieldValidations.waterCut.level !== 'normal' && styles.inputWarning,
            ]}
            placeholder="5.2"
            value={waterCut}
            onChangeText={setWaterCut}
            keyboardType="decimal-pad"
            returnKeyType="next"
            onSubmitEditing={() => tankLevelRef.current?.focus()}
          />
          {historicalStats.waterCut && (
            <Text style={styles.historyText}>
              Avg: {historicalStats.waterCut.avg.toFixed(1)} | Last:{' '}
              {historicalStats.waterCut.last.toFixed(1)}
            </Text>
          )}
          <ValidationBadge validation={fieldValidations.waterCut} />
        </View>
      </View>

      {/* Additional Production Metrics */}
      <Text style={[styles.sectionTitle, { marginTop: 16, marginBottom: 12 }]}>
        Additional Metrics
      </Text>

      <View style={styles.row}>
        <View style={styles.inputGroupHalf}>
          <Text style={styles.label}>Tank Level (in or %)</Text>
          <TextInput
            ref={tankLevelRef}
            style={styles.input}
            placeholder="72.5"
            value={tankLevel}
            onChangeText={setTankLevel}
            keyboardType="decimal-pad"
            returnKeyType="next"
            onSubmitEditing={() => bswRef.current?.focus()}
          />
        </View>

        <View style={styles.inputGroupHalf}>
          <Text style={styles.label}>BS&W (%)</Text>
          <TextInput
            ref={bswRef}
            style={[styles.input, fieldValidations.bsw.level !== 'normal' && styles.inputWarning]}
            placeholder="0.5"
            value={bsw}
            onChangeText={setBsw}
            keyboardType="decimal-pad"
            returnKeyType="next"
            onSubmitEditing={() => gorRef.current?.focus()}
          />
          <ValidationBadge validation={fieldValidations.bsw} />
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.inputGroupHalf}>
          <Text style={styles.label}>GOR (MCF/BBL)</Text>
          <TextInput
            ref={gorRef}
            style={[styles.input, fieldValidations.gor.level !== 'normal' && styles.inputWarning]}
            placeholder="0.51"
            value={gor}
            onChangeText={setGor}
            keyboardType="decimal-pad"
            returnKeyType="next"
            onSubmitEditing={() => fluidLevelRef.current?.focus()}
          />
          <ValidationBadge validation={fieldValidations.gor} />
        </View>

        <View style={styles.inputGroupHalf}>
          <Text style={styles.label}>Fluid Level (ft)</Text>
          <TextInput
            ref={fluidLevelRef}
            style={styles.input}
            placeholder="1250.0"
            value={fluidLevel}
            onChangeText={setFluidLevel}
            keyboardType="decimal-pad"
            returnKeyType="next"
            onSubmitEditing={() => casingPressureRef.current?.focus()}
          />
        </View>
      </View>

      {/* Pressure Measurements */}
      <Text style={[styles.sectionTitle, { marginTop: 16, marginBottom: 12 }]}>
        Pressure Readings
      </Text>

      <View style={styles.row}>
        <View style={styles.inputGroupHalf}>
          <Text style={styles.label}>Casing Pressure (psi)</Text>
          <TextInput
            ref={casingPressureRef}
            style={[
              styles.input,
              fieldValidations.casingPressure.level !== 'normal' && styles.inputWarning,
            ]}
            placeholder="1200.0"
            value={casingPressure}
            onChangeText={setCasingPressure}
            keyboardType="decimal-pad"
            returnKeyType="next"
            onSubmitEditing={() => tubingPressureRef.current?.focus()}
          />
          <ValidationBadge validation={fieldValidations.casingPressure} />
        </View>

        <View style={styles.inputGroupHalf}>
          <Text style={styles.label}>Tubing Pressure (psi)</Text>
          <TextInput
            ref={tubingPressureRef}
            style={[
              styles.input,
              fieldValidations.pressureDifferential.level !== 'normal' && styles.inputWarning,
            ]}
            placeholder="850.0"
            value={tubingPressure}
            onChangeText={setTubingPressure}
            keyboardType="decimal-pad"
            returnKeyType="next"
            onSubmitEditing={() => runTicketRef.current?.focus()}
          />
          <ValidationBadge validation={fieldValidations.pressureDifferential} />
        </View>
      </View>

      {/* Operational Data */}
      <Text style={[styles.sectionTitle, { marginTop: 16, marginBottom: 12 }]}>Operations</Text>

      <View style={styles.row}>
        <View style={styles.inputGroupHalf}>
          <Text style={styles.label}>Run Ticket #</Text>
          <TextInput
            ref={runTicketRef}
            style={styles.input}
            placeholder="RT-12345"
            value={runTicket}
            onChangeText={setRunTicket}
            returnKeyType="next"
            onSubmitEditing={() => waterHaulRef.current?.focus()}
          />
        </View>

        <View style={styles.inputGroupHalf}>
          <Text style={styles.label}>Water Haul (bbl)</Text>
          <TextInput
            ref={waterHaulRef}
            style={styles.input}
            placeholder="50.0"
            value={waterHaul}
            onChangeText={setWaterHaul}
            keyboardType="decimal-pad"
            returnKeyType="next"
            onSubmitEditing={() => {
              if (pumpStatus !== 'operating') {
                downtimeHoursRef.current?.focus();
              } else {
                notesRef.current?.focus();
              }
            }}
          />
        </View>
      </View>

      {pumpStatus !== 'operating' && (
        <View style={styles.row}>
          <View style={styles.inputGroupHalf}>
            <Text style={styles.label}>Downtime (hours)</Text>
            <TextInput
              ref={downtimeHoursRef}
              style={styles.input}
              placeholder="2.5"
              value={downtimeHours}
              onChangeText={setDowntimeHours}
              keyboardType="decimal-pad"
              returnKeyType="next"
              onSubmitEditing={() => downtimeReasonRef.current?.focus()}
            />
          </View>

          <View style={styles.inputGroupHalf}>
            <Text style={styles.label}>Downtime Reason</Text>
            <TextInput
              ref={downtimeReasonRef}
              style={styles.input}
              placeholder="Pump maintenance"
              value={downtimeReason}
              onChangeText={setDowntimeReason}
              returnKeyType="next"
              onSubmitEditing={() => notesRef.current?.focus()}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  loadingText: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputGroupHalf: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  required: {
    color: '#DC2626',
  },
  warningIcon: {
    fontSize: 14,
  },
  input: {
    height: 48,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#111827',
  },
  inputWarning: {
    borderColor: '#F59E0B',
    borderWidth: 2,
    backgroundColor: '#FEF3C7',
  },
  inputCritical: {
    borderColor: '#DC2626',
    borderWidth: 2,
    backgroundColor: '#FEE2E2',
  },
  historyText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    fontStyle: 'italic',
  },
  validationContainer: {
    marginTop: 6,
  },
  validationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  validationWarning: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  validationCritical: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#DC2626',
  },
  validationIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  validationLevel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  validationMessage: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    lineHeight: 16,
  },
});
