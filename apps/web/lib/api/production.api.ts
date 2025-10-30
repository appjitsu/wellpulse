/**
 * Production API Client
 *
 * API client methods for production analytics endpoints.
 */

import { apiClient } from './client';

export interface MonthlyTrendItem {
  month: string;
  production: number;
  target: number;
  efficiency: number;
}

export interface MonthlyTrendResponse {
  monthlyTrend: MonthlyTrendItem[];
}

export interface WellTypeBreakdownItem {
  type: string;
  wells: number;
  production: number;
  percentage: number;
}

export interface WellTypeBreakdownResponse {
  wellTypeBreakdown: WellTypeBreakdownItem[];
}

export const productionApi = {
  /**
   * Get 6-month production trend
   */
  getMonthlyTrend: async (params?: { months?: number }): Promise<MonthlyTrendResponse> => {
    const response = await apiClient.get<MonthlyTrendResponse>('/production/monthly-trend', {
      params,
    });
    return response.data;
  },

  /**
   * Get production breakdown by well type
   */
  getWellTypeBreakdown: async (): Promise<WellTypeBreakdownResponse> => {
    const response = await apiClient.get<WellTypeBreakdownResponse>(
      '/production/well-type-breakdown',
    );
    return response.data;
  },
};
