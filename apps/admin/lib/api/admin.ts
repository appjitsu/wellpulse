/**
 * Admin API Client
 *
 * Functions for managing users and tenants across all tenants.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

// ============================================================================
// User Management
// ============================================================================

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  tenantId: string;
  tenantName: string;
  role: string;
  status: string;
  emailVerified: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}

export interface CreateUserDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  tenantId: string;
  role: string;
}

export interface UpdateUserDto {
  firstName?: string;
  lastName?: string;
  role?: string;
  status?: string;
}

export async function getAllUsers(params?: {
  page?: number;
  limit?: number;
  search?: string;
  tenantId?: string;
  role?: string;
  status?: string;
}): Promise<{
  users: User[];
  total: number;
  page: number;
  limit: number;
}> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.search) searchParams.set('search', params.search);
  if (params?.tenantId) searchParams.set('tenantId', params.tenantId);
  if (params?.role) searchParams.set('role', params.role);
  if (params?.status) searchParams.set('status', params.status);

  const response = await fetch(`${API_BASE_URL}/admin/users?${searchParams.toString()}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch users');
  }

  return response.json();
}

export async function createUser(data: CreateUserDto): Promise<{ id: string; message: string }> {
  const response = await fetch(`${API_BASE_URL}/admin/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error('Failed to create user');
  }

  return response.json();
}

export async function updateUser(
  userId: string,
  data: UpdateUserDto,
): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE_URL}/admin/users/${userId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error('Failed to update user');
  }

  return response.json();
}

export async function deleteUser(userId: string): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE_URL}/admin/users/${userId}`, {
    method: 'DELETE',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to delete user');
  }

  return response.json();
}

export async function sendPasswordReset(userId: string): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE_URL}/admin/users/${userId}/reset-password`, {
    method: 'POST',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to send password reset');
  }

  return response.json();
}

// ============================================================================
// Tenant Management
// ============================================================================

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  subdomain: string;
  status: string;
  subscriptionTier: string;
  contactEmail: string;
  userCount: number;
  createdAt: Date;
}

export interface CreateTenantDto {
  name: string;
  slug: string;
  subdomain: string;
  contactEmail: string;
  subscriptionTier: string;
  trialDays?: number;
}

export interface UpdateTenantDto {
  name?: string;
  contactEmail?: string;
  subscriptionTier?: string;
  status?: string;
}

export async function getAllTenants(params?: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}): Promise<{
  tenants: Tenant[];
  total: number;
  page: number;
  limit: number;
}> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.search) searchParams.set('search', params.search);
  if (params?.status) searchParams.set('status', params.status);

  const response = await fetch(`${API_BASE_URL}/admin/tenants?${searchParams.toString()}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch tenants');
  }

  return response.json();
}

export async function createTenant(
  data: CreateTenantDto,
): Promise<{ id: string; message: string }> {
  const response = await fetch(`${API_BASE_URL}/admin/tenants`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error('Failed to create tenant');
  }

  return response.json();
}

export async function updateTenant(
  tenantId: string,
  data: UpdateTenantDto,
): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE_URL}/admin/tenants/${tenantId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error('Failed to update tenant');
  }

  return response.json();
}

export async function deleteTenant(tenantId: string): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE_URL}/admin/tenants/${tenantId}`, {
    method: 'DELETE',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to delete tenant');
  }

  return response.json();
}

export async function suspendTenant(
  tenantId: string,
  reason: string,
): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE_URL}/admin/tenants/${tenantId}/suspend`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ reason }),
  });

  if (!response.ok) {
    throw new Error('Failed to suspend tenant');
  }

  return response.json();
}

export async function activateTenant(tenantId: string): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE_URL}/admin/tenants/${tenantId}/activate`, {
    method: 'POST',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to activate tenant');
  }

  return response.json();
}
