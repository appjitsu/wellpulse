/**
 * Network Status Indicator Component
 * Displays online/offline status with visual indicator
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetworkStatus } from '../src/hooks/useNetworkStatus';

export function NetworkStatusIndicator() {
  const { isConnected } = useNetworkStatus();
  const [fadeAnim] = useState(new Animated.Value(0));
  const [showIndicator, setShowIndicator] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!isConnected) {
      // Show offline indicator
      setShowIndicator(true);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      // Fade out online indicator after a delay
      setTimeout(() => {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          setShowIndicator(false);
        });
      }, 2000); // Show "back online" for 2 seconds
    }
  }, [isConnected, fadeAnim]);

  if (!showIndicator && isConnected) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          // Position below header on mobile (header height is ~44px + status bar)
          top: Platform.select({
            ios: insets.top + 44,
            android: insets.top + 56,
            default: insets.top,
          }),
        },
      ]}
    >
      <View style={[styles.indicator, !isConnected ? styles.offline : styles.online]}>
        <View style={[styles.dot, !isConnected ? styles.dotOffline : styles.dotOnline]} />
        <Text style={[styles.text, !isConnected ? styles.textOffline : styles.textOnline]}>
          {isConnected ? '✓ Back Online' : '⚠ Offline Mode - Data will sync when online'}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 1000,
    paddingHorizontal: 16,
  },
  indicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  offline: {
    backgroundColor: '#FEF3C7',
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  online: {
    backgroundColor: '#D1FAE5',
    borderLeftWidth: 4,
    borderLeftColor: '#059669',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  dotOffline: {
    backgroundColor: '#F59E0B',
  },
  dotOnline: {
    backgroundColor: '#059669',
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
  },
  textOffline: {
    color: '#92400E',
  },
  textOnline: {
    color: '#065F46',
  },
});
