/**
 * AlertFeed Component
 *
 * Displays recent unacknowledged alerts with ability to acknowledge them.
 * Shows alert type icon, severity badge, well name, field name, message, and timestamp.
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle,
  CheckCircle,
  Info,
  Wrench,
  ShieldAlert,
  FileWarning,
  Calendar,
  Gauge,
  TrendingDown,
  TrendingUp,
  Clock,
  Loader2,
} from 'lucide-react';
import { useRecentAlerts, useAcknowledgeAlert } from '@/hooks/use-alerts';
import { AlertType, AlertSeverity } from '@/lib/api/alerts.api';
import { formatDistanceToNow } from '@/lib/utils/date';

// Map alert types to icons
const alertTypeIcons: Record<AlertType, React.ComponentType<{ className?: string }>> = {
  PRODUCTION_ANOMALY: TrendingDown,
  EQUIPMENT_FAILURE: Wrench,
  SAFETY_VIOLATION: ShieldAlert,
  COMPLIANCE_ISSUE: FileWarning,
  MAINTENANCE_DUE: Calendar,
  LOW_PRESSURE: TrendingDown,
  HIGH_PRESSURE: TrendingUp,
  TANK_LEVEL: Gauge,
};

// Map severity to colors
const severityColors: Record<AlertSeverity, 'destructive' | 'warning' | 'secondary'> = {
  critical: 'destructive',
  warning: 'warning',
  info: 'secondary',
};

const severityTextColors: Record<AlertSeverity, string> = {
  critical: 'text-red-700',
  warning: 'text-amber-700',
  info: 'text-blue-700',
};

const severityBgColors: Record<AlertSeverity, string> = {
  critical: 'bg-red-50 border-red-200',
  warning: 'bg-amber-50 border-amber-200',
  info: 'bg-blue-50 border-blue-200',
};

export function AlertFeed() {
  const { data, isLoading, error } = useRecentAlerts(10);
  const acknowledgeMutation = useAcknowledgeAlert();
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);

  const handleAcknowledge = async (alertId: string) => {
    if (window.confirm('Are you sure you want to acknowledge this alert?')) {
      setAcknowledgingId(alertId);
      try {
        await acknowledgeMutation.mutateAsync(alertId);
      } finally {
        setAcknowledgingId(null);
      }
    }
  };

  // Show loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Alert Feed</CardTitle>
          <CardDescription>Recent unacknowledged alerts requiring attention</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center gap-2 text-gray-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Loading alerts...</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show error state
  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="text-red-800 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Error Loading Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-700">Failed to load alerts. Please try again.</p>
        </CardContent>
      </Card>
    );
  }

  const alerts = data?.alerts || [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Alert Feed</CardTitle>
            <CardDescription>Recent unacknowledged alerts requiring attention</CardDescription>
          </div>
          <Link href="/dashboard/alerts">
            <Button variant="outline" size="sm">
              View All Alerts
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mb-3" />
            <p className="text-lg font-medium text-gray-900">All Clear!</p>
            <p className="text-sm text-gray-500">No unacknowledged alerts at this time</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => {
              const Icon = alertTypeIcons[alert.type] || Info;
              const isAcknowledging = acknowledgingId === alert.id;

              return (
                <div
                  key={alert.id}
                  className={`rounded-lg border p-4 transition-all ${severityBgColors[alert.severity]} ${isAcknowledging ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      <Icon className={`h-5 w-5 ${severityTextColors[alert.severity]}`} />
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant={severityColors[alert.severity]} className="text-xs">
                              {alert.severity.toUpperCase()}
                            </Badge>
                            <span className="text-xs text-gray-500">
                              {alert.type.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <p className="font-medium text-gray-900">{alert.wellName}</p>
                          {alert.fieldName && (
                            <p className="text-sm text-gray-600">{alert.fieldName}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-gray-500 whitespace-nowrap">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(alert.createdAt))}
                        </div>
                      </div>
                      <p className="text-sm text-gray-700">{alert.message}</p>
                      <div className="flex justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAcknowledge(alert.id)}
                          disabled={isAcknowledging}
                        >
                          {isAcknowledging ? (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Acknowledging...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="h-3 w-3" />
                              Acknowledge
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
