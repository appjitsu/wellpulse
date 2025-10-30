/**
 * Alerts Repository
 * Handles fetching alerts from API and acknowledging them
 */

import { authService } from '../services/auth';
import { Platform } from 'react-native';

/**
 * Alert data structure matching backend DTO
 */
export interface Alert {
  id: string;
  wellId: string;
  wellName: string;
  wellApiNumber: string;
  fieldEntryId: string;
  nominalRangeId: string;
  fieldName: string;
  value: number;
  expectedMin: number;
  expectedMax: number;
  unit: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  triggeredAt: string;
  isAcknowledged: boolean;
  acknowledgedBy?: string | null;
  acknowledgedAt?: string | null;
  acknowledgedNotes?: string | null;
}

/**
 * Recent alerts response from API
 */
export interface RecentAlertsResponse {
  alerts: Alert[];
  count: number;
  criticalCount: number;
  lastCheckedAt: string;
}

/**
 * Acknowledge alert response from API
 */
export interface AcknowledgeAlertResponse {
  message: string;
  alertId: string;
  acknowledgedAt: string;
}

class AlertsRepository {
  private apiUrl: string;

  constructor() {
    // Use localhost for web, network IP for mobile devices
    this.apiUrl =
      Platform.OS === 'web'
        ? 'http://localhost:4000'
        : process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';
  }

  /**
   * Fetch recent unacknowledged alerts from API
   * @returns Recent alerts response
   */
  async fetchRecentAlerts(): Promise<RecentAlertsResponse | null> {
    try {
      const headers = await authService.getAuthHeaders();
      const response = await fetch(`${this.apiUrl}/api/alerts/recent`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        console.error('[Alerts] Failed to fetch recent alerts:', response.status);
        return null;
      }

      const data: RecentAlertsResponse = await response.json();
      console.log(`[Alerts] Fetched ${data.count} recent alerts (${data.criticalCount} critical)`);
      return data;
    } catch (error) {
      console.error('[Alerts] Error fetching recent alerts:', error);
      return null;
    }
  }

  /**
   * Acknowledge an alert via API
   * @param alertId - Alert identifier
   * @param notes - Optional notes about the acknowledgement
   * @returns Acknowledge response or null if failed
   */
  async acknowledgeAlert(
    alertId: string,
    notes?: string,
  ): Promise<AcknowledgeAlertResponse | null> {
    try {
      const headers = await authService.getAuthHeaders();
      const response = await fetch(`${this.apiUrl}/api/alerts/${alertId}/acknowledge`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ notes }),
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ message: 'Failed to acknowledge alert' }));
        console.error('[Alerts] Failed to acknowledge alert:', errorData.message);
        return null;
      }

      const data: AcknowledgeAlertResponse = await response.json();
      console.log(`[Alerts] Alert ${alertId} acknowledged successfully`);
      return data;
    } catch (error) {
      console.error('[Alerts] Error acknowledging alert:', error);
      return null;
    }
  }

  /**
   * Get count of unacknowledged alerts
   * @returns Count of unacknowledged alerts
   */
  async getUnacknowledgedCount(): Promise<number> {
    const recentAlerts = await this.fetchRecentAlerts();
    return recentAlerts?.count || 0;
  }

  /**
   * Get count of critical unacknowledged alerts
   * @returns Count of critical unacknowledged alerts
   */
  async getCriticalCount(): Promise<number> {
    const recentAlerts = await this.fetchRecentAlerts();
    return recentAlerts?.criticalCount || 0;
  }
}

export const alertsRepository = new AlertsRepository();
