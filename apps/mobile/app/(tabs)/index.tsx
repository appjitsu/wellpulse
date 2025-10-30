/**
 * Wells List Screen - WellPulse Field Mobile
 * Shows list of assigned wells with quick actions
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
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { db } from '../../src/db/database';
import { Well } from '../../src/db/schema';
import SearchableDropdown, { DropdownItem } from '../../components/SearchableDropdown';

export default function WellsListScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'maintenance'>('all');
  const [wells, setWells] = useState<Well[]>([]);
  const [wellDropdownItems, setWellDropdownItems] = useState<DropdownItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Load wells from database
  useEffect(() => {
    loadWells();
  }, []);

  // Reload wells when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadWells();
    }, []),
  );

  const loadWells = async (isRefreshing: boolean = false) => {
    try {
      if (!isRefreshing) {
        setLoading(true);
      }
      await db.initialize();
      const loadedWells = await db.getAllWells();
      setWells(loadedWells);

      // Convert wells to dropdown items with operator and ID to distinguish duplicates
      const dropdownItems: DropdownItem[] = loadedWells.map((well) => {
        // Use last 6 characters of ID for uniqueness
        const shortId = well.id.slice(-6).toUpperCase();
        return {
          label: `${well.name} - ${well.operator} [${shortId}]`,
          value: well.id,
        };
      });
      setWellDropdownItems(dropdownItems);
    } catch (error) {
      console.error('Failed to load wells:', error);
      Alert.alert('Error', 'Failed to load wells from database');
    } finally {
      if (!isRefreshing) {
        setLoading(false);
      }
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadWells(true);
    setRefreshing(false);
  };

  const filteredWells = wells.filter((well) => {
    // Match against full label format: "Well Name - Operator [ID]"
    const shortId = well.id.slice(-6).toUpperCase();
    const fullLabel = `${well.name} - ${well.operator} [${shortId}]`.toLowerCase();
    const matchesSearch =
      searchQuery === '' ||
      fullLabel.includes(searchQuery.toLowerCase()) ||
      well.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filter === 'all' || well.status === filter;
    return matchesSearch && matchesFilter;
  });

  const handleWellPress = (wellId: string) => {
    // Navigate to well detail screen to view history
    router.push(`/well/${wellId}`);
  };

  const handleQuickEntry = (wellId: string) => {
    // Find the well to get the full label with operator and ID
    const well = wells.find((w) => w.id === wellId);
    if (!well) return;

    const shortId = well.id.slice(-6).toUpperCase();
    const wellLabel = `${well.name} - ${well.operator} [${shortId}]`;
    // Navigate directly to entry form with well pre-filled
    router.push({
      pathname: '/(tabs)/entry',
      params: { wellId, wellName: wellLabel },
    });
  };

  const handleNavigate = async (wellId: string) => {
    const well = wells.find((w) => w.id === wellId);
    if (!well) {
      Alert.alert('Error', 'Well location not found');
      return;
    }

    const { latitude, longitude } = well.location;
    const label = encodeURIComponent(well.name);

    // Web: Open Google Maps in new browser tab
    if (Platform.OS === 'web') {
      const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
      window.open(googleMapsUrl, '_blank');
      return;
    }

    // Mobile: Try native maps apps first, fallback to Google Maps web
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
    <View style={styles.container}>
      {/* Search and Filter */}
      <View style={styles.header}>
        <View style={{ zIndex: 1000, overflow: 'visible' }}>
          <SearchableDropdown
            items={wellDropdownItems}
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search or select well..."
          />
        </View>

        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]}
            onPress={() => setFilter('all')}
          >
            <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
              All ({wells.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filter === 'active' && styles.filterButtonActive]}
            onPress={() => setFilter('active')}
          >
            <Text style={[styles.filterText, filter === 'active' && styles.filterTextActive]}>
              Active ({wells.filter((w) => w.status === 'active').length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filter === 'maintenance' && styles.filterButtonActive]}
            onPress={() => setFilter('maintenance')}
          >
            <Text style={[styles.filterText, filter === 'maintenance' && styles.filterTextActive]}>
              Maintenance ({wells.filter((w) => w.status === 'maintenance').length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Wells List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1E40AF" />
          <Text style={styles.loadingText}>Loading wells...</Text>
        </View>
      ) : filteredWells.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            {searchQuery || filter !== 'all'
              ? 'No wells match your filters'
              : 'No wells found. Wells will sync when online.'}
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.wellsList}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#1E40AF']} // Android
              tintColor="#1E40AF" // iOS
            />
          }
        >
          {filteredWells.map((well) => (
            <View key={well.id} style={styles.wellCard}>
              <View style={styles.wellHeader}>
                <Text style={styles.wellName}>{well.name}</Text>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: `${getStatusColor(well.status)}20` },
                  ]}
                >
                  <View
                    style={[styles.statusDot, { backgroundColor: getStatusColor(well.status) }]}
                  />
                  <Text style={[styles.statusText, { color: getStatusColor(well.status) }]}>
                    {well.status}
                  </Text>
                </View>
              </View>

              <View style={styles.wellDetails}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Production:</Text>
                  <Text style={styles.detailValue}>
                    {well.lastReading?.production || 'No data'}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Last Reading:</Text>
                  <Text style={styles.detailValue}>{well.lastReading?.date || 'No data'}</Text>
                </View>
              </View>

              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleQuickEntry(well.id)}
                >
                  <Text style={styles.actionButtonText}>📝 Quick Entry</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleNavigate(well.id)}
                >
                  <Text style={styles.actionButtonText}>🧭 Directions</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleWellPress(well.id)}
                >
                  <Text style={styles.actionButtonText}>👁️ Details</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
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
  header: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    zIndex: 1000,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#1E40AF',
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  wellsList: {
    flex: 1,
    padding: 16,
  },
  wellCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  wellHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  wellName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
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
  wellDetails: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  detailLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
});
