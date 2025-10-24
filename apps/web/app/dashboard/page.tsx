/**
 * Dashboard Page
 *
 * Protected dashboard page (requires authentication).
 * Placeholder for now - will be implemented in future sprints.
 */

'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { authApi } from '@/lib/api/auth.api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

export default function DashboardPage() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await authApi.logout();
      logout();
      toast.success('Logged out successfully');
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
      // Still logout locally even if API call fails
      logout();
      router.push('/login');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <Button onClick={handleLogout} variant="outline">
            Sign Out
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Welcome to WellPulse</CardTitle>
            <CardDescription>You are successfully authenticated</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-500">User Info</p>
              <div className="mt-2 space-y-1">
                <p>
                  <span className="font-medium">Name:</span> {user?.name}
                </p>
                <p>
                  <span className="font-medium">Email:</span> {user?.email}
                </p>
                <p>
                  <span className="font-medium">Role:</span> {user?.role}
                </p>
              </div>
            </div>

            <div className="rounded-lg bg-blue-50 p-4">
              <p className="text-sm text-blue-800">
                This is a protected route. You can only see this page because you are authenticated.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
