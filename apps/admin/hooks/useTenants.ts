/**
 * React Query hooks for tenant management
 *
 * Provides hooks for fetching and mutating tenant data with
 * automatic caching, loading states, and optimistic updates.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAllTenants, createTenant, type CreateTenantDto } from '@/lib/api/admin';

/**
 * Hook to fetch all tenants with optional filters
 */
export function useTenants(params?: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}) {
  return useQuery({
    queryKey: ['tenants', params],
    queryFn: () => getAllTenants(params),
  });
}

/**
 * Hook to create a new tenant
 */
export function useCreateTenant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTenantDto) => createTenant(data),
    onSuccess: () => {
      // Invalidate tenants query to refetch the list
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
    },
  });
}
