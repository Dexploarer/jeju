import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useAuth } from './useAuth';
import { apiFetch, getAccessToken } from '../lib/api';

/**
 * Hook for fetching and managing unread notifications count.
 */
export function useUnreadNotifications() {
  const { authenticated, user } = useAuth();
  const queryClient = useQueryClient();

  const { data: unreadCount = 0, isLoading } = useQuery({
    queryKey: ['notifications', 'unread-count', user?.id],
    queryFn: async (): Promise<number> => {
      const token = getAccessToken();
      if (!token) {
        return 0;
      }

      const response = await apiFetch('/api/notifications?unreadOnly=true&limit=1');

      if (!response.ok) {
        return 0;
      }

      const data = await response.json() as { unreadCount?: number };
      return data.unreadCount ?? 0;
    },
    enabled: authenticated && !!user,
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: ['notifications', 'unread-count'],
    });
  }, [queryClient]);

  return {
    unreadCount,
    isLoading,
    refresh,
  };
}
