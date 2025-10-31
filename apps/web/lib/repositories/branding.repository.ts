/**
 * Branding Repository
 *
 * Data access layer for white-label branding configuration.
 * Handles logo uploads to Azure Blob Storage.
 *
 * Pattern References:
 * - Repository Pattern (data access abstraction)
 * - Strategy Pattern (Azure Blob Storage)
 * - Error Handling Pattern (user-friendly error messages)
 */

import { apiClient } from '../api/client';
import type { Branding, UpdateBrandingDto } from '@/hooks/use-branding';

/**
 * Branding Repository
 */
class BrandingRepository {
  private readonly basePath = '/admin/branding';

  /**
   * Fetch current branding settings for the tenant
   */
  async getCurrent(): Promise<Branding> {
    try {
      const response = await apiClient.get<Branding>(this.basePath);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch branding settings:', error);
      throw new Error('Failed to load branding settings. Please try again.');
    }
  }

  /**
   * Update branding settings
   */
  async update(data: UpdateBrandingDto): Promise<Branding> {
    try {
      const response = await apiClient.patch<Branding>(this.basePath, data);
      return response.data;
    } catch (error) {
      console.error('Failed to update branding settings:', error);
      throw new Error('Failed to update branding settings. Please try again.');
    }
  }

  /**
   * Upload company logo to Azure Blob Storage
   */
  async uploadLogo(file: File): Promise<{ logoUrl: string }> {
    try {
      const formData = new FormData();
      formData.append('logo', file);

      const response = await apiClient.post<{ logoUrl: string }>(
        `${this.basePath}/upload-logo`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        },
      );

      return response.data;
    } catch (error) {
      console.error('Failed to upload logo:', error);
      throw new Error('Failed to upload logo. Please try again.');
    }
  }
}

export const brandingRepository = new BrandingRepository();
