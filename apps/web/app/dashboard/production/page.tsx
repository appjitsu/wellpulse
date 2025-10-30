/**
 * Production Page
 *
 * Production analytics and reporting
 */

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrendingUp, BarChart3, Download, Calendar, Loader2, AlertTriangle } from 'lucide-react';
import { useMonthlyTrend, useWellTypeBreakdown } from '@/hooks/use-production';

export default function ProductionPage() {
  const { data: trendData, isLoading: trendLoading, error: trendError } = useMonthlyTrend();
  const {
    data: breakdownData,
    isLoading: breakdownLoading,
    error: breakdownError,
  } = useWellTypeBreakdown();

  const isLoading = trendLoading || breakdownLoading;
  const hasError = trendError || breakdownError;

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-2 text-gray-500">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading production analytics...</span>
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
            Error Loading Production Data
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-700">Failed to load production analytics. Please try again.</p>
        </CardContent>
      </Card>
    );
  }

  const monthlyData = trendData?.monthlyTrend || [];
  const currentMonth = monthlyData[monthlyData.length - 1];
  const previousMonth = monthlyData[monthlyData.length - 2];
  const trend =
    currentMonth && previousMonth
      ? ((currentMonth.production - previousMonth.production) / previousMonth.production) * 100
      : 0;

  const wellTypeBreakdown = breakdownData?.wellTypeBreakdown || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Production Analytics</h1>
          <p className="text-gray-500">Monitor production metrics and trends</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Calendar className="mr-2 h-4 w-4" />
            Date Range
          </Button>
          <Button>
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      {currentMonth && (
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Current Month</CardTitle>
              <BarChart3 className="h-5 w-5 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{currentMonth.production.toLocaleString()}</div>
              <p className="text-xs text-gray-500 mt-1">barrels</p>
              <div className="mt-3 flex items-center gap-2">
                <Badge variant="default" className="gap-1">
                  <TrendingUp className="h-3 w-3" />+{trend.toFixed(1)}%
                </Badge>
                <span className="text-xs text-gray-500">vs last month</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Target Achievement
              </CardTitle>
              <TrendingUp className="h-5 w-5 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{currentMonth.efficiency.toFixed(1)}%</div>
              <p className="text-xs text-gray-500 mt-1">of monthly target</p>
              <div className="mt-3">
                <div className="h-2 rounded-full bg-gray-200">
                  <div
                    className="h-full rounded-full bg-green-500"
                    style={{ width: `${Math.min(currentMonth.efficiency, 100)}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Average Daily</CardTitle>
              <BarChart3 className="h-5 w-5 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {Math.round(currentMonth.production / 30).toLocaleString()}
              </div>
              <p className="text-xs text-gray-500 mt-1">bbl/day</p>
              <div className="mt-3 flex items-center gap-2">
                <Badge variant="secondary">{currentMonth.month} Average</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Monthly Trend */}
      {monthlyData.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>6-Month Production Trend</CardTitle>
            <CardDescription>Monthly production vs targets</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {monthlyData.map((month) => (
                <div key={month.month} className="flex items-center gap-4">
                  <div className="w-16 font-medium">{month.month}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="h-8 rounded-lg bg-gray-200 relative overflow-hidden">
                          <div
                            className="h-full bg-blue-500"
                            style={{ width: `${(month.production / 40000) * 100}%` }}
                          />
                          <div
                            className="absolute top-0 h-full border-r-2 border-dashed border-gray-400"
                            style={{ left: `${(month.target / 40000) * 100}%` }}
                          />
                        </div>
                      </div>
                      <div className="w-24 text-right font-bold">
                        {month.production.toLocaleString()}
                      </div>
                      <div className="w-16 text-right">
                        <Badge variant={month.efficiency >= 100 ? 'default' : 'secondary'}>
                          {month.efficiency.toFixed(1)}%
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 flex items-center gap-6 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded bg-blue-500" />
                <span>Actual Production</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 border-r-2 border-dashed border-gray-400" />
                <span>Target</span>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>6-Month Production Trend</CardTitle>
            <CardDescription>Monthly production vs targets</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-gray-500">No production trend data available</div>
          </CardContent>
        </Card>
      )}

      {/* Well Type Breakdown */}
      {wellTypeBreakdown.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Production by Well Type</CardTitle>
            <CardDescription>Breakdown by drilling method</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {wellTypeBreakdown.map((type) => (
                <div key={type.type} className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-32 font-medium">{type.type}</div>
                    <Badge variant="outline">{type.wells} wells</Badge>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-48">
                      <div className="h-6 rounded-full bg-gray-200 relative overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-600"
                          style={{ width: `${type.percentage}%` }}
                        />
                      </div>
                    </div>
                    <div className="w-32 text-right">
                      <span className="text-xl font-bold">{type.production.toLocaleString()}</span>
                      <span className="text-sm text-gray-500 ml-1">bbl</span>
                    </div>
                    <div className="w-16 text-right font-medium text-gray-600">
                      {type.percentage}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Production by Well Type</CardTitle>
            <CardDescription>Breakdown by drilling method</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-gray-500">
              Well type breakdown coming soon
              <p className="text-sm mt-2">
                This feature requires well type classification in the database
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
