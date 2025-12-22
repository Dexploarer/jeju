/**
 * Feed Page
 *
 * Main feed page orchestrator
 *
 * @route /feed
 */

import type { FeedPost } from '@babylon/shared';
import { cn } from '@babylon/shared';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FeedToggle } from '@/components/shared/FeedToggle';
import { PageContainer } from '@/components/shared/PageContainer';
import { PullToRefreshIndicator } from '@/components/shared/PullToRefreshIndicator';
import { FeedSkeleton } from '@/components/shared/Skeleton';
import { useWidgetRefresh } from '@/contexts/WidgetRefreshContext';
import { useAuth } from '@/hooks/useAuth';
import { useErrorToasts } from '@/hooks/useErrorToasts';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useFeedStore } from '@/stores/feedStore';
import { useGameStore } from '@/stores/gameStore';
import { EmptyFeed, PostList } from './components';
import { useFeedPosts, useFollowingPosts } from './hooks';

interface ActorsResponse {
  actors?: Array<{ id: string; name: string }>;
}

// Performance: Lazy load heavy components
const WidgetSidebar = lazy(
  () =>
    import('@/components/shared/WidgetSidebar').then((m) => ({
      default: m.WidgetSidebar,
    }))
);

const CreatePostModal = lazy(
  () =>
    import('@/components/posts/CreatePostModal').then((m) => ({
      default: m.CreatePostModal,
    }))
);

const TradesFeed = lazy(
  () =>
    import('@/components/trades/TradesFeed').then((m) => ({
      default: m.TradesFeed,
    }))
);

type FeedTab = 'latest' | 'following' | 'trades';

export default function Feed() {
  const navigate = useNavigate();
  const { authenticated } = useAuth();
  const { refreshAll: refreshWidgets } = useWidgetRefresh();
  const { registerOptimisticPostCallback, unregisterOptimisticPostCallback } =
    useFeedStore();

  const [tab, setTab] = useState<FeedTab>('latest');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data: actorNames = new Map<string, string>() } = useQuery({
    queryKey: ['actors'],
    queryFn: async () => {
      const response = await fetch('/api/actors');
      if (!response.ok) return new Map<string, string>();
      const data = (await response.json()) as ActorsResponse;
      const nameMap = new Map<string, string>();
      data.actors?.forEach((actor) => {
        nameMap.set(actor.id, actor.name);
      });
      return nameMap;
    },
    staleTime: 5 * 60 * 1000,
  });

  const scrollContainerRefObject = useRef<HTMLDivElement | null>(null);

  useErrorToasts();

  const {
    posts: latestPosts,
    loading: latestLoading,
    loadingMore,
    hasMore,
    cursor,
    fetchPosts,
    refresh: refreshLatest,
    addOptimisticPost,
  } = useFeedPosts({ enabled: tab === 'latest' });

  const { posts: followingPosts, loading: followingLoading } =
    useFollowingPosts({ enabled: tab === 'following' });

  const { allGames, startTime, currentTimeMs } = useGameStore();
  const currentDate = startTime ? new Date(startTime + currentTimeMs) : null;

  const timelinePosts = useMemo(() => {
    if (!startTime || !currentDate || allGames.length === 0) return [];

    const items: Array<{
      id: string;
      content: string;
      author: string;
      authorId: string;
      authorName: string;
      timestamp: string;
      timestampMs: number;
    }> = [];

    allGames.forEach((g) => {
      g.timeline?.forEach((day) => {
        day.feedPosts?.forEach((post) => {
          const ts = new Date(post.timestamp).getTime();
          items.push({
            id: `game-${g.id}-${post.timestamp}`,
            content: post.content,
            author: post.author,
            authorId: post.author,
            authorName: post.authorName,
            timestamp: post.timestamp,
            timestampMs: ts,
          });
        });
      });
    });

    const currentAbs = startTime + currentTimeMs;
    return items
      .filter((p) => p.timestampMs <= currentAbs)
      .sort((a, b) => b.timestampMs - a.timestampMs)
      .map(({ timestampMs: _, ...rest }) => rest as FeedPost);
  }, [allGames, startTime, currentTimeMs, currentDate]);

  const currentPosts = useMemo(() => {
    if (tab === 'following') return followingPosts;
    if (latestPosts.length > 0) return latestPosts;
    if (startTime && allGames.length > 0) return timelinePosts;
    return latestPosts;
  }, [tab, latestPosts, followingPosts, timelinePosts, startTime, allGames]);

  const isLoading =
    (tab === 'latest' && latestLoading) ||
    (tab === 'following' && followingLoading);

  useEffect(() => {
    const handleOptimisticPost = (post: FeedPost) => {
      addOptimisticPost(post);
    };

    registerOptimisticPostCallback(handleOptimisticPost);
    return () => {
      unregisterOptimisticPostCallback();
    };
  }, [
    registerOptimisticPostCallback,
    unregisterOptimisticPostCallback,
    addOptimisticPost,
  ]);

  const handleRefresh = useCallback(async () => {
    if (tab === 'latest') {
      await refreshLatest();
      refreshWidgets();
    }
  }, [tab, refreshLatest, refreshWidgets]);

  const {
    pullDistance,
    isRefreshing,
    containerRef: scrollContainerCallbackRef,
  } = usePullToRefresh({
    onRefresh: handleRefresh,
    enabled: tab === 'latest' || tab === 'trades',
  });

  const scrollContainerRef = useCallback(
    (node: HTMLDivElement | null) => {
      scrollContainerCallbackRef(node);
      if (scrollContainerRefObject.current !== node) {
        scrollContainerRefObject.current = node;
      }
    },
    [scrollContainerCallbackRef]
  );

  const handleLoadMore = useCallback(() => {
    if (tab === 'latest' && cursor) {
      void fetchPosts(cursor, true);
    }
  }, [tab, cursor, fetchPosts]);

  const handlePostCreated = useCallback(
    (newPost: {
      id: string;
      content: string;
      authorId: string;
      authorName: string;
      authorUsername?: string | null;
      authorProfileImageUrl?: string | null;
      timestamp: string;
    }) => {
      const optimisticPost: FeedPost = {
        id: newPost.id,
        content: newPost.content,
        author: newPost.authorId,
        authorId: newPost.authorId,
        authorName: newPost.authorName,
        authorUsername: newPost.authorUsername || undefined,
        authorProfileImageUrl: newPost.authorProfileImageUrl || undefined,
        timestamp: newPost.timestamp,
        likeCount: 0,
        commentCount: 0,
        shareCount: 0,
        isLiked: false,
        isShared: false,
      };

      addOptimisticPost(optimisticPost);
      setShowCreateModal(false);

      if (window.location.pathname !== '/feed') {
        navigate('/feed');
      }
    },
    [addOptimisticPost, navigate]
  );

  const renderContent = () => {
    if (tab === 'trades') {
      return (
        <Suspense fallback={<FeedSkeleton count={5} />}>
          <TradesFeed containerRef={scrollContainerRefObject} />
        </Suspense>
      );
    }

    if (isLoading) {
      return (
        <div className="w-full">
          <FeedSkeleton count={5} />
        </div>
      );
    }

    if (currentPosts.length === 0) {
      if (tab === 'latest') return <EmptyFeed variant="latest" />;
      if (tab === 'following')
        return <EmptyFeed variant="following" isLoading={followingLoading} />;
      return <EmptyFeed variant="default" />;
    }

    return (
      <PostList
        posts={currentPosts}
        actorNames={actorNames}
        hasMore={tab === 'latest' && hasMore}
        loadingMore={loadingMore}
        onLoadMore={handleLoadMore}
      />
    );
  };

  return (
    <PageContainer noPadding className="flex w-full flex-col">
      <div ref={scrollContainerRef} className="relative flex flex-1">
        {/* Feed area */}
        <div className="flex min-w-0 flex-1 flex-col border-[rgba(120,120,120,0.5)] lg:border-r lg:border-l">
          {/* Header with tabs */}
          <div className="sticky top-0 z-10 flex-shrink-0 bg-background shadow-sm">
            <div className="px-3 sm:px-4 lg:px-6">
              <div className="flex items-center justify-between lg:mb-3">
                <FeedToggle activeTab={tab} onTabChange={setTab} />
              </div>
            </div>
          </div>

          {/* Feed content */}
          <div className="flex-1 bg-background">
            <div className="w-full px-4 lg:mx-auto lg:max-w-[700px] lg:px-6">
              <PullToRefreshIndicator
                pullDistance={pullDistance}
                isRefreshing={isRefreshing}
              />
              {renderContent()}
            </div>
          </div>
        </div>

        {/* Widget sidebar - lazy loaded, desktop only */}
        <Suspense fallback={null}>
          <WidgetSidebar />
        </Suspense>
      </div>

      {/* Floating Post Button */}
      {authenticated && (
        <button
          onClick={() => setShowCreateModal(true)}
          className={cn(
            'fixed right-4 bottom-20 z-[100] md:right-6 md:bottom-6',
            'flex items-center justify-center gap-2',
            'bg-[#0066FF] hover:bg-[#2952d9]',
            'font-semibold text-primary-foreground',
            'rounded-full',
            'transition-all duration-200',
            'shadow-lg hover:scale-105 hover:shadow-xl',
            'h-14 w-14 md:h-16 md:w-16'
          )}
          aria-label="Create Post"
        >
          <Plus className="h-6 w-6 md:h-7 md:w-7" />
        </button>
      )}

      {/* Create Post Modal - lazy loaded */}
      {showCreateModal && (
        <Suspense fallback={null}>
          <CreatePostModal
            isOpen={showCreateModal}
            onClose={() => setShowCreateModal(false)}
            onPostCreated={handlePostCreated}
          />
        </Suspense>
      )}
    </PageContainer>
  );
}
