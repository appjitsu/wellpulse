/**
 * Reports Page
 *
 * Generate and download production and compliance reports
 */

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Download, Calendar, Clock, CheckCircle2 } from 'lucide-react';

// Mock report data
const recentReports = [
  {
    id: 1,
    name: 'Monthly Production Report - September 2025',
    type: 'Production',
    date: '2025-10-01',
    size: '2.4 MB',
    status: 'completed',
  },
  {
    id: 2,
    name: 'Regulatory Compliance Report - Q3 2025',
    type: 'Compliance',
    date: '2025-10-01',
    size: '1.8 MB',
    status: 'completed',
  },
  {
    id: 3,
    name: 'Well Performance Analysis - August 2025',
    type: 'Analysis',
    date: '2025-09-15',
    size: '3.1 MB',
    status: 'completed',
  },
  {
    id: 4,
    name: 'Maintenance Summary - Q3 2025',
    type: 'Maintenance',
    date: '2025-09-30',
    size: '1.2 MB',
    status: 'completed',
  },
];

const reportTemplates = [
  {
    name: 'Daily Production Report',
    description: 'Daily summary of production across all wells',
    category: 'Production',
    schedule: 'Daily',
  },
  {
    name: 'Weekly Performance Summary',
    description: 'Weekly performance metrics and trends',
    category: 'Performance',
    schedule: 'Weekly',
  },
  {
    name: 'Monthly Compliance Report',
    description: 'Environmental and regulatory compliance metrics',
    category: 'Compliance',
    schedule: 'Monthly',
  },
  {
    name: 'Quarterly Financial Report',
    description: 'Production revenue and operational costs',
    category: 'Financial',
    schedule: 'Quarterly',
  },
  {
    name: 'Annual Reserves Report',
    description: 'Proven reserves and production forecasts',
    category: 'Reserves',
    schedule: 'Annual',
  },
  {
    name: 'Equipment Maintenance Log',
    description: 'Maintenance history and upcoming schedules',
    category: 'Maintenance',
    schedule: 'On-demand',
  },
];

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Reports</h1>
        <p className="text-gray-500">Generate and download production and compliance reports</p>
      </div>

      {/* Recent Reports */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Reports</CardTitle>
          <CardDescription>Your recently generated reports</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentReports.map((report) => (
              <div
                key={report.id}
                className="flex items-center justify-between rounded-lg border p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                    <FileText className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium">{report.name}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <Badge variant="outline">{report.type}</Badge>
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <Calendar className="h-3 w-3" />
                        {report.date}
                      </span>
                      <span className="text-xs text-gray-500">{report.size}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="default" className="gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Ready
                  </Badge>
                  <Button size="sm" variant="outline">
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Report Templates */}
      <div>
        <h2 className="text-xl font-bold mb-4">Generate New Report</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {reportTemplates.map((template) => (
            <Card key={template.name} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <FileText className="h-8 w-8 text-blue-600" />
                  <Badge variant="outline">{template.category}</Badge>
                </div>
                <CardTitle className="text-lg mt-3">{template.name}</CardTitle>
                <CardDescription>{template.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Clock className="h-4 w-4" />
                  Schedule: {template.schedule}
                </div>
                <Button className="w-full">Generate Report</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
