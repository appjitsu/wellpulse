/**
 * Entry Screen Header - Shows back button when editing an entry
 */

import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';

export function EntryScreenHeaderLeft() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const isEditing = !!params.editId;

  if (!isEditing) {
    return null;
  }

  return (
    <TouchableOpacity
      onPress={() => router.back()}
      style={styles.backButton}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <Text style={styles.backButtonText}>← Back</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  backButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
