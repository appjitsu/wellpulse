/**
 * Login Screen - WellPulse Field Mobile
 * Email/password authentication with biometric option
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService } from '../../src/services/auth';
import { db } from '../../src/db/database';

export default function LoginScreen() {
  const router = useRouter();
  // Prefill with demo credentials in development
  const [tenantId, setTenantId] = useState(__DEV__ ? 'DEMO-A5L32W' : '');
  const [email, setEmail] = useState(__DEV__ ? 'peter@demo.com' : '');
  const [password, setPassword] = useState(__DEV__ ? 'demo123' : '');
  const [isLoading, setIsLoading] = useState(false);
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);
  const [biometricType, setBiometricType] = useState<string>('');

  useEffect(() => {
    checkBiometricSupport();
    loadSavedTenantId();
  }, []);

  const loadSavedTenantId = async () => {
    try {
      const savedTenantId = await authService.getTenantId();
      if (savedTenantId) {
        setTenantId(savedTenantId);
      }
    } catch (error) {
      console.error('Failed to load saved tenant ID:', error);
    }
  };

  const checkBiometricSupport = async () => {
    if (Platform.OS === 'web') {
      setIsBiometricSupported(false);
      return;
    }

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
  };

  const handleLogin = async () => {
    if (!tenantId || !email || !password) {
      Alert.alert('Error', 'Please enter tenant ID, email, and password');
      return;
    }

    // Validate tenant ID format: COMPANY-RANDOM (e.g., DEMO-A5L32W, ACMEOIL-9K2P4H)
    // Company code: 1-8 uppercase letters
    // Random suffix: 6 alphanumeric characters (case-insensitive)
    const tenantIdRegex = /^[A-Z]{1,8}-[A-Z0-9]{6}$/i;
    if (!tenantIdRegex.test(tenantId)) {
      Alert.alert(
        'Invalid Tenant ID',
        'Tenant ID format: COMPANY-RANDOM\n\nExample: DEMO-A5L32W\n\nCompany code: 1-8 letters\nRandom code: 6 alphanumeric characters',
      );
      return;
    }

    setIsLoading(true);

    try {
      const result = await authService.login(email, password, tenantId.toUpperCase());

      if (result.success) {
        // Navigate to main app - token and tenant secret are already saved
        router.replace('/(tabs)');
      } else {
        Alert.alert('Login Failed', result.error || 'Invalid credentials or tenant ID');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to login. Please try again.');
      console.error('Login error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
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
        `Please enroll ${biometricType} in your device settings first`,
      );
      return;
    }

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Sign in to WellPulse Field',
        fallbackLabel: 'Use passcode',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });

      if (result.success) {
        // TODO: Check if user has previously logged in and retrieve credentials from secure storage
        Alert.alert('Success', 'Authenticated successfully', [
          {
            text: 'OK',
            onPress: () => router.replace('/(tabs)'),
          },
        ]);
      } else if (result.error === 'user_cancel') {
        // User cancelled, do nothing
      } else {
        Alert.alert('Authentication Failed', 'Please try again');
      }
    } catch {
      Alert.alert('Error', 'Biometric authentication failed');
    }
  };

  const handleReset = () => {
    Alert.alert(
      'Reset App Data',
      'This will clear all local data including onboarding progress and field entries. Authentication credentials will be preserved. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              // Clear onboarding completion flag
              await AsyncStorage.removeItem('wellpulse_onboarding_complete');

              // Clear all field entries from local database
              const database = await db.getDatabase();
              await database.runAsync('DELETE FROM field_entries');

              // Clear notification preferences
              await AsyncStorage.removeItem('wellpulse_notification_prefs');

              Alert.alert(
                'Reset Complete',
                'All local data has been cleared. The app will now restart to onboarding.',
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      // Redirect to index to trigger onboarding check
                      router.replace('/');
                    },
                  },
                ],
              );
            } catch (error) {
              console.error('Failed to reset app data:', error);
              Alert.alert('Error', 'Failed to reset app data. Please try again.');
            }
          },
        },
      ],
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>⚡</Text>
          <Text style={styles.title}>WellPulse Field</Text>
          <Text style={styles.subtitle}>Field Data Collection</Text>
        </View>

        {/* Login Form */}
        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Tenant ID</Text>
            <TextInput
              style={styles.input}
              placeholder="DEMO-A5L32W"
              placeholderTextColor="#9CA3AF"
              value={tenantId}
              onChangeText={setTenantId}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <Text style={styles.helpText}>Format: COMPANY-XXXXXX (provided by admin)</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="operator@company.com"
              placeholderTextColor="#9CA3AF"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your password"
              placeholderTextColor="#9CA3AF"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          <TouchableOpacity style={styles.loginButton} onPress={handleLogin} disabled={isLoading}>
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.loginButtonText}>Sign In</Text>
            )}
          </TouchableOpacity>

          {/* Biometric Login */}
          {isBiometricSupported && (
            <TouchableOpacity style={styles.biometricButton} onPress={handleBiometricLogin}>
              <Text style={styles.biometricIcon}>{biometricType === 'Face ID' ? '👤' : '👆'}</Text>
              <Text style={styles.biometricText}>Use {biometricType}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.version}>v0.1.0</Text>
          <TouchableOpacity onPress={handleReset} style={styles.resetButton}>
            <Text style={styles.resetText}>🔄 Reset App Data</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logo: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1E40AF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
  },
  form: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    height: 48,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#111827',
  },
  helpText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  loginButton: {
    height: 48,
    backgroundColor: '#1E40AF',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  biometricButton: {
    marginTop: 24,
    padding: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  biometricIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  biometricText: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  footer: {
    marginTop: 48,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#059669',
    fontWeight: '500',
    marginBottom: 8,
  },
  version: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  resetButton: {
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  resetText: {
    fontSize: 13,
    color: '#DC2626',
    fontWeight: '500',
  },
});
