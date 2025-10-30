/**
 * Dashboard API Client
 *
 * API client methods for dashboard analytics endpoints.
 */

import { apiClient } from './client';

export interface DashboardMetric {
  value: number | string;
  change: string;
  trend: 'up' | 'down' | 'neutral';
  unit?: string;
}

export interface DashboardMetricsResponse {
  totalWells: DashboardMetric;
  dailyProduction: DashboardMetric & { unit: string };
  activeAlerts: DashboardMetric;
  monthlyRevenue: DashboardMetric;
}

export interface WellStatusItem {
  status: string;
  count: number;
  percentage: number;
}

export interface WellStatusResponse {
  statusDistribution: WellStatusItem[];
  totalWells: number;
}

export interface RecentActivityItem {
  id: string;
  wellId: string;
  wellName: string;
  event: string;
  eventType: 'PRODUCTION' | 'INSPECTION' | 'MAINTENANCE' | 'ANOMALY';
  severity: 'success' | 'warning' | 'info';
  timestamp: string;
  timeAgo: string;
}

export interface RecentActivityResponse {
  activities: RecentActivityItem[];
}

export interface TopProducer {
  wellId: string;
  wellName: string;
  avgDailyProduction: number;
  trendPercentage: number;
  trend: 'up' | 'down' | 'neutral';
}

export interface TopProducersResponse {
  topProducers: TopProducer[];
}

export const dashboardApi = {
  /**
   * Get dashboard metrics (total wells, production, alerts, revenue)
   */
  getMetrics: async (): Promise<DashboardMetricsResponse> => {
    const response = await apiClient.get<DashboardMetricsResponse>('/dashboard/metrics');
    return response.data;
  },

  /**
   * Get well status distribution
   */
  getWellStatus: async (): Promise<WellStatusResponse> => {
    const response = await apiClient.get<WellStatusResponse>('/dashboard/well-status');
    return response.data;
  },

  /**
   * Get recent activity (last 10 events)
   */
  getRecentActivity: async (): Promise<RecentActivityResponse> => {
    const response = await apiClient.get<RecentActivityResponse>('/dashboard/recent-activity');
    return response.data;
  },

  /**
   * Get top producing wells (top 5)
   */
  getTopProducers: async (): Promise<TopProducersResponse> => {
    const response = await apiClient.get<TopProducersResponse>('/dashboard/top-producers');
    return response.data;
  },
};
