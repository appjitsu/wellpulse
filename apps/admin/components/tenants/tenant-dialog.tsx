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
import { Loader2 } from 'lucide-react';

const tenantFormSchema = z.object({
  name: z.string().min(1, 'Company name is required'),
  slug: z
    .string()
    .min(3, 'Slug must be at least 3 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens'),
  subdomain: z
    .string()
    .min(3, 'Subdomain must be at least 3 characters')
    .regex(/^[a-z0-9-]+$/, 'Subdomain can only contain lowercase letters, numbers, and hyphens'),
  contactEmail: z.string().email('Invalid email address'),
  subscriptionTier: z.enum(['STARTER', 'PROFESSIONAL', 'ENTERPRISE', 'ENTERPRISE_PLUS'], {
    message: 'Subscription tier is required',
  }),
  trialDays: z.number().min(0).max(90).optional(),
});

type TenantFormValues = z.infer<typeof tenantFormSchema>;

interface TenantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant?: {
    id: string;
    name: string;
    slug: string;
    subdomain: string;
    contactEmail: string;
    subscriptionTier: string;
    status: string;
  } | null;
  onSubmit: (values: TenantFormValues) => Promise<void>;
}

export function TenantDialog({ open, onOpenChange, tenant, onSubmit }: TenantDialogProps) {
  const isEditMode = !!tenant;
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<TenantFormValues>({
    resolver: zodResolver(tenantFormSchema),
    defaultValues: {
      name: tenant?.name || '',
      slug: tenant?.slug || '',
      subdomain: tenant?.subdomain || '',
      contactEmail: tenant?.contactEmail || '',
      subscriptionTier:
        (tenant?.subscriptionTier as
          | 'STARTER'
          | 'PROFESSIONAL'
          | 'ENTERPRISE'
          | 'ENTERPRISE_PLUS') || 'STARTER',
      trialDays: 30,
    },
  });

  React.useEffect(() => {
    if (tenant) {
      form.reset({
        name: tenant.name,
        slug: tenant.slug,
        subdomain: tenant.subdomain,
        contactEmail: tenant.contactEmail,
        subscriptionTier: tenant.subscriptionTier as
          | 'STARTER'
          | 'PROFESSIONAL'
          | 'ENTERPRISE'
          | 'ENTERPRISE_PLUS',
        trialDays: 30,
      });
    } else {
      form.reset({
        name: '',
        slug: '',
        subdomain: '',
        contactEmail: '',
        subscriptionTier: 'STARTER',
        trialDays: 30,
      });
    }
  }, [tenant, form]);

  // Auto-generate slug from name
  const watchName = form.watch('name');
  React.useEffect(() => {
    if (!isEditMode && watchName) {
      const generatedSlug = watchName
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .substring(0, 50);
      form.setValue('slug', generatedSlug);
    }
  }, [watchName, isEditMode, form]);

  // Auto-generate subdomain from slug
  const watchSlug = form.watch('slug');
  React.useEffect(() => {
    if (!isEditMode && watchSlug) {
      form.setValue('subdomain', watchSlug);
    }
  }, [watchSlug, isEditMode, form]);

  const handleSubmit = async (values: TenantFormValues) => {
    try {
      setIsSubmitting(true);
      await onSubmit(values);
      form.reset();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to submit tenant:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit Tenant' : 'Create Tenant'}</DialogTitle>
          <DialogDescription>
            {isEditMode
              ? 'Update tenant information and settings.'
              : 'Add a new tenant organization. Tenant ID will be automatically generated.'}
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
                    <Input placeholder="ACME Oil & Gas" {...field} disabled={isEditMode} />
                  </FormControl>
                  <FormDescription>
                    Used to generate the tenant ID (e.g., ACME-A5L32W)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Slug</FormLabel>
                  <FormControl>
                    <Input placeholder="acme-oil-gas" {...field} disabled={isEditMode} />
                  </FormControl>
                  <FormDescription>
                    Auto-generated from company name. Used for database naming.
                  </FormDescription>
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
                      : 'Auto-generated from slug. Used for tenant-specific URLs.'}
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
                        <SelectItem value="ENTERPRISE_PLUS">Enterprise Plus</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="trialDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Trial Days</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        max="90"
                        placeholder="30"
                        {...field}
                        onChange={(e) =>
                          field.onChange(e.target.value ? parseInt(e.target.value) : undefined)
                        }
                      />
                    </FormControl>
                    <FormDescription>0 = Active, 1-90 = Trial</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditMode ? 'Update Tenant' : 'Create Tenant'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
