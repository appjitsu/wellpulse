/**
 * Well Detail Screen - WellPulse Field Mobile
 * Shows well information, recent readings, and history
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Linking,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { db } from '../../src/db/database';
import { Well, WellReading } from '../../src/db/schema';

export default function WellDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [well, setWell] = useState<Well | null>(null);
  const [readings, setReadings] = useState<WellReading[]>([]);
  const [loading, setLoading] = useState(true);

  // Load well and readings from database
  useEffect(() => {
    loadWellData();
  }, [id]);

  const loadWellData = async () => {
    try {
      setLoading(true);
      await db.initialize();

      const loadedWell = await db.getWellById(id as string);
      setWell(loadedWell);

      if (loadedWell) {
        const loadedReadings = await db.getWellReadings(id as string, 10);
        setReadings(loadedReadings);
      }
    } catch (error) {
      console.error('Failed to load well data:', error);
      Alert.alert('Error', 'Failed to load well data from database');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.backButtonContainer}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1E40AF" />
          <Text style={styles.loadingText}>Loading well data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!well) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.backButtonContainer}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.errorText}>Well not found</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadWellData}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const handleQuickEntry = () => {
    router.push({
      pathname: '/(tabs)/entry',
      params: { wellId: id, wellName: well.name },
    });
  };

  const handleNavigate = async () => {
    if (Platform.OS === 'web') {
      alert('Navigation is only available on mobile devices');
      return;
    }

    const { latitude, longitude } = well.location;
    const label = encodeURIComponent(well.name);

    // Try Apple Maps first on iOS, Google Maps as fallback
    let url: string;
    if (Platform.OS === 'ios') {
      url = `maps:?q=${label}&ll=${latitude},${longitude}`;
    } else {
      url = `geo:${latitude},${longitude}?q=${latitude},${longitude}(${label})`;
    }

    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      // Fallback to Google Maps web
      const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
      await Linking.openURL(googleMapsUrl);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return '#059669';
      case 'maintenance':
        return '#F59E0B';
      default:
        return '#6B7280';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Back Button */}
      <View style={styles.backButtonContainer}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.wellName}>{well.name}</Text>
              <Text style={styles.operator}>Operator: {well.operator}</Text>
            </View>
            <View
              style={[styles.statusBadge, { backgroundColor: `${getStatusColor(well.status)}20` }]}
            >
              <View style={[styles.statusDot, { backgroundColor: getStatusColor(well.status) }]} />
              <Text style={[styles.statusText, { color: getStatusColor(well.status) }]}>
                {well.status}
              </Text>
            </View>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.primaryButton} onPress={handleQuickEntry}>
              <Text style={styles.primaryButtonText}>📝 Quick Entry</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={handleNavigate}>
              <Text style={styles.secondaryButtonText}>📍 Navigate</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Latest Reading */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Latest Reading</Text>
          {well.lastReading ? (
            <View style={styles.card}>
              <Text style={styles.readingDate}>{well.lastReading.date}</Text>
              <View style={styles.readingGrid}>
                <View style={styles.readingItem}>
                  <Text style={styles.readingLabel}>Oil Production</Text>
                  <Text style={styles.readingValue}>{well.lastReading.production}</Text>
                </View>
                {well.lastReading.gasVolume && (
                  <View style={styles.readingItem}>
                    <Text style={styles.readingLabel}>Gas Volume</Text>
                    <Text style={styles.readingValue}>{well.lastReading.gasVolume}</Text>
                  </View>
                )}
                {well.lastReading.pressure && (
                  <View style={styles.readingItem}>
                    <Text style={styles.readingLabel}>Pressure</Text>
                    <Text style={styles.readingValue}>{well.lastReading.pressure}</Text>
                  </View>
                )}
                {well.lastReading.temperature && (
                  <View style={styles.readingItem}>
                    <Text style={styles.readingLabel}>Temperature</Text>
                    <Text style={styles.readingValue}>{well.lastReading.temperature}</Text>
                  </View>
                )}
                {well.lastReading.waterCut && (
                  <View style={styles.readingItem}>
                    <Text style={styles.readingLabel}>Water Cut</Text>
                    <Text style={styles.readingValue}>{well.lastReading.waterCut}</Text>
                  </View>
                )}
              </View>
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.emptyText}>No reading data available</Text>
            </View>
          )}
        </View>

        {/* Recent History */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent History</Text>
          {readings.length > 0 ? (
            readings.map((reading) => (
              <View key={reading.id} style={styles.historyCard}>
                <View style={styles.historyHeader}>
                  <Text style={styles.historyDate}>{reading.date}</Text>
                  <View
                    style={[
                      styles.historyStatusBadge,
                      {
                        backgroundColor:
                          reading.status === 'normal'
                            ? '#DCFCE7'
                            : reading.status === 'alert'
                              ? '#FEE2E2'
                              : '#FEF3C7',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.historyStatusText,
                        {
                          color:
                            reading.status === 'normal'
                              ? '#059669'
                              : reading.status === 'alert'
                                ? '#DC2626'
                                : '#F59E0B',
                        },
                      ]}
                    >
                      {reading.status}
                    </Text>
                  </View>
                </View>
                <Text style={styles.historyProduction}>{reading.production}</Text>
              </View>
            ))
          ) : (
            <View style={styles.card}>
              <Text style={styles.emptyText}>No history available</Text>
            </View>
          )}
        </View>

        {/* Bottom spacing for scroll */}
        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  backButtonContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 16,
    color: '#1E40AF',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#DC2626',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#1E40AF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  wellName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  operator: {
    fontSize: 14,
    color: '#6B7280',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#1E40AF',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  readingDate: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  readingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  readingItem: {
    width: '47%',
  },
  readingLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  readingValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  historyDate: {
    fontSize: 12,
    color: '#6B7280',
  },
  historyStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  historyStatusText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  historyProduction: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
});
