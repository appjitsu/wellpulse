/**
 * Nominal Ranges Repository
 * Handles fetching effective nominal ranges from API and caching for offline use
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService } from '../services/auth';
import { Platform } from 'react-native';

const CACHE_KEY_PREFIX = 'nominal_ranges_';

/**
 * Nominal range data structure matching backend DTO
 */
export interface NominalRange {
  id: string;
  fieldName: string;
  min: number;
  max: number;
  unit: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message?: string | null;
  gracePeriodMinutes?: number | null;
  isWellOverride: boolean;
  wellId?: string | null;
  overrideReason?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

/**
 * Effective nominal ranges response from API
 */
export interface EffectiveNominalRangesResponse {
  wellId: string;
  wellName: string;
  ranges: NominalRange[];
  overrideCount: number;
  defaultCount: number;
}

class NominalRangesRepository {
  private apiUrl: string;

  constructor() {
    // Use localhost for web, network IP for mobile devices
    this.apiUrl =
      Platform.OS === 'web'
        ? 'http://localhost:4000'
        : process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';
  }

  /**
   * Fetch effective nominal ranges for a well from API
   * @param wellId - Well identifier
   * @returns Effective nominal ranges with cascade resolution
   */
  async fetchEffectiveRanges(wellId: string): Promise<EffectiveNominalRangesResponse | null> {
    try {
      const headers = await authService.getAuthHeaders();
      const response = await fetch(`${this.apiUrl}/api/nominal-ranges/effective/${wellId}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        console.error('[NominalRanges] Failed to fetch effective ranges:', response.status);
        return null;
      }

      const data: EffectiveNominalRangesResponse = await response.json();

      // Cache the ranges for offline use
      await this.cacheRanges(wellId, data.ranges);

      return data;
    } catch (error) {
      console.error('[NominalRanges] Error fetching effective ranges:', error);
      return null;
    }
  }

  /**
   * Cache nominal ranges in AsyncStorage for offline use
   * @param wellId - Well identifier
   * @param ranges - Nominal ranges to cache
   */
  async cacheRanges(wellId: string, ranges: NominalRange[]): Promise<void> {
    try {
      const cacheKey = `${CACHE_KEY_PREFIX}${wellId}`;
      const cacheData = {
        wellId,
        ranges,
        cachedAt: new Date().toISOString(),
      };
      await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheData));
      console.log(`[NominalRanges] Cached ${ranges.length} ranges for well ${wellId}`);
    } catch (error) {
      console.error('[NominalRanges] Error caching ranges:', error);
    }
  }

  /**
   * Get cached nominal ranges from AsyncStorage
   * @param wellId - Well identifier
   * @returns Cached nominal ranges or null if not found
   */
  async getCachedRanges(wellId: string): Promise<NominalRange[] | null> {
    try {
      const cacheKey = `${CACHE_KEY_PREFIX}${wellId}`;
      const cachedData = await AsyncStorage.getItem(cacheKey);

      if (!cachedData) {
        return null;
      }

      const { ranges, cachedAt } = JSON.parse(cachedData);

      // Check if cache is stale (older than 24 hours)
      const cacheAge = Date.now() - new Date(cachedAt).getTime();
      const MAX_CACHE_AGE = 24 * 60 * 60 * 1000; // 24 hours

      if (cacheAge > MAX_CACHE_AGE) {
        console.log('[NominalRanges] Cache is stale, returning null');
        return null;
      }

      console.log(`[NominalRanges] Loaded ${ranges.length} cached ranges for well ${wellId}`);
      return ranges;
    } catch (error) {
      console.error('[NominalRanges] Error loading cached ranges:', error);
      return null;
    }
  }

  /**
   * Get effective ranges for a well (try API first, fallback to cache)
   * @param wellId - Well identifier
   * @param useCache - Whether to use cached data if API fails
   * @returns Nominal ranges array
   */
  async getEffectiveRanges(wellId: string, useCache: boolean = true): Promise<NominalRange[]> {
    // Try fetching from API first
    const apiData = await this.fetchEffectiveRanges(wellId);
    if (apiData) {
      return apiData.ranges;
    }

    // Fallback to cached data if API fails and cache is allowed
    if (useCache) {
      const cached = await this.getCachedRanges(wellId);
      if (cached) {
        console.log('[NominalRanges] Using cached ranges as fallback');
        return cached;
      }
    }

    console.log('[NominalRanges] No ranges available (API failed, no cache)');
    return [];
  }

  /**
   * Clear all cached nominal ranges (useful for logout or data reset)
   */
  async clearAllCaches(): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter((key) => key.startsWith(CACHE_KEY_PREFIX));
      await AsyncStorage.multiRemove(cacheKeys);
      console.log(`[NominalRanges] Cleared ${cacheKeys.length} cached ranges`);
    } catch (error) {
      console.error('[NominalRanges] Error clearing caches:', error);
    }
  }
}

export const nominalRangesRepository = new NominalRangesRepository();
