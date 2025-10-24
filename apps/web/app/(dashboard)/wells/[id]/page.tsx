/**
 * Well Details Page
 *
 * Displays detailed information about a well:
 * - Well name, API number, status
 * - Location (latitude/longitude)
 * - Lease, field, operator
 * - Edit button (RBAC-aware)
 */

'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Pencil } from 'lucide-react';
import { useWell } from '@/hooks/use-wells';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { WellStatusBadge } from '@/components/wells/well-status-badge';

export default function WellDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const wellId = params.id as string;

  const { data: well, isLoading, error } = useWell(wellId);

  // Check if user can edit (Admins and Managers only)
  const canEdit = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>Loading...</CardTitle>
            <CardDescription>Fetching well details</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (error || !well) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>Error</CardTitle>
            <CardDescription>Well not found</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/wells')}>Back to Wells</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6 flex items-center justify-between">
        <Button variant="ghost" asChild>
          <Link href="/wells">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Wells
          </Link>
        </Button>
        {canEdit && (
          <Button asChild>
            <Link href={`/wells/${wellId}/edit`}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit Well
            </Link>
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-3xl">{well.name}</CardTitle>
              <CardDescription>API: {well.apiNumber}</CardDescription>
            </div>
            <WellStatusBadge status={well.status} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Location */}
            <div>
              <h3 className="font-semibold text-sm text-gray-500 dark:text-gray-400 mb-2">
                Location
              </h3>
              <p className="text-lg">
                {well.latitude.toFixed(6)}, {well.longitude.toFixed(6)}
              </p>
            </div>

            {/* Status */}
            <div>
              <h3 className="font-semibold text-sm text-gray-500 dark:text-gray-400 mb-2">
                Status
              </h3>
              <div className="text-lg">
                <WellStatusBadge status={well.status} />
              </div>
            </div>

            {/* Lease */}
            {well.lease && (
              <div>
                <h3 className="font-semibold text-sm text-gray-500 dark:text-gray-400 mb-2">
                  Lease
                </h3>
                <p className="text-lg">{well.lease}</p>
              </div>
            )}

            {/* Field */}
            {well.field && (
              <div>
                <h3 className="font-semibold text-sm text-gray-500 dark:text-gray-400 mb-2">
                  Field
                </h3>
                <p className="text-lg">{well.field}</p>
              </div>
            )}

            {/* Operator */}
            {well.operator && (
              <div>
                <h3 className="font-semibold text-sm text-gray-500 dark:text-gray-400 mb-2">
                  Operator
                </h3>
                <p className="text-lg">{well.operator}</p>
              </div>
            )}

            {/* Created At */}
            <div>
              <h3 className="font-semibold text-sm text-gray-500 dark:text-gray-400 mb-2">
                Created
              </h3>
              <p className="text-lg">{new Date(well.createdAt).toLocaleDateString()}</p>
            </div>

            {/* Updated At */}
            <div>
              <h3 className="font-semibold text-sm text-gray-500 dark:text-gray-400 mb-2">
                Last Updated
              </h3>
              <p className="text-lg">{new Date(well.updatedAt).toLocaleDateString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
