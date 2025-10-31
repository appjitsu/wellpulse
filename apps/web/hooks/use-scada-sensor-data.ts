/**
 * SCADA Sensor Data React Query Hook
 *
 * Provides real-time sensor data from all active SCADA connections.
 * Features:
 * - Auto-refresh every 30 seconds
 * - Aggregates data from all connections
 * - Provides status indicators and trend analysis
 *
 * Pattern References:
 * - React Query Pattern (caching, polling)
 * - Observer Pattern (real-time updates)
 */

import { useQuery } from '@tanstack/react-query';
import { scadaSensorDataRepository } from '@/lib/repositories/scada-sensor-data.repository';

/**
 * Query keys for SCADA sensor data
 */
export const scadaSensorDataKeys = {
  all: ['scada-sensor-data'] as const,
  current: () => [...scadaSensorDataKeys.all, 'current'] as const,
};

/**
 * Fetch current sensor readings from all active SCADA connections
 */
export function useScadaSensorData() {
  return useQuery({
    queryKey: scadaSensorDataKeys.current(),
    queryFn: () => scadaSensorDataRepository.getCurrentReadings(),
    staleTime: 0, // Always consider stale (enable polling)
    refetchInterval: 30000, // Auto-refresh every 30 seconds
    refetchIntervalInBackground: true, // Continue polling in background
  });
}
