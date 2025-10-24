/**
 * Wells API Client
 *
 * API client methods for wells endpoints.
 * Follows the established pattern from users.api.ts
 */

import { apiClient } from './client';

export type WellStatus = 'ACTIVE' | 'INACTIVE' | 'PLUGGED_AND_ABANDONED';

export interface Well {
  id: string;
  name: string;
  apiNumber: string;
  status: WellStatus;
  latitude: number;
  longitude: number;
  lease?: string;
  field?: string;
  operator?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface GetWellsParams {
  status?: WellStatus;
  lease?: string;
  field?: string;
  limit?: number;
  offset?: number;
}

export interface GetWellsResponse {
  wells: Well[];
  total: number;
}

export interface CreateWellInput {
  name: string;
  apiNumber: string;
  status: WellStatus;
  latitude: number;
  longitude: number;
  lease?: string;
  field?: string;
  operator?: string;
}

export interface UpdateWellInput {
  name?: string;
  apiNumber?: string;
  status?: WellStatus;
  latitude?: number;
  longitude?: number;
  lease?: string;
  field?: string;
  operator?: string;
}

export const wellsApi = {
  /**
   * Get all wells with optional filters
   */
  getWells: async (params?: GetWellsParams): Promise<GetWellsResponse> => {
    const response = await apiClient.get<GetWellsResponse>('/wells', {
      params,
    });
    return response.data;
  },

  /**
   * Get a single well by ID
   */
  getWellById: async (id: string): Promise<Well> => {
    const response = await apiClient.get<Well>(`/wells/${id}`);
    return response.data;
  },

  /**
   * Create a new well
   */
  createWell: async (data: CreateWellInput): Promise<Well> => {
    const response = await apiClient.post<Well>('/wells', data);
    return response.data;
  },

  /**
   * Update an existing well
   */
  updateWell: async (id: string, data: UpdateWellInput): Promise<Well> => {
    const response = await apiClient.patch<Well>(`/wells/${id}`, data);
    return response.data;
  },

  /**
   * Delete a well (soft delete)
   */
  deleteWell: async (id: string): Promise<{ message: string }> => {
    const response = await apiClient.delete<{ message: string }>(`/wells/${id}`);
    return response.data;
  },
};
