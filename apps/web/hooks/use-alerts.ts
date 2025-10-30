/**
 * useAlerts Hooks
 *
 * React Query hooks for alerts.
 * Provides queries for alert stats, recent alerts, alert history, and mutations for acknowledging alerts.
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { alertsApi, AlertHistoryFilters } from '../lib/api/alerts.api';

/**
 * Query hook to fetch alert statistics
 */
export function useAlertStats() {
  return useQuery({
    queryKey: ['alerts', 'stats'],
    queryFn: () => alertsApi.getAlertStats(),
    staleTime: 30000, // 30 seconds - for real-time feel
    retry: false,
  });
}

/**
 * Query hook to fetch recent unacknowledged alerts
 */
export function useRecentAlerts(limit?: number) {
  return useQuery({
    queryKey: ['alerts', 'recent', limit],
    queryFn: () => alertsApi.getRecentAlerts(limit),
    staleTime: 30000, // 30 seconds - for real-time feel
    retry: false,
  });
}

/**
 * Query hook to fetch paginated alert history with filters
 */
export function useAlertHistory(filters?: AlertHistoryFilters) {
  return useQuery({
    queryKey: ['alerts', 'history', filters],
    queryFn: () => alertsApi.getAlertHistory(filters),
    staleTime: 30000, // 30 seconds
    retry: false,
  });
}

/**
 * Mutation hook to acknowledge a single alert
 */
export function useAcknowledgeAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (alertId: string) => alertsApi.acknowledgeAlert(alertId),
    onSuccess: () => {
      // Invalidate and refetch alert queries
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });
}

/**
 * Mutation hook to bulk acknowledge alerts
 */
export function useBulkAcknowledgeAlerts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (alertIds: string[]) => alertsApi.bulkAcknowledgeAlerts(alertIds),
    onSuccess: () => {
      // Invalidate and refetch alert queries
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });
}
