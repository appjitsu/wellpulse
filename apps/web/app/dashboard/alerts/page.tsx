/**
 * Alerts List Page
 *
 * Full-page alert list with filtering, pagination, and bulk actions.
 * Allows users to view all alerts, filter by severity and status, search, and acknowledge alerts.
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAlertHistory, useAcknowledgeAlert, useBulkAcknowledgeAlerts } from '@/hooks/use-alerts';
import { AlertType, AlertSeverity, AlertItem } from '@/lib/api/alerts.api';
import { formatDistanceToNow, formatDateTime } from '@/lib/utils/date';

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

export default function AlertsPage() {
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [severity, setSeverity] = useState<AlertSeverity | undefined>(undefined);
  const [acknowledged, setAcknowledged] = useState<boolean | undefined>(false);
  const [search, setSearch] = useState('');
  const [selectedAlerts, setSelectedAlerts] = useState<string[]>([]);
  const [detailAlert, setDetailAlert] = useState<AlertItem | null>(null);

  const { data, isLoading, error } = useAlertHistory({
    page,
    limit,
    severity,
    acknowledged,
    search: search || undefined,
  });

  const acknowledgeMutation = useAcknowledgeAlert();
  const bulkAcknowledgeMutation = useBulkAcknowledgeAlerts();

  const handleAcknowledge = async (alertId: string) => {
    if (window.confirm('Are you sure you want to acknowledge this alert?')) {
      await acknowledgeMutation.mutateAsync(alertId);
    }
  };

  const handleBulkAcknowledge = async () => {
    if (selectedAlerts.length === 0) return;
    if (window.confirm(`Are you sure you want to acknowledge ${selectedAlerts.length} alert(s)?`)) {
      await bulkAcknowledgeMutation.mutateAsync(selectedAlerts);
      setSelectedAlerts([]);
    }
  };

  const handleSelectAlert = (alertId: string) => {
    setSelectedAlerts((prev) =>
      prev.includes(alertId) ? prev.filter((id) => id !== alertId) : [...prev, alertId],
    );
  };

  const handleSelectAll = () => {
    if (selectedAlerts.length === data?.alerts.length) {
      setSelectedAlerts([]);
    } else {
      setSelectedAlerts(data?.alerts.map((alert) => alert.id) || []);
    }
  };

  const handleExportCSV = () => {
    if (!data?.alerts.length) return;

    const headers = [
      'ID',
      'Well Name',
      'Field Name',
      'Type',
      'Severity',
      'Message',
      'Created At',
      'Acknowledged At',
    ];
    const rows = data.alerts.map((alert) => [
      alert.id,
      alert.wellName,
      alert.fieldName || '',
      alert.type,
      alert.severity,
      alert.message,
      alert.createdAt,
      alert.acknowledgedAt || '',
    ]);

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `alerts-${new Date().toISOString()}.csv`;
    a.click();
  };

  const alerts = data?.alerts || [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Alerts</h1>
        <p className="text-gray-500">View and manage all alerts across your wells</p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter alerts by severity, status, and search</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            {/* Search */}
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Search by well name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Severity Filter */}
            <div>
              <select
                value={severity || ''}
                onChange={(e) =>
                  setSeverity(e.target.value ? (e.target.value as AlertSeverity) : undefined)
                }
                className="h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">All Severities</option>
                <option value="critical">Critical</option>
                <option value="warning">Warning</option>
                <option value="info">Info</option>
              </select>
            </div>

            {/* Acknowledged Filter */}
            <div>
              <select
                value={acknowledged === undefined ? '' : acknowledged ? 'true' : 'false'}
                onChange={(e) =>
                  setAcknowledged(e.target.value === '' ? undefined : e.target.value === 'true')
                }
                className="h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="false">Unacknowledged</option>
                <option value="true">Acknowledged</option>
                <option value="">All Status</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions Bar */}
      {selectedAlerts.length > 0 && (
        <div className="flex items-center justify-between rounded-lg border bg-blue-50 p-4">
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 text-blue-600" />
            <span className="font-medium text-blue-900">
              {selectedAlerts.length} alert(s) selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setSelectedAlerts([])}>
              Clear Selection
            </Button>
            <Button
              size="sm"
              onClick={handleBulkAcknowledge}
              disabled={bulkAcknowledgeMutation.isPending}
            >
              {bulkAcknowledgeMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Acknowledging...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Acknowledge Selected
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Alert List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Alert History</CardTitle>
              <CardDescription>{pagination?.total || 0} total alert(s) found</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {alerts.length > 0 && (
                <>
                  <Button variant="outline" size="sm" onClick={handleSelectAll}>
                    {selectedAlerts.length === alerts.length ? 'Deselect All' : 'Select All'}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleExportCSV}>
                    <Download className="h-4 w-4" />
                    Export CSV
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-2 text-gray-500">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span>Loading alerts...</span>
              </div>
            </div>
          ) : error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center">
              <AlertTriangle className="mx-auto h-12 w-12 text-red-600 mb-3" />
              <p className="text-lg font-medium text-red-900">Error Loading Alerts</p>
              <p className="text-sm text-red-700">Failed to load alerts. Please try again.</p>
            </div>
          ) : alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mb-3" />
              <p className="text-lg font-medium text-gray-900">No Alerts Found</p>
              <p className="text-sm text-gray-500">
                No alerts match your current filters. Try adjusting your search criteria.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert) => {
                const Icon = alertTypeIcons[alert.type] || Info;
                const isSelected = selectedAlerts.includes(alert.id);

                return (
                  <div
                    key={alert.id}
                    className={`rounded-lg border p-4 transition-all ${
                      severityBgColors[alert.severity]
                    } ${isSelected ? 'ring-2 ring-blue-500' : ''} ${
                      alert.acknowledgedAt ? 'opacity-60' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Checkbox */}
                      {!alert.acknowledgedAt && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectAlert(alert.id)}
                          className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      )}

                      {/* Icon */}
                      <div className="mt-0.5">
                        <Icon className={`h-5 w-5 ${severityTextColors[alert.severity]}`} />
                      </div>

                      {/* Content */}
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
                              {alert.acknowledgedAt && (
                                <Badge variant="secondary" className="text-xs">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Acknowledged
                                </Badge>
                              )}
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
                        {alert.description && (
                          <p className="text-xs text-gray-600">{alert.description}</p>
                        )}
                        <div className="flex items-center justify-between">
                          <Button
                            variant="link"
                            size="sm"
                            className="p-0 h-auto text-xs"
                            onClick={() => setDetailAlert(alert)}
                          >
                            View Details
                          </Button>
                          {!alert.acknowledgedAt && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAcknowledge(alert.id)}
                              disabled={acknowledgeMutation.isPending}
                            >
                              {acknowledgeMutation.isPending ? (
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
                          )}
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

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">
            Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}{' '}
            alerts
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                const pageNum = i + 1;
                return (
                  <Button
                    key={pageNum}
                    variant={page === pageNum ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPage(pageNum)}
                  >
                    {pageNum}
                  </Button>
                );
              })}
              {pagination.totalPages > 5 && (
                <>
                  <span className="px-2 text-gray-500">...</span>
                  <Button
                    variant={page === pagination.totalPages ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPage(pagination.totalPages)}
                  >
                    {pagination.totalPages}
                  </Button>
                </>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={page === pagination.totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Alert Detail Modal */}
      <Dialog open={!!detailAlert} onOpenChange={() => setDetailAlert(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Alert Details</DialogTitle>
            <DialogDescription>Full information about this alert</DialogDescription>
          </DialogHeader>
          {detailAlert && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Severity</p>
                  <Badge variant={severityColors[detailAlert.severity]} className="mt-1">
                    {detailAlert.severity.toUpperCase()}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Type</p>
                  <p className="text-sm text-gray-900 mt-1">
                    {detailAlert.type.replace(/_/g, ' ')}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Well</p>
                  <p className="text-sm text-gray-900 mt-1">{detailAlert.wellName}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Field</p>
                  <p className="text-sm text-gray-900 mt-1">{detailAlert.fieldName || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Created</p>
                  <p className="text-sm text-gray-900 mt-1">
                    {formatDateTime(new Date(detailAlert.createdAt))}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Status</p>
                  <p className="text-sm text-gray-900 mt-1">
                    {detailAlert.acknowledgedAt ? (
                      <Badge variant="secondary">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Acknowledged
                      </Badge>
                    ) : (
                      <Badge variant="destructive">Unacknowledged</Badge>
                    )}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Message</p>
                <p className="text-sm text-gray-900 mt-1">{detailAlert.message}</p>
              </div>
              {detailAlert.description && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Description</p>
                  <p className="text-sm text-gray-900 mt-1">{detailAlert.description}</p>
                </div>
              )}
              {detailAlert.metadata && Object.keys(detailAlert.metadata).length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Additional Data</p>
                  <pre className="mt-1 rounded-lg bg-gray-100 p-3 text-xs overflow-auto">
                    {JSON.stringify(detailAlert.metadata, null, 2)}
                  </pre>
                </div>
              )}
              {detailAlert.acknowledgedAt && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Acknowledged At</p>
                  <p className="text-sm text-gray-900 mt-1">
                    {formatDateTime(new Date(detailAlert.acknowledgedAt))}
                  </p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailAlert(null)}>
              Close
            </Button>
            {detailAlert && !detailAlert.acknowledgedAt && (
              <Button
                onClick={() => {
                  handleAcknowledge(detailAlert.id);
                  setDetailAlert(null);
                }}
                disabled={acknowledgeMutation.isPending}
              >
                {acknowledgeMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Acknowledging...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Acknowledge Alert
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
