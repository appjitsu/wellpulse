/**
 * Error state for tenants page
 */

import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface TenantsErrorProps {
  error: Error;
  onRetry: () => void;
}

export function TenantsError({ error, onRetry }: TenantsErrorProps) {
  return (
    <div className="p-8">
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error loading tenants</AlertTitle>
        <AlertDescription className="mt-2">
          {error.message || 'Failed to load tenants. Please try again.'}
        </AlertDescription>
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-4">
          Retry
        </Button>
      </Alert>
    </div>
  );
}
