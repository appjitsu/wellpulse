/**
 * Branding React Query Hook
 *
 * Provides data fetching and mutation hooks for white-label branding management.
 * Features:
 * - Fetch current branding settings
 * - Update branding configuration
 * - Upload company logo to Azure Blob Storage
 *
 * Pattern References:
 * - React Query Pattern (caching, optimistic updates)
 * - Strategy Pattern (Azure Blob Storage)
 * - Repository Pattern (data access abstraction)
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { brandingRepository } from '@/lib/repositories/branding.repository';

/**
 * Query keys for branding
 */
export const brandingKeys = {
  all: ['branding'] as const,
  current: () => [...brandingKeys.all, 'current'] as const,
};

export interface Branding {
  id: string;
  companyName: string;
  companyAddress?: string;
  companyPhone?: string;
  companyWebsite?: string;
  logoUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  backgroundColor: string;
  reportHeader?: string;
  reportFooter?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateBrandingDto {
  companyName: string;
  companyAddress?: string;
  companyPhone?: string;
  companyWebsite?: string;
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  backgroundColor: string;
  reportHeader?: string;
  reportFooter?: string;
}

/**
 * Fetch current branding settings
 */
export function useBranding() {
  const queryClient = useQueryClient();

  // Fetch branding
  const { data, isLoading, error } = useQuery({
    queryKey: brandingKeys.current(),
    queryFn: () => brandingRepository.getCurrent(),
    staleTime: 5 * 60 * 1000, // 5 minutes - branding doesn't change frequently
  });

  // Update branding mutation
  const updateBranding = useMutation({
    mutationFn: (data: UpdateBrandingDto) => brandingRepository.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: brandingKeys.current() });
    },
  });

  // Upload logo mutation
  const uploadLogo = useMutation({
    mutationFn: (file: File) => brandingRepository.uploadLogo(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: brandingKeys.current() });
    },
  });

  return {
    branding: data,
    isLoading,
    error,
    updateBranding,
    uploadLogo,
  };
}
