'use client';

import { useUsers } from '@/hooks/use-users';
import { UsersTable } from '@/components/users/users-table';

export default function TeamPage() {
  const { data, isLoading, error } = useUsers();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg text-gray-600 dark:text-gray-400">Loading team members...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg text-red-600 dark:text-red-400">
          Error loading team members: {error instanceof Error ? error.message : 'Unknown error'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Team Management</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Manage team members, roles, and permissions
          </p>
        </div>
      </div>

      <UsersTable users={data?.users || []} />

      {data && data.total > 0 && (
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Showing {data.users.length} of {data.total} team members
        </div>
      )}
    </div>
  );
}
