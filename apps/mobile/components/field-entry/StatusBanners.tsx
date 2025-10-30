/**
 * Status Banners Component
 * Displays network status and edit mode banners
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useFieldEntry } from './FieldEntryContext';

export function StatusBanners() {
  const { editingEntryId } = useFieldEntry();
  return (
    <>
      {/* Edit Mode Banner */}
      {editingEntryId && (
        <View style={styles.editModeBanner}>
          <Text style={styles.editModeIcon}>✏️</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.editModeTitle}>Editing Entry</Text>
            <Text style={styles.editModeSubtext}>
              Modify fields below and tap &ldquo;Update Entry&rdquo; to save changes
            </Text>
          </View>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  editModeBanner: {
    backgroundColor: '#FEF3C7',
    borderWidth: 2,
    borderColor: '#F59E0B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  editModeIcon: {
    fontSize: 32,
  },
  editModeTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#92400E',
    marginBottom: 4,
  },
  editModeSubtext: {
    fontSize: 13,
    color: '#78350F',
    lineHeight: 18,
  },
});
