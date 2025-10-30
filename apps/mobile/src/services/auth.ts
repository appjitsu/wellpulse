/**
 * Authentication Service
 * Manages secure token storage and authentication state for mobile app
 */

import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const AUTH_TOKEN_KEY = 'wellpulse_auth_token';
const USER_DATA_KEY = 'wellpulse_user_data';
const TENANT_ID_KEY = 'wellpulse_tenant_id';
const TENANT_SECRET_KEY = 'wellpulse_tenant_secret';
const BIOMETRIC_ENABLED_KEY = 'wellpulse_biometric_enabled';
const DEVICE_ID_KEY = 'wellpulse_device_id';

export interface User {
  id: string;
  email: string;
  name: string;
}

class AuthService {
  /**
   * Save authentication token securely
   * On iOS: Uses Keychain
   * On Android: Uses EncryptedSharedPreferences
   * On Web: Uses localStorage (less secure, but acceptable for development)
   */
  async saveAuthToken(token: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.setItem(AUTH_TOKEN_KEY, token);
      return;
    }

    await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
  }

  /**
   * Get stored authentication token
   */
  async getAuthToken(): Promise<string | null> {
    if (Platform.OS === 'web') {
      return localStorage.getItem(AUTH_TOKEN_KEY);
    }

    return await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
  }

  /**
   * Remove authentication token (logout)
   * NOTE: Tenant ID and secret key persist across logout
   */
  async removeAuthToken(): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(USER_DATA_KEY);
      // Tenant ID and secret key persist
      return;
    }

    await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_DATA_KEY);
    // Tenant ID and secret key persist
  }

  /**
   * Save tenant ID (persists across logout)
   */
  async saveTenantId(tenantId: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.setItem(TENANT_ID_KEY, tenantId);
      return;
    }

    await SecureStore.setItemAsync(TENANT_ID_KEY, tenantId);
  }

  /**
   * Get stored tenant ID
   */
  async getTenantId(): Promise<string | null> {
    if (Platform.OS === 'web') {
      return localStorage.getItem(TENANT_ID_KEY);
    }

    return await SecureStore.getItemAsync(TENANT_ID_KEY);
  }

  /**
   * Save tenant secret key (returned from server on login, persists across logout)
   * Can be rotated by super admin in admin control panel
   */
  async saveTenantSecret(secret: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.setItem(TENANT_SECRET_KEY, secret);
      return;
    }

    await SecureStore.setItemAsync(TENANT_SECRET_KEY, secret);
  }

  /**
   * Get stored tenant secret key
   */
  async getTenantSecret(): Promise<string | null> {
    if (Platform.OS === 'web') {
      return localStorage.getItem(TENANT_SECRET_KEY);
    }

    return await SecureStore.getItemAsync(TENANT_SECRET_KEY);
  }

  /**
   * Get persistent device ID (generates one if not exists)
   * Device ID format: mobile-{timestamp}-{random}
   * Used to track which device submitted field entries for sync
   */
  async getDeviceId(): Promise<string> {
    if (Platform.OS === 'web') {
      let deviceId = localStorage.getItem(DEVICE_ID_KEY);
      if (!deviceId) {
        deviceId = `mobile-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
        localStorage.setItem(DEVICE_ID_KEY, deviceId);
      }
      return deviceId;
    }

    let deviceId = await SecureStore.getItemAsync(DEVICE_ID_KEY);
    if (!deviceId) {
      // Generate unique device ID: mobile-{timestamp}-{random}
      deviceId = `mobile-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
      await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);
      console.log('[Auth] Generated new device ID:', deviceId);
    }
    return deviceId;
  }

  /**
   * Save user data
   */
  async saveUserData(user: User): Promise<void> {
    const userData = JSON.stringify(user);

    if (Platform.OS === 'web') {
      localStorage.setItem(USER_DATA_KEY, userData);
      return;
    }

    await SecureStore.setItemAsync(USER_DATA_KEY, userData);
  }

  /**
   * Get stored user data
   */
  async getUserData(): Promise<User | null> {
    let userData: string | null;

    if (Platform.OS === 'web') {
      userData = localStorage.getItem(USER_DATA_KEY);
    } else {
      userData = await SecureStore.getItemAsync(USER_DATA_KEY);
    }

    if (!userData) {
      return null;
    }

    try {
      return JSON.parse(userData) as User;
    } catch {
      return null;
    }
  }

  /**
   * Check if user is authenticated and token is valid (not expired)
   */
  async isAuthenticated(): Promise<boolean> {
    const token = await this.getAuthToken();
    if (!token) {
      return false;
    }

    // Check if token is expired
    const isExpired = this.isTokenExpired(token);
    if (isExpired) {
      // Auto-logout if token expired
      console.log('[Auth] Token expired, logging out...');
      await this.logout();
      return false;
    }

    return true;
  }

  /**
   * Decode JWT token and check if it's expired
   * @param token - JWT access token
   * @returns true if token is expired, false otherwise
   */
  private isTokenExpired(token: string): boolean {
    try {
      // JWT structure: header.payload.signature
      const parts = token.split('.');
      if (parts.length !== 3) {
        console.error('[Auth] Invalid JWT token format');
        return true; // Treat invalid token as expired
      }

      // Decode the payload (base64)
      const payload = parts[1];
      const decodedPayload = JSON.parse(this.base64UrlDecode(payload));

      // Check expiration (exp is in seconds, Date.now() is in milliseconds)
      if (!decodedPayload.exp) {
        console.error('[Auth] Token missing expiration claim');
        return true; // No expiration = treat as expired for security
      }

      const expirationTime = decodedPayload.exp * 1000; // Convert to milliseconds
      const currentTime = Date.now();
      const isExpired = currentTime >= expirationTime;

      if (isExpired) {
        console.log('[Auth] Token expired:', {
          expirationTime: new Date(expirationTime).toISOString(),
          currentTime: new Date(currentTime).toISOString(),
        });
      }

      return isExpired;
    } catch (error) {
      console.error('[Auth] Failed to decode token:', error);
      return true; // Treat decode errors as expired
    }
  }

  /**
   * Base64 URL decode (handles JWT base64url encoding)
   * @param str - Base64 URL encoded string
   * @returns Decoded string
   */
  private base64UrlDecode(str: string): string {
    // Replace URL-safe characters
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');

    // Pad with '=' to make length multiple of 4
    const padding = base64.length % 4;
    if (padding > 0) {
      base64 += '='.repeat(4 - padding);
    }

    // Decode base64
    if (Platform.OS === 'web') {
      return atob(base64);
    } else {
      // React Native: Use manual base64 decode
      return this.decodeBase64(base64);
    }
  }

  /**
   * Manual base64 decode for React Native
   * @param base64 - Base64 encoded string
   * @returns Decoded string
   */
  private decodeBase64(base64: string): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let result = '';
    let buffer = 0;
    let bits = 0;

    for (let i = 0; i < base64.length; i++) {
      const char = base64[i];
      if (char === '=') break;

      const value = chars.indexOf(char);
      if (value === -1) continue;

      buffer = (buffer << 6) | value;
      bits += 6;

      if (bits >= 8) {
        bits -= 8;
        result += String.fromCharCode((buffer >> bits) & 0xff);
      }
    }

    return result;
  }

  /**
   * Login with email and password
   * Calls backend API and stores returned access token and tenant secret
   * @param email - User email
   * @param password - User password
   * @param tenantId - Tenant identifier (e.g., "demo", "acme") - persists across logout
   */
  async login(
    email: string,
    password: string,
    tenantId: string,
  ): Promise<{ success: boolean; token?: string; user?: User; error?: string }> {
    // Use localhost for web, network IP for mobile devices
    const API_URL =
      Platform.OS === 'web'
        ? 'http://localhost:4000'
        : process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

    try {
      // Save tenant ID for future API requests (persists across logout)
      await this.saveTenantId(tenantId);

      // Login endpoint only requires X-Tenant-ID, not X-Tenant-Secret
      // The server will return the tenant secret in the response
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Tenant-ID': tenantId,
      };

      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          email,
          password,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Login failed' }));
        return {
          success: false,
          error: errorData.message || 'Invalid email or password',
        };
      }

      const data = await response.json();

      // Extract user, token, and tenant secret from API response
      const user: User = {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name,
      };

      const token = data.accessToken;
      const tenantSecret = data.tenantSecret; // Server returns tenant secret

      // Save token, user data, and tenant secret securely
      await this.saveAuthToken(token);
      await this.saveUserData(user);
      await this.saveTenantSecret(tenantSecret);

      return {
        success: true,
        token,
        user,
      };
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Network error. Please check your connection.',
      };
    }
  }

  /**
   * Logout - clear all auth data (tenant ID and secret persist)
   */
  async logout(): Promise<void> {
    await this.removeAuthToken();
  }

  /**
   * Get authenticated request headers with tenant ID and secret
   * Use this helper for all API requests that require authentication
   * @returns Headers object with Authorization, X-Tenant-ID, and X-Tenant-Secret
   */
  async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await this.getAuthToken();
    const tenantId = await this.getTenantId();
    const tenantSecret = await this.getTenantSecret();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (tenantId) {
      headers['X-Tenant-ID'] = tenantId;
    }

    if (tenantSecret) {
      headers['X-Tenant-Secret'] = tenantSecret;
    }

    return headers;
  }

  /**
   * Check if biometric authentication is enabled
   */
  async isBiometricEnabled(): Promise<boolean> {
    if (Platform.OS === 'web') {
      return false;
    }

    const enabled = await AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY);
    return enabled === 'true';
  }

  /**
   * Enable or disable biometric authentication
   */
  async setBiometricEnabled(enabled: boolean): Promise<void> {
    if (Platform.OS === 'web') {
      return;
    }

    await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, enabled ? 'true' : 'false');
  }

  /**
   * Authenticate user with biometrics (Face ID, Touch ID, etc.)
   * @returns {Promise<boolean>} true if authentication successful, false otherwise
   */
  async authenticateWithBiometrics(): Promise<boolean> {
    if (Platform.OS === 'web') {
      return false;
    }

    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      if (!hasHardware) {
        return false;
      }

      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!isEnrolled) {
        return false;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to access WellPulse',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false, // Allow PIN/password fallback
        fallbackLabel: 'Use PIN',
      });

      return result.success;
    } catch (error) {
      console.error('[Auth] Biometric authentication failed:', error);
      return false;
    }
  }
}

export const authService = new AuthService();
