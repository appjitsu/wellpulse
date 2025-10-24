/**
 * Wells Table Component
 *
 * Displays wells in a table format with:
 * - Name, API Number, Status (badge), Lease, Location, Actions
 * - Edit and Delete actions (RBAC-aware)
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Pencil, Trash2, Eye } from 'lucide-react';
import { Well } from '@/lib/api/wells.api';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { WellStatusBadge } from './well-status-badge';
import { DeleteWellDialog } from './delete-well-dialog';

interface WellsTableProps {
  wells: Well[];
}

export function WellsTable({ wells }: WellsTableProps) {
  const { user } = useAuth();
  const [deleteWellId, setDeleteWellId] = useState<string | null>(null);

  // Check if user can edit/delete (Admins and Managers only)
  const canModify = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  if (wells.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Wells</CardTitle>
          <CardDescription>No wells found. Create your first well to get started.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Wells</CardTitle>
          <CardDescription>Manage your wells and their operational status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-gray-100">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-gray-100">
                    API Number
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-gray-100">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-gray-100">
                    Lease
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-gray-100">
                    Location
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-900 dark:text-gray-100">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {wells.map((well) => (
                  <tr
                    key={well.id}
                    className="border-b last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                      {well.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {well.apiNumber}
                    </td>
                    <td className="px-4 py-3">
                      <WellStatusBadge status={well.status} />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {well.lease || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {well.latitude.toFixed(4)}, {well.longitude.toFixed(4)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon-sm" asChild>
                          <Link href={`/wells/${well.id}`}>
                            <Eye className="h-4 w-4" />
                            <span className="sr-only">View</span>
                          </Link>
                        </Button>
                        {canModify && (
                          <>
                            <Button variant="ghost" size="icon-sm" asChild>
                              <Link href={`/wells/${well.id}/edit`}>
                                <Pencil className="h-4 w-4" />
                                <span className="sr-only">Edit</span>
                              </Link>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => setDeleteWellId(well.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">Delete</span>
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {deleteWellId && (
        <DeleteWellDialog
          wellId={deleteWellId}
          open={!!deleteWellId}
          onOpenChange={(open) => !open && setDeleteWellId(null)}
        />
      )}
    </>
  );
}
