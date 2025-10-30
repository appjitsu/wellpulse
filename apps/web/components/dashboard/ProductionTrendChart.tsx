/**
 * ProductionTrendChart Component
 *
 * Displays a line chart showing production over time (last 30 days).
 * Uses a simple CSS-based chart since no charting library is installed.
 */

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Loader2, AlertTriangle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

interface ProductionDataPoint {
  date: string;
  production: number;
  target?: number;
}

interface ProductionTrendResponse {
  data: ProductionDataPoint[];
  summary: {
    avgProduction: number;
    trend: 'up' | 'down' | 'neutral';
    trendPercentage: number;
  };
}

/**
 * Fetch production trend data
 */
async function fetchProductionTrend(days: number = 30): Promise<ProductionTrendResponse> {
  const response = await apiClient.get<ProductionTrendResponse>('/production/trend', {
    params: { days },
  });
  return response.data;
}

export function ProductionTrendChart() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['production', 'trend', 30],
    queryFn: () => fetchProductionTrend(30),
    staleTime: 60000, // 1 minute
    retry: false,
  });

  // Show loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Production Trend</CardTitle>
          <CardDescription>Last 30 days of oil production (bbl/day)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-2 text-gray-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Loading chart...</span>
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
            Error Loading Chart
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-700">Failed to load production data. Please try again.</p>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Production Trend</CardTitle>
          <CardDescription>Last 30 days of oil production (bbl/day)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-gray-500">
            No production data available for the selected period
          </div>
        </CardContent>
      </Card>
    );
  }

  const { data: chartData, summary } = data;

  // Calculate chart dimensions
  const maxProduction = Math.max(...chartData.map((d) => d.production));
  const minProduction = Math.min(...chartData.map((d) => d.production));
  const range = maxProduction - minProduction;

  // Generate SVG path for the line
  const width = 100; // percentage
  const height = 200; // pixels
  const points = chartData.map((d, i) => {
    const x = (i / (chartData.length - 1)) * width;
    const y = height - ((d.production - minProduction) / range) * height;
    return `${x},${y}`;
  });
  const pathData = `M ${points.join(' L ')}`;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Production Trend</CardTitle>
            <CardDescription>Last 30 days of oil production (bbl/day)</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={summary.trend === 'up' ? 'default' : 'destructive'}>
              {summary.trend === 'up' ? (
                <TrendingUp className="h-3 w-3 mr-1" />
              ) : (
                <TrendingDown className="h-3 w-3 mr-1" />
              )}
              {summary.trendPercentage > 0 ? '+' : ''}
              {summary.trendPercentage.toFixed(1)}%
            </Badge>
            <div className="text-right">
              <p className="text-sm text-gray-500">Avg Production</p>
              <p className="text-lg font-bold">{Math.round(summary.avgProduction)} bbl/day</p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative w-full" style={{ height: `${height}px` }}>
          <svg
            className="w-full h-full"
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="none"
          >
            {/* Grid lines */}
            {[0, 25, 50, 75, 100].map((percent) => (
              <line
                key={percent}
                x1="0"
                y1={(percent / 100) * height}
                x2={width}
                y2={(percent / 100) * height}
                stroke="#e5e7eb"
                strokeWidth="0.5"
              />
            ))}

            {/* Area fill */}
            <path
              d={`${pathData} L ${width},${height} L 0,${height} Z`}
              fill="url(#gradient)"
              opacity="0.2"
            />

            {/* Line */}
            <path d={pathData} fill="none" stroke="#3b82f6" strokeWidth="2" />

            {/* Gradient definition */}
            <defs>
              <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>

          {/* Y-axis labels */}
          <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-gray-500 pr-2">
            <span>{Math.round(maxProduction)}</span>
            <span>{Math.round(minProduction + range * 0.75)}</span>
            <span>{Math.round(minProduction + range * 0.5)}</span>
            <span>{Math.round(minProduction + range * 0.25)}</span>
            <span>{Math.round(minProduction)}</span>
          </div>
        </div>

        {/* X-axis labels */}
        <div className="mt-4 flex justify-between text-xs text-gray-500">
          <span>
            {new Date(chartData[0].date).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })}
          </span>
          <span>
            {new Date(chartData[Math.floor(chartData.length / 2)].date).toLocaleDateString(
              'en-US',
              {
                month: 'short',
                day: 'numeric',
              },
            )}
          </span>
          <span>
            {new Date(chartData[chartData.length - 1].date).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })}
          </span>
        </div>

        {/* Legend */}
        <div className="mt-6 flex items-center justify-center gap-6">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-blue-500" />
            <span className="text-sm text-gray-600">Oil Production (bbl/day)</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
