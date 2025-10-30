/**
 * Sync Status Screen - Shows offline queue and sync status
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { db } from '../../src/db/database';
import { syncService, SyncStatus } from '../../src/services/sync';
import { FieldEntry } from '../../src/db/schema';
import { showErrorAlert } from '../../src/utils/error-alert';
import { EntryDetailModal } from '../../components/EntryDetailModal';
import { alertsRepository } from '../../src/repositories/alerts.repository';

interface LastSyncResult {
  timestamp: string;
  success: number;
  failed: number;
}

export default function SyncScreen() {
  const router = useRouter();
  const [stats, setStats] = useState({ total: 0, pending: 0, synced: 0, failed: 0 });
  const [pendingEntries, setPendingEntries] = useState<FieldEntry[]>([]);
  const [syncStatus] = useState<SyncStatus>({ isSyncing: false, progress: 0 });
  const [isOnline, setIsOnline] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<LastSyncResult | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [unacknowledgedAlertCount, setUnacknowledgedAlertCount] = useState<number>(0);

  const loadData = async () => {
    if (Platform.OS === 'web') {
      setStats({ total: 0, pending: 0, synced: 0, failed: 0 });
      setPendingEntries([]);
      return;
    }

    try {
      const [syncStats, pending, online, lastSync, alertCount] = await Promise.all([
        db.getSyncStats(),
        db.getPendingEntries(),
        syncService.checkConnectivity(),
        AsyncStorage.getItem('lastSyncResult'),
        alertsRepository.getUnacknowledgedCount(),
      ]);
      setStats(syncStats);
      setPendingEntries(pending);
      setIsOnline(online);
      setUnacknowledgedAlertCount(alertCount);
      if (lastSync) {
        setLastSyncResult(JSON.parse(lastSync));
      }
    } catch (error) {
      console.error('Failed to load sync data:', error);
      showErrorAlert({
        title: 'Data Load Error',
        message: 'Failed to load sync statistics. Please restart the app if this persists.',
        error,
      });
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, []),
  );

  const handleSync = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Not Available', 'Sync is only available on mobile devices');
      return;
    }

    if (!isOnline) {
      Alert.alert('Offline', 'Cannot sync while offline. Please check your internet connection.');
      return;
    }

    if (stats.pending === 0) {
      Alert.alert('Nothing to Sync', 'All entries are already synced');
      return;
    }

    try {
      const result = await syncService.syncPendingEntries();

      // Save last sync result
      const lastSync: LastSyncResult = {
        timestamp: new Date().toISOString(),
        success: result.success,
        failed: result.failed,
      };
      await AsyncStorage.setItem('lastSyncResult', JSON.stringify(lastSync));
      setLastSyncResult(lastSync);

      // Save to sync history - store ALL entries that were part of this sync attempt
      const syncedEntries = result.success > 0 ? pendingEntries : []; // If success, these were all synced
      const failedEntriesData = result.failed > 0 ? await db.getPendingEntries() : []; // If failed, these are still pending

      const historyItem = {
        id: Date.now().toString(),
        timestamp: lastSync.timestamp,
        success: result.success,
        failed: result.failed,
        syncedEntries, // Entries that were successfully synced
        failedEntries: failedEntriesData, // Entries that failed to sync
      };

      const existingHistory = await AsyncStorage.getItem('syncHistory');
      const history = existingHistory ? JSON.parse(existingHistory) : [];
      history.unshift(historyItem); // Add to front
      history.splice(20); // Keep only last 20 sync attempts
      await AsyncStorage.setItem('syncHistory', JSON.stringify(history));

      // Check for authentication errors in the result
      const hasAuthError = result.errors.some((err) => err.includes('Authentication expired'));
      if (hasAuthError) {
        Alert.alert('Session Expired', 'Your session has expired. Please log in again.', [
          {
            text: 'OK',
            onPress: () => {
              // Navigate to login screen
              router.replace('/login');
            },
          },
        ]);
        return;
      }

      if (result.success > 0) {
        Alert.alert(
          'Sync Complete',
          `Successfully synced ${result.success} ${result.success === 1 ? 'entry' : 'entries'}${
            result.failed > 0 ? `\n${result.failed} failed` : ''
          }`,
        );
      } else if (result.failed > 0) {
        showErrorAlert({
          title: 'Sync Failed',
          message: `Failed to sync ${result.failed} entries. See details below.`,
          error: new Error(result.errors.join('\n')),
          technicalDetails: `Failed entries:\n${result.errors.join('\n')}`,
        });
      }

      await loadData();
    } catch (error) {
      console.error('Sync error:', error);

      // Check if this is an authentication error
      const errorMessage = error instanceof Error ? error.message : '';
      if (errorMessage.includes('Authentication expired')) {
        Alert.alert('Session Expired', 'Your session has expired. Please log in again.', [
          {
            text: 'OK',
            onPress: () => {
              // Navigate to login screen
              router.replace('/login');
            },
          },
        ]);
        return;
      }

      showErrorAlert({
        title: 'Sync Error',
        message: 'Failed to sync entries with the server. Check your connection and try again.',
        error,
        technicalDetails: 'Make sure the API server is running at the configured URL.',
      });
    }
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatSyncTime = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  const handleViewEntry = (entry: FieldEntry) => {
    setSelectedEntryId(entry.id);
    setModalVisible(true);
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    setSelectedEntryId(null);
  };

  const handleSaveModal = () => {
    loadData(); // Reload data after saving
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollContentContainer}
      >
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: '#F59E0B' }]}>{stats.pending}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: '#10B981' }]}>{stats.synced}</Text>
            <Text style={styles.statLabel}>Synced</Text>
          </View>
        </View>

        {/* Alert Badge */}
        {unacknowledgedAlertCount > 0 && (
          <View style={styles.alertBanner}>
            <View style={styles.alertBannerContent}>
              <Text style={styles.alertBannerIcon}>🚨</Text>
              <View style={styles.alertBannerText}>
                <Text style={styles.alertBannerTitle}>
                  {unacknowledgedAlertCount} Unacknowledged Alert
                  {unacknowledgedAlertCount !== 1 ? 's' : ''}
                </Text>
                <Text style={styles.alertBannerSubtitle}>
                  Review alerts that require your attention
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.alertBannerButton}
              onPress={() => router.push('/(tabs)/alerts')}
            >
              <Text style={styles.alertBannerButtonText}>View Alerts</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Last Sync Attempt - Compact */}
        {lastSyncResult && (
          <View style={styles.lastSyncCompact}>
            <Text style={styles.lastSyncCompactTime}>
              Last sync: {formatSyncTime(lastSyncResult.timestamp)}
            </Text>
            <View style={styles.lastSyncCompactStats}>
              {lastSyncResult.success > 0 && (
                <Text style={styles.lastSyncCompactSuccess}>✓ {lastSyncResult.success}</Text>
              )}
              {lastSyncResult.failed > 0 && (
                <Text style={styles.lastSyncCompactFailed}>✗ {lastSyncResult.failed}</Text>
              )}
            </View>
          </View>
        )}

        {/* Pending Entries to Sync */}
        {pendingEntries.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Pending Entries ({pendingEntries.length})</Text>
            <Text style={styles.sectionSubtitle}>These entries will be synced together</Text>
            {pendingEntries.map((entry) => (
              <TouchableOpacity
                key={entry.id}
                style={styles.entryItem}
                onPress={() => handleViewEntry(entry)}
                activeOpacity={0.7}
              >
                <View style={styles.entryHeader}>
                  <Text style={styles.entryWell}>{entry.wellName}</Text>
                  <Text style={styles.entryDate}>{formatDate(entry.createdAt)}</Text>
                </View>
                <View style={styles.entryDetails}>
                  <Text style={styles.entryVolume}>Oil: {entry.productionVolume} bbl</Text>
                  {entry.gasVolume && (
                    <Text style={styles.entryDetailText}>Gas: {entry.gasVolume} mcf</Text>
                  )}
                  {entry.pressure && (
                    <Text style={styles.entryDetailText}>Pressure: {entry.pressure} psi</Text>
                  )}
                </View>
                {entry.syncStatus === 'failed' && entry.syncError && (
                  <Text style={styles.entryError} numberOfLines={2}>
                    ⚠️ Error: {entry.syncError}
                  </Text>
                )}
                <Text style={styles.tapHint}>Tap to view/edit</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.syncButton,
            (!isOnline || stats.pending === 0 || syncStatus.isSyncing) && styles.syncButtonDisabled,
          ]}
          onPress={handleSync}
          disabled={!isOnline || stats.pending === 0 || syncStatus.isSyncing}
        >
          {syncStatus.isSyncing ? (
            <>
              <ActivityIndicator color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.syncButtonText}>
                Syncing... {syncStatus.progress.toFixed(0)}%
              </Text>
            </>
          ) : (
            <Text style={styles.syncButtonText}>🔄 Sync Now</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Entry Detail Modal */}
      <EntryDetailModal
        visible={modalVisible}
        entryId={selectedEntryId}
        onClose={handleCloseModal}
        onSave={handleSaveModal}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  scrollContent: { flex: 1 },
  scrollContentContainer: {
    padding: 16,
    paddingBottom: 100, // Extra padding at bottom for button visibility above tab bar
  },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  statCard: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statValue: { fontSize: 28, fontWeight: 'bold', color: '#1E40AF', marginBottom: 4 },
  statLabel: { fontSize: 12, color: '#6B7280', textTransform: 'uppercase' },
  card: { backgroundColor: '#FFF', borderRadius: 12, padding: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 8, color: '#111827' },
  sectionSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 12,
  },
  entryItem: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  entryWell: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  entryDate: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 8,
  },
  entryDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  entryVolume: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '500',
  },
  entryDetailText: {
    fontSize: 12,
    color: '#6B7280',
  },
  entryError: {
    fontSize: 11,
    color: '#DC2626',
    fontStyle: 'italic',
    marginTop: 6,
    backgroundColor: '#FEE2E2',
    padding: 6,
    borderRadius: 4,
  },
  tapHint: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 8,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  lastSyncCompact: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastSyncCompactTime: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  lastSyncCompactStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  lastSyncCompactSuccess: {
    fontSize: 13,
    color: '#10B981',
    fontWeight: '600',
  },
  lastSyncCompactFailed: {
    fontSize: 13,
    color: '#EF4444',
    fontWeight: '600',
  },
  syncButton: {
    backgroundColor: '#1E40AF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  syncButtonDisabled: { opacity: 0.5 },
  syncButtonText: { fontSize: 16, fontWeight: 'bold', color: '#FFF' },
  alertBanner: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#DC2626',
  },
  alertBannerContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  alertBannerIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  alertBannerText: {
    flex: 1,
  },
  alertBannerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#991B1B',
    marginBottom: 4,
  },
  alertBannerSubtitle: {
    fontSize: 13,
    color: '#7F1D1D',
  },
  alertBannerButton: {
    backgroundColor: '#DC2626',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  alertBannerButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
