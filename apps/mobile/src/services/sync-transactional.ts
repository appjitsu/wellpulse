/**
 * Transactional Sync Service
 * Ensures atomic sync operations - all photos must upload before syncing entry data
 */

import { Platform } from 'react-native';
import { db } from '../db/database';
import { FieldEntry, Photo } from '../db/schema';
import { photoUploadService } from './photo-upload';
import { authService } from './auth';
import { autoResolveConflict } from '../utils/conflict-resolution';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

export class TransactionalSyncService {
  private isSyncing = false;
  private syncListeners: Array<(status: SyncStatus) => void> = [];

  /**
   * Sync pending entries with transactional guarantee:
   * 1. Upload ALL photos first
   * 2. Only if ALL photos succeed → sync entry data with photo URLs
   * 3. If any photo fails → abort sync, mark as 'failed'
   */
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

      let successCount = 0;
      let failedCount = 0;
      const errors: string[] = [];

      for (let i = 0; i < pendingEntries.length; i++) {
        const entry = pendingEntries[i];
        const progress = ((i + 1) / pendingEntries.length) * 100;

        this.notifyListeners({ isSyncing: true, progress });

        try {
          await db.updateSyncStatus(entry.id, 'syncing');

          // TRANSACTIONAL SYNC: Photos first, then data
          await this.syncEntryTransactional(entry);

          await db.updateSyncStatus(entry.id, 'synced');
          successCount++;
        } catch (error) {
          failedCount++;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`${entry.wellName}: ${errorMessage}`);
          await db.updateSyncStatus(entry.id, 'failed', errorMessage);
        }
      }

      this.notifyListeners({ isSyncing: false, progress: 100 });
      return { success: successCount, failed: failedCount, errors };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Sync a single entry with transactional guarantee
   *
   * TRANSACTION FLOW:
   * 1. Upload ALL photos to temporary storage
   * 2. If ANY photo fails → throw error, abort transaction
   * 3. If ALL photos succeed → sync entry data with photo URLs
   * 4. Backend saves entry atomically (data + photo refs)
   */
  private async syncEntryTransactional(entry: FieldEntry): Promise<void> {
    const deviceId = await authService.getDeviceId();
    const headers = await authService.getAuthHeaders();

    // STEP 1: Upload ALL photos first
    const photoUrls: string[] = [];
    const photosToUpload = entry.photos.filter((p) => !p.remoteUrl); // Only upload pending photos

    console.log(
      `[TransactionalSync] Entry ${entry.id}: Uploading ${photosToUpload.length} photos...`,
    );

    if (photosToUpload.length > 0) {
      try {
        for (const photo of photosToUpload) {
          const result = await photoUploadService.uploadPhoto(photo.localUri, entry.id);

          if (!result.success || !result.url) {
            // ABORT TRANSACTION: Photo upload failed
            throw new Error(`Photo upload failed: ${result.error || 'Unknown error'}`);
          }

          photoUrls.push(result.url);
          console.log(`[TransactionalSync] Photo uploaded: ${result.url}`);
        }
      } catch (error) {
        // TRANSACTION ABORTED: Rollback by not syncing entry
        console.error('[TransactionalSync] Transaction aborted - photo upload failed:', error);
        throw new Error(
          `Transaction aborted: ${error instanceof Error ? error.message : 'Photo upload failed'}`,
        );
      }
    }

    console.log(
      `[TransactionalSync] All photos uploaded successfully. Proceeding with entry sync...`,
    );

    // STEP 2: Build entry payload with ALL photo URLs (existing + newly uploaded)
    const allPhotos: Photo[] = [
      ...entry.photos
        .filter((p) => p.remoteUrl)
        .map((p) => ({
          localUri: p.localUri,
          remoteUrl: p.remoteUrl!,
          uploadStatus: 'uploaded' as const,
        })),
      ...photoUrls.map((url, index) => ({
        localUri: photosToUpload[index].localUri,
        remoteUrl: url,
        uploadStatus: 'uploaded' as const,
      })),
    ];

    const apiEntry = {
      wellId: entry.wellName, // TODO: Map wellName to wellId from local wells table
      entryType: 'PRODUCTION' as const,
      data: {
        volume: parseFloat(entry.productionVolume),
        gasVolume: entry.gasVolume ? parseFloat(entry.gasVolume) : undefined,
        pressure: entry.pressure ? parseFloat(entry.pressure) : undefined,
        temperature: entry.temperature ? parseFloat(entry.temperature) : undefined,
        waterCut: entry.waterCut ? parseFloat(entry.waterCut) : undefined,
      },
      recordedAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      deviceId,
      latitude: entry.location?.latitude,
      longitude: entry.location?.longitude,
      photos: allPhotos.map((p) => p.remoteUrl), // Send only remote URLs to backend
      notes: entry.notes,
    };

    // STEP 3: Sync entry data (backend saves atomically)
    const response = await fetch(`${API_BASE_URL}/api/sync/push`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        deviceId,
        entries: [apiEntry],
      }),
    });

    if (response.status === 409) {
      // CONFLICT DETECTED
      console.log('[TransactionalSync] Conflict detected, resolving...');
      const conflictData = await response.json();

      // Auto-resolve with safety-bias strategy
      const resolved = autoResolveConflict(entry, conflictData.serverVersion, 'safety-bias');

      if (resolved.syncStatus === 'conflict') {
        // Conflict requires user resolution
        await db.updateEntryWithConflict(
          entry.id,
          conflictData.serverVersion,
          conflictData.serverVersion,
        );
        throw new Error('Conflict requires user resolution');
      } else {
        // Auto-resolved successfully
        await db.updateEntryWithResolution(entry.id, resolved);
        console.log('[TransactionalSync] Conflict auto-resolved with safety-bias');
      }
    } else if (!response.ok) {
      // TRANSACTION FAILED: Backend rejected entry
      const errorText = await response.text();
      throw new Error(`Backend sync failed: ${response.status} - ${errorText}`);
    }

    // STEP 4: Update local database with remote photo URLs
    // This ensures offline access to photos via localUri, but uses remoteUrl when online
    await db.updateEntryPhotos(entry.id, allPhotos);

    console.log(
      `[TransactionalSync] Entry ${entry.id} synced successfully with ${allPhotos.length} photos`,
    );
  }

  /**
   * Subscribe to sync status changes
   */
  onSyncStatusChange(listener: (status: SyncStatus) => void): () => void {
    this.syncListeners.push(listener);
    return () => {
      this.syncListeners = this.syncListeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners(status: SyncStatus): void {
    this.syncListeners.forEach((listener) => listener(status));
  }

  /**
   * Check API connectivity
   */
  async checkConnectivity(): Promise<boolean> {
    try {
      const url = `${API_BASE_URL}/api/health`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      try {
        const response = await fetch(url, {
          method: 'GET',
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        return response.ok;
      } catch (fetchError) {
        clearTimeout(timeoutId);
        throw fetchError;
      }
    } catch (error) {
      console.error('[TransactionalSync] Connectivity check failed:', error);
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

export const transactionalSyncService = new TransactionalSyncService();
