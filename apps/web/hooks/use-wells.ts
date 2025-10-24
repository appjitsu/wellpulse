/**
 * useWells Hook
 *
 * React Query hooks for wells management.
 * Provides queries and mutations with automatic cache invalidation.
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  wellsApi,
  type GetWellsParams,
  type CreateWellInput,
  type UpdateWellInput,
} from '../lib/api/wells.api';

/**
 * Query hook to fetch all wells with optional filters
 */
export function useWells(params?: GetWellsParams) {
  return useQuery({
    queryKey: ['wells', params],
    queryFn: () => wellsApi.getWells(params),
  });
}

/**
 * Query hook to fetch a single well by ID
 */
export function useWell(id: string) {
  return useQuery({
    queryKey: ['wells', id],
    queryFn: () => wellsApi.getWellById(id),
    enabled: !!id, // Only fetch if ID is provided
  });
}

/**
 * Mutation hook to create a new well
 */
export function useCreateWell() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateWellInput) => wellsApi.createWell(data),
    onSuccess: () => {
      // Invalidate wells list to refetch
      queryClient.invalidateQueries({ queryKey: ['wells'] });
    },
  });
}

/**
 * Mutation hook to update an existing well
 */
export function useUpdateWell() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateWellInput }) =>
      wellsApi.updateWell(id, data),
    onSuccess: (updatedWell) => {
      // Invalidate both the specific well and the list
      queryClient.invalidateQueries({ queryKey: ['wells', updatedWell.id] });
      queryClient.invalidateQueries({ queryKey: ['wells'] });
    },
  });
}

/**
 * Mutation hook to delete a well
 */
export function useDeleteWell() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => wellsApi.deleteWell(id),
    onSuccess: () => {
      // Invalidate wells list to refetch
      queryClient.invalidateQueries({ queryKey: ['wells'] });
    },
  });
}
