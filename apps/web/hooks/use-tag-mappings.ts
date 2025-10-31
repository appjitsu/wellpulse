/**
 * Tag Mappings React Query Hook
 *
 * Provides data fetching and mutation hooks for SCADA tag mapping management.
 * Features:
 * - List all tag mappings for a connection
 * - Create new tag mappings
 * - Update mapping settings
 * - Delete mappings
 * - Browse available tags from SCADA connection
 *
 * Pattern References:
 * - React Query Pattern (caching, optimistic updates)
 * - Repository Pattern (data access abstraction)
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { tagMappingsRepository } from '@/lib/repositories/tag-mappings.repository';

/**
 * Query keys for tag mappings
 */
export const tagMappingsKeys = {
  all: ['tag-mappings'] as const,
  lists: () => [...tagMappingsKeys.all, 'list'] as const,
  list: (connectionId?: string) => [...tagMappingsKeys.lists(), connectionId] as const,
  details: () => [...tagMappingsKeys.all, 'detail'] as const,
  detail: (id: string) => [...tagMappingsKeys.details(), id] as const,
};

export interface TagMapping {
  id: string;
  connectionId: string;
  tagNodeId: string;
  tagDisplayName: string;
  measurementType: string;
  conversionFactor: number;
  minValue: number | null;
  maxValue: number | null;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTagMappingDto {
  connectionId: string;
  tagId: string;
  measurementType: string;
  conversionFactor: number;
  minValue?: number;
  maxValue?: number;
  isEnabled: boolean;
}

export interface UpdateTagMappingDto {
  measurementType?: string;
  conversionFactor?: number;
  minValue?: number | null;
  maxValue?: number | null;
  isEnabled?: boolean;
}

/**
 * Fetch tag mappings for a SCADA connection
 */
export function useTagMappings(connectionId: string) {
  const queryClient = useQueryClient();

  // Fetch all mappings for this connection
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: tagMappingsKeys.list(connectionId),
    queryFn: () => tagMappingsRepository.findByConnection(connectionId),
    enabled: !!connectionId,
    staleTime: 60000, // 1 minute - mappings are relatively stable
  });

  // Create mapping mutation
  const createMapping = useMutation({
    mutationFn: (data: CreateTagMappingDto) => tagMappingsRepository.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tagMappingsKeys.list(connectionId) });
    },
  });

  // Update mapping mutation
  const updateMapping = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTagMappingDto }) =>
      tagMappingsRepository.update(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: tagMappingsKeys.list(connectionId) });

      const previousMappings = queryClient.getQueryData<TagMapping[]>(
        tagMappingsKeys.list(connectionId),
      );

      if (previousMappings) {
        queryClient.setQueryData<TagMapping[]>(
          tagMappingsKeys.list(connectionId),
          previousMappings.map((mapping) =>
            mapping.id === id ? { ...mapping, ...data } : mapping,
          ),
        );
      }

      return { previousMappings };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousMappings) {
        queryClient.setQueryData(tagMappingsKeys.list(connectionId), context.previousMappings);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: tagMappingsKeys.list(connectionId) });
    },
  });

  // Delete mapping mutation
  const deleteMapping = useMutation({
    mutationFn: (id: string) => tagMappingsRepository.delete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: tagMappingsKeys.list(connectionId) });

      const previousMappings = queryClient.getQueryData<TagMapping[]>(
        tagMappingsKeys.list(connectionId),
      );

      if (previousMappings) {
        queryClient.setQueryData<TagMapping[]>(
          tagMappingsKeys.list(connectionId),
          previousMappings.filter((mapping) => mapping.id !== id),
        );
      }

      return { previousMappings };
    },
    onError: (_err, _id, context) => {
      if (context?.previousMappings) {
        queryClient.setQueryData(tagMappingsKeys.list(connectionId), context.previousMappings);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: tagMappingsKeys.list(connectionId) });
    },
  });

  // Browse tags mutation (fetches available tags from SCADA connection)
  const browseTags = useMutation({
    mutationFn: () => tagMappingsRepository.browseTags(connectionId),
  });

  return {
    mappings: data || [],
    isLoading,
    error,
    refetch,
    createMapping,
    updateMapping,
    deleteMapping,
    browseTags,
  };
}

/**
 * Fetch single tag mapping by ID
 */
export function useTagMapping(id: string) {
  return useQuery({
    queryKey: tagMappingsKeys.detail(id),
    queryFn: () => tagMappingsRepository.findById(id),
    enabled: !!id,
    staleTime: 60000,
  });
}
