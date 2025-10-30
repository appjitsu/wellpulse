/**
 * EntryCard Component - Display a field entry in a card
 * Shared across all platforms with NativeWind styling
 */

import React from 'react';
import { View, Text, type ViewProps } from 'react-native';
import type { FieldEntry } from '../types';

export interface EntryCardProps extends ViewProps {
  /** Field entry data */
  entry: FieldEntry;
}

export const EntryCard: React.FC<EntryCardProps> = ({ entry, className, ...props }) => {
  return (
    <View
      className={`bg-white rounded-lg p-4 border border-gray-200 ${className || ''}`}
      {...props}
    >
      {/* Header: Well Name + Date */}
      <View className="flex-row justify-between items-center mb-3">
        <Text className="text-lg font-bold text-gray-900">{entry.wellName}</Text>
        <Text className="text-sm text-gray-600">{entry.entryDate}</Text>
      </View>

      {/* Production Data */}
      <View className="flex-row flex-wrap gap-4 mb-3">
        <View className="flex-1 min-w-[100px]">
          <Text className="text-xs text-gray-600 mb-1">Production</Text>
          <Text className="text-base font-semibold text-gray-900">
            {entry.productionVolume} bbl/day
          </Text>
        </View>

        {entry.pressure !== undefined && (
          <View className="flex-1 min-w-[100px]">
            <Text className="text-xs text-gray-600 mb-1">Pressure</Text>
            <Text className="text-base font-semibold text-gray-900">{entry.pressure} psi</Text>
          </View>
        )}

        {entry.temperature !== undefined && (
          <View className="flex-1 min-w-[100px]">
            <Text className="text-xs text-gray-600 mb-1">Temperature</Text>
            <Text className="text-base font-semibold text-gray-900">{entry.temperature}°F</Text>
          </View>
        )}
      </View>

      {/* Operator + Sync Status */}
      <View className="flex-row items-center justify-between">
        <Text className="text-sm text-gray-600">
          Operator: <Text className="text-gray-900">{entry.operatorName}</Text>
        </Text>

        {!entry.synced && (
          <View className="flex-row items-center">
            <View className="w-2 h-2 rounded-full bg-amber-500 mr-2" />
            <Text className="text-sm font-medium text-amber-700">Pending Sync</Text>
          </View>
        )}
      </View>

      {/* Notes */}
      {entry.notes && (
        <View className="mt-3 pt-3 border-t border-gray-200">
          <Text className="text-sm text-gray-600 italic">{entry.notes}</Text>
        </View>
      )}
    </View>
  );
};
