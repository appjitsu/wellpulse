/**
 * Sync History Screen - Shows past sync attempts with expandable failed entries
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  Platform,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { db } from '../../src/db/database';
import { FieldEntry } from '../../src/db/schema';
import { EntryDetailModal } from '../../components/EntryDetailModal';

interface SyncHistoryItem {
  id: string;
  timestamp: string;
  success: number;
  failed: number;
  syncedEntries?: FieldEntry[]; // Successfully synced entries
  failedEntries?: FieldEntry[]; // Failed entries
}

export default function HistoryScreen() {
  const [syncHistory, setSyncHistory] = useState<SyncHistoryItem[]>([]);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);

  const loadSyncHistory = async () => {
    if (Platform.OS === 'web') {
      setSyncHistory([]);
      return;
    }

    try {
      setLoading(true);

      // Load sync history from AsyncStorage
      const historyJson = await AsyncStorage.getItem('syncHistory');
      const history: SyncHistoryItem[] = historyJson ? JSON.parse(historyJson) : [];

      // For each history item with failed entries, load the actual entry details
      const enrichedHistory = await Promise.all(
        history.map(async (item) => {
          if (item.failed > 0 && item.failedEntries) {
            // Load full entry details for failed entries
            const fullEntries = await Promise.all(
              item.failedEntries.map(async (entry) => {
                const fullEntry = await db.getEntryById(entry.id);
                return fullEntry || entry;
              }),
            );
            return { ...item, failedEntries: fullEntries };
          }
          return item;
        }),
      );

      setSyncHistory(enrichedHistory);
    } catch (error) {
      console.error('Failed to load sync history:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadSyncHistory();
    }, []),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSyncHistory();
    setRefreshing(false);
  };

  const toggleExpand = (id: string) => {
    setExpandedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
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
    loadSyncHistory(); // Reload history after saving
  };

  const renderSyncHistoryItem = ({ item }: { item: SyncHistoryItem }) => {
    const isExpanded = expandedItems.has(item.id);
    const hasSyncedEntries =
      item.success > 0 && item.syncedEntries && item.syncedEntries.length > 0;
    const hasFailedEntries = item.failed > 0 && item.failedEntries && item.failedEntries.length > 0;
    const hasAnyEntries = hasSyncedEntries || hasFailedEntries;

    return (
      <View style={styles.historyCard}>
        <TouchableOpacity
          onPress={() => hasAnyEntries && toggleExpand(item.id)}
          activeOpacity={hasAnyEntries ? 0.7 : 1}
          disabled={!hasAnyEntries}
        >
          <View style={styles.historyHeader}>
            <Text style={styles.historyDate}>{formatDate(item.timestamp)}</Text>
            {hasAnyEntries && <Text style={styles.expandIcon}>{isExpanded ? '▼' : '▶'}</Text>}
          </View>
          <View style={styles.historyStats}>
            {item.success > 0 && (
              <Text style={styles.successText}>
                ✓ {item.success} {item.success === 1 ? 'entry' : 'entries'} synced
              </Text>
            )}
            {item.failed > 0 && (
              <Text style={styles.failedText}>
                ✗ {item.failed} {item.failed === 1 ? 'entry' : 'entries'} failed
              </Text>
            )}
          </View>
        </TouchableOpacity>

        {/* Expandable Entries Section */}
        {isExpanded && hasAnyEntries && (
          <View style={styles.entriesContainer}>
            {/* Successfully Synced Entries */}
            {hasSyncedEntries && (
              <>
                <Text style={styles.entriesTitle}>
                  ✓ Synced Entries ({item.syncedEntries!.length}):
                </Text>
                {item.syncedEntries!.map((entry) => (
                  <TouchableOpacity
                    key={entry.id}
                    style={styles.syncedEntryItem}
                    onPress={() => handleViewEntry(entry)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.entryHeader}>
                      <Text style={styles.entryWell}>{entry.wellName}</Text>
                      <Text style={styles.entryVolume}>Oil: {entry.productionVolume} bbl</Text>
                    </View>
                    <View style={styles.entryDetailsRow}>
                      {entry.gasVolume && (
                        <Text style={styles.entryDetailText}>Gas: {entry.gasVolume} mcf</Text>
                      )}
                      {entry.pressure && (
                        <Text style={styles.entryDetailText}>Pressure: {entry.pressure} psi</Text>
                      )}
                    </View>
                    <Text style={styles.entryDate}>{formatDate(entry.createdAt)}</Text>
                    <Text style={styles.tapHint}>Tap to view</Text>
                  </TouchableOpacity>
                ))}
              </>
            )}

            {/* Failed Entries */}
            {hasFailedEntries && (
              <>
                <Text style={[styles.entriesTitle, { marginTop: hasSyncedEntries ? 16 : 0 }]}>
                  ✗ Failed Entries ({item.failedEntries!.length}):
                </Text>
                {item.failedEntries!.map((entry) => (
                  <TouchableOpacity
                    key={entry.id}
                    style={styles.failedEntryItem}
                    onPress={() => handleViewEntry(entry)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.entryHeader}>
                      <Text style={styles.entryWell}>{entry.wellName}</Text>
                      <Text style={styles.entryVolume}>Oil: {entry.productionVolume} bbl</Text>
                    </View>
                    <View style={styles.entryDetailsRow}>
                      {entry.gasVolume && (
                        <Text style={styles.entryDetailText}>Gas: {entry.gasVolume} mcf</Text>
                      )}
                      {entry.pressure && (
                        <Text style={styles.entryDetailText}>Pressure: {entry.pressure} psi</Text>
                      )}
                    </View>
                    <Text style={styles.entryDate}>{formatDate(entry.createdAt)}</Text>
                    {entry.syncError && (
                      <Text style={styles.entryError} numberOfLines={2}>
                        ⚠️ Error: {entry.syncError}
                      </Text>
                    )}
                    <Text style={styles.tapHint}>Tap to view/edit</Text>
                  </TouchableOpacity>
                ))}
              </>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>📋</Text>
      <Text style={styles.emptyText}>No sync history yet</Text>
      <Text style={styles.emptySubtext}>Sync attempts will appear here</Text>
    </View>
  );

  if (loading && syncHistory.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1E40AF" />
        <Text style={styles.loadingText}>Loading sync history...</Text>
      </View>
    );
  }

  return (
    <>
      <FlatList
        data={syncHistory}
        renderItem={renderSyncHistoryItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.contentContainer}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#1E40AF']} // Android
            tintColor="#1E40AF" // iOS
          />
        }
        style={styles.container}
      />

      {/* Entry Detail Modal */}
      <EntryDetailModal
        visible={modalVisible}
        entryId={selectedEntryId}
        onClose={handleCloseModal}
        onSave={handleSaveModal}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  contentContainer: { padding: 16 },
  centerContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  historyDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  expandIcon: {
    fontSize: 14,
    color: '#6B7280',
  },
  historyStats: {
    flexDirection: 'row',
    gap: 16,
  },
  successText: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '500',
  },
  failedText: {
    fontSize: 14,
    color: '#EF4444',
    fontWeight: '500',
  },
  entriesContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  entriesTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
  },
  syncedEntryItem: {
    backgroundColor: '#F0FDF4',
    borderLeftWidth: 3,
    borderLeftColor: '#10B981',
    borderRadius: 6,
    padding: 12,
    marginBottom: 8,
  },
  failedEntryItem: {
    backgroundColor: '#FEF2F2',
    borderLeftWidth: 3,
    borderLeftColor: '#EF4444',
    borderRadius: 6,
    padding: 12,
    marginBottom: 8,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  entryWell: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  entryVolume: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '500',
    marginLeft: 8,
  },
  entryDetailsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  entryDetailText: {
    fontSize: 12,
    color: '#6B7280',
  },
  entryDate: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
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
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#374151', marginBottom: 8 },
  emptySubtext: { fontSize: 14, color: '#9CA3AF' },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    color: '#6B7280',
  },
});
