/**
 * API Client
 *
 * Axios instance with request/response interceptors for authentication.
 * - Attaches access token to all requests
 * - Handles 401 errors and automatic token refresh
 * - Includes credentials for httpOnly cookie support
 */

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import type { ApiError } from '../types/auth.types';

// Create axios instance
export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Include cookies for refresh token
});

// Flag to prevent multiple refresh attempts
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });

  failedQueue = [];
};

// Request interceptor - attach access token and tenant subdomain
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Get access token from auth store
    // Note: We import dynamically to avoid circular dependencies
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Extract subdomain from hostname and include in request
    // This is needed for multi-tenant subdomain routing
    if (typeof window !== 'undefined' && config.headers) {
      const hostname = window.location.hostname;
      const subdomain = extractSubdomain(hostname);

      if (subdomain) {
        config.headers['X-Tenant-Subdomain'] = subdomain;
      }
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

/**
 * Extract subdomain from hostname
 *
 * Examples:
 * - demo.localhost → "demo"
 * - demo.wellpulse.app → "demo"
 * - localhost → null
 * - wellpulse.app → null
 */
function extractSubdomain(hostname: string): string | null {
  // Remove port if present
  const host = hostname.split(':')[0];

  // Split by dots
  const parts = host.split('.');

  // No subdomain if single part (localhost)
  if (parts.length === 1) {
    return null;
  }

  // Two parts: check if it's localhost or base domain
  if (parts.length === 2) {
    if (parts[1] === 'localhost' || host === 'wellpulse.app') {
      // First part is the subdomain (demo.localhost → "demo")
      return parts[0];
    }
    return null;
  }

  // Three or more parts: first part is subdomain
  // demo.wellpulse.app → "demo"
  return parts[0];
}

// Response interceptor - handle 401 and refresh token
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error: AxiosError<ApiError>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // If error is 401 and we haven't retried yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Avoid refreshing on auth endpoints (login, register, etc.)
      if (originalRequest.url?.includes('/auth/')) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // If already refreshing, queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers && token) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return apiClient(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Attempt to refresh token
        const response = await apiClient.post('/auth/refresh');
        const { accessToken } = response.data;

        // Store new access token
        if (typeof window !== 'undefined') {
          localStorage.setItem('accessToken', accessToken);
        }

        // Update authorization header
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        }

        processQueue(null, accessToken);

        // Retry original request
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError as Error, null);

        // Clear auth state and redirect to login (skip in development if no token exists)
        if (typeof window !== 'undefined') {
          const hasToken = localStorage.getItem('accessToken');
          const isDevelopment = process.env.NODE_ENV !== 'production';

          localStorage.removeItem('accessToken');
          localStorage.removeItem('user');

          // Only redirect to login if we had a token before (actual logout scenario)
          // In development, don't redirect if there was never a token (avoids redirect loops)
          if (hasToken || !isDevelopment) {
            window.location.href = '/login';
          }
        }

        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export default apiClient;
