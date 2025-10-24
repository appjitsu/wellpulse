import { apiClient } from './client';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'MANAGER' | 'OPERATOR';
  status: 'ACTIVE' | 'PENDING' | 'SUSPENDED';
  emailVerified: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}

export interface GetUsersResponse {
  users: User[];
  total: number;
}

export interface UpdateUserRoleRequest {
  role: 'ADMIN' | 'MANAGER' | 'OPERATOR';
}

export const usersApi = {
  getUsers: async (params?: {
    role?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<GetUsersResponse> => {
    const response = await apiClient.get<GetUsersResponse>('/users', {
      params,
    });
    return response.data;
  },

  updateUserRole: async (
    userId: string,
    data: UpdateUserRoleRequest,
  ): Promise<{ message: string }> => {
    const response = await apiClient.patch<{ message: string }>(`/users/${userId}/role`, data);
    return response.data;
  },

  suspendUser: async (userId: string): Promise<{ message: string }> => {
    const response = await apiClient.patch<{ message: string }>(`/users/${userId}/suspend`);
    return response.data;
  },

  activateUser: async (userId: string): Promise<{ message: string }> => {
    const response = await apiClient.patch<{ message: string }>(`/users/${userId}/activate`);
    return response.data;
  },
};
