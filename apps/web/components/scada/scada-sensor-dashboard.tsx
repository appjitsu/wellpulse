/**
 * Real-Time SCADA Sensor Dashboard
 *
 * Displays live sensor readings from all connected SCADA systems.
 * Features:
 * - Real-time sensor value updates (auto-refresh every 30 seconds)
 * - Status indicators (normal, warning, critical, offline)
 * - Trend indicators (↑ increasing, ↓ decreasing, → stable)
 * - Grouped by measurement type (pressure, temperature, flow, etc.)
 * - Alert badges for out-of-range values
 * - Last update timestamp
 *
 * Pattern References:
 * - Observer Pattern (real-time data updates)
 * - Polling Pattern (periodic refresh)
 * - Specification Pattern (alert conditions)
 *
 * @see docs/sprints/sprint-5-implementation-spec.md:1791-1932
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
  Gauge,
  Thermometer,
  Droplets,
  Activity,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useScadaSensorData } from '@/hooks/use-scada-sensor-data';
import { MEASUREMENT_TYPES } from './tag-mapping-dialog';

/**
 * Sensor reading with real-time value
 */
export interface SensorReading {
  id: string;
  connectionId: string;
  connectionName: string;
  wellId: string;
  wellName: string;
  tagNodeId: string;
  tagDisplayName: string;
  measurementType: string;
  currentValue: number;
  previousValue?: number;
  unit: string;
  minValue: number | null;
  maxValue: number | null;
  timestamp: string;
  status: 'normal' | 'warning' | 'critical' | 'offline';
}

/**
 * Sensor grouping by measurement type
 */
interface SensorGroup {
  type: string;
  label: string;
  icon: React.ReactNode;
  sensors: SensorReading[];
}

interface ScadaSensorDashboardProps {
  className?: string;
}

export function ScadaSensorDashboard({ className = '' }: ScadaSensorDashboardProps) {
  const { data: sensors, isLoading, error, refetch } = useScadaSensorData();
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  /**
   * Auto-refresh every 30 seconds
   */
  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
      setLastRefresh(new Date());
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [refetch]);

  /**
   * Manual refresh
   */
  const handleRefresh = () => {
    refetch();
    setLastRefresh(new Date());
  };

  /**
   * Group sensors by measurement type
   */
  const groupedSensors = (sensors || []).reduce<SensorGroup[]>((groups, sensor) => {
    let group = groups.find((g) => g.type === sensor.measurementType);

    if (!group) {
      const measurementConfig = MEASUREMENT_TYPES.find((t) => t.value === sensor.measurementType);

      group = {
        type: sensor.measurementType,
        label: measurementConfig?.label || sensor.measurementType,
        icon: getMeasurementIcon(sensor.measurementType),
        sensors: [],
      };
      groups.push(group);
    }

    group.sensors.push(sensor);
    return groups;
  }, []);

  /**
   * Get status badge color
   */
  const getStatusBadge = (status: SensorReading['status']) => {
    const variants = {
      normal: { variant: 'default' as const, label: 'Normal', className: 'bg-green-500' },
      warning: {
        variant: 'secondary' as const,
        label: 'Warning',
        className: 'bg-yellow-500 text-white',
      },
      critical: { variant: 'destructive' as const, label: 'Critical', className: '' },
      offline: { variant: 'outline' as const, label: 'Offline', className: 'text-slate-500' },
    };

    const config = variants[status] || variants.offline;

    return (
      <Badge variant={config.variant} className={config.className}>
        {config.label}
      </Badge>
    );
  };

  /**
   * Get trend indicator
   */
  const getTrendIndicator = (sensor: SensorReading) => {
    if (!sensor.previousValue || sensor.previousValue === sensor.currentValue) {
      return <Minus className="w-4 h-4 text-slate-400" aria-label="Stable" />;
    }

    if (sensor.currentValue > sensor.previousValue) {
      return <TrendingUp className="w-4 h-4 text-green-600" aria-label="Increasing" />;
    }

    return <TrendingDown className="w-4 h-4 text-red-600" aria-label="Decreasing" />;
  };

  /**
   * Format timestamp as relative time
   */
  const formatTimestamp = (timestamp: string): string => {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffSecs = Math.floor(diffMs / 1000);

      if (diffSecs < 60) return `${diffSecs}s ago`;
      if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m ago`;
      if (diffSecs < 86400) return `${Math.floor(diffSecs / 3600)}h ago`;
      return `${Math.floor(diffSecs / 86400)}d ago`;
    } catch {
      return 'Unknown';
    }
  };

  /**
   * Format value with proper precision
   */
  const formatValue = (value: number): string => {
    if (Math.abs(value) >= 1000) {
      return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
    }
    if (Math.abs(value) >= 10) {
      return value.toLocaleString('en-US', { maximumFractionDigits: 1 });
    }
    return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
  };

  /**
   * Check if value is out of range
   */
  const isOutOfRange = (sensor: SensorReading): boolean => {
    if (sensor.minValue !== null && sensor.currentValue < sensor.minValue) return true;
    if (sensor.maxValue !== null && sensor.currentValue > sensor.maxValue) return true;
    return false;
  };

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center py-12 ${className}`}>
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-3 text-slate-600">Loading sensor data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className={className}>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Failed to load sensor data. Please check your SCADA connections and try again.
        </AlertDescription>
      </Alert>
    );
  }

  if (!sensors || sensors.length === 0) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-4">
          <Activity className="w-8 h-8 text-slate-400" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">No Sensor Data Available</h3>
        <p className="text-slate-600 mb-6 max-w-md mx-auto">
          Configure tag mappings in your SCADA connections to start receiving real-time sensor data.
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Live Sensor Data</h2>
          <p className="text-sm text-slate-600 mt-1">
            {sensors.length} active sensor{sensors.length !== 1 ? 's' : ''} • Last updated{' '}
            {formatTimestamp(lastRefresh.toISOString())}
          </p>
        </div>
        <Button variant="outline" onClick={handleRefresh}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Grouped Sensor Cards */}
      {groupedSensors.map((group) => (
        <Card key={group.type}>
          <CardHeader>
            <div className="flex items-center gap-2">
              {group.icon}
              <div>
                <CardTitle>{group.label}</CardTitle>
                <CardDescription>
                  {group.sensors.length} sensor{group.sensors.length !== 1 ? 's' : ''}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {group.sensors.map((sensor) => (
                <div
                  key={sensor.id}
                  className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                    isOutOfRange(sensor)
                      ? 'bg-red-50 border-red-200'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {/* Sensor Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-slate-900 truncate">
                        {sensor.tagDisplayName}
                      </h4>
                      {getTrendIndicator(sensor)}
                    </div>
                    <p className="text-sm text-slate-600 mb-1">
                      {sensor.wellName} • {sensor.connectionName}
                    </p>
                    <p className="text-xs text-slate-500">{formatTimestamp(sensor.timestamp)}</p>
                  </div>

                  {/* Current Value */}
                  <div className="text-center px-6">
                    <div className="text-3xl font-bold text-slate-900 mb-1">
                      {formatValue(sensor.currentValue)}
                    </div>
                    <div className="text-sm text-slate-600">{sensor.unit}</div>
                  </div>

                  {/* Status & Alerts */}
                  <div className="flex flex-col items-end gap-2">
                    {getStatusBadge(sensor.status)}
                    {isOutOfRange(sensor) && (
                      <div className="flex items-center gap-1 text-xs text-red-600">
                        <AlertTriangle className="w-3 h-3" />
                        Out of range
                      </div>
                    )}
                    {sensor.minValue !== null || sensor.maxValue !== null ? (
                      <div className="text-xs text-slate-500">
                        Range: {sensor.minValue ?? '−∞'} to {sensor.maxValue ?? '+∞'}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/**
 * Get icon for measurement type
 */
function getMeasurementIcon(measurementType: string): React.ReactNode {
  switch (measurementType) {
    case 'pressure':
      return <Gauge className="w-5 h-5 text-blue-600" />;
    case 'temperature':
      return <Thermometer className="w-5 h-5 text-orange-600" />;
    case 'oil_volume':
    case 'gas_volume':
    case 'water_volume':
      return <Droplets className="w-5 h-5 text-cyan-600" />;
    case 'flow_rate':
      return <Activity className="w-5 h-5 text-green-600" />;
    default:
      return <Activity className="w-5 h-5 text-slate-600" />;
  }
}
