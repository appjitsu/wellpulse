/**
 * API Sync Service
 * Syncs local field entries with backend API
 */

import { Platform } from 'react-native';
import { db } from '../db/database';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

export class SyncService {
  private isSyncing = false;
  private syncListeners: Array<(status: SyncStatus) => void> = [];

  async syncPendingEntries(): Promise<SyncResult> {
    if (Platform.OS === 'web') {
      return { success: 0, failed: 0, errors: [] };
    }

    if (this.isSyncing) {
      throw new Error('Sync already in progress');
    }

    this.isSyncing = true;
    this.notifyListeners({ isSyncing: true, progress: 0 });

    try {
      const pendingEntries = await db.getPendingEntries();

      if (pendingEntries.length === 0) {
        this.notifyListeners({ isSyncing: false, progress: 100 });
        return { success: 0, failed: 0, errors: [] };
      }

      console.log(`[Sync] Starting transactional sync of ${pendingEntries.length} entries`);

      // Get authenticated headers with tenant context
      const { authService } = await import('./auth');
      const deviceId = await authService.getDeviceId();
      const headers = await authService.getAuthHeaders();

      // Transform all entries to API format
      const apiEntries = pendingEntries.map((entry) => ({
        wellId: entry.wellName, // TODO: Map wellName to wellId from local wells table
        entryType: 'PRODUCTION' as const,
        data: {
          volume: parseFloat(entry.productionVolume),
          gasVolume: entry.gasVolume ? parseFloat(entry.gasVolume) : undefined,
          waterVolume: entry.waterVolume ? parseFloat(entry.waterVolume) : undefined,
          waterCut: entry.waterCut ? parseFloat(entry.waterCut) : undefined,
          pressure: entry.pressure ? parseFloat(entry.pressure) : undefined,
          temperature: entry.temperature ? parseFloat(entry.temperature) : undefined,
          tankLevel: entry.tankLevel ? parseFloat(entry.tankLevel) : undefined,
          bsw: entry.bsw ? parseFloat(entry.bsw) : undefined,
          gor: entry.gor ? parseFloat(entry.gor) : undefined,
          fluidLevel: entry.fluidLevel ? parseFloat(entry.fluidLevel) : undefined,
          casingPressure: entry.casingPressure ? parseFloat(entry.casingPressure) : undefined,
          tubingPressure: entry.tubingPressure ? parseFloat(entry.tubingPressure) : undefined,
          pumpStatus: entry.pumpStatus,
          downtimeHours: entry.downtimeHours ? parseFloat(entry.downtimeHours) : undefined,
          downtimeReason: entry.downtimeReason,
          runTicket: entry.runTicket,
          waterHaul: entry.waterHaul ? parseFloat(entry.waterHaul) : undefined,
        },
        recordedAt: entry.createdAt,
        deviceId,
        latitude: entry.location?.latitude,
        longitude: entry.location?.longitude,
        photos: entry.photos,
        notes: entry.notes,
      }));

      // Send all entries in one batch request (transactional)
      this.notifyListeners({ isSyncing: true, progress: 50 });

      const response = await fetch(`${API_BASE_URL}/api/sync/push`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          deviceId,
          entries: apiEntries,
        }),
      });

      this.notifyListeners({ isSyncing: true, progress: 75 });

      if (!response.ok) {
        const errorText = await response.text();

        // Handle 401 Unauthorized - token expired or invalid
        if (response.status === 401) {
          console.log('[Sync] 401 Unauthorized - logging out user');
          await authService.logout();
          throw new Error('Authentication expired. Please log in again.');
        }

        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      // SUCCESS: Mark all entries as synced
      console.log(
        `[Sync] Batch sync successful - marking ${pendingEntries.length} entries as synced`,
      );
      for (const entry of pendingEntries) {
        await db.updateSyncStatus(entry.id, 'synced');
      }

      this.notifyListeners({ isSyncing: false, progress: 100 });
      return { success: pendingEntries.length, failed: 0, errors: [] };
    } catch (error) {
      // FAILURE: Mark all entries as failed (atomic transaction)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[Sync] Batch sync failed - marking all entries as failed:`, errorMessage);

      const pendingEntries = await db.getPendingEntries();
      for (const entry of pendingEntries) {
        await db.updateSyncStatus(entry.id, 'failed', errorMessage);
      }

      this.notifyListeners({ isSyncing: false, progress: 0 });
      return { success: 0, failed: pendingEntries.length, errors: [errorMessage] };
    } finally {
      this.isSyncing = false;
    }
  }

  onSyncStatusChange(listener: (status: SyncStatus) => void): () => void {
    this.syncListeners.push(listener);
    return () => {
      this.syncListeners = this.syncListeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners(status: SyncStatus): void {
    this.syncListeners.forEach((listener) => listener(status));
  }

  async checkConnectivity(): Promise<boolean> {
    try {
      const url = `${API_BASE_URL}/api/health`;
      console.log(`[Sync] Checking connectivity to: ${url}`);
      console.log(`[Sync] API_BASE_URL: ${API_BASE_URL}`);

      // Use AbortController for timeout (AbortSignal.timeout not available in React Native)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      try {
        const response = await fetch(url, {
          method: 'GET',
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        console.log(`[Sync] Response status: ${response.status} ${response.ok ? 'OK' : 'FAILED'}`);
        return response.ok;
      } catch (fetchError) {
        clearTimeout(timeoutId);
        throw fetchError;
      }
    } catch (error) {
      console.error(`[Sync] Connectivity check failed:`, error);
      return false;
    }
  }
}

export interface SyncStatus {
  isSyncing: boolean;
  progress: number; // 0-100
}

export interface SyncResult {
  success: number;
  failed: number;
  errors: string[];
}

export const syncService = new SyncService();
