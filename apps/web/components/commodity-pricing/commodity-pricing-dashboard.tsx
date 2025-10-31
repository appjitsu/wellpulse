/**
 * Commodity Pricing Dashboard
 *
 * Displays real-time and historical commodity prices from EIA API.
 * Features:
 * - WTI Crude Oil spot prices ($/BBL)
 * - Henry Hub Natural Gas spot prices ($/MCF)
 * - 30-day historical price charts
 * - Trend indicators and daily change percentages
 * - Last sync timestamp
 * - Manual refresh capability
 *
 * Pattern References:
 * - Observer Pattern (daily price updates)
 * - Strategy Pattern (multiple data sources - EIA, backup sources)
 * - Repository Pattern (price data access)
 *
 * @see docs/sprints/sprint-5-implementation-spec.md:1934-2051
 */

'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  DollarSign,
  AlertTriangle,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useCommodityPrices } from '@/hooks/use-commodity-prices';

/**
 * Price data point for charting
 */
interface PricePoint {
  date: string;
  price: number;
}

/**
 * Commodity price with historical data
 * (Already defined in repository, but duplicated here for component use)
 */
export interface CommodityPrice {
  commodity: 'WTI_CRUDE_OIL' | 'HENRY_HUB_NATURAL_GAS';
  currentPrice: number;
  previousPrice: number;
  unit: string;
  change: number;
  changePercent: number;
  historical: PricePoint[];
  lastUpdated: string;
}

interface CommodityPricingDashboardProps {
  className?: string;
}

export function CommodityPricingDashboard({ className = '' }: CommodityPricingDashboardProps) {
  const { data: prices, isLoading, error, refetch, isRefetching } = useCommodityPrices();

  /**
   * Manual refresh
   */
  const handleRefresh = () => {
    refetch();
  };

  /**
   * Format price with currency
   */
  const formatPrice = (price: number, unit: string): string => {
    return `$${price.toFixed(2)} ${unit}`;
  };

  /**
   * Format date for chart
   */
  const formatChartDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  /**
   * Format timestamp as relative time
   */
  const formatTimestamp = (timestamp: string): string => {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffHours = Math.floor(diffMs / 3600000);

      if (diffHours < 1) return 'Less than 1 hour ago';
      if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;

      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } catch {
      return 'Unknown';
    }
  };

  /**
   * Get commodity display name
   */
  const getCommodityName = (commodity: string): string => {
    switch (commodity) {
      case 'WTI_CRUDE_OIL':
        return 'WTI Crude Oil';
      case 'HENRY_HUB_NATURAL_GAS':
        return 'Henry Hub Natural Gas';
      default:
        return commodity;
    }
  };

  /**
   * Get trend badge
   */
  const getTrendBadge = (changePercent: number) => {
    const isPositive = changePercent >= 0;
    const icon = isPositive ? (
      <TrendingUp className="w-3 h-3" />
    ) : (
      <TrendingDown className="w-3 h-3" />
    );

    return (
      <Badge
        variant={isPositive ? 'default' : 'destructive'}
        className={isPositive ? 'bg-green-500' : ''}
      >
        {icon}
        <span className="ml-1">
          {isPositive ? '+' : ''}
          {changePercent.toFixed(2)}%
        </span>
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center py-12 ${className}`}>
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-3 text-slate-600">Loading commodity prices...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className={className}>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Failed to load commodity prices. Please check your EIA API configuration and try again.
        </AlertDescription>
      </Alert>
    );
  }

  if (!prices || prices.length === 0) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-4">
          <DollarSign className="w-8 h-8 text-slate-400" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">No Pricing Data Available</h3>
        <p className="text-slate-600 mb-6 max-w-md mx-auto">
          Configure EIA API key in settings to enable real-time commodity price tracking.
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Commodity Prices</h2>
          <p className="text-sm text-slate-600 mt-1">
            Real-time market prices from U.S. Energy Information Administration (EIA)
          </p>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={isRefetching}>
          {isRefetching ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Refreshing...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </>
          )}
        </Button>
      </div>

      {/* Commodity Price Cards */}
      {prices.map((commodity) => (
        <Card key={commodity.commodity}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-green-600" />
                  {getCommodityName(commodity.commodity)}
                </CardTitle>
                <CardDescription>
                  Last updated {formatTimestamp(commodity.lastUpdated)}
                </CardDescription>
              </div>
              {getTrendBadge(commodity.changePercent)}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Current Price Display */}
              <div className="flex items-baseline justify-between border-b pb-4">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Current Price</p>
                  <p className="text-4xl font-bold text-slate-900">
                    {formatPrice(commodity.currentPrice, commodity.unit)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-600 mb-1">Daily Change</p>
                  <p
                    className={`text-2xl font-semibold ${
                      commodity.change >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {commodity.change >= 0 ? '+' : ''}
                    {formatPrice(commodity.change, commodity.unit)}
                  </p>
                </div>
              </div>

              {/* 30-Day Historical Chart */}
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-3">30-Day Price History</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={commodity.historical}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatChartDate}
                      stroke="#64748b"
                      style={{ fontSize: 12 }}
                    />
                    <YAxis
                      domain={['dataMin - 5', 'dataMax + 5']}
                      stroke="#64748b"
                      style={{ fontSize: 12 }}
                      tickFormatter={(value) => `$${value.toFixed(0)}`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        padding: '8px 12px',
                      }}
                      labelFormatter={(label) => `Date: ${formatChartDate(label)}`}
                      formatter={(value: number) => [formatPrice(value, commodity.unit), 'Price']}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="price"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={{ fill: '#3b82f6', r: 3 }}
                      activeDot={{ r: 5 }}
                      name="Price"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Price Statistics */}
              <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                <div>
                  <p className="text-xs text-slate-600 mb-1">30-Day High</p>
                  <p className="text-lg font-semibold text-slate-900">
                    {formatPrice(
                      Math.max(...commodity.historical.map((p) => p.price)),
                      commodity.unit,
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-600 mb-1">30-Day Low</p>
                  <p className="text-lg font-semibold text-slate-900">
                    {formatPrice(
                      Math.min(...commodity.historical.map((p) => p.price)),
                      commodity.unit,
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-600 mb-1">30-Day Average</p>
                  <p className="text-lg font-semibold text-slate-900">
                    {formatPrice(
                      commodity.historical.reduce((sum, p) => sum + p.price, 0) /
                        commodity.historical.length,
                      commodity.unit,
                    )}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
