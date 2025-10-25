/**
 * Tenant Management Page
 *
 * Manage all tenant organizations (create, view, edit, suspend).
 */

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building2, Plus } from 'lucide-react';
import { useState } from 'react';
import { DataTable } from '@/components/ui/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { DataTableColumnHeader } from '@/components/ui/data-table';
import { TenantDialog } from '@/components/tenants/tenant-dialog';

// Mock tenant data
interface Tenant {
  id: string;
  name: string;
  subdomain: string;
  contactEmail: string;
  status: string;
  subscriptionTier: string;
  userCount: number;
  createdAt: string;
}

const mockTenants: Tenant[] = [
  {
    id: '1',
    name: 'ACME Oil & Gas',
    subdomain: 'acmeoil',
    contactEmail: 'admin@acme.com',
    status: 'ACTIVE',
    subscriptionTier: 'PROFESSIONAL',
    userCount: 25,
    createdAt: '2024-10-15',
  },
  {
    id: '2',
    name: 'Demo Corporation',
    subdomain: 'demooil',
    contactEmail: 'admin@demo.com',
    status: 'ACTIVE',
    subscriptionTier: 'ENTERPRISE',
    userCount: 50,
    createdAt: '2024-10-10',
  },
  {
    id: '3',
    name: 'WellPulse Internal',
    subdomain: 'internal',
    contactEmail: 'internal@wellpulse.app',
    status: 'TRIAL',
    subscriptionTier: 'STARTER',
    userCount: 5,
    createdAt: '2024-10-20',
  },
];

export default function TenantsPage() {
  const [tenantDialogOpen, setTenantDialogOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);

  const columns: ColumnDef<Tenant>[] = [
    {
      accessorKey: 'name',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Company Name" />,
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.getValue('name')}</div>
          <div className="text-sm text-muted-foreground">{row.original.subdomain}.wellpulse.io</div>
        </div>
      ),
    },
    {
      accessorKey: 'contactEmail',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Contact Email" />,
    },
    {
      accessorKey: 'status',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => {
        const status = row.getValue('status') as string;
        return (
          <Badge
            variant={
              status === 'ACTIVE' ? 'default' : status === 'TRIAL' ? 'secondary' : 'destructive'
            }
          >
            {status}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'subscriptionTier',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Tier" />,
      cell: ({ row }) => {
        const tier = row.getValue('subscriptionTier') as string;
        return <Badge variant="outline">{tier}</Badge>;
      },
    },
    {
      accessorKey: 'userCount',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Users" />,
      cell: ({ row }) => {
        return <div className="text-right">{row.getValue('userCount')}</div>;
      },
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Created" />,
      cell: ({ row }) => {
        return <div className="text-sm">{row.getValue('createdAt')}</div>;
      },
    },
  ];

  const handleTenantSubmit = async (values: unknown) => {
    console.log('Tenant submit:', values);
    // TODO: Implement API call
  };

  return (
    <div className="space-y-6 p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tenant Management</h1>
          <p className="text-muted-foreground">Manage all tenant organizations</p>
        </div>
        <Button onClick={() => setTenantDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Tenant
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tenants</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockTenants.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {mockTenants.filter((t) => t.status === 'ACTIVE').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Trial</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {mockTenants.filter((t) => t.status === 'TRIAL').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {mockTenants.reduce((sum, t) => sum + t.userCount, 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tenants Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Tenants</CardTitle>
          <CardDescription>View and manage all tenant organizations</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={mockTenants}
            searchKey="name"
            searchPlaceholder="Search tenants..."
          />
        </CardContent>
      </Card>

      {/* Tenant Dialog */}
      <TenantDialog
        open={tenantDialogOpen}
        onOpenChange={setTenantDialogOpen}
        tenant={selectedTenant}
        onSubmit={handleTenantSubmit}
      />
    </div>
  );
}
