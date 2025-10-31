/**
 * Tag Mapping Configuration Dialog
 *
 * Maps SCADA tags (from OPC-UA/Modbus/MQTT) to WellPulse field data entries.
 * Features:
 * - Browse available tags from SCADA connection
 * - Map tags to measurement types (oil, gas, water, pressure, temperature)
 * - Configure unit conversions (e.g., PSI → kPa, °F → °C)
 * - Set data validation rules (min/max ranges)
 * - Enable/disable individual tag mappings
 *
 * Pattern References:
 * - Observer Pattern (tag value changes trigger field entry creation)
 * - Strategy Pattern (unit conversion strategies)
 * - Specification Pattern (data validation rules)
 *
 * @see docs/sprints/sprint-5-implementation-spec.md:1658-1789
 */

'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
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
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, Plus, Trash2, RefreshCw, AlertCircle } from 'lucide-react';
import { useTagMappings } from '@/hooks/use-tag-mappings';

/**
 * Available measurement types for mapping
 */
export const MEASUREMENT_TYPES = [
  { value: 'oil_volume', label: 'Oil Volume (BBL)', unit: 'BBL' },
  { value: 'gas_volume', label: 'Gas Volume (MCF)', unit: 'MCF' },
  { value: 'water_volume', label: 'Water Volume (BBL)', unit: 'BBL' },
  { value: 'pressure', label: 'Pressure (PSI)', unit: 'PSI' },
  { value: 'temperature', label: 'Temperature (°F)', unit: '°F' },
  { value: 'flow_rate', label: 'Flow Rate (BBL/day)', unit: 'BBL/day' },
  { value: 'runtime_hours', label: 'Runtime Hours', unit: 'hours' },
  { value: 'pump_speed', label: 'Pump Speed (RPM)', unit: 'RPM' },
] as const;

/**
 * Unit conversion options
 */
export const UNIT_CONVERSIONS = {
  pressure: [
    { from: 'PSI', to: 'PSI', factor: 1 },
    { from: 'PSI', to: 'kPa', factor: 6.89476 },
    { from: 'PSI', to: 'bar', factor: 0.0689476 },
  ],
  temperature: [
    { from: '°F', to: '°F', factor: 1 },
    { from: '°F', to: '°C', formula: '(x - 32) * 5/9' },
    { from: '°C', to: '°F', formula: 'x * 9/5 + 32' },
  ],
  volume: [
    { from: 'BBL', to: 'BBL', factor: 1 },
    { from: 'BBL', to: 'm³', factor: 0.158987 },
    { from: 'MCF', to: 'MCF', factor: 1 },
    { from: 'MCF', to: 'm³', factor: 28.3168 },
  ],
} as const;

/**
 * Form validation schema
 */
const tagMappingFormSchema = z.object({
  tagId: z.string().min(1, 'Tag is required'),
  measurementType: z.string().min(1, 'Measurement type is required'),
  conversionFactor: z.number().positive('Conversion factor must be positive'),
  minValue: z.number().optional(),
  maxValue: z.number().optional(),
  isEnabled: z.boolean(),
});

type TagMappingFormValues = z.infer<typeof tagMappingFormSchema>;

export interface OpcTag {
  nodeId: string;
  displayName: string;
  dataType: string;
  currentValue?: number | string;
}

interface TagMappingDialogProps {
  open: boolean;
  onClose: () => void;
  connectionId: string;
  connectionName: string;
}

export function TagMappingDialog({
  open,
  onClose,
  connectionId,
  connectionName,
}: TagMappingDialogProps) {
  const [availableTags, setAvailableTags] = useState<OpcTag[]>([]);
  const [loadingTags, setLoadingTags] = useState(false);

  const { mappings, isLoading, createMapping, deleteMapping, browseTags } =
    useTagMappings(connectionId);

  const form = useForm<TagMappingFormValues>({
    resolver: zodResolver(tagMappingFormSchema),
    defaultValues: {
      tagId: '',
      measurementType: '',
      conversionFactor: 1,
      isEnabled: true,
    },
  });

  /**
   * Load available tags from SCADA connection
   */
  const handleBrowseTags = async () => {
    setLoadingTags(true);
    try {
      const tags = await browseTags.mutateAsync();
      setAvailableTags(tags);
    } catch (error) {
      console.error('Failed to browse tags:', error);
    } finally {
      setLoadingTags(false);
    }
  };

  /**
   * Load tags on dialog open
   */
  useEffect(() => {
    if (open) {
      handleBrowseTags();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, connectionId]);

  /**
   * Handle form submission
   */
  const onSubmit = async (values: TagMappingFormValues) => {
    try {
      await createMapping.mutateAsync({
        connectionId,
        ...values,
      });
      form.reset();
    } catch (error) {
      console.error('Failed to create tag mapping:', error);
    }
  };

  /**
   * Handle delete mapping
   */
  const handleDelete = async (mappingId: string) => {
    if (confirm('Are you sure you want to delete this tag mapping?')) {
      await deleteMapping.mutateAsync(mappingId);
    }
  };

  /**
   * Get selected tag details
   */
  const selectedTag = availableTags.find((tag) => tag.nodeId === form.watch('tagId'));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configure Tag Mappings</DialogTitle>
          <DialogDescription>
            Map SCADA tags from <strong>{connectionName}</strong> to WellPulse field data entries.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Existing Mappings Table */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-slate-900">Active Mappings</h3>
              <Button variant="outline" size="sm" onClick={handleBrowseTags} disabled={loadingTags}>
                {loadingTags ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Browsing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh Tags
                  </>
                )}
              </Button>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                <span className="ml-2 text-slate-600">Loading mappings...</span>
              </div>
            ) : mappings.length === 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No tag mappings configured. Add your first mapping below.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tag</TableHead>
                      <TableHead>Measurement Type</TableHead>
                      <TableHead>Conversion</TableHead>
                      <TableHead>Range</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mappings.map((mapping) => (
                      <TableRow key={mapping.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium text-slate-900">
                              {mapping.tagDisplayName}
                            </div>
                            <div className="text-xs text-slate-500 font-mono">
                              {mapping.tagNodeId}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {MEASUREMENT_TYPES.find((t) => t.value === mapping.measurementType)
                            ?.label || mapping.measurementType}
                        </TableCell>
                        <TableCell>
                          {mapping.conversionFactor !== 1 ? (
                            <span className="text-sm text-slate-600">
                              ×{mapping.conversionFactor}
                            </span>
                          ) : (
                            <span className="text-sm text-slate-400">None</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {mapping.minValue !== null || mapping.maxValue !== null ? (
                            <span className="text-sm text-slate-600">
                              {mapping.minValue ?? '−∞'} to {mapping.maxValue ?? '+∞'}
                            </span>
                          ) : (
                            <span className="text-sm text-slate-400">No limits</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={mapping.isEnabled ? 'default' : 'secondary'}>
                            {mapping.isEnabled ? 'Enabled' : 'Disabled'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(mapping.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {/* Add New Mapping Form */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Add New Mapping</h3>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {/* Tag Selection */}
                  <FormField
                    control={form.control}
                    name="tagId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SCADA Tag *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a tag" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {availableTags.map((tag) => (
                              <SelectItem key={tag.nodeId} value={tag.nodeId}>
                                <div className="flex items-center justify-between w-full">
                                  <span>{tag.displayName}</span>
                                  {tag.currentValue !== undefined && (
                                    <span className="ml-2 text-xs text-slate-500">
                                      ({tag.currentValue} {tag.dataType})
                                    </span>
                                  )}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          {availableTags.length === 0
                            ? 'Click "Refresh Tags" to browse available tags'
                            : `${availableTags.length} tags available`}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Measurement Type */}
                  <FormField
                    control={form.control}
                    name="measurementType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Measurement Type *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {MEASUREMENT_TYPES.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>How this tag should be recorded</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Conversion Factor */}
                  <FormField
                    control={form.control}
                    name="conversionFactor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Conversion Factor</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.0001"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 1)}
                          />
                        </FormControl>
                        <FormDescription>Multiply tag value by this factor</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Min Value */}
                  <FormField
                    control={form.control}
                    name="minValue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Min Value (Optional)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="No minimum"
                            {...field}
                            onChange={(e) =>
                              field.onChange(
                                e.target.value ? parseFloat(e.target.value) : undefined,
                              )
                            }
                            value={field.value ?? ''}
                          />
                        </FormControl>
                        <FormDescription>Reject values below this</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Max Value */}
                  <FormField
                    control={form.control}
                    name="maxValue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max Value (Optional)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="No maximum"
                            {...field}
                            onChange={(e) =>
                              field.onChange(
                                e.target.value ? parseFloat(e.target.value) : undefined,
                              )
                            }
                            value={field.value ?? ''}
                          />
                        </FormControl>
                        <FormDescription>Reject values above this</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Enabled Toggle */}
                  <FormField
                    control={form.control}
                    name="isEnabled"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Enable Mapping</FormLabel>
                          <FormDescription>Start collecting data from this tag</FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                {/* Selected Tag Info */}
                {selectedTag && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Selected Tag:</strong> {selectedTag.displayName} (
                      {selectedTag.dataType})
                      {selectedTag.currentValue !== undefined && (
                        <>
                          {' '}
                          | <strong>Current Value:</strong> {selectedTag.currentValue}
                        </>
                      )}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Error Alert */}
                {createMapping.isError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      {createMapping.error instanceof Error
                        ? createMapping.error.message
                        : 'Failed to create mapping. Please try again.'}
                    </AlertDescription>
                  </Alert>
                )}

                <DialogFooter className="gap-2">
                  <Button type="button" variant="outline" onClick={onClose}>
                    Close
                  </Button>
                  <Button type="submit" disabled={createMapping.isPending}>
                    {createMapping.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 mr-2" />
                        Add Mapping
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
