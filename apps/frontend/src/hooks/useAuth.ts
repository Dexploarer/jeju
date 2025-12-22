/**
 * Auth Hook
 *
 * Authentication state and methods
 */

import { useCallback } from 'react';
import { useAuthStore, type User } from '../stores/authStore';

interface UseAuthReturn {
  ready: boolean;
  authenticated: boolean;
  loadingProfile: boolean;
  user: User | null;
  wallet: { address: string } | undefined;
  smartWalletAddress?: string;
  smartWalletReady: boolean;
  needsOnboarding: boolean;
  needsOnchain: boolean;
  login: () => void;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
}

/**
 * Main authentication hook for managing user authentication state.
 * This is a simplified version - integrate with your auth provider.
 */
export function useAuth(): UseAuthReturn {
  const {
    user,
    wallet,
    isLoadingProfile,
    needsOnboarding,
    needsOnchain,
    clearAuth,
  } = useAuthStore();

  const authenticated = !!user;
  const ready = true;

  const login = useCallback(() => {
    console.log('Login triggered');
  }, []);

  const logout = useCallback(async () => {
    clearAuth();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('frontend-auth');
      const win = window as Window & { __oauth3AccessToken?: string | null };
      win.__oauth3AccessToken = null;
    }
  }, [clearAuth]);

  const refresh = useCallback(async () => {
    console.log('Refresh triggered');
  }, []);

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    if (typeof window === 'undefined') return null;
    const win = window as Window & { __oauth3AccessToken?: string | null };
    return win.__oauth3AccessToken ?? null;
  }, []);

  return {
    ready,
    authenticated,
    loadingProfile: isLoadingProfile,
    user,
    wallet: wallet ? { address: wallet.address } : undefined,
    smartWalletAddress: undefined,
    smartWalletReady: false,
    needsOnboarding,
    needsOnchain,
    login,
    logout,
    refresh,
    getAccessToken,
  };
}
