/**
 * FieldEntryScreen Component - Complete field data entry screen
 * Shared across all platforms with NativeWind styling
 *
 * This is the main screen for offline field data entry.
 * Includes form, status cards, and recent entries list.
 */

import React from 'react';
import { SafeAreaView, ScrollView, View, Text, ActivityIndicator, Alert } from 'react-native';
import { useFieldEntry } from '../hooks/useFieldEntry';
import { Button } from './Button';
import { TextField } from './TextField';
import { NumberField } from './NumberField';
import { TextArea } from './TextArea';
import { StatCard } from './StatCard';
import { EntryCard } from './EntryCard';

export interface FieldEntryScreenProps {
  /** Database name (default: 'wellpulse.db') */
  dbName?: string;
  /** Show header (default: true) */
  showHeader?: boolean;
}

export const FieldEntryScreen: React.FC<FieldEntryScreenProps> = ({
  dbName,
  showHeader = true,
}) => {
  const {
    // Form state
    wellName,
    setWellName,
    operatorName,
    setOperatorName,
    entryDate,
    setEntryDate,
    productionVolume,
    setProductionVolume,
    pressure,
    setPressure,
    temperature,
    setTemperature,
    notes,
    setNotes,

    // Submission state
    isSubmitting,
    error,
    successMessage,

    // Data state
    entries,
    unsyncedCount,
    isLoading,

    // Actions
    handleSubmit,
    clearMessages,
  } = useFieldEntry({
    dbName,
    onSaveSuccess: (entry) => {
      console.log('[FieldEntryScreen] Entry saved:', entry.id);
    },
    onError: (err) => {
      console.error('[FieldEntryScreen] Error:', err);
      Alert.alert('Error', err.message);
    },
  });

  // Loading state
  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#1E40AF" />
          <Text className="text-base text-gray-600 mt-4">Loading field entries...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView className="flex-1">
        <View className="p-6">
          {/* Header */}
          {showHeader && (
            <View className="mb-6 pb-6 border-b-2 border-primary-700">
              <Text className="text-3xl font-bold text-primary-700 mb-2">WellPulse Field</Text>
              <Text className="text-base text-gray-600">
                Offline Data Entry for Oil & Gas Operations
              </Text>
            </View>
          )}

          {/* Status Cards */}
          <View className="flex-row gap-4 mb-6">
            <View className="flex-1">
              <StatCard label="Status" value="Offline Mode" variant="success" icon="●" />
            </View>
            <View className="flex-1">
              <StatCard
                label="Pending Sync"
                value={`${unsyncedCount} ${unsyncedCount === 1 ? 'entry' : 'entries'}`}
                variant="warning"
              />
            </View>
          </View>

          {/* Success/Error Messages */}
          {(successMessage || error) && (
            <View className={`p-4 rounded-lg mb-6 ${successMessage ? 'bg-green-50' : 'bg-red-50'}`}>
              <Text className={`text-sm ${successMessage ? 'text-green-800' : 'text-red-800'}`}>
                {successMessage || error}
              </Text>
              <Button
                title="Dismiss"
                variant="ghost"
                size="sm"
                onPress={clearMessages}
                className="mt-2"
              />
            </View>
          )}

          {/* Field Entry Form */}
          <View className="mb-8">
            <Text className="text-xl font-bold text-gray-900 mb-4">New Field Entry</Text>

            <View className="bg-white rounded-lg p-4 border border-gray-200">
              {/* Well Name */}
              <TextField
                label="Well Name"
                value={wellName}
                onChangeText={setWellName}
                placeholder="TX-450"
                required
                autoCapitalize="characters"
              />

              {/* Operator Name */}
              <TextField
                label="Operator Name"
                value={operatorName}
                onChangeText={setOperatorName}
                placeholder="John Doe"
                required
                autoCapitalize="words"
              />

              {/* Date + Production Volume (2 columns) */}
              <View className="flex-row gap-4">
                <View className="flex-1">
                  <TextField
                    label="Entry Date"
                    value={entryDate}
                    onChangeText={setEntryDate}
                    placeholder="2025-10-25"
                    required
                  />
                </View>
                <View className="flex-1">
                  <NumberField
                    label="Production Volume"
                    unit="bbl/day"
                    value={productionVolume}
                    onChangeText={setProductionVolume}
                    placeholder="245.50"
                    required
                  />
                </View>
              </View>

              {/* Pressure + Temperature (2 columns) */}
              <View className="flex-row gap-4">
                <View className="flex-1">
                  <NumberField
                    label="Pressure"
                    unit="psi"
                    value={pressure}
                    onChangeText={setPressure}
                    placeholder="2850.00"
                  />
                </View>
                <View className="flex-1">
                  <NumberField
                    label="Temperature"
                    unit="°F"
                    value={temperature}
                    onChangeText={setTemperature}
                    placeholder="85.50"
                  />
                </View>
              </View>

              {/* Notes */}
              <TextArea
                label="Notes"
                value={notes}
                onChangeText={setNotes}
                placeholder="Equipment observations, maintenance notes, etc."
                rows={3}
              />

              {/* Submit Button */}
              <Button
                title={isSubmitting ? 'Saving...' : 'Save Entry (Offline)'}
                variant="primary"
                size="lg"
                loading={isSubmitting}
                onPress={handleSubmit}
                fullWidth
              />
            </View>
          </View>

          {/* Recent Entries */}
          <View>
            <Text className="text-xl font-bold text-gray-900 mb-4">Recent Entries</Text>

            {entries.length === 0 ? (
              <View className="bg-white rounded-lg p-6 border border-gray-200 items-center">
                <Text className="text-base text-gray-600 text-center">
                  No entries yet.{'\n'}Add your first field entry above.
                </Text>
              </View>
            ) : (
              <View className="gap-4">
                {entries.map((entry) => (
                  <EntryCard key={entry.id} entry={entry} />
                ))}
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};
