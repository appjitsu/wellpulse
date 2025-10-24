/**
 * Admin Dashboard
 *
 * Main dashboard for WellPulse internal staff.
 * Shows tenant management, system status, and admin tools.
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { authApi } from '@/lib/api/auth.api';

export default function AdminDashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, router]);

  const handleLogout = async () => {
    try {
      await authApi.logout();
      logout();
      router.push('/');
    } catch (error) {
      console.error('Logout error:', error);
      // Logout locally even if API call fails
      logout();
      router.push('/');
    }
  };

  if (!isAuthenticated || !user) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">
              WellPulse Admin
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Internal Administration Portal
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-50">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400">{user.role}</p>
            </div>
            <button
              onClick={handleLogout}
              className="rounded-md bg-slate-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Welcome Message */}
        <div className="mb-8 rounded-lg border border-blue-200 bg-blue-50 p-6 dark:border-blue-900/50 dark:bg-blue-900/20">
          <h2 className="mb-2 text-xl font-semibold text-blue-900 dark:text-blue-100">
            Welcome back, {user.firstName}!
          </h2>
          <p className="text-sm text-blue-700 dark:text-blue-300">
            You&apos;re logged in as an admin. This is the WellPulse internal administration portal.
          </p>
        </div>

        {/* Admin Tools Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Tenant Management */}
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-50">
              Tenant Management
            </h3>
            <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
              Create, manage, and monitor customer tenants
            </p>
            <button
              className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50"
              disabled
            >
              Coming Soon
            </button>
          </div>

          {/* System Status */}
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-50">
              System Status
            </h3>
            <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
              Monitor platform health and performance
            </p>
            <button
              className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50"
              disabled
            >
              Coming Soon
            </button>
          </div>

          {/* Billing & Analytics */}
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-50">
              Billing & Analytics
            </h3>
            <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
              View revenue, subscriptions, and usage metrics
            </p>
            <button
              className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50"
              disabled
            >
              Coming Soon
            </button>
          </div>
        </div>

        {/* Quick Links */}
        <div className="mt-8 rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-50">
            Quick Links
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <a
              href={`${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '')}/api/docs`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-500 hover:underline dark:text-blue-400"
            >
              API Documentation →
            </a>
            <a
              href={process.env.NEXT_PUBLIC_CLIENT_URL || 'http://localhost:4001'}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-500 hover:underline dark:text-blue-400"
            >
              Client Portal →
            </a>
            <a
              href="http://localhost:8025"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-500 hover:underline dark:text-blue-400"
            >
              Mailpit (Email Testing) →
            </a>
            <a
              href={`${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '')}/api/health`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-500 hover:underline dark:text-blue-400"
            >
              API Health Check →
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
