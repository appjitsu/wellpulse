/**
 * Well-Type-Specific Fields Component
 * Renders equipment-specific fields based on selected well's wellType
 * Pattern: Context-aware forms that adapt to well configuration
 */

import React, { useRef } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { useFieldEntry } from './FieldEntryContext';

export function WellTypeSpecificFields() {
  const { selectedWell } = useFieldEntry();

  // Don't render anything if no well is selected
  if (!selectedWell) {
    return null;
  }

  // Render appropriate fields based on well type
  switch (selectedWell.wellType) {
    case 'beam-pump':
      return <BeamPumpFields />;
    case 'pcp':
      return <PCPFields />;
    case 'submersible':
      return <SubmersibleFields />;
    case 'gas-lift':
      return <GasLiftFields />;
    case 'plunger-lift':
      return <PlungerLiftFields />;
    case 'natural-flow':
      return null; // Natural flow wells don't have equipment-specific fields
    default:
      return null;
  }
}

/**
 * Beam Pump Specific Fields
 * Most common for small Permian operators
 */
function BeamPumpFields() {
  const {
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
    notesRef,
  } = useFieldEntry();

  // Local refs for keyboard navigation
  const pumpRuntimeRef = useRef<TextInput>(null);
  const strokesPerMinuteRef = useRef<TextInput>(null);
  const strokeLengthRef = useRef<TextInput>(null);
  const engineHoursRef = useRef<TextInput>(null);
  const engineTempRef = useRef<TextInput>(null);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Beam Pump Equipment</Text>
      <Text style={styles.sectionDescription}>Rod pump (pumping unit) measurements</Text>

      <View style={styles.row}>
        <View style={styles.inputGroupHalf}>
          <Text style={styles.label}>Pump Runtime (hours)</Text>
          <TextInput
            ref={pumpRuntimeRef}
            style={styles.input}
            placeholder="24.0"
            value={pumpRuntime}
            onChangeText={setPumpRuntime}
            keyboardType="decimal-pad"
            returnKeyType="next"
            onSubmitEditing={() => strokesPerMinuteRef.current?.focus()}
          />
        </View>

        <View style={styles.inputGroupHalf}>
          <Text style={styles.label}>Strokes Per Minute (SPM)</Text>
          <TextInput
            ref={strokesPerMinuteRef}
            style={styles.input}
            placeholder="12.5"
            value={strokesPerMinute}
            onChangeText={setStrokesPerMinute}
            keyboardType="decimal-pad"
            returnKeyType="next"
            onSubmitEditing={() => strokeLengthRef.current?.focus()}
          />
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.inputGroupHalf}>
          <Text style={styles.label}>Stroke Length (in)</Text>
          <TextInput
            ref={strokeLengthRef}
            style={styles.input}
            placeholder="74"
            value={strokeLength}
            onChangeText={setStrokeLength}
            keyboardType="decimal-pad"
            returnKeyType="next"
            onSubmitEditing={() => engineHoursRef.current?.focus()}
          />
        </View>

        <View style={styles.inputGroupHalf}>
          <Text style={styles.label}>Engine Hours</Text>
          <TextInput
            ref={engineHoursRef}
            style={styles.input}
            placeholder="15420"
            value={engineHours}
            onChangeText={setEngineHours}
            keyboardType="decimal-pad"
            returnKeyType="next"
            onSubmitEditing={() => engineTempRef.current?.focus()}
          />
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.inputGroupHalf}>
          <Text style={styles.label}>Engine Temp (°F)</Text>
          <TextInput
            ref={engineTempRef}
            style={styles.input}
            placeholder="195"
            value={engineTemp}
            onChangeText={setEngineTemp}
            keyboardType="decimal-pad"
            returnKeyType="next"
            onSubmitEditing={() => notesRef.current?.focus()}
          />
        </View>
      </View>
    </View>
  );
}

/**
 * PCP (Progressive Cavity Pump) Specific Fields
 * Growing in popularity for high-viscosity oil
 */
function PCPFields() {
  const {
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
    notesRef,
  } = useFieldEntry();

  // Local refs for keyboard navigation
  const motorAmpsRef = useRef<TextInput>(null);
  const motorVoltageRef = useRef<TextInput>(null);
  const motorTempRef = useRef<TextInput>(null);
  const motorRpmRef = useRef<TextInput>(null);
  const motorRunningHoursRef = useRef<TextInput>(null);
  const dischargePressureRef = useRef<TextInput>(null);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>PCP Equipment</Text>
      <Text style={styles.sectionDescription}>
        Progressive cavity pump (single-screw pump) measurements
      </Text>

      <View style={styles.row}>
        <View style={styles.inputGroupHalf}>
          <Text style={styles.label}>Motor Amps</Text>
          <TextInput
            ref={motorAmpsRef}
            style={styles.input}
            placeholder="45.2"
            value={motorAmps}
            onChangeText={setMotorAmps}
            keyboardType="decimal-pad"
            returnKeyType="next"
            onSubmitEditing={() => motorVoltageRef.current?.focus()}
          />
        </View>

        <View style={styles.inputGroupHalf}>
          <Text style={styles.label}>Motor Voltage</Text>
          <TextInput
            ref={motorVoltageRef}
            style={styles.input}
            placeholder="480"
            value={motorVoltage}
            onChangeText={setMotorVoltage}
            keyboardType="decimal-pad"
            returnKeyType="next"
            onSubmitEditing={() => motorTempRef.current?.focus()}
          />
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.inputGroupHalf}>
          <Text style={styles.label}>Motor Temp (°F)</Text>
          <TextInput
            ref={motorTempRef}
            style={styles.input}
            placeholder="185"
            value={motorTemp}
            onChangeText={setMotorTemp}
            keyboardType="decimal-pad"
            returnKeyType="next"
            onSubmitEditing={() => motorRpmRef.current?.focus()}
          />
        </View>

        <View style={styles.inputGroupHalf}>
          <Text style={styles.label}>Motor RPM</Text>
          <TextInput
            ref={motorRpmRef}
            style={styles.input}
            placeholder="350"
            value={motorRpm}
            onChangeText={setMotorRpm}
            keyboardType="decimal-pad"
            returnKeyType="next"
            onSubmitEditing={() => motorRunningHoursRef.current?.focus()}
          />
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.inputGroupHalf}>
          <Text style={styles.label}>Motor Running Hours</Text>
          <TextInput
            ref={motorRunningHoursRef}
            style={styles.input}
            placeholder="8450"
            value={motorRunningHours}
            onChangeText={setMotorRunningHours}
            keyboardType="decimal-pad"
            returnKeyType="next"
            onSubmitEditing={() => dischargePressureRef.current?.focus()}
          />
        </View>

        <View style={styles.inputGroupHalf}>
          <Text style={styles.label}>Discharge Pressure (psi)</Text>
          <TextInput
            ref={dischargePressureRef}
            style={styles.input}
            placeholder="1250"
            value={dischargePressure}
            onChangeText={setDischargePressure}
            keyboardType="decimal-pad"
            returnKeyType="next"
            onSubmitEditing={() => notesRef.current?.focus()}
          />
        </View>
      </View>
    </View>
  );
}

/**
 * Submersible Pump Specific Fields
 * Electric submersible pump (ESP) - uses similar fields to PCP
 */
function SubmersibleFields() {
  const {
    motorAmps,
    setMotorAmps,
    motorVoltage,
    setMotorVoltage,
    motorTemp,
    setMotorTemp,
    motorRunningHours,
    setMotorRunningHours,
    dischargePressure,
    setDischargePressure,
    notesRef,
  } = useFieldEntry();

  // Local refs for keyboard navigation
  const motorAmpsRef = useRef<TextInput>(null);
  const motorVoltageRef = useRef<TextInput>(null);
  const motorTempRef = useRef<TextInput>(null);
  const motorRunningHoursRef = useRef<TextInput>(null);
  const dischargePressureRef = useRef<TextInput>(null);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Submersible Pump Equipment</Text>
      <Text style={styles.sectionDescription}>Electric submersible pump (ESP) measurements</Text>

      <View style={styles.row}>
        <View style={styles.inputGroupHalf}>
          <Text style={styles.label}>Motor Amps</Text>
          <TextInput
            ref={motorAmpsRef}
            style={styles.input}
            placeholder="58.3"
            value={motorAmps}
            onChangeText={setMotorAmps}
            keyboardType="decimal-pad"
            returnKeyType="next"
            onSubmitEditing={() => motorVoltageRef.current?.focus()}
          />
        </View>

        <View style={styles.inputGroupHalf}>
          <Text style={styles.label}>Motor Voltage</Text>
          <TextInput
            ref={motorVoltageRef}
            style={styles.input}
            placeholder="2400"
            value={motorVoltage}
            onChangeText={setMotorVoltage}
            keyboardType="decimal-pad"
            returnKeyType="next"
            onSubmitEditing={() => motorTempRef.current?.focus()}
          />
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.inputGroupHalf}>
          <Text style={styles.label}>Motor Temp (°F)</Text>
          <TextInput
            ref={motorTempRef}
            style={styles.input}
            placeholder="210"
            value={motorTemp}
            onChangeText={setMotorTemp}
            keyboardType="decimal-pad"
            returnKeyType="next"
            onSubmitEditing={() => motorRunningHoursRef.current?.focus()}
          />
        </View>

        <View style={styles.inputGroupHalf}>
          <Text style={styles.label}>Motor Running Hours</Text>
          <TextInput
            ref={motorRunningHoursRef}
            style={styles.input}
            placeholder="12350"
            value={motorRunningHours}
            onChangeText={setMotorRunningHours}
            keyboardType="decimal-pad"
            returnKeyType="next"
            onSubmitEditing={() => dischargePressureRef.current?.focus()}
          />
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.inputGroupHalf}>
          <Text style={styles.label}>Discharge Pressure (psi)</Text>
          <TextInput
            ref={dischargePressureRef}
            style={styles.input}
            placeholder="1850"
            value={dischargePressure}
            onChangeText={setDischargePressure}
            keyboardType="decimal-pad"
            returnKeyType="next"
            onSubmitEditing={() => notesRef.current?.focus()}
          />
        </View>
      </View>
    </View>
  );
}

/**
 * Gas Lift Specific Fields
 * Uses compressed gas to reduce fluid density
 */
function GasLiftFields() {
  const {
    gasInjectionVolume,
    setGasInjectionVolume,
    injectionPressure,
    setInjectionPressure,
    backpressure,
    setBackpressure,
    orificeSize,
    setOrificeSize,
    notesRef,
  } = useFieldEntry();

  // Local refs for keyboard navigation
  const gasInjectionVolumeRef = useRef<TextInput>(null);
  const injectionPressureRef = useRef<TextInput>(null);
  const backpressureRef = useRef<TextInput>(null);
  const orificeSizeRef = useRef<TextInput>(null);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Gas Lift Equipment</Text>
      <Text style={styles.sectionDescription}>Compressed gas injection measurements</Text>

      <View style={styles.row}>
        <View style={styles.inputGroupHalf}>
          <Text style={styles.label}>Gas Injection Volume (MCF)</Text>
          <TextInput
            ref={gasInjectionVolumeRef}
            style={styles.input}
            placeholder="150.0"
            value={gasInjectionVolume}
            onChangeText={setGasInjectionVolume}
            keyboardType="decimal-pad"
            returnKeyType="next"
            onSubmitEditing={() => injectionPressureRef.current?.focus()}
          />
        </View>

        <View style={styles.inputGroupHalf}>
          <Text style={styles.label}>Injection Pressure (psi)</Text>
          <TextInput
            ref={injectionPressureRef}
            style={styles.input}
            placeholder="1200"
            value={injectionPressure}
            onChangeText={setInjectionPressure}
            keyboardType="decimal-pad"
            returnKeyType="next"
            onSubmitEditing={() => backpressureRef.current?.focus()}
          />
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.inputGroupHalf}>
          <Text style={styles.label}>Backpressure (psi)</Text>
          <TextInput
            ref={backpressureRef}
            style={styles.input}
            placeholder="850"
            value={backpressure}
            onChangeText={setBackpressure}
            keyboardType="decimal-pad"
            returnKeyType="next"
            onSubmitEditing={() => orificeSizeRef.current?.focus()}
          />
        </View>

        <View style={styles.inputGroupHalf}>
          <Text style={styles.label}>Orifice Size</Text>
          <TextInput
            ref={orificeSizeRef}
            style={styles.input}
            placeholder="3/8"
            value={orificeSize}
            onChangeText={setOrificeSize}
            returnKeyType="next"
            onSubmitEditing={() => notesRef.current?.focus()}
          />
        </View>
      </View>
    </View>
  );
}

/**
 * Plunger Lift Specific Fields
 * Specialized for gas wells with fluid loading
 */
function PlungerLiftFields() {
  const {
    cycleTime,
    setCycleTime,
    surfacePressure,
    setSurfacePressure,
    plungerArrival,
    setPlungerArrival,
    notesRef,
  } = useFieldEntry();

  // Local refs for keyboard navigation
  const cycleTimeRef = useRef<TextInput>(null);
  const surfacePressureRef = useRef<TextInput>(null);
  const plungerArrivalRef = useRef<TextInput>(null);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Plunger Lift Equipment</Text>
      <Text style={styles.sectionDescription}>
        Plunger cycle measurements (typically gas wells)
      </Text>

      <View style={styles.row}>
        <View style={styles.inputGroupHalf}>
          <Text style={styles.label}>Cycle Time (minutes)</Text>
          <TextInput
            ref={cycleTimeRef}
            style={styles.input}
            placeholder="45"
            value={cycleTime}
            onChangeText={setCycleTime}
            keyboardType="decimal-pad"
            returnKeyType="next"
            onSubmitEditing={() => surfacePressureRef.current?.focus()}
          />
        </View>

        <View style={styles.inputGroupHalf}>
          <Text style={styles.label}>Surface Pressure (psi)</Text>
          <TextInput
            ref={surfacePressureRef}
            style={styles.input}
            placeholder="650"
            value={surfacePressure}
            onChangeText={setSurfacePressure}
            keyboardType="decimal-pad"
            returnKeyType="next"
            onSubmitEditing={() => plungerArrivalRef.current?.focus()}
          />
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.inputGroupHalf}>
          <Text style={styles.label}>Last Plunger Arrival</Text>
          <TextInput
            ref={plungerArrivalRef}
            style={styles.input}
            placeholder="08:45 AM"
            value={plungerArrival}
            onChangeText={setPlungerArrival}
            returnKeyType="next"
            onSubmitEditing={() => notesRef.current?.focus()}
          />
        </View>
      </View>
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 16,
    fontStyle: 'italic',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  inputGroupHalf: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
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
});
