/**
 * useProduction Hooks
 *
 * React Query hooks for production analytics.
 * Provides queries for monthly trend and well type breakdown.
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import { productionApi } from '../lib/api/production.api';

/**
 * Query hook to fetch 6-month production trend
 */
export function useMonthlyTrend(params?: { months?: number }) {
  return useQuery({
    queryKey: ['production', 'monthly-trend', params],
    queryFn: () => productionApi.getMonthlyTrend(params),
    staleTime: 300000, // 5 minutes
  });
}

/**
 * Query hook to fetch well type breakdown
 */
export function useWellTypeBreakdown() {
  return useQuery({
    queryKey: ['production', 'well-type-breakdown'],
    queryFn: () => productionApi.getWellTypeBreakdown(),
    staleTime: 300000, // 5 minutes
  });
}
