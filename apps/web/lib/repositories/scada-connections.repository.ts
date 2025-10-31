/**
 * SCADA Connections Repository
 *
 * Data access layer for SCADA connection management.
 * Abstracts API calls and provides type-safe interfaces.
 *
 * Pattern References:
 * - Repository Pattern (data access abstraction)
 * - Error Handling Pattern (user-friendly error messages)
 *
 * @see docs/patterns/05-Repository-Pattern.md
 */

import { apiClient } from '../api/client';
import type { ScadaConnectionItem } from '@/components/scada/scada-connections-list';
import type {
  CreateScadaConnectionDto,
  UpdateScadaConnectionDto,
  TestConnectionDto,
} from '@/hooks/use-scada-connections';

/**
 * SCADA Connections Repository
 */
class ScadaConnectionsRepository {
  private readonly basePath = '/scada/connections';

  /**
   * Fetch all SCADA connections for the current tenant
   */
  async findAll(): Promise<ScadaConnectionItem[]> {
    try {
      const response = await apiClient.get<ScadaConnectionItem[]>(this.basePath);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch SCADA connections:', error);
      throw new Error('Failed to load SCADA connections. Please try again.');
    }
  }

  /**
   * Fetch single SCADA connection by ID
   */
  async findById(id: string): Promise<ScadaConnectionItem> {
    try {
      const response = await apiClient.get<ScadaConnectionItem>(`${this.basePath}/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch SCADA connection ${id}:`, error);
      throw new Error('Failed to load connection details. Please try again.');
    }
  }

  /**
   * Create new SCADA connection
   */
  async create(data: CreateScadaConnectionDto): Promise<ScadaConnectionItem> {
    try {
      const response = await apiClient.post<ScadaConnectionItem>(this.basePath, data);
      return response.data;
    } catch (error) {
      console.error('Failed to create SCADA connection:', error);
      throw new Error('Failed to create connection. Please check your settings and try again.');
    }
  }

  /**
   * Test SCADA connection without saving
   */
  async testConnection(data: TestConnectionDto): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await apiClient.post<{ success: boolean; error?: string }>(
        `${this.basePath}/test`,
        data,
      );
      return response.data;
    } catch (error) {
      console.error('Connection test failed:', error);
      return {
        success: false,
        error: 'Connection test failed. Please verify your endpoint URL and credentials.',
      };
    }
  }

  /**
   * Update SCADA connection
   */
  async update(id: string, data: UpdateScadaConnectionDto): Promise<ScadaConnectionItem> {
    try {
      const response = await apiClient.patch<ScadaConnectionItem>(`${this.basePath}/${id}`, data);
      return response.data;
    } catch (error) {
      console.error(`Failed to update SCADA connection ${id}:`, error);
      throw new Error('Failed to update connection. Please try again.');
    }
  }

  /**
   * Delete SCADA connection (soft delete)
   */
  async delete(id: string): Promise<void> {
    try {
      await apiClient.delete(`${this.basePath}/${id}`);
    } catch (error) {
      console.error(`Failed to delete SCADA connection ${id}:`, error);
      throw new Error('Failed to delete connection. Please try again.');
    }
  }

  /**
   * Disconnect SCADA connection (keeps configuration)
   */
  async disconnect(id: string): Promise<void> {
    try {
      await apiClient.post(`${this.basePath}/${id}/disconnect`);
    } catch (error) {
      console.error(`Failed to disconnect SCADA connection ${id}:`, error);
      throw new Error('Failed to disconnect. Please try again.');
    }
  }
}

export const scadaConnectionsRepository = new ScadaConnectionsRepository();
