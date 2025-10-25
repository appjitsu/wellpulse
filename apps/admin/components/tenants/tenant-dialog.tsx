'use client';

import * as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const tenantFormSchema = z.object({
  name: z.string().min(1, 'Company name is required'),
  subdomain: z
    .string()
    .min(3, 'Subdomain must be at least 3 characters')
    .regex(/^[a-z0-9-]+$/, 'Subdomain can only contain lowercase letters, numbers, and hyphens'),
  contactEmail: z.string().email('Invalid email address'),
  subscriptionTier: z.enum(['STARTER', 'PROFESSIONAL', 'ENTERPRISE'], {
    message: 'Subscription tier is required',
  }),
  status: z.enum(['TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED'], {
    message: 'Status is required',
  }),
});

type TenantFormValues = z.infer<typeof tenantFormSchema>;

interface TenantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant?: {
    id: string;
    name: string;
    subdomain: string;
    contactEmail: string;
    subscriptionTier: string;
    status: string;
  } | null;
  onSubmit: (values: TenantFormValues) => Promise<void>;
}

export function TenantDialog({ open, onOpenChange, tenant, onSubmit }: TenantDialogProps) {
  const isEditMode = !!tenant;

  const form = useForm<TenantFormValues>({
    resolver: zodResolver(tenantFormSchema),
    defaultValues: {
      name: tenant?.name || '',
      subdomain: tenant?.subdomain || '',
      contactEmail: tenant?.contactEmail || '',
      subscriptionTier:
        (tenant?.subscriptionTier as 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE') || 'STARTER',
      status: (tenant?.status as 'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED') || 'TRIAL',
    },
  });

  React.useEffect(() => {
    if (tenant) {
      form.reset({
        name: tenant.name,
        subdomain: tenant.subdomain,
        contactEmail: tenant.contactEmail,
        subscriptionTier: tenant.subscriptionTier as 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE',
        status: tenant.status as 'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED',
      });
    } else {
      form.reset({
        name: '',
        subdomain: '',
        contactEmail: '',
        subscriptionTier: 'STARTER',
        status: 'TRIAL',
      });
    }
  }, [tenant, form]);

  const handleSubmit = async (values: TenantFormValues) => {
    try {
      await onSubmit(values);
      form.reset();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to submit tenant:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit Tenant' : 'Create Tenant'}</DialogTitle>
          <DialogDescription>
            {isEditMode
              ? 'Update tenant information and settings.'
              : 'Add a new tenant organization to the system.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company Name</FormLabel>
                  <FormControl>
                    <Input placeholder="ACME Oil & Gas" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="subdomain"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subdomain</FormLabel>
                  <FormControl>
                    <div className="flex items-center">
                      <Input placeholder="acme" {...field} disabled={isEditMode} />
                      <span className="ml-2 text-sm text-muted-foreground">.wellpulse.io</span>
                    </div>
                  </FormControl>
                  <FormDescription>
                    {isEditMode
                      ? 'Subdomain cannot be changed after creation'
                      : 'Used for tenant-specific URLs'}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contactEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="admin@acme.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="subscriptionTier"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subscription Tier</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select tier" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="STARTER">Starter</SelectItem>
                        <SelectItem value="PROFESSIONAL">Professional</SelectItem>
                        <SelectItem value="ENTERPRISE">Enterprise</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="TRIAL">Trial</SelectItem>
                        <SelectItem value="ACTIVE">Active</SelectItem>
                        <SelectItem value="SUSPENDED">Suspended</SelectItem>
                        <SelectItem value="CANCELLED">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">{isEditMode ? 'Update Tenant' : 'Create Tenant'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
