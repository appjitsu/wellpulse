/**
 * Wells List Page
 *
 * Main wells management page with:
 * - Wells table with search and filters
 * - Create well button (RBAC-aware)
 * - Loading and error states
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { useWells } from '@/hooks/use-wells';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { WellsTable } from '@/components/wells/wells-table';
import type { WellStatus } from '@/lib/api/wells.api';

export default function WellsPage() {
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState<WellStatus | undefined>(undefined);
  const [leaseFilter, setLeaseFilter] = useState('');
  const [fieldFilter, setFieldFilter] = useState('');

  // Build query params
  const params = {
    ...(statusFilter && { status: statusFilter }),
    ...(leaseFilter && { lease: leaseFilter }),
    ...(fieldFilter && { field: fieldFilter }),
  };

  const { data, isLoading, error } = useWells(Object.keys(params).length > 0 ? params : undefined);

  // Check if user can create wells (Admins and Managers only)
  const canCreate = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>Error</CardTitle>
            <CardDescription>Failed to load wells. Please try again.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Wells</h1>
          <p className="text-muted-foreground">Manage your wells and operational data</p>
        </div>
        {canCreate && (
          <Button asChild>
            <Link href="/wells/new">
              <Plus className="mr-2 h-4 w-4" />
              Create Well
            </Link>
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter wells by status, lease, or field</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Status Filter */}
            <div>
              <label className="text-sm font-medium mb-2 block">Status</label>
              <select
                value={statusFilter || ''}
                onChange={(e) => setStatusFilter(e.target.value as WellStatus | undefined)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="PLUGGED_AND_ABANDONED">Plugged and Abandoned</option>
              </select>
            </div>

            {/* Lease Filter */}
            <div>
              <label className="text-sm font-medium mb-2 block">Lease</label>
              <Input
                placeholder="Filter by lease..."
                value={leaseFilter}
                onChange={(e) => setLeaseFilter(e.target.value)}
              />
            </div>

            {/* Field Filter */}
            <div>
              <label className="text-sm font-medium mb-2 block">Field</label>
              <Input
                placeholder="Filter by field..."
                value={fieldFilter}
                onChange={(e) => setFieldFilter(e.target.value)}
              />
            </div>
          </div>

          {/* Clear Filters */}
          {(statusFilter || leaseFilter || fieldFilter) && (
            <div className="mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setStatusFilter(undefined);
                  setLeaseFilter('');
                  setFieldFilter('');
                }}
              >
                Clear Filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Wells Table */}
      {isLoading ? (
        <Card>
          <CardHeader>
            <CardTitle>Loading...</CardTitle>
            <CardDescription>Fetching wells data</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <WellsTable wells={data?.wells || []} />
      )}
    </div>
  );
}
