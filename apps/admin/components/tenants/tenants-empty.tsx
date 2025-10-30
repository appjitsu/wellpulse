/**
 * Empty state for tenants page
 */

import { Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TenantsEmptyProps {
  onCreateClick: () => void;
}

export function TenantsEmpty({ onCreateClick }: TenantsEmptyProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="rounded-full bg-slate-100 p-6 mb-4">
        <Building2 className="h-12 w-12 text-slate-400" />
      </div>
      <h3 className="text-lg font-semibold mb-2">No tenants yet</h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-sm">
        Get started by creating your first tenant organization. Each tenant will get their own
        database and subdomain.
      </p>
      <Button onClick={onCreateClick}>Create Your First Tenant</Button>
    </div>
  );
}
