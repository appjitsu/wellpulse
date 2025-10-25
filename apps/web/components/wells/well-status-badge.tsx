/**
 * Well Status Badge Component
 *
 * Color-coded status badges for wells:
 * - ACTIVE: Green
 * - INACTIVE: Yellow
 * - PLUGGED_AND_ABANDONED: Red
 */

'use client';

import { Badge } from '@/components/ui/badge';
import type { WellStatus } from '@/lib/api/wells.api';

interface WellStatusBadgeProps {
  status: WellStatus;
}

const statusConfig: Record<
  WellStatus,
  {
    label: string;
    variant: 'success' | 'warning' | 'danger';
  }
> = {
  ACTIVE: {
    label: 'Active',
    variant: 'success',
  },
  INACTIVE: {
    label: 'Inactive',
    variant: 'warning',
  },
  PLUGGED_AND_ABANDONED: {
    label: 'Plugged',
    variant: 'danger',
  },
};

export function WellStatusBadge({ status }: WellStatusBadgeProps) {
  const config = statusConfig[status];

  return <Badge variant={config.variant}>{config.label}</Badge>;
}
