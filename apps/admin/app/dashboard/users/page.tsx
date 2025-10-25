/**
 * User Management Page
 *
 * Manage all users across all tenants (create, view, edit, reset password).
 */

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Plus, Mail, Edit, Trash2, MoreHorizontal } from 'lucide-react';
import { useState } from 'react';
import { DataTable } from '@/components/ui/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { DataTableColumnHeader } from '@/components/ui/data-table';
import { UserDialog } from '@/components/users/user-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Mock user data
interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  tenantId: string;
  tenantName: string;
  role: string;
  status: string;
  lastActive: string;
}

const mockUsers: User[] = [
  {
    id: '1',
    email: 'john@acme.com',
    firstName: 'John',
    lastName: 'Doe',
    tenantId: 'acme-id',
    tenantName: 'ACME Oil & Gas',
    role: 'ADMIN',
    status: 'ACTIVE',
    lastActive: '2 min ago',
  },
  {
    id: '2',
    email: 'jane@acme.com',
    firstName: 'Jane',
    lastName: 'Smith',
    tenantId: 'acme-id',
    tenantName: 'ACME Oil & Gas',
    role: 'MANAGER',
    status: 'ACTIVE',
    lastActive: '5 min ago',
  },
  {
    id: '3',
    email: 'bob@demo.com',
    firstName: 'Bob',
    lastName: 'Johnson',
    tenantId: 'demo-id',
    tenantName: 'Demo Corporation',
    role: 'USER',
    status: 'ACTIVE',
    lastActive: '1 hour ago',
  },
  {
    id: '4',
    email: 'alice@demo.com',
    firstName: 'Alice',
    lastName: 'Williams',
    tenantId: 'demo-id',
    tenantName: 'Demo Corporation',
    role: 'ADMIN',
    status: 'ACTIVE',
    lastActive: '3 hours ago',
  },
  {
    id: '5',
    email: 'charlie@internal.com',
    firstName: 'Charlie',
    lastName: 'Brown',
    tenantId: 'internal-id',
    tenantName: 'WellPulse Internal',
    role: 'SUPER_ADMIN',
    status: 'ACTIVE',
    lastActive: 'Just now',
  },
];

export default function UsersPage() {
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const tenants = [
    { id: 'acme-id', name: 'ACME Oil & Gas' },
    { id: 'demo-id', name: 'Demo Corporation' },
    { id: 'internal-id', name: 'WellPulse Internal' },
  ];

  const columns: ColumnDef<User>[] = [
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
      accessorKey: 'lastActive',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Last Active" />,
      cell: ({ row }) => (
        <div className="text-sm text-muted-foreground">{row.getValue('lastActive')}</div>
      ),
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

  const handleEditUser = (user: User) => {
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
    alert('Password reset email sent!');
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
          <p className="text-muted-foreground">Manage all users across all tenants</p>
        </div>
        <Button onClick={handleCreateUser}>
          <Plus className="mr-2 h-4 w-4" />
          Create User
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockUsers.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Now</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {
                mockUsers.filter(
                  (u) => u.lastActive.includes('min') || u.lastActive.includes('now'),
                ).length
              }
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Admins</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {mockUsers.filter((u) => u.role.includes('ADMIN')).length}
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
          <DataTable
            columns={columns}
            data={mockUsers}
            searchKey="email"
            searchPlaceholder="Search by email..."
          />
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
        tenants={tenants}
        onSubmit={handleUserSubmit}
      />
    </div>
  );
}
