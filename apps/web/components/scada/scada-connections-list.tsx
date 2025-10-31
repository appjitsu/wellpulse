/**
 * SCADA Connections List Component
 *
 * Displays all SCADA connections for the tenant with status monitoring.
 * Features:
 * - Connection status indicators (active, inactive, error, connecting)
 * - Real-time heartbeat monitoring
 * - Quick actions (test, configure tags, disconnect)
 * - Error message display
 * - Create new connection button
 *
 * Pattern References:
 * - Observer Pattern (connection status updates)
 * - Component Composition
 *
 * @see docs/sprints/sprint-5-implementation-spec.md:1552-1656
 */

'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2,
  Plus,
  Settings,
  Zap,
  Trash2,
} from 'lucide-react';
import { CreateScadaConnectionDialog } from './create-scada-connection-dialog';

export interface ScadaConnectionItem {
  id: string;
  name: string;
  description?: string;
  wellId: string;
  wellName: string;
  endpointUrl: string;
  protocol: 'OPC_UA' | 'MODBUS_TCP' | 'MQTT';
  status: 'active' | 'inactive' | 'error' | 'connecting';
  pollIntervalSeconds: number;
  lastConnectedAt?: string;
  lastErrorMessage?: string;
  isEnabled: boolean;
  createdAt: string;
  tagMappingsCount?: number;
}

interface ScadaConnectionsListProps {
  connections: ScadaConnectionItem[];
  isLoading?: boolean;
  onTestConnection?: (connectionId: string) => void;
  onConfigureTags?: (connectionId: string) => void;
  onDisconnect?: (connectionId: string) => void;
  onDelete?: (connectionId: string) => void;
  onRefresh?: () => void;
}

export function ScadaConnectionsList({
  connections,
  isLoading = false,
  onTestConnection,
  onConfigureTags,
  onDisconnect,
  onDelete,
  onRefresh,
}: ScadaConnectionsListProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [testingConnection, setTestingConnection] = useState<string | null>(null);

  /**
   * Get status badge component
   */
  const getStatusBadge = (status: ScadaConnectionItem['status']) => {
    const badges = {
      active: (
        <Badge
          variant="default"
          className="bg-green-500 hover:bg-green-600 flex items-center gap-1"
        >
          <CheckCircle className="w-3 h-3" />
          Connected
        </Badge>
      ),
      inactive: (
        <Badge variant="secondary" className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-slate-400" />
          Disconnected
        </Badge>
      ),
      error: (
        <Badge variant="destructive" className="flex items-center gap-1">
          <XCircle className="w-3 h-3" />
          Error
        </Badge>
      ),
      connecting: (
        <Badge variant="outline" className="flex items-center gap-1">
          <Loader2 className="w-3 h-3 animate-spin" />
          Connecting
        </Badge>
      ),
    };

    return badges[status] || badges.inactive;
  };

  /**
   * Format last connected timestamp
   */
  const formatLastConnected = (timestamp?: string): string => {
    if (!timestamp) return 'Never';

    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins} min ago`;

      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;

      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } catch {
      return 'Unknown';
    }
  };

  /**
   * Handle test connection
   */
  const handleTestConnection = async (connectionId: string) => {
    setTestingConnection(connectionId);
    try {
      await onTestConnection?.(connectionId);
    } finally {
      setTestingConnection(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-3 text-slate-600">Loading SCADA connections...</span>
      </div>
    );
  }

  if (connections.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-4">
          <Zap className="w-8 h-8 text-slate-400" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">No SCADA Connections</h3>
        <p className="text-slate-600 mb-6 max-w-md mx-auto">
          Connect to your SCADA systems (RTUs/PLCs) to enable real-time well monitoring and
          automated data collection.
        </p>
        <Button onClick={() => setShowCreateDialog(true)} size="lg">
          <Plus className="w-4 h-4 mr-2" />
          Add First Connection
        </Button>

        {showCreateDialog && (
          <CreateScadaConnectionDialog
            open={showCreateDialog}
            onClose={() => {
              setShowCreateDialog(false);
              onRefresh?.();
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">SCADA Connections</h2>
          <p className="text-sm text-slate-600 mt-1">
            {connections.length} connection{connections.length !== 1 ? 's' : ''} configured
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Connection
        </Button>
      </div>

      {/* Connection Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {connections.map((connection) => (
          <Card key={connection.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-lg truncate">{connection.name}</CardTitle>
                  <CardDescription className="truncate">{connection.wellName}</CardDescription>
                </div>
                {getStatusBadge(connection.status)}
              </div>
            </CardHeader>

            <CardContent className="space-y-3">
              {/* Connection Details */}
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Protocol:</span>
                  <span className="font-medium text-slate-900">{connection.protocol}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Endpoint:</span>
                  <span
                    className="font-mono text-xs text-slate-900 truncate max-w-[150px]"
                    title={connection.endpointUrl}
                  >
                    {connection.endpointUrl}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Poll Interval:</span>
                  <span className="font-medium text-slate-900">
                    {connection.pollIntervalSeconds}s
                  </span>
                </div>

                {connection.tagMappingsCount !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Tag Mappings:</span>
                    <span className="font-medium text-slate-900">
                      {connection.tagMappingsCount}
                    </span>
                  </div>
                )}

                {connection.lastConnectedAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Last Connected:</span>
                    <span className="font-medium text-slate-900">
                      {formatLastConnected(connection.lastConnectedAt)}
                    </span>
                  </div>
                )}
              </div>

              {/* Error Message */}
              {connection.status === 'error' && connection.lastErrorMessage && (
                <div className="flex items-start gap-2 p-2 rounded-md bg-red-50 border border-red-200">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-800 break-words">{connection.lastErrorMessage}</p>
                </div>
              )}

              {/* Description */}
              {connection.description && (
                <p className="text-xs text-slate-600 italic border-t pt-2">
                  {connection.description}
                </p>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => onConfigureTags?.(connection.id)}
                >
                  <Settings className="w-3 h-3 mr-1" />
                  Tags
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleTestConnection(connection.id)}
                  disabled={testingConnection === connection.id}
                >
                  {testingConnection === connection.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Zap className="w-3 h-3" />
                  )}
                </Button>

                {connection.status === 'active' && onDisconnect && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onDisconnect(connection.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <XCircle className="w-3 h-3" />
                  </Button>
                )}

                {onDelete && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(connection.id)}
                    className="text-slate-400 hover:text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create Connection Dialog */}
      {showCreateDialog && (
        <CreateScadaConnectionDialog
          open={showCreateDialog}
          onClose={() => {
            setShowCreateDialog(false);
            onRefresh?.();
          }}
        />
      )}
    </div>
  );
}
