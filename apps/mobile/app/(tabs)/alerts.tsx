/**
 * Alerts Screen - Recent unacknowledged alerts list
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert as RNAlert,
  ActivityIndicator,
  Platform,
  ScrollView,
  RefreshControl,
  TextInput,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { alertsRepository, Alert } from '../../src/repositories/alerts.repository';
import { showErrorAlert } from '../../src/utils/error-alert';

export default function AlertsScreen() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filterSeverity, setFilterSeverity] = useState<string>('ALL');
  const [filterWell, setFilterWell] = useState<string>('');
  const [isOnline, setIsOnline] = useState(false);

  const loadAlerts = async () => {
    if (Platform.OS === 'web') {
      setAlerts([]);
      return;
    }

    setIsLoading(true);
    try {
      const result = await alertsRepository.fetchRecentAlerts();
      if (result) {
        setAlerts(result.alerts);
        setIsOnline(true);
      } else {
        setIsOnline(false);
      }
    } catch (error) {
      console.error('[Alerts] Failed to load alerts:', error);
      showErrorAlert({
        title: 'Error Loading Alerts',
        message: 'Failed to load alerts. Please check your connection.',
        error,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadAlerts();
    setIsRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      loadAlerts();
    }, []),
  );

  const handleAcknowledge = async (alert: Alert) => {
    if (Platform.OS === 'web') {
      RNAlert.alert('Not Available', 'Acknowledgement is only available on mobile devices');
      return;
    }

    if (!isOnline) {
      RNAlert.alert(
        'Offline',
        'Cannot acknowledge alerts while offline. Please check your internet connection.',
      );
      return;
    }

    RNAlert.alert(
      'Acknowledge Alert',
      `Acknowledge this ${alert.severity} alert for ${alert.wellName}?\n\n${alert.message}`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Acknowledge',
          onPress: async () => {
            try {
              const result = await alertsRepository.acknowledgeAlert(alert.id);
              if (result) {
                RNAlert.alert('Success', 'Alert acknowledged successfully');
                await loadAlerts(); // Reload alerts
              } else {
                showErrorAlert({
                  title: 'Acknowledgement Failed',
                  message: 'Failed to acknowledge alert. Please try again.',
                });
              }
            } catch (error) {
              console.error('[Alerts] Error acknowledging alert:', error);
              showErrorAlert({
                title: 'Error',
                message: 'An error occurred while acknowledging the alert.',
                error,
              });
            }
          },
        },
      ],
    );
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

  const getSeverityStyle = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return styles.severityCritical;
      case 'HIGH':
        return styles.severityHigh;
      case 'MEDIUM':
        return styles.severityMedium;
      case 'LOW':
        return styles.severityLow;
      default:
        return styles.severityMedium;
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return '🚨';
      case 'HIGH':
        return '⚠️';
      case 'MEDIUM':
        return '⚡';
      case 'LOW':
        return 'ℹ️';
      default:
        return '⚡';
    }
  };

  // Filter alerts
  const filteredAlerts = alerts.filter((alert) => {
    const severityMatch = filterSeverity === 'ALL' || alert.severity === filterSeverity;
    const wellMatch =
      filterWell === '' || alert.wellName.toLowerCase().includes(filterWell.toLowerCase());
    return severityMatch && wellMatch;
  });

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollContentContainer}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
      >
        {/* Filter Section */}
        <View style={styles.filterSection}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by well name..."
            value={filterWell}
            onChangeText={setFilterWell}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.severityFilter}
          >
            {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((severity) => (
              <TouchableOpacity
                key={severity}
                style={[
                  styles.severityButton,
                  filterSeverity === severity && styles.severityButtonActive,
                ]}
                onPress={() => setFilterSeverity(severity)}
              >
                <Text
                  style={[
                    styles.severityButtonText,
                    filterSeverity === severity && styles.severityButtonTextActive,
                  ]}
                >
                  {severity}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Stats Summary */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{filteredAlerts.length}</Text>
            <Text style={styles.statLabel}>Total Alerts</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: '#DC2626' }]}>
              {filteredAlerts.filter((a) => a.severity === 'CRITICAL').length}
            </Text>
            <Text style={styles.statLabel}>Critical</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: '#F59E0B' }]}>
              {filteredAlerts.filter((a) => a.severity === 'HIGH').length}
            </Text>
            <Text style={styles.statLabel}>High</Text>
          </View>
        </View>

        {/* Loading State */}
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#1E40AF" />
            <Text style={styles.loadingText}>Loading alerts...</Text>
          </View>
        )}

        {/* Offline State */}
        {!isOnline && !isLoading && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📡</Text>
            <Text style={styles.emptyTitle}>Offline</Text>
            <Text style={styles.emptyText}>Connect to the internet to view alerts</Text>
          </View>
        )}

        {/* Empty State */}
        {isOnline && !isLoading && filteredAlerts.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>✅</Text>
            <Text style={styles.emptyTitle}>No Alerts</Text>
            <Text style={styles.emptyText}>
              {filterSeverity !== 'ALL' || filterWell !== ''
                ? 'No alerts match your filters'
                : 'All clear! No recent unacknowledged alerts'}
            </Text>
          </View>
        )}

        {/* Alert List */}
        {isOnline && !isLoading && filteredAlerts.length > 0 && (
          <View style={styles.alertsList}>
            {filteredAlerts.map((alert) => (
              <TouchableOpacity
                key={alert.id}
                style={styles.alertCard}
                onPress={() => handleAcknowledge(alert)}
                activeOpacity={0.7}
              >
                <View style={styles.alertHeader}>
                  <View style={styles.alertHeaderLeft}>
                    <Text style={styles.alertIcon}>{getSeverityIcon(alert.severity)}</Text>
                    <View>
                      <Text style={styles.alertWellName}>{alert.wellName}</Text>
                      <Text style={styles.alertApiNumber}>{alert.wellApiNumber}</Text>
                    </View>
                  </View>
                  <View style={[styles.severityBadge, getSeverityStyle(alert.severity)]}>
                    <Text style={styles.severityBadgeText}>{alert.severity}</Text>
                  </View>
                </View>

                <View style={styles.alertBody}>
                  <Text style={styles.alertField}>
                    Field: <Text style={styles.alertFieldValue}>{alert.fieldName}</Text>
                  </Text>
                  <Text style={styles.alertValue}>
                    Value:{' '}
                    <Text style={styles.alertValueBold}>
                      {alert.value} {alert.unit}
                    </Text>
                  </Text>
                  <Text style={styles.alertExpected}>
                    Expected: {alert.expectedMin}-{alert.expectedMax} {alert.unit}
                  </Text>
                  <Text style={styles.alertMessage}>{alert.message}</Text>
                </View>

                <View style={styles.alertFooter}>
                  <Text style={styles.alertDate}>{formatDate(alert.triggeredAt)}</Text>
                  <Text style={styles.tapHint}>Tap to acknowledge</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  scrollContent: { flex: 1 },
  scrollContentContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  filterSection: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  searchInput: {
    height: 40,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    marginBottom: 12,
  },
  severityFilter: {
    flexDirection: 'row',
  },
  severityButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    marginRight: 8,
  },
  severityButtonActive: {
    backgroundColor: '#1E40AF',
  },
  severityButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  severityButtonTextActive: {
    color: '#FFFFFF',
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
  statLabel: { fontSize: 12, color: '#6B7280', textAlign: 'center' },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 48,
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 48,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  alertsList: {
    gap: 12,
  },
  alertCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#DC2626',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  alertHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  alertIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  alertWellName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  alertApiNumber: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  severityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  severityBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: 0.5,
  },
  severityCritical: {
    backgroundColor: '#DC2626',
  },
  severityHigh: {
    backgroundColor: '#F59E0B',
  },
  severityMedium: {
    backgroundColor: '#3B82F6',
  },
  severityLow: {
    backgroundColor: '#10B981',
  },
  alertBody: {
    marginBottom: 12,
  },
  alertField: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
  },
  alertFieldValue: {
    fontWeight: '600',
    color: '#111827',
  },
  alertValue: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
  },
  alertValueBold: {
    fontWeight: '700',
    color: '#DC2626',
    fontSize: 14,
  },
  alertExpected: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 8,
  },
  alertMessage: {
    fontSize: 13,
    color: '#111827',
    lineHeight: 18,
    fontStyle: 'italic',
  },
  alertFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  alertDate: {
    fontSize: 12,
    color: '#6B7280',
  },
  tapHint: {
    fontSize: 11,
    color: '#3B82F6',
    fontWeight: '600',
  },
});
