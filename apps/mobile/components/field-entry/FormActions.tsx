/**
 * Form Actions Component
 * Save/Update/Cancel buttons, loading state, toast notification
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import { useFieldEntry } from './FieldEntryContext';

export function FormActions() {
  const {
    wellName,
    productionVolume,
    pressure,
    temperature,
    gasVolume,
    waterCut,
    checklist,
    location,
    isSaving,
    isOnline,
    editingEntryId,
    handleSave,
    handleCancelEdit,
  } = useFieldEntry();

  // Check if form is complete (all required fields filled, all checklist items checked, and GPS tagged)
  const isFormComplete = useMemo(() => {
    const hasWellName = wellName.trim().length > 0;
    const hasAllMeasurements =
      productionVolume.trim().length > 0 &&
      pressure.trim().length > 0 &&
      temperature.trim().length > 0 &&
      gasVolume.trim().length > 0 &&
      waterCut.trim().length > 0;
    const allChecklistComplete = Object.values(checklist).every((checked) => checked === true);
    const hasGPSLocation = location !== null;

    return hasWellName && hasAllMeasurements && allChecklistComplete && hasGPSLocation;
  }, [wellName, productionVolume, pressure, temperature, gasVolume, waterCut, checklist, location]);

  const isDisabled = isSaving || !isFormComplete;

  // Show confirmation dialog before saving
  const handleSaveWithConfirmation = () => {
    if (Platform.OS === 'web') {
      // For web, use native confirm dialog
      const confirmed = window.confirm(
        'Do you confirm that the well measurements are correct and daily inspection is accurate?',
      );
      if (confirmed) {
        handleSave();
      }
    } else {
      // For mobile, use Alert API
      Alert.alert(
        'Confirm Entry',
        'Do you confirm that the well measurements are correct and daily inspection is accurate?',
        [
          {
            text: 'No',
            style: 'cancel',
          },
          {
            text: 'Yes',
            onPress: handleSave,
            style: 'default',
          },
        ],
        { cancelable: true },
      );
    }
  };

  return (
    <>
      {/* Action Buttons */}
      <View style={editingEntryId ? styles.buttonRow : null}>
        {editingEntryId && (
          <TouchableOpacity
            style={[styles.cancelButton, isSaving && styles.saveButtonDisabled]}
            onPress={handleCancelEdit}
            disabled={isSaving}
          >
            <Text style={styles.cancelButtonText}>✕ Cancel</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[
            styles.saveButton,
            editingEntryId && styles.saveButtonHalf,
            isDisabled && styles.saveButtonDisabled,
          ]}
          onPress={handleSaveWithConfirmation}
          disabled={isDisabled}
        >
          {isSaving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>
              {editingEntryId ? '✏️ Update Entry' : '💾 Save Entry'}
              {!isOnline ? ' (Offline)' : ''}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  saveButton: {
    height: 56,
    backgroundColor: '#1E40AF',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#1E40AF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonHalf: {
    flex: 1,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  cancelButton: {
    flex: 1,
    height: 56,
    backgroundColor: '#6B7280',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
  },
});
