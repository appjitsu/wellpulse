/**
 * Team Page
 *
 * Team member management and permissions
 */

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Users, Mail, Shield, UserPlus, MoreVertical, AlertCircle, Loader2 } from 'lucide-react';
import { useUsers } from '@/hooks/use-users';

/**
 * Generate initials from a name
 * Example: "John Doe" -> "JD"
 */
function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Format last login time to human-readable format
 * Example: "5 min ago", "2 hours ago", "3 days ago"
 */
function formatLastActive(lastLoginAt: Date | null): string {
  if (!lastLoginAt) {
    return 'Never';
  }

  const now = new Date();
  const lastLogin = new Date(lastLoginAt);
  const diffMs = now.getTime() - lastLogin.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) {
    return 'Just now';
  } else if (diffMins < 60) {
    return `${diffMins} min ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  } else {
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  }
}

const roleColors: Record<string, string> = {
  ADMIN: 'bg-purple-100 text-purple-700 border-purple-300',
  MANAGER: 'bg-blue-100 text-blue-700 border-blue-300',
  OPERATOR: 'bg-green-100 text-green-700 border-green-300',
};

const roleDescriptions: Record<string, string> = {
  ADMIN: 'Full system access and user management',
  MANAGER: 'View and manage wells, production, and reports',
  OPERATOR: 'View wells and enter field data',
};

export default function TeamPage() {
  const { data, isLoading, error } = useUsers({ status: 'ACTIVE' });

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Team</h1>
            <p className="text-gray-500">Manage team members and permissions</p>
          </div>
        </div>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Team</h1>
            <p className="text-gray-500">Manage team members and permissions</p>
          </div>
        </div>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <div>
                <p className="font-medium text-red-900">Failed to load team members</p>
                <p className="text-sm text-red-700">
                  {error instanceof Error ? error.message : 'An error occurred'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const teamMembers = data?.users || [];

  // Empty state
  if (teamMembers.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Team</h1>
            <p className="text-gray-500">Manage team members and permissions</p>
          </div>
          <Button>
            <UserPlus className="mr-2 h-4 w-4" />
            Invite Member
          </Button>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20">
            <Users className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No team members yet</h3>
            <p className="text-sm text-gray-500 mb-6">
              Get started by inviting your first team member
            </p>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Invite Member
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Calculate role counts
  const adminCount = teamMembers.filter((m) => m.role === 'ADMIN').length;
  const operatorCount = teamMembers.filter((m) => m.role === 'OPERATOR').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Team</h1>
          <p className="text-gray-500">Manage team members and permissions</p>
        </div>
        <Button>
          <UserPlus className="mr-2 h-4 w-4" />
          Invite Member
        </Button>
      </div>

      {/* Team Overview */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Members</CardTitle>
            <Users className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{teamMembers.length}</div>
            <p className="text-xs text-gray-500 mt-1">Active users</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Administrators</CardTitle>
            <Shield className="h-5 w-5 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{adminCount}</div>
            <p className="text-xs text-gray-500 mt-1">With full access</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Field Operators</CardTitle>
            <Users className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{operatorCount}</div>
            <p className="text-xs text-gray-500 mt-1">Active in field</p>
          </CardContent>
        </Card>
      </div>

      {/* Team Members List */}
      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>View and manage your team</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {teamMembers.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between rounded-lg border p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-blue-600 text-white font-semibold">
                      {getInitials(member.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{member.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="flex items-center gap-1 text-sm text-gray-600">
                        <Mail className="h-3 w-3" />
                        {member.email}
                      </span>
                      <span className="text-sm text-gray-400">•</span>
                      <span className="text-sm text-gray-500">
                        Active {formatLastActive(member.lastLoginAt)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <Badge className={roleColors[member.role]}>{member.role}</Badge>
                    <p className="text-xs text-gray-500 mt-1">{roleDescriptions[member.role]}</p>
                  </div>
                  <Button size="icon" variant="ghost">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Role Permissions */}
      <Card>
        <CardHeader>
          <CardTitle>Role Permissions</CardTitle>
          <CardDescription>Permission levels for each role</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(roleDescriptions).map(([role, description]) => (
              <div key={role} className="flex items-start gap-4 rounded-lg border p-4">
                <Shield className="h-5 w-5 text-gray-600 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Badge className={roleColors[role]}>{role}</Badge>
                    <span className="text-sm text-gray-600">{description}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
