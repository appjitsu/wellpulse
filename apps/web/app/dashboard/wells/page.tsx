/**
 * Wells Page
 *
 * Well management and monitoring interface
 */

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Droplet, MapPin, AlertTriangle, Search, Filter, Plus, Loader2 } from 'lucide-react';
import { useWells } from '@/hooks/use-wells';

// Status mapping from API to UI display
const statusColors: Record<string, string> = {
  ACTIVE: 'bg-green-500',
  INACTIVE: 'bg-red-500',
  PLUGGED: 'bg-gray-400',
};

const statusLabels: Record<string, string> = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  PLUGGED: 'Plugged',
};

export default function WellsPage() {
  // Fetch wells data from API
  const { data, isLoading, error } = useWells();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Wells</h1>
          <p className="text-gray-500">
            Manage and monitor all your well sites
            {data && <span className="ml-2">({data.total} total)</span>}
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Well
        </Button>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input placeholder="Search wells by name or API number..." className="pl-10" />
            </div>
            <Button variant="outline">
              <Filter className="mr-2 h-4 w-4" />
              Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center gap-2 text-gray-500">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>Loading wells...</span>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              <div>
                <p className="font-semibold">Failed to load wells</p>
                <p className="text-sm text-red-500">
                  {error instanceof Error ? error.message : 'An unexpected error occurred'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!isLoading && !error && data?.wells.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <Droplet className="h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No wells yet</h3>
              <p className="text-gray-500 mb-6 max-w-md">
                Get started by adding your first well to begin monitoring production data and
                tracking performance.
              </p>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Your First Well
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Wells Grid */}
      {!isLoading && !error && data && data.wells.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {data.wells.map((well) => (
            <Card key={well.id} className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Droplet className="h-5 w-5 text-blue-600" />
                    <div>
                      <CardTitle className="text-lg">{well.apiNumber}</CardTitle>
                      <CardDescription>{well.name}</CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Status */}
                <div className="flex items-center gap-2">
                  <div className={`h-3 w-3 rounded-full ${statusColors[well.status]}`} />
                  <span className="text-sm font-medium">{statusLabels[well.status]}</span>
                </div>

                {/* Location */}
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <MapPin className="h-4 w-4" />
                  {well.latitude.toFixed(4)}, {well.longitude.toFixed(4)}
                </div>

                {/* Additional Info */}
                {(well.field || well.lease || well.operator) && (
                  <div className="space-y-1 text-sm">
                    {well.field && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Field:</span>
                        <span className="font-medium">{well.field}</span>
                      </div>
                    )}
                    {well.lease && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Lease:</span>
                        <span className="font-medium">{well.lease}</span>
                      </div>
                    )}
                    {well.operator && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Operator:</span>
                        <span className="font-medium">{well.operator}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Dates */}
                <div className="pt-2 border-t border-gray-100">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Created</span>
                    <span className="font-medium">
                      {new Date(well.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
