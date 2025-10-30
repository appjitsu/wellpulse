/**
 * Photo Upload Service
 * Handles uploading field entry photos to backend storage
 */

import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { FileSystemUploadType } from 'expo-file-system/legacy';
import { authService } from './auth';
import { Photo } from '../db/schema';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

export interface PhotoUploadJob {
  localUri: string;
  entryId: string;
  index: number;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  progress: number;
  remoteUrl?: string;
  error?: string;
}

class PhotoUploadService {
  private uploadQueue: PhotoUploadJob[] = [];
  private activeUploads: Map<string, AbortController> = new Map();
  private uploadListeners: Array<(jobs: PhotoUploadJob[]) => void> = [];

  /**
   * Upload a single photo to the backend
   * Automatically compresses photos before upload to minimize bandwidth
   * Returns the remote URL on success
   */
  async uploadPhoto(
    localUri: string,
    entryId: string,
    _onProgress?: (progress: UploadProgress) => void,
  ): Promise<UploadResult> {
    if (Platform.OS === 'web') {
      return {
        success: false,
        error: 'Photo upload not supported on web',
      };
    }

    try {
      // STEP 1: Compress photo to minimize bandwidth (critical for field workers with poor connectivity)
      console.log('[PhotoUpload] Compressing photo before upload...');
      const compressedUri = await this.compressPhoto(localUri);

      // Get file info (check compressed file)
      const fileInfo = await FileSystem.getInfoAsync(compressedUri);
      if (!fileInfo.exists) {
        return {
          success: false,
          error: 'Photo file not found',
        };
      }

      console.log(
        `[PhotoUpload] Compressed ${localUri} to ${compressedUri} (${fileInfo.size ? Math.round(fileInfo.size / 1024) : '?'}KB)`,
      );

      // Get auth headers
      const headers = await authService.getAuthHeaders();

      // Create abort controller for cancellation
      const abortController = new AbortController();
      const uploadKey = `${entryId}-${localUri}`;
      this.activeUploads.set(uploadKey, abortController);

      // STEP 2: Upload compressed photo using FileSystem.uploadAsync for progress tracking
      const uploadResult = await FileSystem.uploadAsync(
        `${API_BASE_URL}/api/field-entries/${entryId}/photos`,
        compressedUri, // Upload compressed version
        {
          httpMethod: 'POST',
          uploadType: FileSystemUploadType.MULTIPART,
          fieldName: 'photo',
          headers,
          parameters: {
            entryId,
          },
        },
      );

      // Clean up abort controller
      this.activeUploads.delete(uploadKey);

      if (uploadResult.status === 200 || uploadResult.status === 201) {
        const response = JSON.parse(uploadResult.body);
        return {
          success: true,
          url: response.url,
        };
      } else {
        const errorResponse = JSON.parse(uploadResult.body);
        return {
          success: false,
          error: errorResponse.message || 'Upload failed',
        };
      }
    } catch (error) {
      console.error('[PhotoUpload] Upload error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  }

  /**
   * Upload multiple photos for an entry
   * Returns array of results for each photo
   */
  async uploadPhotos(
    photos: Photo[],
    entryId: string,
    onProgress?: (completed: number, total: number) => void,
  ): Promise<UploadResult[]> {
    const results: UploadResult[] = [];

    for (let i = 0; i < photos.length; i++) {
      const result = await this.uploadPhoto(photos[i].localUri, entryId);
      results.push(result);

      if (onProgress) {
        onProgress(i + 1, photos.length);
      }
    }

    return results;
  }

  /**
   * Queue photos for background upload
   * Returns immediately, uploads happen in background
   */
  queuePhotosForUpload(photos: Photo[], entryId: string): void {
    const jobs: PhotoUploadJob[] = photos.map((photo, index) => ({
      localUri: photo.localUri,
      entryId,
      index,
      status: 'pending',
      progress: 0,
    }));

    this.uploadQueue.push(...jobs);
    this.notifyListeners();

    // Start processing queue
    this.processQueue();
  }

  /**
   * Process upload queue in background
   */
  private async processQueue(): Promise<void> {
    const pendingJobs = this.uploadQueue.filter((job) => job.status === 'pending');

    // Process up to 2 uploads concurrently
    const maxConcurrent = 2;
    const currentUploading = this.uploadQueue.filter((job) => job.status === 'uploading').length;
    const slotsAvailable = maxConcurrent - currentUploading;

    if (slotsAvailable <= 0 || pendingJobs.length === 0) {
      return;
    }

    const jobsToProcess = pendingJobs.slice(0, slotsAvailable);

    for (const job of jobsToProcess) {
      job.status = 'uploading';
      this.notifyListeners();

      // Upload in background
      this.uploadPhoto(job.localUri, job.entryId, (progress) => {
        job.progress = progress.percentage;
        this.notifyListeners();
      })
        .then((result) => {
          if (result.success) {
            job.status = 'completed';
            job.remoteUrl = result.url;
            job.progress = 100;
          } else {
            job.status = 'failed';
            job.error = result.error;
          }
          this.notifyListeners();

          // Continue processing queue
          this.processQueue();
        })
        .catch((error) => {
          job.status = 'failed';
          job.error = error instanceof Error ? error.message : 'Unknown error';
          this.notifyListeners();

          // Continue processing queue
          this.processQueue();
        });
    }
  }

  /**
   * Cancel a specific upload
   */
  cancelUpload(entryId: string, localUri: string): void {
    const uploadKey = `${entryId}-${localUri}`;
    const abortController = this.activeUploads.get(uploadKey);

    if (abortController) {
      abortController.abort();
      this.activeUploads.delete(uploadKey);
    }

    // Remove from queue
    const job = this.uploadQueue.find((j) => j.entryId === entryId && j.localUri === localUri);
    if (job) {
      job.status = 'failed';
      job.error = 'Cancelled by user';
      this.notifyListeners();
    }
  }

  /**
   * Retry a failed upload
   */
  retryUpload(entryId: string, localUri: string): void {
    const job = this.uploadQueue.find(
      (j) => j.entryId === entryId && j.localUri === localUri && j.status === 'failed',
    );

    if (job) {
      job.status = 'pending';
      job.error = undefined;
      job.progress = 0;
      this.notifyListeners();

      // Restart queue processing
      this.processQueue();
    }
  }

  /**
   * Get current upload queue status
   */
  getUploadQueue(): PhotoUploadJob[] {
    return [...this.uploadQueue];
  }

  /**
   * Clear completed uploads from queue
   */
  clearCompletedUploads(): void {
    this.uploadQueue = this.uploadQueue.filter((job) => job.status !== 'completed');
    this.notifyListeners();
  }

  /**
   * Subscribe to upload queue changes
   */
  onQueueChange(listener: (jobs: PhotoUploadJob[]) => void): () => void {
    this.uploadListeners.push(listener);
    return () => {
      this.uploadListeners = this.uploadListeners.filter((l) => l !== listener);
    };
  }

  /**
   * Notify all listeners of queue changes
   */
  private notifyListeners(): void {
    const jobs = this.getUploadQueue();
    this.uploadListeners.forEach((listener) => listener(jobs));
  }

  /**
   * Compress photo before upload (reduces bandwidth)
   * Uses Expo's ImageManipulator
   */
  async compressPhoto(localUri: string, quality: number = 0.8): Promise<string> {
    if (Platform.OS === 'web') {
      return localUri; // No compression on web
    }

    try {
      const { ImageManipulator } = await import('expo-image-manipulator');

      const manipResult = await ImageManipulator.manipulateAsync(
        localUri,
        [{ resize: { width: 1920 } }], // Max width 1920px
        { compress: quality, format: ImageManipulator.SaveFormat.JPEG },
      );

      return manipResult.uri;
    } catch (error) {
      console.error('[PhotoUpload] Compression error:', error);
      return localUri; // Return original if compression fails
    }
  }
}

export const photoUploadService = new PhotoUploadService();
