/**
 * Dashboard Page
 *
 * Main dashboard with overview metrics, production charts, and well status
 */

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp,
  TrendingDown,
  Droplet,
  AlertTriangle,
  DollarSign,
  Loader2,
} from 'lucide-react';
import { useDashboardMetrics, useWellStatus, useTopProducers } from '@/hooks/use-dashboard';
import { useAlertStats } from '@/hooks/use-alerts';
import { AlertFeed } from '@/components/dashboard/AlertFeed';
import { ProductionTrendChart } from '@/components/dashboard/ProductionTrendChart';

export default function DashboardPage() {
  const {
    data: metricsData,
    isLoading: metricsLoading,
    error: metricsError,
  } = useDashboardMetrics();
  const { data: statusData, isLoading: statusLoading, error: statusError } = useWellStatus();
  const {
    data: producersData,
    isLoading: producersLoading,
    error: producersError,
  } = useTopProducers();
  const {
    data: alertStatsData,
    isLoading: alertStatsLoading,
    error: alertStatsError,
  } = useAlertStats();

  const isLoading = metricsLoading || statusLoading || producersLoading || alertStatsLoading;
  const hasError = metricsError || statusError || producersError || alertStatsError;

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-2 text-gray-500">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading dashboard...</span>
        </div>
      </div>
    );
  }

  // Show error state
  if (hasError) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="text-red-800 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Error Loading Dashboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-700">Failed to load dashboard data. Please try again.</p>
        </CardContent>
      </Card>
    );
  }

  // Use real alert stats from alerts API
  const activeAlertsCount = alertStatsData?.unacknowledged ?? 0;
  const alertChange = metricsData?.activeAlerts.change || '+0%';
  const alertTrend = metricsData?.activeAlerts.trend || 'neutral';

  const metrics = metricsData
    ? [
        {
          title: 'Total Wells',
          value: metricsData.totalWells.value,
          change: metricsData.totalWells.change,
          trend: metricsData.totalWells.trend,
          icon: Droplet,
          description: 'Active wells',
        },
        {
          title: 'Daily Production',
          value: metricsData.dailyProduction.value,
          unit: metricsData.dailyProduction.unit,
          change: metricsData.dailyProduction.change,
          trend: metricsData.dailyProduction.trend,
          icon: TrendingUp,
          description: 'Last 24 hours',
        },
        {
          title: 'Active Alerts',
          value: activeAlertsCount,
          change: alertChange,
          trend: alertTrend,
          icon: AlertTriangle,
          description: 'Require attention',
          alert: activeAlertsCount > 0,
        },
        {
          title: 'Monthly Revenue',
          value: metricsData.monthlyRevenue.value,
          change: metricsData.monthlyRevenue.change,
          trend: metricsData.monthlyRevenue.trend,
          icon: DollarSign,
          description: 'This month',
        },
      ]
    : [];

  // Map status names for display
  const statusColorMap: Record<string, string> = {
    ACTIVE: 'bg-green-500',
    INACTIVE: 'bg-red-500',
    MAINTENANCE: 'bg-yellow-500',
    PLUGGED: 'bg-gray-400',
  };

  const statusLabelMap: Record<string, string> = {
    ACTIVE: 'Producing',
    INACTIVE: 'Offline',
    MAINTENANCE: 'Maintenance',
    PLUGGED: 'Idle',
  };

  const statusDistribution =
    statusData?.statusDistribution.map((status) => ({
      status: statusLabelMap[status.status] || status.status,
      count: status.count,
      color: statusColorMap[status.status] || 'bg-gray-400',
      percentage: status.percentage,
    })) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Dashboard</h1>
        <p className="text-gray-500">Welcome back! Here&apos;s your field overview.</p>
      </div>

      {/* Metrics Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          const isPositive = metric.trend === 'up' && !metric.alert;
          const isNegative = metric.trend === 'up' && metric.alert;

          return (
            <Card key={metric.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">{metric.title}</CardTitle>
                <Icon className={`h-5 w-5 ${metric.alert ? 'text-orange-600' : 'text-blue-600'}`} />
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <div className="text-3xl font-bold">{metric.value}</div>
                  {metric.unit && <span className="text-sm text-gray-500">{metric.unit}</span>}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Badge
                    variant={isPositive ? 'default' : isNegative ? 'destructive' : 'secondary'}
                    className="text-xs"
                  >
                    {metric.change}
                  </Badge>
                  <p className="text-xs text-gray-500">{metric.description}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Production Trend Chart */}
      <ProductionTrendChart />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Well Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Well Status</CardTitle>
            <CardDescription>Current status distribution across all wells</CardDescription>
          </CardHeader>
          <CardContent>
            {statusDistribution.length > 0 ? (
              <div className="space-y-4">
                {statusDistribution.map((status) => (
                  <div key={status.status} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`h-3 w-3 rounded-full ${status.color}`} />
                      <span className="text-sm font-medium">{status.status}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-2xl font-bold">{status.count}</span>
                      <div className="h-2 w-32 rounded-full bg-gray-200">
                        <div
                          className={`h-full rounded-full ${status.color}`}
                          style={{ width: `${status.percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">No well status data available</div>
            )}
          </CardContent>
        </Card>

        {/* Top Producers */}
        <Card>
          <CardHeader>
            <CardTitle>Top Producers</CardTitle>
            <CardDescription>Highest producing wells (bbl/day)</CardDescription>
          </CardHeader>
          <CardContent>
            {producersData && producersData.topProducers.length > 0 ? (
              <div className="space-y-4">
                {producersData.topProducers.map((well, index) => (
                  <div key={well.wellId} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                        {index + 1}
                      </div>
                      <span className="font-medium">{well.wellName}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xl font-bold">
                        {Math.round(well.avgDailyProduction)}
                      </span>
                      <div className="flex items-center gap-1">
                        {well.trend === 'up' ? (
                          <TrendingUp className="h-4 w-4 text-green-600" />
                        ) : well.trend === 'down' ? (
                          <TrendingDown className="h-4 w-4 text-red-600" />
                        ) : null}
                        {well.trend !== 'neutral' && (
                          <span
                            className={`text-sm font-medium ${
                              well.trend === 'up' ? 'text-green-600' : 'text-red-600'
                            }`}
                          >
                            {well.trendPercentage > 0 ? '+' : ''}
                            {well.trendPercentage.toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">No production data available</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Alert Feed - replaces Recent Activity */}
      <AlertFeed />
    </div>
  );
}
