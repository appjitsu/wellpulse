/**
 * Tag Mappings Repository
 *
 * Data access layer for SCADA tag mapping management.
 * Abstracts API calls and provides type-safe interfaces.
 *
 * Pattern References:
 * - Repository Pattern (data access abstraction)
 * - Error Handling Pattern (user-friendly error messages)
 */

import { apiClient } from '../api/client';
import type {
  TagMapping,
  CreateTagMappingDto,
  UpdateTagMappingDto,
} from '@/hooks/use-tag-mappings';
import type { OpcTag } from '@/components/scada/tag-mapping-dialog';

/**
 * Tag Mappings Repository
 */
class TagMappingsRepository {
  private readonly basePath = '/scada/tag-mappings';

  /**
   * Fetch all tag mappings for a SCADA connection
   */
  async findByConnection(connectionId: string): Promise<TagMapping[]> {
    try {
      const response = await apiClient.get<TagMapping[]>(`${this.basePath}`, {
        params: { connectionId },
      });
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch tag mappings for connection ${connectionId}:`, error);
      throw new Error('Failed to load tag mappings. Please try again.');
    }
  }

  /**
   * Fetch single tag mapping by ID
   */
  async findById(id: string): Promise<TagMapping> {
    try {
      const response = await apiClient.get<TagMapping>(`${this.basePath}/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch tag mapping ${id}:`, error);
      throw new Error('Failed to load tag mapping details. Please try again.');
    }
  }

  /**
   * Create new tag mapping
   */
  async create(data: CreateTagMappingDto): Promise<TagMapping> {
    try {
      const response = await apiClient.post<TagMapping>(this.basePath, data);
      return response.data;
    } catch (error) {
      console.error('Failed to create tag mapping:', error);
      throw new Error('Failed to create tag mapping. Please check your settings and try again.');
    }
  }

  /**
   * Update tag mapping
   */
  async update(id: string, data: UpdateTagMappingDto): Promise<TagMapping> {
    try {
      const response = await apiClient.patch<TagMapping>(`${this.basePath}/${id}`, data);
      return response.data;
    } catch (error) {
      console.error(`Failed to update tag mapping ${id}:`, error);
      throw new Error('Failed to update tag mapping. Please try again.');
    }
  }

  /**
   * Delete tag mapping
   */
  async delete(id: string): Promise<void> {
    try {
      await apiClient.delete(`${this.basePath}/${id}`);
    } catch (error) {
      console.error(`Failed to delete tag mapping ${id}:`, error);
      throw new Error('Failed to delete tag mapping. Please try again.');
    }
  }

  /**
   * Browse available tags from SCADA connection
   */
  async browseTags(connectionId: string): Promise<OpcTag[]> {
    try {
      const response = await apiClient.get<OpcTag[]>(
        `/scada/connections/${connectionId}/browse-tags`,
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to browse tags for connection ${connectionId}:`, error);
      throw new Error('Failed to browse SCADA tags. Please verify the connection is active.');
    }
  }
}

export const tagMappingsRepository = new TagMappingsRepository();
