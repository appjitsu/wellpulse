/**
 * Alerts API Client
 *
 * API client methods for alerts endpoints.
 */

import { apiClient } from './client';

export type AlertSeverity = 'critical' | 'warning' | 'info';
export type AlertType =
  | 'PRODUCTION_ANOMALY'
  | 'EQUIPMENT_FAILURE'
  | 'SAFETY_VIOLATION'
  | 'COMPLIANCE_ISSUE'
  | 'MAINTENANCE_DUE'
  | 'LOW_PRESSURE'
  | 'HIGH_PRESSURE'
  | 'TANK_LEVEL';

export interface AlertStatsResponse {
  total: number;
  unacknowledged: number;
  bySeverity: {
    critical: number;
    warning: number;
    info: number;
  };
}

export interface AlertItem {
  id: string;
  tenantId: string;
  wellId: string;
  wellName: string;
  fieldId: string | null;
  fieldName: string | null;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RecentAlertsResponse {
  alerts: AlertItem[];
  count: number;
}

export interface AlertHistoryFilters {
  page?: number;
  limit?: number;
  severity?: AlertSeverity;
  acknowledged?: boolean;
  search?: string;
}

export interface AlertHistoryResponse {
  alerts: AlertItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface AcknowledgeAlertResponse {
  message: string;
  alert: AlertItem;
}

export const alertsApi = {
  /**
   * Get alert statistics (total, unacknowledged, by severity)
   */
  getAlertStats: async (): Promise<AlertStatsResponse> => {
    const response = await apiClient.get<AlertStatsResponse>('/alerts/stats');
    return response.data;
  },

  /**
   * Get recent unacknowledged alerts
   */
  getRecentAlerts: async (limit?: number): Promise<RecentAlertsResponse> => {
    const response = await apiClient.get<RecentAlertsResponse>('/alerts/recent', {
      params: { limit: limit || 10 },
    });
    return response.data;
  },

  /**
   * Get paginated alert history with filters
   */
  getAlertHistory: async (filters?: AlertHistoryFilters): Promise<AlertHistoryResponse> => {
    const response = await apiClient.get<AlertHistoryResponse>('/alerts/history', {
      params: filters,
    });
    return response.data;
  },

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert: async (alertId: string): Promise<AcknowledgeAlertResponse> => {
    const response = await apiClient.post<AcknowledgeAlertResponse>(
      `/alerts/${alertId}/acknowledge`,
    );
    return response.data;
  },

  /**
   * Bulk acknowledge alerts
   */
  bulkAcknowledgeAlerts: async (
    alertIds: string[],
  ): Promise<{ message: string; count: number }> => {
    const response = await apiClient.post<{ message: string; count: number }>(
      '/alerts/acknowledge/bulk',
      { alertIds },
    );
    return response.data;
  },
};
