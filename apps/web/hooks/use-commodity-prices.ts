/**
 * Commodity Prices React Query Hook
 *
 * Provides real-time commodity pricing data from EIA API.
 * Features:
 * - WTI Crude Oil and Henry Hub Natural Gas prices
 * - 30-day historical data
 * - Daily sync at 6 AM CT
 *
 * Pattern References:
 * - React Query Pattern (caching, polling)
 * - Observer Pattern (price updates)
 */

import { useQuery } from '@tanstack/react-query';
import { commodityPricesRepository } from '@/lib/repositories/commodity-prices.repository';

/**
 * Query keys for commodity prices
 */
export const commodityPricesKeys = {
  all: ['commodity-prices'] as const,
  current: () => [...commodityPricesKeys.all, 'current'] as const,
};

/**
 * Fetch current commodity prices with historical data
 */
export function useCommodityPrices() {
  return useQuery({
    queryKey: commodityPricesKeys.current(),
    queryFn: () => commodityPricesRepository.getCurrentPrices(),
    staleTime: 60 * 60 * 1000, // 1 hour - prices update once daily
    refetchInterval: 60 * 60 * 1000, // Auto-refresh every hour
  });
}
