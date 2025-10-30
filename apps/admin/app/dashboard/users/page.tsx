/**
 * User Management Page
 *
 * Manage all users across all tenants (create, view, edit, reset password).
 */

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Plus, Mail, Edit, Trash2, MoreHorizontal, Filter } from 'lucide-react';
import { useState, useEffect } from 'react';
import { DataTable } from '@/components/ui/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { DataTableColumnHeader } from '@/components/ui/data-table';
import { UserDialog } from '@/components/users/user-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import * as adminApi from '@/lib/api/admin';

export default function UsersPage() {
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<adminApi.User | null>(null);
  const [users, setUsers] = useState<adminApi.User[]>([]);
  const [tenants, setTenants] = useState<adminApi.Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('all');
  const [total, setTotal] = useState(0);

  // Fetch tenants for the filter dropdown
  useEffect(() => {
    const fetchTenants = async () => {
      try {
        const response = await adminApi.getAllTenants({ limit: 1000 });
        setTenants(response.tenants);
      } catch (error) {
        console.error('Failed to fetch tenants:', error);
      }
    };
    fetchTenants();
  }, []);

  // Fetch users when tenant filter changes
  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const response = await adminApi.getAllUsers({
          limit: 100,
          tenantId: selectedTenantId === 'all' ? undefined : selectedTenantId,
        });
        setUsers(response.users);
        setTotal(response.total);
      } catch (error) {
        console.error('Failed to fetch users:', error);
        setUsers([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, [selectedTenantId]);

  const columns: ColumnDef<adminApi.User>[] = [
    {
      accessorKey: 'email',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Email" />,
      cell: ({ row }) => <div className="font-medium">{row.getValue('email')}</div>,
    },
    {
      accessorKey: 'firstName',
      header: ({ column }) => <DataTableColumnHeader column={column} title="First Name" />,
    },
    {
      accessorKey: 'lastName',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Last Name" />,
    },
    {
      accessorKey: 'tenantName',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Tenant" />,
      cell: ({ row }) => <Badge variant="outline">{row.getValue('tenantName')}</Badge>,
    },
    {
      accessorKey: 'role',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Role" />,
      cell: ({ row }) => {
        const role = row.getValue('role') as string;
        return <Badge variant={role === 'SUPER_ADMIN' ? 'default' : 'secondary'}>{role}</Badge>;
      },
    },
    {
      accessorKey: 'status',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => {
        const status = row.getValue('status') as string;
        return <Badge variant={status === 'ACTIVE' ? 'default' : 'destructive'}>{status}</Badge>;
      },
    },
    {
      accessorKey: 'lastLoginAt',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Last Login" />,
      cell: ({ row }) => {
        const lastLogin = row.getValue('lastLoginAt') as Date | null;
        return (
          <div className="text-sm text-muted-foreground">
            {lastLogin ? new Date(lastLogin).toLocaleString() : 'Never'}
          </div>
        );
      },
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const user = row.original;

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => handleEditUser(user)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSendPasswordReset(user.id)}>
                <Mail className="mr-2 h-4 w-4" />
                Reset Password
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleDeleteUser(user.id)} className="text-red-600">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  const handleCreateUser = () => {
    setSelectedUser(null);
    setUserDialogOpen(true);
  };

  const handleEditUser = (user: adminApi.User) => {
    setSelectedUser(user);
    setUserDialogOpen(true);
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    console.log('Delete user:', userId);
    // TODO: Implement API call
  };

  const handleSendPasswordReset = async (userId: string) => {
    console.log('Send password reset:', userId);
    // TODO: Implement API call
    // Note: Using console.log for now until backend endpoint is implemented
  };

  const handleUserSubmit = async (values: unknown) => {
    console.log('User submit:', values);
    // TODO: Implement API call
  };

  return (
    <div className="space-y-6 p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground">
            {selectedTenantId === 'all'
              ? 'Manage all users across all tenants'
              : `Manage users for ${tenants.find((t) => t.id === selectedTenantId)?.name || 'selected tenant'}`}
          </p>
        </div>
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Select tenant" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tenants</SelectItem>
                {tenants.map((tenant) => (
                  <SelectItem key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleCreateUser}>
            <Plus className="mr-2 h-4 w-4" />
            Create User
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '...' : total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Now</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {loading
                ? '...'
                : users.filter((u) => {
                    if (!u.lastLoginAt) return false;
                    const minutesAgo = (Date.now() - new Date(u.lastLoginAt).getTime()) / 1000 / 60;
                    return minutesAgo < 30;
                  }).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Admins</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {loading ? '...' : users.filter((u) => u.role.includes('ADMIN')).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">User Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">87%</div>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>View and manage all users across all tenants</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-muted-foreground">Loading users...</div>
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={users}
              searchKey="email"
              searchPlaceholder="Search by email..."
            />
          )}
        </CardContent>
      </Card>

      {/* User Dialog */}
      <UserDialog
        open={userDialogOpen}
        onOpenChange={setUserDialogOpen}
        user={
          selectedUser
            ? {
                id: selectedUser.id,
                email: selectedUser.email,
                firstName: selectedUser.firstName,
                lastName: selectedUser.lastName,
                tenantId: selectedUser.tenantId,
                role: selectedUser.role,
              }
            : null
        }
        tenants={tenants.map((t) => ({ id: t.id, name: t.name }))}
        onSubmit={handleUserSubmit}
      />
    </div>
  );
}
