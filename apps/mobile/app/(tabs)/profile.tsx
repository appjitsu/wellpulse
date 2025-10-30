/**
 * Profile & Settings Screen
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Platform,
  Switch,
  Modal,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService, User } from '../../src/services/auth';
import { db } from '../../src/db/database';

const NOTIFICATION_PREFS_KEY = 'wellpulse_notification_prefs';

interface NotificationPrefs {
  pushEnabled: boolean;
  emailEnabled: boolean;
  syncAlerts: boolean;
  maintenanceReminders: boolean;
}

export default function ProfileScreen() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [tenantId, setTenantId] = useState<string>('');
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);
  const [biometricType, setBiometricType] = useState<string>('');
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [storageStats, setStorageStats] = useState({
    entries: 0,
    photos: 0,
    sizeKb: 0,
  });
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPrefs>({
    pushEnabled: false,
    emailEnabled: false,
    syncAlerts: false,
    maintenanceReminders: false,
  });

  useEffect(() => {
    loadUserData();
    checkBiometricSupport();
    loadStorageStats();
    loadNotificationPrefs();
    loadBiometricEnabled();
    checkNotificationPermissionStatus();
  }, []);

  const loadUserData = async () => {
    try {
      const userData = await authService.getUserData();
      const savedTenantId = await authService.getTenantId();

      if (userData) {
        setUser(userData);
      }
      if (savedTenantId) {
        setTenantId(savedTenantId);
      }
    } catch (error) {
      console.error('Failed to load user data:', error);
    }
  };

  const checkBiometricSupport = async () => {
    if (Platform.OS === 'web') {
      setIsBiometricSupported(false);
      return;
    }

    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      setIsBiometricSupported(compatible);

      if (compatible) {
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
          setBiometricType('Face ID');
        } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
          setBiometricType('Touch ID');
        } else if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
          setBiometricType('Iris Scan');
        } else {
          setBiometricType('Biometric');
        }
      }
    } catch (error) {
      console.error('Failed to check biometric support:', error);
    }
  };

  const loadStorageStats = async () => {
    try {
      const database = await db.getDatabase();

      // Count all local entries
      const entryResult = await database.getAllAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM field_entries',
      );
      const entryCount = entryResult[0]?.count || 0;

      // Count entries with photos (photos is a JSON array, check if not empty)
      const photoResult = await database.getAllAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM field_entries WHERE photos IS NOT NULL AND photos != '[]'`,
      );
      const photoCount = photoResult[0]?.count || 0;

      // Estimate size (rough calculation: ~2KB per entry, ~50KB per photo)
      const estimatedSizeKb = entryCount * 2 + photoCount * 50;

      setStorageStats({
        entries: entryCount,
        photos: photoCount,
        sizeKb: estimatedSizeKb,
      });
    } catch (error) {
      console.error('Failed to load storage stats:', error);
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          try {
            // Clear authentication token and user data
            await authService.logout();
            // Navigate to login screen
            router.replace('/(auth)/login');
          } catch (error) {
            console.error('Logout failed:', error);
            Alert.alert('Error', 'Failed to logout. Please try again.');
          }
        },
      },
    ]);
  };

  const loadNotificationPrefs = async () => {
    try {
      const saved = await AsyncStorage.getItem(NOTIFICATION_PREFS_KEY);
      if (saved) {
        setNotificationPrefs(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Failed to load notification preferences:', error);
    }
  };

  const checkNotificationPermissionStatus = async () => {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      console.log('[Notifications] Current OS permission status:', status);

      // If OS permission is not granted, ensure pushEnabled is false
      if (status !== 'granted') {
        const saved = await AsyncStorage.getItem(NOTIFICATION_PREFS_KEY);
        if (saved) {
          const prefs = JSON.parse(saved);
          if (prefs.pushEnabled) {
            // OS permission was revoked in settings, sync our state
            console.log('[Notifications] OS permission revoked, updating preferences');
            prefs.pushEnabled = false;
            await AsyncStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(prefs));
            setNotificationPrefs(prefs);
          }
        }
      }
    } catch (error) {
      console.error('Failed to check notification permission status:', error);
    }
  };

  const saveNotificationPrefs = async (prefs: NotificationPrefs) => {
    try {
      await AsyncStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(prefs));
      setNotificationPrefs(prefs);
    } catch (error) {
      console.error('Failed to save notification preferences:', error);
      Alert.alert('Error', 'Failed to save notification preferences');
    }
  };

  const handleNotifications = () => {
    setShowNotificationSettings(true);
  };

  const toggleNotificationPref = async (key: keyof NotificationPrefs) => {
    const newValue = !notificationPrefs[key];

    // Special handling for pushEnabled - requires OS permission
    if (key === 'pushEnabled') {
      if (newValue) {
        // User wants to enable push notifications - check/request OS permission
        try {
          const { status: existingStatus } = await Notifications.getPermissionsAsync();
          let finalStatus = existingStatus;

          if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
          }

          if (finalStatus !== 'granted') {
            // Permission denied at OS level
            Alert.alert(
              'Permission Required',
              'Please enable notifications in your device settings to receive push notifications.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Open Settings',
                  onPress: () => Linking.openSettings(),
                },
              ],
            );
            return; // Don't update preference
          }

          // Permission granted - get push token and save
          try {
            const token = await Notifications.getExpoPushTokenAsync();
            console.log('[Notifications] Push token:', token.data);
            // TODO: Send token to backend API for storing with user profile
          } catch (error) {
            console.error('[Notifications] Failed to get push token:', error);
          }
        } catch (error) {
          console.error('[Notifications] Failed to request permissions:', error);
          Alert.alert('Error', 'Failed to enable notifications');
          return;
        }
      } else {
        // User wants to disable push notifications
        // Note: We can't revoke OS permission, but we can disable app-level handling
        console.log('[Notifications] Push notifications disabled in app');
        // TODO: Notify backend to stop sending push notifications
      }
    }

    // Update preferences
    const newPrefs = {
      ...notificationPrefs,
      [key]: newValue,
    };
    saveNotificationPrefs(newPrefs);
  };

  const loadBiometricEnabled = async () => {
    try {
      const enabled = await authService.isBiometricEnabled();
      setBiometricEnabled(enabled);
    } catch (error) {
      console.error('Failed to load biometric setting:', error);
    }
  };

  const handleBiometric = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Not Available', 'Biometric authentication is only available on mobile devices');
      return;
    }

    if (!isBiometricSupported) {
      Alert.alert('Not Supported', 'Biometric authentication is not supported on this device');
      return;
    }

    const hasEnrolled = await LocalAuthentication.isEnrolledAsync();
    if (!hasEnrolled) {
      Alert.alert(
        'No Biometrics Enrolled',
        `Please enroll ${biometricType} in your device settings first, then return to enable ${biometricType} login.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open Settings',
            onPress: async () => {
              try {
                await Linking.openSettings();
              } catch (error) {
                console.error('Failed to open settings:', error);
                Alert.alert('Error', 'Could not open settings');
              }
            },
          },
        ],
      );
      return;
    }

    // Toggle biometric authentication
    try {
      const newValue = !biometricEnabled;

      if (newValue) {
        // Enabling biometrics - require authentication first
        const authenticated = await authService.authenticateWithBiometrics();
        if (authenticated) {
          await authService.setBiometricEnabled(true);
          setBiometricEnabled(true);
          Alert.alert('Success', `${biometricType} login enabled successfully`);
        } else {
          Alert.alert('Authentication Failed', 'Please try again');
        }
      } else {
        // Disabling biometrics
        await authService.setBiometricEnabled(false);
        setBiometricEnabled(false);
        Alert.alert('Disabled', `${biometricType} login has been disabled`);
      }
    } catch (error) {
      console.error('Failed to toggle biometric authentication:', error);
      Alert.alert('Error', 'Failed to update biometric setting');
    }
  };

  const handleClearCache = () => {
    Alert.alert('Clear Cache', 'Are you sure you want to clear the app cache?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          try {
            // Clear synced entries from local database
            const database = await db.getDatabase();
            await database.runAsync('DELETE FROM field_entries WHERE syncStatus = "synced"');

            // Reload stats
            await loadStorageStats();

            Alert.alert('Success', 'Cache cleared successfully');
          } catch (error) {
            console.error('Failed to clear cache:', error);
            Alert.alert('Error', 'Failed to clear cache');
          }
        },
      },
    ]);
  };

  const handleStorageUsage = () => {
    const sizeDisplay =
      storageStats.sizeKb < 1024
        ? `${storageStats.sizeKb} KB`
        : `${(storageStats.sizeKb / 1024).toFixed(1)} MB`;

    Alert.alert(
      'Storage Usage',
      `Local entries: ${storageStats.entries}\nPhotos: ${storageStats.photos}\nEstimated size: ~${sizeDisplay}`,
      [{ text: 'OK' }],
    );
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <>
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user ? getInitials(user.name) : '👤'}</Text>
          </View>
          <Text style={styles.name}>{user?.name || 'Loading...'}</Text>
          <Text style={styles.email}>{user?.email || ''}</Text>
          {tenantId && <Text style={styles.tenantId}>Tenant: {tenantId}</Text>}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>
          <TouchableOpacity style={styles.menuItem} onPress={handleNotifications}>
            <Text style={styles.menuItemText}>🔔 Notifications</Text>
          </TouchableOpacity>
          <View style={styles.menuItemWithSwitch}>
            <View style={styles.settingInfo}>
              <Text style={styles.menuItemText}>👆 Biometric Login</Text>
            </View>
            <Switch
              value={biometricEnabled}
              onValueChange={handleBiometric}
              disabled={!isBiometricSupported}
              trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
              thumbColor={biometricEnabled ? '#1E40AF' : '#F3F4F6'}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data & Storage</Text>
          <TouchableOpacity style={styles.menuItem} onPress={handleClearCache}>
            <Text style={styles.menuItemText}>💾 Clear Cache</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={handleStorageUsage}>
            <Text style={styles.menuItemText}>📊 Storage Usage</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>🚪 Logout</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Notification Settings Modal */}
      <Modal
        visible={showNotificationSettings}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowNotificationSettings(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Notification Settings</Text>
            <TouchableOpacity onPress={() => setShowNotificationSettings(false)}>
              <Text style={styles.modalClose}>Done</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Push Notifications</Text>
                <Text style={styles.settingDescription}>
                  Receive alerts about well status and sync updates
                </Text>
              </View>
              <Switch
                value={notificationPrefs.pushEnabled}
                onValueChange={() => toggleNotificationPref('pushEnabled')}
                trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
                thumbColor={notificationPrefs.pushEnabled ? '#1E40AF' : '#F3F4F6'}
              />
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Email Notifications</Text>
                <Text style={styles.settingDescription}>
                  Receive daily summaries and reports via email
                </Text>
              </View>
              <Switch
                value={notificationPrefs.emailEnabled}
                onValueChange={() => toggleNotificationPref('emailEnabled')}
                trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
                thumbColor={notificationPrefs.emailEnabled ? '#1E40AF' : '#F3F4F6'}
              />
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Sync Alerts</Text>
                <Text style={styles.settingDescription}>
                  Get notified when data syncs complete or fail
                </Text>
              </View>
              <Switch
                value={notificationPrefs.syncAlerts}
                onValueChange={() => toggleNotificationPref('syncAlerts')}
                trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
                thumbColor={notificationPrefs.syncAlerts ? '#1E40AF' : '#F3F4F6'}
              />
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Maintenance Reminders</Text>
                <Text style={styles.settingDescription}>
                  Receive alerts for scheduled well maintenance
                </Text>
              </View>
              <Switch
                value={notificationPrefs.maintenanceReminders}
                onValueChange={() => toggleNotificationPref('maintenanceReminders')}
                trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
                thumbColor={notificationPrefs.maintenanceReminders ? '#1E40AF' : '#F3F4F6'}
              />
            </View>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    backgroundColor: '#FFF',
    padding: 24,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E0E7FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  avatarText: { fontSize: 28, fontWeight: 'bold', color: '#4F46E5' },
  name: { fontSize: 20, fontWeight: 'bold', color: '#111827', marginBottom: 4 },
  email: { fontSize: 14, color: '#6B7280', marginBottom: 4 },
  tenantId: {
    fontSize: 12,
    color: '#9CA3AF',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  section: { backgroundColor: '#FFF', marginTop: 16, paddingVertical: 8 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    paddingHorizontal: 16,
    paddingVertical: 8,
    textTransform: 'uppercase',
  },
  menuItem: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  menuItemText: { fontSize: 16, color: '#374151' },
  menuItemWithSwitch: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingSubtext: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  logoutButton: {
    margin: 16,
    padding: 16,
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    alignItems: 'center',
  },
  logoutText: { fontSize: 16, fontWeight: '600', color: '#DC2626' },
  // Notification Settings Modal
  modalContainer: { flex: 1, backgroundColor: '#F9FAFB' },
  modalHeader: {
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: { fontSize: 18, fontWeight: '600', color: '#111827' },
  modalClose: { fontSize: 16, fontWeight: '600', color: '#4F46E5' },
  modalContent: { flex: 1 },
  settingItem: {
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  settingInfo: { flex: 1, marginRight: 12 },
  settingLabel: { fontSize: 16, fontWeight: '500', color: '#111827', marginBottom: 4 },
  settingDescription: { fontSize: 14, color: '#6B7280', lineHeight: 20 },
});
