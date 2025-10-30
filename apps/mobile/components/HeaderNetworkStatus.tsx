/**
 * Header Network Status Component
 * Displays online/offline status in the navigation header
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNetworkStatus } from '../src/hooks/useNetworkStatus';

export function HeaderNetworkStatus() {
  const { isConnected } = useNetworkStatus();

  return (
    <View style={styles.container}>
      <View style={[styles.dot, isConnected ? styles.dotOnline : styles.dotOffline]} />
      <Text style={styles.text}>{isConnected ? 'Online' : 'Offline'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    marginRight: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  dotOnline: {
    backgroundColor: '#10B981',
  },
  dotOffline: {
    backgroundColor: '#F59E0B',
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
