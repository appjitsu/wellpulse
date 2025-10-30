/**
 * useDashboard Hooks
 *
 * React Query hooks for dashboard analytics.
 * Provides queries for metrics, well status, activity, and top producers.
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../lib/api/dashboard.api';

/**
 * Query hook to fetch dashboard metrics
 */
export function useDashboardMetrics() {
  return useQuery({
    queryKey: ['dashboard', 'metrics'],
    queryFn: () => dashboardApi.getMetrics(),
    staleTime: 60000, // 1 minute
    retry: false, // Don't retry on auth failures (avoids infinite loops)
  });
}

/**
 * Query hook to fetch well status distribution
 */
export function useWellStatus() {
  return useQuery({
    queryKey: ['dashboard', 'well-status'],
    queryFn: () => dashboardApi.getWellStatus(),
    staleTime: 60000, // 1 minute
    retry: false, // Don't retry on auth failures (avoids infinite loops)
  });
}

/**
 * Query hook to fetch recent activity
 */
export function useRecentActivity() {
  return useQuery({
    queryKey: ['dashboard', 'recent-activity'],
    queryFn: () => dashboardApi.getRecentActivity(),
    staleTime: 30000, // 30 seconds
    retry: false, // Don't retry on auth failures (avoids infinite loops)
  });
}

/**
 * Query hook to fetch top producing wells
 */
export function useTopProducers() {
  return useQuery({
    queryKey: ['dashboard', 'top-producers'],
    queryFn: () => dashboardApi.getTopProducers(),
    staleTime: 60000, // 1 minute
    retry: false, // Don't retry on auth failures (avoids infinite loops)
  });
}
