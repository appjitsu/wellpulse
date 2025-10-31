/**
 * Create SCADA Connection Dialog Component
 *
 * Multi-step form for setting up new SCADA connections to RTUs/PLCs.
 * Features:
 * - Well selection dropdown
 * - Protocol selection (OPC-UA, Modbus TCP, MQTT)
 * - Endpoint configuration with validation
 * - Authentication credentials (encrypted at rest)
 * - Connection testing before saving
 * - Error handling with user-friendly messages
 *
 * Pattern References:
 * - Form Validation Pattern
 * - Multi-step Wizard Pattern
 * - Optimistic UI Updates
 *
 * @see docs/sprints/sprint-5-implementation-spec.md:1552-1656
 */

'use client';

import { useState } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle, XCircle, Zap, AlertCircle } from 'lucide-react';
import { useScadaConnections } from '@/hooks/use-scada-connections';
import { useWells } from '@/hooks/use-wells';

/**
 * Form validation schema
 */
const connectionFormSchema = z.object({
  wellId: z.string().min(1, 'Please select a well'),
  name: z
    .string()
    .min(3, 'Name must be at least 3 characters')
    .max(100, 'Name must be less than 100 characters'),
  description: z.string().max(500, 'Description must be less than 500 characters').optional(),
  protocol: z.enum(['OPC_UA', 'MODBUS_TCP', 'MQTT']),
  endpointUrl: z
    .string()
    .min(1, 'Endpoint URL is required')
    .regex(
      /^(opc\.tcp|modbus|mqtt):\/\/[\w\-.]+(:\d+)?(\/.*)?$/,
      'Invalid endpoint format. Examples: opc.tcp://192.168.1.100:4840, modbus://10.0.0.50:502, mqtt://broker.example.com:1883',
    ),
  username: z.string().optional(),
  password: z.string().optional(),
  pollIntervalSeconds: z
    .number()
    .int()
    .min(1, 'Poll interval must be at least 1 second')
    .max(3600, 'Poll interval must be less than 1 hour'),
});

type ConnectionFormValues = z.infer<typeof connectionFormSchema>;

interface CreateScadaConnectionDialogProps {
  open: boolean;
  onClose: () => void;
}

export function CreateScadaConnectionDialog({ open, onClose }: CreateScadaConnectionDialogProps) {
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const { data: wells, isLoading: loadingWells } = useWells();
  const { createConnection, testConnection } = useScadaConnections();

  const form = useForm<ConnectionFormValues>({
    resolver: zodResolver(connectionFormSchema),
    defaultValues: {
      name: '',
      description: '',
      protocol: 'OPC_UA',
      endpointUrl: '',
      username: '',
      password: '',
      pollIntervalSeconds: 60,
    },
  });

  /**
   * Handle form submission
   */
  const onSubmit = async (values: ConnectionFormValues) => {
    try {
      await createConnection.mutateAsync(values);
      form.reset();
      setTestResult(null);
      onClose();
    } catch (error) {
      console.error('Failed to create SCADA connection:', error);
    }
  };

  /**
   * Test connection before saving
   */
  const handleTestConnection = async () => {
    const values = form.getValues();

    // Validate required fields
    const requiredFields = ['wellId', 'protocol', 'endpointUrl'];
    const hasRequiredFields = requiredFields.every((field) => {
      const value = values[field as keyof ConnectionFormValues];
      return value && value !== '';
    });

    if (!hasRequiredFields) {
      setTestResult({
        success: false,
        message: 'Please fill in all required fields before testing the connection.',
      });
      return;
    }

    setTestingConnection(true);
    setTestResult(null);

    try {
      const result = await testConnection.mutateAsync({
        protocol: values.protocol,
        endpointUrl: values.endpointUrl,
        username: values.username,
        password: values.password,
      });

      setTestResult({
        success: result.success,
        message: result.success
          ? 'Connection successful! You can now save this configuration.'
          : result.error || 'Connection failed. Please check your settings.',
      });
    } catch (error) {
      setTestResult({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Connection test failed. Please verify your endpoint URL and credentials.',
      });
    } finally {
      setTestingConnection(false);
    }
  };

  /**
   * Get endpoint placeholder based on protocol
   */
  const getEndpointPlaceholder = (protocol: string): string => {
    switch (protocol) {
      case 'OPC_UA':
        return 'opc.tcp://192.168.1.100:4840';
      case 'MODBUS_TCP':
        return 'modbus://10.0.0.50:502';
      case 'MQTT':
        return 'mqtt://broker.example.com:1883';
      default:
        return '';
    }
  };

  /**
   * Handle dialog close
   */
  const handleClose = () => {
    form.reset();
    setTestResult(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add SCADA Connection</DialogTitle>
          <DialogDescription>
            Connect to your SCADA system (RTU/PLC) to enable real-time well monitoring and automated
            data collection.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Well Selection */}
            <FormField
              control={form.control}
              name="wellId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Well *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={loadingWells}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a well" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {wells?.wells?.map((well) => (
                        <SelectItem key={well.id} value={well.id}>
                          {well.name} ({well.apiNumber})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>The well this SCADA connection will monitor</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Connection Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Connection Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="RTU-001 Main Controller" {...field} />
                  </FormControl>
                  <FormDescription>
                    A descriptive name for this connection (e.g., RTU model, location)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Optional notes about this connection..."
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Protocol Selection */}
            <FormField
              control={form.control}
              name="protocol"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Protocol *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="OPC_UA">OPC-UA (Recommended)</SelectItem>
                      <SelectItem value="MODBUS_TCP">Modbus TCP</SelectItem>
                      <SelectItem value="MQTT">MQTT</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Communication protocol supported by your RTU/PLC
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Endpoint URL */}
            <FormField
              control={form.control}
              name="endpointUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Endpoint URL *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={getEndpointPlaceholder(form.watch('protocol'))}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Network address of your SCADA device (IP:port or hostname:port)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Authentication */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input placeholder="admin" autoComplete="off" {...field} />
                    </FormControl>
                    <FormDescription>Optional</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="new-password" {...field} />
                    </FormControl>
                    <FormDescription>Encrypted at rest</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Poll Interval */}
            <FormField
              control={form.control}
              name="pollIntervalSeconds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Poll Interval (seconds) *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={3600}
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 60)}
                    />
                  </FormControl>
                  <FormDescription>
                    How often to poll the SCADA system for new data (1-3600 seconds)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Test Result Alert */}
            {testResult && (
              <Alert variant={testResult.success ? 'default' : 'destructive'}>
                {testResult.success ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                <AlertDescription>{testResult.message}</AlertDescription>
              </Alert>
            )}

            {/* Error Alert */}
            {createConnection.isError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {createConnection.error instanceof Error
                    ? createConnection.error.message
                    : 'Failed to create connection. Please try again.'}
                </AlertDescription>
              </Alert>
            )}

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={handleTestConnection}
                disabled={testingConnection}
              >
                {testingConnection ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2" />
                    Test Connection
                  </>
                )}
              </Button>
              <Button
                type="submit"
                disabled={createConnection.isPending || testingConnection || !testResult?.success}
              >
                {createConnection.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Connection'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
