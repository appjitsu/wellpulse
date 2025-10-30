/**
 * Well Selection Section Component
 * Handles well dropdown and barcode scanner trigger buttons
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import SearchableDropdown from '../SearchableDropdown';
import { useFieldEntry } from './FieldEntryContext';

export function WellSelectionSection() {
  const {
    wells,
    wellName,
    setWellName,
    editingEntryId,
    cameraPermission,
    handleBarcodeLookup,
    wellNameRef,
    productionVolumeRef,
  } = useFieldEntry();

  return (
    <>
      {/* Barcode/QR Lookup Button */}
      {Platform.OS !== 'web' && cameraPermission?.granted && (
        <TouchableOpacity style={styles.lookupButton} onPress={handleBarcodeLookup}>
          <Text style={styles.lookupButtonIcon}>📷</Text>
          <Text style={styles.lookupButtonText}>Scan Barcode/QR to Lookup Well</Text>
        </TouchableOpacity>
      )}

      {/* Well Selection */}
      <View style={[styles.section, { zIndex: 1000, overflow: 'visible' }]}>
        <Text style={styles.sectionTitle}>Well Information</Text>
        <View style={[styles.inputGroup, { zIndex: 1000, overflow: 'visible', marginBottom: 0 }]}>
          <Text style={styles.label}>
            Well Name <Text style={styles.required}>*</Text>
          </Text>
          <SearchableDropdown
            items={wells}
            value={wellName}
            onChange={setWellName}
            placeholder="Select or type well name"
            inputRef={wellNameRef}
            returnKeyType="next"
            onSubmitEditing={() => productionVolumeRef.current?.focus()}
            disabled={!!editingEntryId}
          />
        </View>
      </View>
    </>
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
    marginBottom: 16,
  },
  inputGroup: {
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
  lookupButton: {
    backgroundColor: '#EEF2FF',
    borderWidth: 2,
    borderColor: '#818CF8',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  lookupButtonIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  lookupButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4F46E5',
  },
});
