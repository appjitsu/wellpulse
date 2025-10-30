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
import { TenantSuccessDialog } from '@/components/tenants/tenant-success-dialog';
import { useToast } from '@/hooks/use-toast';
import { useTenants, useCreateTenant } from '@/hooks/useTenants';
import { TenantsLoading } from '@/components/tenants/tenants-loading';
import { TenantsError } from '@/components/tenants/tenants-error';
import { TenantsEmpty } from '@/components/tenants/tenants-empty';
import type { Tenant } from '@/lib/api/admin';

export default function TenantsPage() {
  const [tenantDialogOpen, setTenantDialogOpen] = useState(false);
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [selectedTenant, _setSelectedTenant] = useState<Tenant | null>(null);
  const [createdTenant, setCreatedTenant] = useState<{
    id: string;
    tenantId: string;
    subdomain: string;
    message: string;
  } | null>(null);
  const { toast } = useToast();

  // Fetch tenants with React Query
  const { data, isLoading, error, refetch } = useTenants();
  const createTenantMutation = useCreateTenant();

  const tenants = data?.tenants || [];

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
        const date = new Date(row.getValue('createdAt'));
        return <div className="text-sm">{date.toLocaleDateString()}</div>;
      },
    },
  ];

  const handleTenantSubmit = async (values: {
    name: string;
    slug: string;
    subdomain: string;
    contactEmail: string;
    subscriptionTier: string;
    trialDays?: number;
  }) => {
    try {
      const result = await createTenantMutation.mutateAsync(values);
      setCreatedTenant(
        result as { id: string; tenantId: string; subdomain: string; message: string },
      );
      setSuccessDialogOpen(true);
      setTenantDialogOpen(false);

      toast({
        title: 'Tenant created successfully',
        description: `Tenant ID: ${(result as { tenantId?: string }).tenantId}`,
      });
    } catch (error) {
      toast({
        title: 'Failed to create tenant',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
      throw error;
    }
  };

  // Show loading state
  if (isLoading) {
    return <TenantsLoading />;
  }

  // Show error state
  if (error) {
    return <TenantsError error={error} onRetry={() => refetch()} />;
  }

  // Show empty state
  if (tenants.length === 0) {
    return (
      <div className="space-y-6 p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Tenant Management</h1>
            <p className="text-muted-foreground">Manage all tenant organizations</p>
          </div>
        </div>
        <Card>
          <CardContent className="pt-6">
            <TenantsEmpty onCreateClick={() => setTenantDialogOpen(true)} />
          </CardContent>
        </Card>
        <TenantDialog
          open={tenantDialogOpen}
          onOpenChange={setTenantDialogOpen}
          tenant={selectedTenant}
          onSubmit={handleTenantSubmit}
        />
        <TenantSuccessDialog
          open={successDialogOpen}
          onOpenChange={setSuccessDialogOpen}
          tenantData={createdTenant}
        />
      </div>
    );
  }

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
            <div className="text-2xl font-bold">{tenants.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {tenants.filter((t) => t.status === 'ACTIVE').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Trial</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {tenants.filter((t) => t.status === 'TRIAL').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {tenants.reduce((sum, t) => sum + t.userCount, 0)}
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
            data={tenants}
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

      {/* Success Dialog */}
      <TenantSuccessDialog
        open={successDialogOpen}
        onOpenChange={setSuccessDialogOpen}
        tenantData={createdTenant}
      />
    </div>
  );
}
