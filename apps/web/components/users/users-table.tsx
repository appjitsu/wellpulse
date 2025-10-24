'use client';

import { useState } from 'react';
import { User } from '@/lib/api/users.api';
import { useUpdateUserRole, useSuspendUser, useActivateUser } from '@/hooks/use-users';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface UsersTableProps {
  users: User[];
}

export function UsersTable({ users }: UsersTableProps) {
  const updateUserRole = useUpdateUserRole();
  const suspendUser = useSuspendUser();
  const activateUser = useActivateUser();
  const [loadingUserId, setLoadingUserId] = useState<string | null>(null);

  const handleRoleChange = async (userId: string, newRole: 'ADMIN' | 'MANAGER' | 'OPERATOR') => {
    setLoadingUserId(userId);
    try {
      await updateUserRole.mutateAsync({ userId, role: newRole });
    } finally {
      setLoadingUserId(null);
    }
  };

  const handleSuspend = async (userId: string) => {
    setLoadingUserId(userId);
    try {
      await suspendUser.mutateAsync(userId);
    } finally {
      setLoadingUserId(null);
    }
  };

  const handleActivate = async (userId: string) => {
    setLoadingUserId(userId);
    try {
      await activateUser.mutateAsync(userId);
    } finally {
      setLoadingUserId(null);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      case 'MANAGER':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'OPERATOR':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'SUSPENDED':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (users.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>No team members found. Invite users to get started.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Team Members</CardTitle>
        <CardDescription>Manage your team members and their roles</CardDescription>
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
                  Email
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-gray-100">
                  Role
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-gray-100">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-gray-100">
                  Last Login
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-900 dark:text-gray-100">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr
                  key={user.id}
                  className="border-b last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                    {user.name}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                    {user.email}
                    {!user.emailVerified && (
                      <span className="ml-2 text-xs text-yellow-600 dark:text-yellow-400">
                        (unverified)
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={user.role}
                      onChange={(e) =>
                        handleRoleChange(
                          user.id,
                          e.target.value as 'ADMIN' | 'MANAGER' | 'OPERATOR',
                        )
                      }
                      disabled={loadingUserId === user.id}
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${getRoleBadgeColor(user.role)} cursor-pointer border-0`}
                    >
                      <option value="ADMIN">Admin</option>
                      <option value="MANAGER">Manager</option>
                      <option value="OPERATOR">Operator</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${getStatusBadgeColor(user.status)}`}
                    >
                      {user.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                    {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {user.status === 'ACTIVE' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSuspend(user.id)}
                        disabled={loadingUserId === user.id}
                      >
                        Suspend
                      </Button>
                    ) : user.status === 'SUSPENDED' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleActivate(user.id)}
                        disabled={loadingUserId === user.id}
                      >
                        Activate
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
