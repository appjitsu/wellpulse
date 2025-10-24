/**
 * Auth Store
 *
 * Zustand store for authentication state management.
 * - Persists user info (NOT access token) to localStorage
 * - Access token stored separately for security
 * - Auto-refresh logic handled by API client interceptors
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../types/auth.types';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthActions {
  login: (user: User, accessToken: string) => void;
  logout: () => void;
  setAccessToken: (token: string) => void;
  setUser: (user: User) => void;
  refreshToken: (accessToken: string) => void;
  setLoading: (loading: boolean) => void;
}

export type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      // State
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: true,

      // Actions
      login: (user, accessToken) => {
        // Store access token in memory and localStorage (for interceptor)
        if (typeof window !== 'undefined') {
          localStorage.setItem('accessToken', accessToken);
        }

        set({
          user,
          accessToken,
          isAuthenticated: true,
          isLoading: false,
        });
      },

      logout: () => {
        // Clear access token from localStorage
        if (typeof window !== 'undefined') {
          localStorage.removeItem('accessToken');
        }

        set({
          user: null,
          accessToken: null,
          isAuthenticated: false,
          isLoading: false,
        });
      },

      setAccessToken: (token) => {
        // Store access token in memory and localStorage
        if (typeof window !== 'undefined') {
          localStorage.setItem('accessToken', token);
        }

        set({ accessToken: token, isAuthenticated: true });
      },

      setUser: (user) => {
        set({ user, isAuthenticated: true });
      },

      refreshToken: (accessToken) => {
        // Update access token in memory and localStorage
        if (typeof window !== 'undefined') {
          localStorage.setItem('accessToken', accessToken);
        }

        set({ accessToken });
      },

      setLoading: (loading) => {
        set({ isLoading: loading });
      },
    }),
    {
      name: 'auth-storage',
      // Only persist user info, NOT access token (security)
      partialize: (state) => ({
        user: state.user,
      }),
      // Rehydrate on mount
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Check if access token exists in localStorage
          const accessToken =
            typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

          if (accessToken && state.user) {
            state.accessToken = accessToken;
            state.isAuthenticated = true;
          }

          state.isLoading = false;
        }
      },
    },
  ),
);
