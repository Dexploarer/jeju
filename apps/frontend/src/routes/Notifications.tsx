/**
 * Notifications Page
 *
 * @route /notifications
 */

import { cn } from '@babylon/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { GroupInviteCard } from '@/components/groups/GroupInviteCard';
import { Avatar } from '@/components/shared/Avatar';
import { PageContainer } from '@/components/shared/PageContainer';
import { PullToRefreshIndicator } from '@/components/shared/PullToRefreshIndicator';
import { useAuth } from '@/hooks/useAuth';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';

interface Notification {
  id: string;
  type: string;
  actorId: string | null;
  actor: {
    id: string;
    displayName: string;
    username: string | null;
    profileImageUrl: string | null;
  } | null;
  postId: string | null;
  commentId: string | null;
  chatId: string | null;
  groupId: string | null;
  inviteId: string | null;
  message: string;
  read: boolean;
  createdAt: string;
}

interface GroupInvite {
  inviteId: string;
  groupId: string;
  groupName: string;
  groupDescription: string | null;
  memberCount: number;
  invitedAt: string;
}

interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
}

interface GroupInvitesResponse {
  invites: GroupInvite[];
}

export default function Notifications() {
  const { authenticated, user, getAccessToken } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    data: notificationsData,
    isLoading: notificationsLoading,
    refetch: refetchNotifications,
  } = useQuery({
    queryKey: ['notifications'],
    queryFn: async (): Promise<NotificationsResponse> => {
      const token = await getAccessToken();

      if (!token) {
        return { notifications: [], unreadCount: 0 };
      }

      const response = await fetch('/api/notifications?limit=100', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch notifications');
      }

      return (await response.json()) as NotificationsResponse;
    },
    enabled: authenticated && !!user,
    refetchInterval: 60000,
    refetchIntervalInBackground: false,
  });

  const { data: invitesData, isLoading: invitesLoading } = useQuery({
    queryKey: ['group-invites'],
    queryFn: async (): Promise<GroupInvite[]> => {
      const token = await getAccessToken();

      if (!token) {
        return [];
      }

      const response = await fetch('/api/groups/invites', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch group invites');
      }

      const data = (await response.json()) as GroupInvitesResponse;
      return data.invites || [];
    },
    enabled: authenticated && !!user,
  });

  const notifications = notificationsData
    ? notificationsData.notifications
    : [];
  const groupInvites = invitesData || [];
  const loading = notificationsLoading || invitesLoading;
  const unreadCount = notificationsData ? notificationsData.unreadCount : 0;

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const token = await getAccessToken();
      if (!token) throw new Error('No auth token');

      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          notificationIds: [notificationId],
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to mark notification as read');
      }

      return notificationId;
    },
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] });

      const previousData = queryClient.getQueryData<NotificationsResponse>([
        'notifications',
      ]);

      queryClient.setQueryData<NotificationsResponse>(
        ['notifications'],
        (old) => {
          if (!old) return old;
          return {
            notifications: old.notifications.map((n) =>
              n.id === notificationId ? { ...n, read: true } : n
            ),
            unreadCount: Math.max(0, old.unreadCount - 1),
          };
        }
      );

      return { previousData };
    },
    onError: (_err, _notificationId, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['notifications'], context.previousData);
      }
    },
  });

  const markAsRead = useCallback(
    (notificationId: string, isAlreadyRead: boolean) => {
      if (isAlreadyRead) return;
      markAsReadMutation.mutate(notificationId);
    },
    [markAsReadMutation]
  );

  const handleRefresh = useCallback(async () => {
    await refetchNotifications();
    await queryClient.invalidateQueries({ queryKey: ['group-invites'] });
    toast.success('Notifications refreshed');
  }, [refetchNotifications, queryClient]);

  const { pullDistance, isRefreshing, containerRef } = usePullToRefresh({
    onRefresh: handleRefresh,
  });

  const fetchNotifications = useCallback(async () => {
    await refetchNotifications();
    await queryClient.invalidateQueries({ queryKey: ['group-invites'] });
  }, [refetchNotifications, queryClient]);

  useEffect(() => {
    if (!authenticated || notifications.length === 0) return;

    const timers = new Map<string, ReturnType<typeof setTimeout>>();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const notificationId = entry.target.getAttribute(
            'data-notification-id'
          );
          if (!notificationId) return;

          const notification = notifications.find(
            (n) => n.id === notificationId
          );
          if (!notification || notification.read) return;

          if (entry.isIntersecting) {
            const existingTimer = timers.get(notificationId);
            if (existingTimer) {
              clearTimeout(existingTimer);
            }

            const timer = setTimeout(() => {
              markAsRead(notificationId, false);
            }, 3000);

            timers.set(notificationId, timer);
          } else {
            const timer = timers.get(notificationId);
            if (timer) {
              clearTimeout(timer);
              timers.delete(notificationId);
            }
          }
        });
      },
      {
        threshold: 0.5,
        rootMargin: '-50px',
      }
    );

    const notificationElements = document.querySelectorAll(
      '[data-notification-id]'
    );
    notificationElements.forEach((el) => observer.observe(el));

    return () => {
      observer.disconnect();
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, [notifications, authenticated, markAsRead]);

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'comment':
        return '💬';
      case 'reaction':
        return '❤️';
      case 'follow':
        return '👤';
      case 'mention':
        return '📢';
      case 'reply':
        return '↩️';
      case 'share':
        return '🔁';
      case 'system':
        return '✨';
      default:
        return '🔔';
    }
  };

  const getNotificationLink = (notification: Notification) => {
    if (notification.chatId) {
      return `/chats?chat=${notification.chatId}`;
    }

    if (
      notification.type === 'system' &&
      notification.message.includes('invited you to')
    ) {
      return '/chats';
    }

    if (
      notification.type === 'system' &&
      (notification.message.includes('Message') ||
        notification.message.includes('message'))
    ) {
      return '/chats';
    }

    if (
      notification.type === 'system' &&
      notification.message.includes('profile')
    ) {
      return '/settings';
    }

    if (notification.type === 'follow' && notification.actorId) {
      return `/profile/${notification.actorId}`;
    }

    if (
      (notification.type === 'comment' ||
        notification.type === 'reaction' ||
        notification.type === 'reply') &&
      notification.postId
    ) {
      return `/post/${notification.postId}`;
    }

    if (notification.type === 'share' && notification.postId) {
      return `/post/${notification.postId}`;
    }

    if (notification.type === 'mention' && notification.postId) {
      return `/post/${notification.postId}`;
    }

    return '/feed';
  };

  if (!authenticated) {
    return (
      <PageContainer
        noPadding
        className="flex w-full flex-col"
      >
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden border-[rgba(120,120,120,0.5)] lg:border-r lg:border-l">
          <div className="sticky top-0 z-10 border-border border-b bg-background">
            <div className="px-4 py-3 lg:px-6">
              <h1 className="font-bold text-xl">Notifications</h1>
            </div>
          </div>
          <div className="flex flex-1 flex-col items-center justify-center gap-4">
            <p className="text-muted-foreground">
              Please sign in to view notifications
            </p>
            <Link
              to="/feed"
              className="rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground transition-all hover:bg-primary/90"
            >
              Go to Feed
            </Link>
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer noPadding className="flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 border-border border-b bg-background/95 backdrop-blur-sm">
        <div className="px-4 py-3">
          <h1 className="font-bold text-xl">Notifications</h1>
          {unreadCount > 0 && (
            <p className="text-muted-foreground text-sm">
              {unreadCount} unread
            </p>
          )}
        </div>
      </div>

      {/* Content */}
      <div ref={containerRef} className="relative flex-1 overflow-y-auto">
        <PullToRefreshIndicator
          pullDistance={pullDistance}
          isRefreshing={isRefreshing}
        />
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="text-muted-foreground">
              Loading notifications...
            </div>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Bell className="mb-4 h-16 w-16 text-muted-foreground opacity-50" />
            <h2 className="mb-2 font-semibold text-xl">No notifications yet</h2>
            <p className="px-4 text-center text-muted-foreground">
              When you get comments, reactions, follows, or mentions,
              they&apos;ll show up here.
            </p>
          </div>
        ) : (
          <div className="mx-auto max-w-feed space-y-4">
            {/* Group Invites Section */}
            {groupInvites.length > 0 && (
              <div className="space-y-3 px-4">
                <h3 className="font-semibold text-muted-foreground text-sm">
                  Pending Group Invites
                </h3>
                {groupInvites.map((invite) => (
                  <GroupInviteCard
                    key={invite.inviteId}
                    inviteId={invite.inviteId}
                    groupId={invite.groupId}
                    groupName={invite.groupName}
                    groupDescription={invite.groupDescription}
                    memberCount={invite.memberCount}
                    invitedAt={invite.invitedAt}
                    onAccepted={(_groupId, chatId) => {
                      void fetchNotifications();
                      toast.success('Joined group');
                      if (chatId) {
                        navigate(`/chats?chat=${chatId}`);
                      }
                    }}
                    onDeclined={() => {
                      void fetchNotifications();
                      toast.success('Invite declined');
                    }}
                  />
                ))}
              </div>
            )}

            {/* Regular Notifications */}
            {notifications.map((notification) => (
              <Link
                key={notification.id}
                to={getNotificationLink(notification)}
                onClick={() => markAsRead(notification.id, notification.read)}
                data-notification-id={notification.id}
                className={cn(
                  'block border-border border-b px-4 py-4 lg:px-6',
                  'transition-colors hover:bg-muted/30',
                  !notification.read && 'bg-primary/5'
                )}
              >
                <div className="flex items-start gap-3">
                  {!notification.read && (
                    <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  )}

                  {notification.actor ? (
                    <Avatar
                      id={notification.actor.id}
                      name={notification.actor.displayName}
                      size="md"
                      className="shrink-0"
                    />
                  ) : (
                    <div
                      className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                        notification.type === 'system'
                          ? 'bg-primary/10'
                          : 'bg-muted'
                      )}
                    >
                      {notification.type === 'system' ? (
                        <span className="text-xl">
                          {getNotificationIcon(notification.type)}
                        </span>
                      ) : (
                        <Bell className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        {notification.type === 'system' ? (
                          <p className="text-foreground leading-relaxed">
                            {notification.message}
                          </p>
                        ) : (
                          <p className="text-foreground leading-relaxed">
                            <span className="font-semibold">
                              {notification.actor
                                ? notification.actor.displayName
                                : 'Someone'}
                            </span>{' '}
                            <span className="text-muted-foreground">
                              {getNotificationIcon(notification.type)}{' '}
                              {notification.message
                                .replace(
                                  notification.actor
                                    ? notification.actor.displayName
                                    : '',
                                  ''
                                )
                                .replace(/^:\s*/, '')}
                            </span>
                          </p>
                        )}
                        <time className="mt-1 block text-muted-foreground text-sm">
                          {formatTimeAgo(notification.createdAt)}
                        </time>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
