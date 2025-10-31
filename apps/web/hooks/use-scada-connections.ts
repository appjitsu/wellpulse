/**
 * SCADA Connections React Query Hook
 *
 * Provides data fetching and mutation hooks for SCADA connection management.
 * Features:
 * - List all connections with real-time status
 * - Create new connections
 * - Test connection before saving
 * - Update connection settings
 * - Delete connections
 * - Refresh connection status
 *
 * Pattern References:
 * - React Query Pattern (caching, optimistic updates)
 * - Repository Pattern (data access abstraction)
 *
 * @see docs/patterns/XX-React-Query-Pattern.md
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { scadaConnectionsRepository } from '@/lib/repositories/scada-connections.repository';
import type { ScadaConnectionItem } from '@/components/scada/scada-connections-list';

/**
 * Query keys for SCADA connections
 */
export const scadaConnectionsKeys = {
  all: ['scada-connections'] as const,
  lists: () => [...scadaConnectionsKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) => [...scadaConnectionsKeys.lists(), filters] as const,
  details: () => [...scadaConnectionsKeys.all, 'detail'] as const,
  detail: (id: string) => [...scadaConnectionsKeys.details(), id] as const,
};

/**
 * Fetch all SCADA connections for the current tenant
 */
export function useScadaConnections() {
  const queryClient = useQueryClient();

  // Fetch all connections
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: scadaConnectionsKeys.lists(),
    queryFn: () => scadaConnectionsRepository.findAll(),
    staleTime: 30000, // 30 seconds - connections update frequently
    refetchInterval: 60000, // Auto-refresh every minute for status updates
  });

  // Create connection mutation
  const createConnection = useMutation({
    mutationFn: (data: CreateScadaConnectionDto) => scadaConnectionsRepository.create(data),
    onSuccess: () => {
      // Invalidate and refetch connections list
      queryClient.invalidateQueries({ queryKey: scadaConnectionsKeys.lists() });
    },
  });

  // Test connection mutation (doesn't save)
  const testConnection = useMutation({
    mutationFn: (data: TestConnectionDto) => scadaConnectionsRepository.testConnection(data),
  });

  // Update connection mutation
  const updateConnection = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateScadaConnectionDto }) =>
      scadaConnectionsRepository.update(id, data),
    onMutate: async ({ id, data }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: scadaConnectionsKeys.lists() });

      // Snapshot previous value
      const previousConnections = queryClient.getQueryData<ScadaConnectionItem[]>(
        scadaConnectionsKeys.lists(),
      );

      // Optimistically update
      if (previousConnections) {
        queryClient.setQueryData<ScadaConnectionItem[]>(
          scadaConnectionsKeys.lists(),
          previousConnections.map((conn) => (conn.id === id ? { ...conn, ...data } : conn)),
        );
      }

      return { previousConnections };
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previousConnections) {
        queryClient.setQueryData(scadaConnectionsKeys.lists(), context.previousConnections);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: scadaConnectionsKeys.lists() });
    },
  });

  // Delete connection mutation
  const deleteConnection = useMutation({
    mutationFn: (id: string) => scadaConnectionsRepository.delete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: scadaConnectionsKeys.lists() });

      const previousConnections = queryClient.getQueryData<ScadaConnectionItem[]>(
        scadaConnectionsKeys.lists(),
      );

      // Optimistically remove from list
      if (previousConnections) {
        queryClient.setQueryData<ScadaConnectionItem[]>(
          scadaConnectionsKeys.lists(),
          previousConnections.filter((conn) => conn.id !== id),
        );
      }

      return { previousConnections };
    },
    onError: (_err, _id, context) => {
      if (context?.previousConnections) {
        queryClient.setQueryData(scadaConnectionsKeys.lists(), context.previousConnections);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: scadaConnectionsKeys.lists() });
    },
  });

  // Disconnect connection mutation (soft disconnect, keeps config)
  const disconnectConnection = useMutation({
    mutationFn: (id: string) => scadaConnectionsRepository.disconnect(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scadaConnectionsKeys.lists() });
    },
  });

  return {
    connections: data || [],
    isLoading,
    error,
    refetch,
    createConnection,
    testConnection,
    updateConnection,
    deleteConnection,
    disconnectConnection,
  };
}

/**
 * Fetch single SCADA connection by ID
 */
export function useScadaConnection(id: string) {
  return useQuery({
    queryKey: scadaConnectionsKeys.detail(id),
    queryFn: () => scadaConnectionsRepository.findById(id),
    enabled: !!id,
    staleTime: 30000,
  });
}

/**
 * DTOs (Data Transfer Objects)
 */
export interface CreateScadaConnectionDto {
  wellId: string;
  name: string;
  description?: string;
  protocol: 'OPC_UA' | 'MODBUS_TCP' | 'MQTT';
  endpointUrl: string;
  username?: string;
  password?: string;
  pollIntervalSeconds: number;
}

export interface UpdateScadaConnectionDto {
  name?: string;
  description?: string;
  endpointUrl?: string;
  username?: string;
  password?: string;
  pollIntervalSeconds?: number;
  isEnabled?: boolean;
}

export interface TestConnectionDto {
  protocol: 'OPC_UA' | 'MODBUS_TCP' | 'MQTT';
  endpointUrl: string;
  username?: string;
  password?: string;
}
