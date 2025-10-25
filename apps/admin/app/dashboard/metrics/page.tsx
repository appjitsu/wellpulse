/**
 * Metrics Dashboard Page
 *
 * Custom Prometheus metrics visualization for WellPulse admin portal.
 * Displays real-time metrics for connection pools, API performance, and system health.
 *
 * Cost-saving alternative to Grafana on Azure.
 *
 * Features:
 * - Real-time connection pool metrics per tenant
 * - API request rate and latency
 * - System resource utilization (CPU, memory, GC)
 * - Auto-refresh every 10 seconds
 */

'use client';

import { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Activity,
  Database,
  Gauge as GaugeIcon,
  RefreshCw,
  TrendingUp,
  AlertCircle,
  Cpu,
  MemoryStick,
  Users,
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
// Admin API import available for future use
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import * as adminApi from '@/lib/api/admin';

// PrometheusMetric interface available for future structured metric parsing
// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface PrometheusMetric {
  name: string;
  type: string;
  help: string;
  metrics: Array<{
    labels: Record<string, string>;
    value: number;
  }>;
}

interface ParsedMetrics {
  connectionPools: Array<{
    tenantId: string;
    tenantName: string;
    databaseName: string;
    totalConnections: number;
    idleConnections: number;
    waitingClients: number;
  }>;
  httpMetrics: {
    totalRequests: number;
    avgLatency: number;
    requestsPerMin: number;
    requestsByRoute: Array<{
      route: string;
      count: number;
    }>;
    requestsByStatus: Array<{
      status: string;
      count: number;
    }>;
  };
  systemMetrics: {
    cpuUsage: number;
    memoryUsed: number;
    memoryTotal: number;
    gcDuration: number;
    eventLoopLag: number;
  };
  tenantMetrics: {
    total: number;
    byStatus: Array<{
      status: string;
      count: number;
    }>;
    activeUsers: Array<{
      tenantId: string;
      count: number;
    }>;
  };
  timeSeriesData: Array<{
    timestamp: string;
    requests: number;
    avgLatency: number;
  }>;
}

// Chart colors
const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function MetricsPage() {
  const [metrics, setMetrics] = useState<ParsedMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Track historical data for time series charts (last 20 data points)
  const [historicalData, setHistoricalData] = useState<
    Array<{
      timestamp: string;
      requests: number;
      avgLatency: number;
    }>
  >([]);

  // Track previous request count for requests/min calculation
  const previousRequestsRef = useRef<{ count: number; timestamp: number } | null>(null);

  const fetchMetrics = async () => {
    try {
      setError(null);

      // Fetch from API /api/metrics endpoint
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
      const response = await fetch(`${apiUrl}/metrics`);

      if (!response.ok) {
        throw new Error(`Failed to fetch metrics: ${response.statusText}`);
      }

      const metricsText = await response.text();
      console.log('📥 Fetched metrics text (first 500 chars):', metricsText.substring(0, 500));
      const parsed = parsePrometheusMetrics(metricsText);
      console.log('✅ Parsed metrics:', parsed);

      setMetrics(parsed);
      setLastUpdate(new Date());

      // Update historical data for charts (keep last 20 points)
      const timestamp = new Date().toLocaleTimeString();
      setHistoricalData((prev) => {
        const newData = [
          ...prev,
          {
            timestamp,
            requests: parsed.httpMetrics.totalRequests,
            avgLatency: parsed.httpMetrics.avgLatency,
          },
        ].slice(-20); // Keep only last 20 data points
        return newData;
      });

      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch metrics');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();

    if (autoRefresh) {
      const interval = setInterval(fetchMetrics, 10000); // Refresh every 10 seconds
      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh]);

  const parsePrometheusMetrics = (text: string): ParsedMetrics => {
    console.log('📊 Parsing metrics, text length:', text.length);
    const lines = text.split('\n');

    interface PoolMetric {
      tenantId: string;
      tenantName: string;
      databaseName: string;
      totalConnections: number;
      idleConnections: number;
      waitingClients: number;
    }

    const poolMetrics: Map<string, PoolMetric> = new Map();
    const requestsByRoute: Map<string, number> = new Map();
    const requestsByStatus: Map<string, number> = new Map();
    const tenantStatus: Map<string, number> = new Map();
    const activeUsers: Map<string, number> = new Map();

    let totalRequests = 0;
    let cpuUsage = 0;
    let memoryUsed = 0;
    let memoryTotal = 0;
    let totalTenantsCount = 0;

    // For histogram-based average latency calculation
    let histogramSum = 0;
    let histogramCount = 0;

    for (const line of lines) {
      if (line.startsWith('#') || !line.trim()) continue;

      // Parse connection pool metrics
      if (line.startsWith('tenant_connection_pool_size')) {
        const match = line.match(
          /tenant_connection_pool_size\{tenant_id="([^"]+)",tenant_name="([^"]+)",database_name="([^"]+)"\}\s+(\d+)/,
        );
        if (match) {
          const [, tenantId, tenantName, databaseName, value] = match;
          const key = `${tenantId}:${databaseName}`;
          if (!poolMetrics.has(key)) {
            poolMetrics.set(key, {
              tenantId,
              tenantName,
              databaseName,
              totalConnections: 0,
              idleConnections: 0,
              waitingClients: 0,
            });
          }
          poolMetrics.get(key)!.totalConnections = parseInt(value);
        }
      }

      if (line.startsWith('tenant_connection_pool_idle')) {
        const match = line.match(
          /tenant_connection_pool_idle\{tenant_id="([^"]+)",tenant_name="([^"]+)",database_name="([^"]+)"\}\s+(\d+)/,
        );
        if (match) {
          const [, tenantId, tenantName, databaseName, value] = match;
          const key = `${tenantId}:${databaseName}`;
          if (!poolMetrics.has(key)) {
            poolMetrics.set(key, {
              tenantId,
              tenantName,
              databaseName,
              totalConnections: 0,
              idleConnections: 0,
              waitingClients: 0,
            });
          }
          poolMetrics.get(key)!.idleConnections = parseInt(value);
        }
      }

      if (line.startsWith('tenant_connection_pool_waiting')) {
        const match = line.match(
          /tenant_connection_pool_waiting\{tenant_id="([^"]+)",tenant_name="([^"]+)",database_name="([^"]+)"\}\s+(\d+)/,
        );
        if (match) {
          const [, tenantId, tenantName, databaseName, value] = match;
          const key = `${tenantId}:${databaseName}`;
          if (!poolMetrics.has(key)) {
            poolMetrics.set(key, {
              tenantId,
              tenantName,
              databaseName,
              totalConnections: 0,
              idleConnections: 0,
              waitingClients: 0,
            });
          }
          poolMetrics.get(key)!.waitingClients = parseInt(value);
        }
      }

      // Parse HTTP metrics - total requests
      if (line.startsWith('http_requests_total')) {
        const routeMatch = line.match(
          /http_requests_total\{method="[^"]+",route="([^"]+)",status_code="([^"]+)"\}\s+(\d+)/,
        );
        if (routeMatch) {
          const [, route, statusCode, count] = routeMatch;
          const countNum = parseInt(count);
          totalRequests += countNum;

          // Track by route
          requestsByRoute.set(route, (requestsByRoute.get(route) || 0) + countNum);

          // Track by status
          requestsByStatus.set(statusCode, (requestsByStatus.get(statusCode) || 0) + countNum);
        }
      }

      // Parse histogram for average latency calculation
      if (line.startsWith('http_request_duration_seconds_sum')) {
        const match = line.match(/http_request_duration_seconds_sum.*\s+([\d.]+)/);
        if (match) {
          histogramSum += parseFloat(match[1]);
        }
      }

      if (line.startsWith('http_request_duration_seconds_count')) {
        const match = line.match(/http_request_duration_seconds_count.*\s+(\d+)/);
        if (match) {
          histogramCount += parseInt(match[1]);
        }
      }

      // Parse tenant metrics
      if (line.startsWith('tenants_total')) {
        const match = line.match(/tenants_total\s+(\d+)/);
        if (match) {
          totalTenantsCount = parseInt(match[1]);
        }
      }

      if (line.startsWith('tenants_by_status')) {
        const match = line.match(/tenants_by_status\{status="([^"]+)"\}\s+(\d+)/);
        if (match) {
          const [, status, count] = match;
          tenantStatus.set(status, parseInt(count));
        }
      }

      // Parse active users
      if (line.startsWith('tenant_active_users')) {
        const match = line.match(/tenant_active_users\{tenant_id="([^"]+)"\}\s+(\d+)/);
        if (match) {
          const [, tenantId, count] = match;
          activeUsers.set(tenantId, parseInt(count));
        }
      }

      // Parse system metrics
      if (line.startsWith('wellpulse_process_cpu_seconds_total')) {
        const match = line.match(/(\d+\.?\d*)/);
        if (match) {
          cpuUsage = parseFloat(match[1]);
        }
      }

      if (line.startsWith('wellpulse_nodejs_heap_size_used_bytes')) {
        const match = line.match(/(\d+)/);
        if (match) {
          memoryUsed = parseInt(match[1]);
        }
      }

      if (line.startsWith('wellpulse_nodejs_heap_size_total_bytes')) {
        const match = line.match(/(\d+)/);
        if (match) {
          memoryTotal = parseInt(match[1]);
        }
      }
    }

    // Calculate average latency from histogram (in milliseconds)
    const avgLatency = histogramCount > 0 ? (histogramSum / histogramCount) * 1000 : 0;

    // Calculate requests per minute
    let requestsPerMin = 0;
    const now = Date.now();
    if (previousRequestsRef.current) {
      const timeDiffMs = now - previousRequestsRef.current.timestamp;
      const requestsDiff = totalRequests - previousRequestsRef.current.count;
      if (timeDiffMs > 0) {
        requestsPerMin = (requestsDiff / timeDiffMs) * 60000; // Convert to per minute
      }
    }
    previousRequestsRef.current = { count: totalRequests, timestamp: now };

    console.log('📈 Final parsed metrics:', {
      connectionPools: poolMetrics.size,
      totalRequests,
      avgLatency: avgLatency.toFixed(2),
      requestsPerMin: requestsPerMin.toFixed(1),
      totalTenants: totalTenantsCount,
    });

    return {
      connectionPools: Array.from(poolMetrics.values()),
      httpMetrics: {
        totalRequests,
        avgLatency,
        requestsPerMin,
        requestsByRoute: Array.from(requestsByRoute.entries()).map(([route, count]) => ({
          route,
          count,
        })),
        requestsByStatus: Array.from(requestsByStatus.entries()).map(([status, count]) => ({
          status,
          count,
        })),
      },
      systemMetrics: {
        cpuUsage,
        memoryUsed,
        memoryTotal,
        gcDuration: 0,
        eventLoopLag: 0,
      },
      tenantMetrics: {
        total: totalTenantsCount,
        byStatus: Array.from(tenantStatus.entries()).map(([status, count]) => ({
          status,
          count,
        })),
        activeUsers: Array.from(activeUsers.entries()).map(([tenantId, count]) => ({
          tenantId,
          count,
        })),
      },
      timeSeriesData: [],
    };
  };

  if (loading && !metrics) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Metrics</h1>
          <p className="text-muted-foreground">
            Real-time monitoring of API performance and resource utilization
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground">
            {lastUpdate && <span>Last updated: {lastUpdate.toLocaleTimeString()}</span>}
          </div>
          <Button variant="outline" size="sm" onClick={() => setAutoRefresh(!autoRefresh)}>
            <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
          </Button>
          <Button variant="outline" size="sm" onClick={fetchMetrics}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Now
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {metrics && (
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">
              <GaugeIcon className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="http">
              <Activity className="h-4 w-4 mr-2" />
              HTTP Metrics
            </TabsTrigger>
            <TabsTrigger value="pools">
              <Database className="h-4 w-4 mr-2" />
              Connection Pools
            </TabsTrigger>
            <TabsTrigger value="system">
              <Cpu className="h-4 w-4 mr-2" />
              System Resources
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            {/* Top KPI Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
                  <Activity className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {metrics.httpMetrics.totalRequests.toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {metrics.httpMetrics.requestsPerMin > 0
                      ? `${metrics.httpMetrics.requestsPerMin.toFixed(1)} req/min`
                      : 'Calculating rate...'}
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Avg Latency</CardTitle>
                  <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {metrics.httpMetrics.avgLatency > 0
                      ? `${metrics.httpMetrics.avgLatency.toFixed(2)}ms`
                      : '0ms'}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Response time</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Total Tenants</CardTitle>
                  <Users className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics.tenantMetrics.total}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {metrics.tenantMetrics.byStatus.find((s) => s.status === 'ACTIVE')?.count || 0}{' '}
                    active
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
                  <MemoryStick className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {(
                      (metrics.systemMetrics.memoryUsed / metrics.systemMetrics.memoryTotal) *
                      100
                    ).toFixed(0)}
                    %
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {(metrics.systemMetrics.memoryUsed / 1024 / 1024).toFixed(0)} /{' '}
                    {(metrics.systemMetrics.memoryTotal / 1024 / 1024).toFixed(0)} MB
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Charts Row */}
            <div className="grid gap-4 md:grid-cols-2">
              {/* Request Trend */}
              {historicalData.length > 1 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Request Trend</CardTitle>
                    <CardDescription>Total requests over time</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={historicalData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="timestamp" tick={{ fontSize: 10 }} />
                        <YAxis />
                        <Tooltip />
                        <Line
                          type="monotone"
                          dataKey="requests"
                          stroke={CHART_COLORS[0]}
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Tenant Status Distribution */}
              {metrics.tenantMetrics.byStatus.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Tenant Status Distribution</CardTitle>
                    <CardDescription>Breakdown by tenant status</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={metrics.tenantMetrics.byStatus}
                          dataKey="count"
                          nameKey="status"
                          cx="50%"
                          cy="50%"
                          outerRadius={70}
                          label
                        >
                          {metrics.tenantMetrics.byStatus.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={CHART_COLORS[index % CHART_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Connection Pools Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Connection Pools Overview</CardTitle>
                <CardDescription>Database connection utilization</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
                  {metrics.connectionPools.slice(0, 8).map((pool) => {
                    const activeConnections = pool.totalConnections - pool.idleConnections;
                    const utilizationPercent =
                      pool.totalConnections > 0
                        ? Math.round((activeConnections / pool.totalConnections) * 100)
                        : 0;

                    return (
                      <div key={`${pool.tenantId}:${pool.databaseName}`} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium truncate">{pool.tenantName}</span>
                          <Badge
                            variant={utilizationPercent > 80 ? 'destructive' : 'default'}
                            className="text-xs"
                          >
                            {utilizationPercent}%
                          </Badge>
                        </div>
                        <div className="w-full bg-secondary rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              utilizationPercent > 80
                                ? 'bg-red-500'
                                : utilizationPercent > 60
                                  ? 'bg-yellow-500'
                                  : 'bg-green-500'
                            }`}
                            style={{ width: `${utilizationPercent}%` }}
                          />
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {activeConnections} / {pool.totalConnections} active
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Connection Pools Tab */}
          <TabsContent value="pools" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {metrics.connectionPools.map((pool) => {
                const activeConnections = pool.totalConnections - pool.idleConnections;
                const utilizationPercent =
                  pool.totalConnections > 0
                    ? Math.round((activeConnections / pool.totalConnections) * 100)
                    : 0;

                const status =
                  pool.waitingClients > 0
                    ? 'critical'
                    : utilizationPercent > 80
                      ? 'warning'
                      : 'healthy';

                return (
                  <Card key={`${pool.tenantId}:${pool.databaseName}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-medium">{pool.tenantName}</CardTitle>
                        <Badge
                          variant={
                            status === 'critical'
                              ? 'destructive'
                              : status === 'warning'
                                ? 'secondary'
                                : 'default'
                          }
                        >
                          {status.toUpperCase()}
                        </Badge>
                      </div>
                      <CardDescription className="text-xs">{pool.databaseName}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Total Connections</span>
                          <span className="font-medium">{pool.totalConnections}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Active</span>
                          <span className="font-medium text-green-600">{activeConnections}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Idle</span>
                          <span className="font-medium text-blue-600">{pool.idleConnections}</span>
                        </div>
                        {pool.waitingClients > 0 && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Waiting</span>
                            <span className="font-medium text-red-600">{pool.waitingClients}</span>
                          </div>
                        )}
                        <div className="pt-2">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span>Utilization</span>
                            <span>{utilizationPercent}%</span>
                          </div>
                          <div className="w-full bg-secondary rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                utilizationPercent > 80
                                  ? 'bg-red-500'
                                  : utilizationPercent > 60
                                    ? 'bg-yellow-500'
                                    : 'bg-green-500'
                              }`}
                              style={{ width: `${utilizationPercent}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {metrics.connectionPools.length === 0 && (
              <Card>
                <CardContent className="flex items-center justify-center h-32">
                  <p className="text-muted-foreground">No active connection pools</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* HTTP Metrics Tab */}
          <TabsContent value="http" className="space-y-4">
            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {metrics.httpMetrics.totalRequests.toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Since server start</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Avg Latency</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {metrics.httpMetrics.avgLatency > 0
                      ? `${metrics.httpMetrics.avgLatency.toFixed(2)}ms`
                      : '0ms'}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Average response time</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Requests/Min</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold flex items-center gap-2">
                    {metrics.httpMetrics.requestsPerMin > 0 ? (
                      <>
                        <TrendingUp className="h-6 w-6 text-green-500" />
                        {metrics.httpMetrics.requestsPerMin.toFixed(1)}
                      </>
                    ) : (
                      <span className="text-muted-foreground">Calculating...</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Real-time request rate</p>
                </CardContent>
              </Card>
            </div>

            {/* Request Trend Line Chart */}
            {historicalData.length > 1 && (
              <Card>
                <CardHeader>
                  <CardTitle>Request Trend (Last {historicalData.length} updates)</CardTitle>
                  <CardDescription>Total requests over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={historicalData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="timestamp"
                        tick={{ fontSize: 12 }}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                      />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="requests"
                        stroke={CHART_COLORS[0]}
                        strokeWidth={2}
                        name="Total Requests"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Latency Trend Line Chart */}
            {historicalData.length > 1 && (
              <Card>
                <CardHeader>
                  <CardTitle>Average Latency Trend</CardTitle>
                  <CardDescription>Response time over time (milliseconds)</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={historicalData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="timestamp"
                        tick={{ fontSize: 12 }}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                      />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="avgLatency"
                        stroke={CHART_COLORS[1]}
                        strokeWidth={2}
                        name="Avg Latency (ms)"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Requests by Route and Status */}
            <div className="grid gap-4 md:grid-cols-2">
              {/* Requests by Route */}
              {metrics.httpMetrics.requestsByRoute.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Requests by Route</CardTitle>
                    <CardDescription>Request distribution across endpoints</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={metrics.httpMetrics.requestsByRoute}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="route"
                          tick={{ fontSize: 10 }}
                          angle={-45}
                          textAnchor="end"
                          height={100}
                        />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="count" fill={CHART_COLORS[2]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Requests by Status Code */}
              {metrics.httpMetrics.requestsByStatus.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Requests by Status Code</CardTitle>
                    <CardDescription>HTTP response status distribution</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={metrics.httpMetrics.requestsByStatus}
                          dataKey="count"
                          nameKey="status"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label
                        >
                          {metrics.httpMetrics.requestsByStatus.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={CHART_COLORS[index % CHART_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* System Resources Tab */}
          <TabsContent value="system" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Cpu className="h-5 w-5" />
                    CPU Usage
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {metrics.systemMetrics.cpuUsage.toFixed(2)}s
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Total CPU time (user + system)
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MemoryStick className="h-5 w-5" />
                    Memory Usage
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {(metrics.systemMetrics.memoryUsed / 1024 / 1024).toFixed(0)} MB
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    of {(metrics.systemMetrics.memoryTotal / 1024 / 1024).toFixed(0)} MB total heap
                  </p>
                  <div className="w-full bg-secondary rounded-full h-2 mt-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all"
                      style={{
                        width: `${((metrics.systemMetrics.memoryUsed / metrics.systemMetrics.memoryTotal) * 100).toFixed(0)}%`,
                      }}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
