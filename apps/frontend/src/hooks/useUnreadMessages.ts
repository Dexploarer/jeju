import { useQuery } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { apiFetch } from '../lib/api';

interface UnreadCounts {
  pendingDMs: number;
  hasNewMessages: boolean;
}

/**
 * Hook for efficiently polling unread and pending message counts.
 */
export function useUnreadMessages() {
  const { authenticated, getAccessToken } = useAuth();

  const { data: counts = { pendingDMs: 0, hasNewMessages: false }, isLoading } =
    useQuery({
      queryKey: ['unreadMessages'],
      queryFn: async (): Promise<UnreadCounts> => {
        const token = await getAccessToken();
        if (!token) {
          return { pendingDMs: 0, hasNewMessages: false };
        }

        const response = await apiFetch('/api/chats/unread-count');

        if (!response.ok) {
          throw new Error(`Failed to fetch unread count: ${response.status}`);
        }

        const data = await response.json() as UnreadCounts;
        return {
          pendingDMs: data.pendingDMs ?? 0,
          hasNewMessages: data.hasNewMessages ?? false,
        };
      },
      enabled: authenticated,
      refetchInterval: 30000,
      staleTime: 15000,
    });

  return {
    ...counts,
    totalUnread: counts.pendingDMs + (counts.hasNewMessages ? 1 : 0),
    isLoading,
  };
}
