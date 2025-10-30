'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

interface TenantSuccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantData: {
    id: string;
    tenantId: string;
    subdomain: string;
    message: string;
  } | null;
}

export function TenantSuccessDialog({ open, onOpenChange, tenantData }: TenantSuccessDialogProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  if (!tenantData) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Check className="h-5 w-5 text-green-600" />
            Tenant Created Successfully
          </DialogTitle>
          <DialogDescription>
            The tenant has been created and the database has been provisioned.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Tenant ID</label>
              <div className="flex items-center justify-between mt-1">
                <code className="text-sm font-mono bg-background px-2 py-1 rounded">
                  {tenantData.tenantId}
                </code>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleCopy(tenantData.tenantId, 'tenantId')}
                >
                  {copiedField === 'tenantId' ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Subdomain</label>
              <div className="flex items-center justify-between mt-1">
                <code className="text-sm font-mono bg-background px-2 py-1 rounded">
                  {tenantData.subdomain}.wellpulse.io
                </code>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleCopy(`${tenantData.subdomain}.wellpulse.io`, 'subdomain')}
                >
                  {copiedField === 'subdomain' ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Database ID</label>
              <div className="flex items-center justify-between mt-1">
                <code className="text-sm font-mono bg-background px-2 py-1 rounded text-xs">
                  {tenantData.id}
                </code>
                <Button size="sm" variant="ghost" onClick={() => handleCopy(tenantData.id, 'id')}>
                  {copiedField === 'id' ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
            <p className="text-sm text-yellow-900">
              <strong>Important:</strong> The tenant secret has been generated and sent to Slack (or
              logged to console if Slack is disabled). This is the only time it will be shown in
              plaintext.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
