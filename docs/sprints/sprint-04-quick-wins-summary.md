# Sprint 4: Quick Wins & Immediate Fixes

**Status**: Ready for Implementation
**Priority**: CRITICAL (fixes developer productivity issues)

---

## Immediate Fixes (Today)

### ✅ Fix #12: Keyboard Navigation Order on Data Entry Form

**Problem**: Hitting "Next" on keyboard doesn't follow visual order of fields

**Root Cause**:
- Temperature field (line 241) navigates to Gas Volume (circular reference!)
- Gas Volume (line 190) skips Pressure & Temperature entirely
- Inconsistent tab order breaks UX

**Solution**: Update `onSubmitEditing` handlers to match visual top-to-bottom, left-to-right order

**Correct Visual Order:**
```
Row 1: Production Volume → Gas Volume
Row 2: Water Volume → Water Cut
Row 3: Pressure → Temperature
Row 4: Tank Level → BS&W
Row 5: GOR → Fluid Level
Row 6: Casing Pressure → Tubing Pressure
Row 7: Pump Status → Downtime Hours
Row 8: Run Ticket → Water Haul
```

**Implementation**:
```typescript
// Production Volume → Gas Volume (same row)
onSubmitEditing={() => gasVolumeRef.current?.focus()}

// Gas Volume → Water Volume (next row, first field)
onSubmitEditing={() => waterVolumeRef.current?.focus()}

// Water Volume → Water Cut (same row)
onSubmitEditing={() => waterCutRef.current?.focus()}

// Water Cut → Pressure (next row, first field)
onSubmitEditing={() => pressureRef.current?.focus()}

// Pressure → Temperature (same row)
onSubmitEditing={() => temperatureRef.current?.focus()}

// Temperature → Tank Level (next row)
onSubmitEditing={() => tankLevelRef.current?.focus()}

// ... continue for all fields ...
```

**Files to Update**:
1. `apps/mobile/components/field-entry/ProductionDataForm.tsx` - Fix existing navigation
2. `apps/mobile/components/field-entry/WellTypeSpecificFields.tsx` - Add navigation for equipment fields
3. `apps/mobile/components/field-entry/NotesAndMediaSection.tsx` - Add notesRef for final field

---

### ✅ Fix #6: Auto-Fill Test Data Button

**Problem**: Manually entering data during development is slow and error-prone

**Solution**: Add "Fill with Test Data" button (development mode only) that:
1. Generates random realistic values (some intentionally out of range to test alerts)
2. Checks all checklist items
3. Selects a random well from the dropdown
4. Populates well-type-specific fields based on selected well type

**Implementation**:

```typescript
// apps/mobile/app/(tabs)/entry.tsx

const fillWithTestData = () => {
  // 1. Select random well first (enables well-type-specific fields)
  if (wells.length > 0) {
    const randomWell = wells[Math.floor(Math.random() * wells.length)];
    handleWellSelection(randomWell.label);
  } else {
    Alert.alert('No Wells', 'Please sync wells data first');
    return;
  }

  // 2. Generate production data (some out of range)
  setProductionVolume(String(Math.random() > 0.7 ? Math.floor(Math.random() * 1000) : Math.floor(Math.random() * 200)));
  setGasVolume(String(Math.random() > 0.7 ? Math.floor(Math.random() * 10000) : Math.floor(Math.random() * 2000)));
  setWaterVolume(String(Math.floor(Math.random() * 100)));
  setWaterCut(String((Math.random() > 0.6 ? Math.random() * 100 : Math.random() * 50).toFixed(2)));

  // 3. Generate pressure/temperature (some out of range)
  setPressure(String(Math.random() > 0.7 ? Math.floor(Math.random() * 5000) : Math.floor(Math.random() * 3000)));
  setTemperature(String(Math.floor(Math.random() * 300)));

  // 4. Generate additional production metrics
  setTankLevel(String(Math.floor(Math.random() * 100)));
  setBsw(String((Math.random() * 12).toFixed(2))); // Some > 1% (violates sales requirement)
  setGor(String(Math.floor(Math.random() * 15000))); // Some > 6000 (high GOR warning)
  setFluidLevel(String(Math.floor(Math.random() * 5000)));
  setCasingPressure(String(Math.random() > 0.8 ? Math.floor(Math.random() * 500) : 0)); // Some with abnormal pressure
  setTubingPressure(String(Math.floor(Math.random() * 2500)));

  // 5. Generate operational data
  const statuses: Array<'operating' | 'down' | 'maintenance'> = ['operating', 'down', 'maintenance'];
  const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
  setPumpStatus(randomStatus);

  if (randomStatus === 'down' || randomStatus === 'maintenance') {
    setDowntimeHours(String(Math.floor(Math.random() * 72)));
    const reasons = ['Pump failure', 'Rod parted', 'Electrical issue', 'Scheduled maintenance', 'Weather delay'];
    setDowntimeReason(reasons[Math.floor(Math.random() * reasons.length)]);
  }

  setRunTicket(String(Math.floor(Math.random() * 500)));
  setWaterHaul(String(Math.floor(Math.random() * 200)));

  // 6. Generate well-type-specific fields based on selected well
  const well = allWellsData.find(w => w.name === wellName);
  if (well) {
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

      case 'gas-lift':
        setGasInjectionVolume(String(Math.floor(Math.random() * 600)));
        setInjectionPressure(String(Math.floor(Math.random() * 1500)));
        setBackpressure(String(Math.floor(Math.random() * 1000)));
        const orifices = ['1/4', '3/8', '1/2', '5/8', '3/4'];
        setOrificeSize(orifices[Math.floor(Math.random() * orifices.length)]);
        break;

      case 'plunger-lift':
        setCycleTime(String(Math.floor(Math.random() * 90)));
        setSurfacePressure(String(Math.floor(Math.random() * 800)));
        const hour = Math.floor(Math.random() * 12) + 1;
        const minute = String(Math.floor(Math.random() * 60)).padStart(2, '0');
        const ampm = Math.random() > 0.5 ? 'AM' : 'PM';
        setPlungerArrival(`${hour}:${minute} ${ampm}`);
        break;
    }
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

  toast.success('Test data generated! (Some values intentionally out of range)', { duration: 4000 });
};

// Add button in render (only in development mode)
{__DEV__ && (
  <View style={styles.testDataButtonContainer}>
    <TouchableOpacity style={styles.testDataButton} onPress={fillWithTestData}>
      <Text style={styles.testDataIcon}>🎲</Text>
      <Text style={styles.testDataButtonText}>Fill with Test Data</Text>
    </TouchableOpacity>
  </View>
)}

const styles = StyleSheet.create({
  // ... existing styles ...

  testDataButtonContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FEF3C7', // Light yellow background
    borderTopWidth: 1,
    borderTopColor: '#FDE047',
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
```

---

## Summary

**Context-Aware Forms Implementation**: ✅ COMPLETE
- All 6 well types supported (beam-pump, PCP, submersible, gas-lift, plunger-lift, natural-flow)
- 20+ equipment-specific fields conditionally rendered
- State fully wired with save/load support

**Next Steps** (in priority order):
1. ✅ Fix keyboard navigation (30 minutes)
2. ✅ Add test data generation button (45 minutes)
3. 📋 Review Sprint 4 Enterprise Features Plan
4. 📋 Prioritize Phase 1 (Nominal Ranges & Alerts) for next sprint

**Testing Checklist**:
- [ ] Keyboard navigation follows visual order
- [ ] Test data button generates realistic values
- [ ] Well-type-specific fields show/hide correctly
- [ ] All state persists on save/edit
- [ ] No console errors
