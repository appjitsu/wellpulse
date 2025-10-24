/**
 * Edit Well Form Component
 *
 * Form for editing an existing well.
 * Similar to create form but pre-populated with well data.
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useWell, useUpdateWell } from '@/hooks/use-wells';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

// API Number validation (format: XX-XXX-XXXXX)
const API_NUMBER_REGEX = /^\d{2}-\d{3}-\d{5}$/;

// Well form validation schema
const wellFormSchema = z.object({
  name: z
    .string()
    .min(1, 'Well name is required')
    .max(255, 'Name must be less than 255 characters'),
  apiNumber: z
    .string()
    .min(1, 'API number is required')
    .regex(API_NUMBER_REGEX, 'API number must be in format: XX-XXX-XXXXX'),
  status: z.enum(['ACTIVE', 'INACTIVE', 'PLUGGED_AND_ABANDONED'], 'Status is required'),
  latitude: z
    .number('Latitude must be a number')
    .min(-90, 'Latitude must be between -90 and 90')
    .max(90, 'Latitude must be between -90 and 90'),
  longitude: z
    .number('Longitude must be a number')
    .min(-180, 'Longitude must be between -180 and 180')
    .max(180, 'Longitude must be between -180 and 180'),
  lease: z.string().optional(),
  field: z.string().optional(),
  operator: z.string().optional(),
});

type WellFormData = z.infer<typeof wellFormSchema>;

interface EditWellFormProps {
  wellId: string;
}

export function EditWellForm({ wellId }: EditWellFormProps) {
  const router = useRouter();
  const { data: well, isLoading } = useWell(wellId);
  const updateWell = useUpdateWell();

  const form = useForm<WellFormData>({
    resolver: zodResolver(wellFormSchema),
    defaultValues: {
      name: '',
      apiNumber: '',
      status: 'ACTIVE',
      latitude: 0,
      longitude: 0,
      lease: '',
      field: '',
      operator: '',
    },
  });

  // Populate form when well data is loaded
  useEffect(() => {
    if (well) {
      form.reset({
        name: well.name,
        apiNumber: well.apiNumber,
        status: well.status,
        latitude: well.latitude,
        longitude: well.longitude,
        lease: well.lease || '',
        field: well.field || '',
        operator: well.operator || '',
      });
    }
  }, [well, form]);

  const onSubmit = async (data: WellFormData) => {
    try {
      await updateWell.mutateAsync({ id: wellId, data });
      toast.success('Well updated successfully');
      router.push(`/wells/${wellId}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update well';
      toast.error(errorMessage);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Edit Well</CardTitle>
          <CardDescription>Loading well data...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!well) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Edit Well</CardTitle>
          <CardDescription>Well not found</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit Well</CardTitle>
        <CardDescription>Update well information</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Well Name */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Well Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Well 001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* API Number */}
              <FormField
                control={form.control}
                name="apiNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>API Number</FormLabel>
                    <FormControl>
                      <Input placeholder="42-123-45678" {...field} />
                    </FormControl>
                    <FormDescription>Format: XX-XXX-XXXXX</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Status */}
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <FormControl>
                      <select
                        {...field}
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        <option value="ACTIVE">Active</option>
                        <option value="INACTIVE">Inactive</option>
                        <option value="PLUGGED_AND_ABANDONED">Plugged and Abandoned</option>
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Lease */}
              <FormField
                control={form.control}
                name="lease"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lease (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Permian Lease 1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Latitude */}
              <FormField
                control={form.control}
                name="latitude"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Latitude</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.0001"
                        placeholder="31.8457"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>Range: -90 to 90</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Longitude */}
              <FormField
                control={form.control}
                name="longitude"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Longitude</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.0001"
                        placeholder="-102.3676"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>Range: -180 to 180</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Field */}
              <FormField
                control={form.control}
                name="field"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Field (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Delaware Basin" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Operator */}
              <FormField
                control={form.control}
                name="operator"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Operator (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="ACME Oil & Gas" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(`/wells/${wellId}`)}
                disabled={form.formState.isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Updating...' : 'Update Well'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
