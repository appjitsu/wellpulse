/**
 * useAuth Hook
 *
 * React hook for accessing authentication state and actions.
 * Wraps the Zustand auth store with proper TypeScript types.
 */

'use client';

import { useAuthStore } from '../lib/store/auth.store';

export const useAuth = () => {
  const user = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading);
  const login = useAuthStore((state) => state.login);
  const logout = useAuthStore((state) => state.logout);
  const setAccessToken = useAuthStore((state) => state.setAccessToken);
  const setUser = useAuthStore((state) => state.setUser);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const setLoading = useAuthStore((state) => state.setLoading);

  return {
    user,
    accessToken,
    isAuthenticated,
    isLoading,
    login,
    logout,
    setAccessToken,
    setUser,
    refreshToken,
    setLoading,
  };
};
