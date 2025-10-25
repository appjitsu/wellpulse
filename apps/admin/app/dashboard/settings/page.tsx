/**
 * Settings Page
 *
 * Admin portal configuration and settings.
 */

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Bell, Shield, Database, Mail } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="space-y-6 p-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage admin portal configuration</p>
      </div>

      {/* Settings Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Notifications */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Notifications</CardTitle>
            </div>
            <CardDescription>Configure alert and notification preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Email Alerts</p>
                <p className="text-xs text-muted-foreground">Receive critical system alerts</p>
              </div>
              <input type="checkbox" className="h-4 w-4" defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Performance Alerts</p>
                <p className="text-xs text-muted-foreground">Get notified of performance issues</p>
              </div>
              <input type="checkbox" className="h-4 w-4" defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Tenant Activity</p>
                <p className="text-xs text-muted-foreground">Updates on tenant activities</p>
              </div>
              <input type="checkbox" className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>

        {/* Security */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Security</CardTitle>
            </div>
            <CardDescription>Security and access control settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium">Session Timeout</p>
              <p className="text-xs text-muted-foreground mb-2">Auto logout after inactivity</p>
              <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option>30 minutes</option>
                <option>1 hour</option>
                <option>4 hours</option>
                <option>8 hours</option>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Two-Factor Authentication</p>
                <p className="text-xs text-muted-foreground">Require 2FA for admin access</p>
              </div>
              <input type="checkbox" className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>

        {/* Database */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Database</CardTitle>
            </div>
            <CardDescription>Database configuration and maintenance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium">Connection Pool Size</p>
              <p className="text-xs text-muted-foreground mb-2">Max connections per tenant</p>
              <input
                type="number"
                defaultValue={10}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <p className="text-sm font-medium">Backup Schedule</p>
              <p className="text-xs text-muted-foreground mb-2">Automated backup frequency</p>
              <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option>Every 6 hours</option>
                <option>Every 12 hours</option>
                <option>Daily</option>
                <option>Weekly</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Email */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Email</CardTitle>
            </div>
            <CardDescription>SMTP and email delivery configuration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium">SMTP Server</p>
              <p className="text-xs text-muted-foreground mb-2">Current: Mailpit (Development)</p>
              <input
                type="text"
                defaultValue="localhost:8025"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                disabled
              />
            </div>
            <div>
              <p className="text-sm font-medium">From Address</p>
              <p className="text-xs text-muted-foreground mb-2">Default sender email</p>
              <input
                type="email"
                defaultValue="noreply@wellpulse.app"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Coming Soon */}
      <Card>
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
          <CardDescription>Additional settings and configuration options</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• Rate limiting configuration</li>
            <li>• API key management</li>
            <li>• Audit log settings</li>
            <li>• Integration webhooks</li>
            <li>• Theme customization</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
