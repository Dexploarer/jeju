/**
 * Route: /trending/:tag
 * Display posts for a trending tag
 */

import { logger } from '@babylon/shared';
import { useInfiniteQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useEffect, useMemo } from 'react';
import { PostCard } from '@/components/posts/PostCard';
import { PageContainer } from '@/components/shared/PageContainer';

interface PostData {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  authorUsername?: string | null;
  authorProfileImageUrl?: string | null;
  timestamp: string;
  likeCount?: number;
  commentCount?: number;
  shareCount?: number;
  isLiked?: boolean;
  isShared?: boolean;
}

interface TagInfo {
  name: string;
  displayName: string;
  category?: string | null;
}

interface TrendingResponse {
  success: boolean;
  tag?: TagInfo;
  posts: PostData[];
}

const PAGE_SIZE = 20;

export default function TrendingTag() {
  const params = useParams<{ tag?: string }>();
  const navigate = useNavigate();
  const tag = params.tag;

  // Redirect to trending if no tag provided
  useEffect(() => {
    if (!tag) {
      navigate('/trending', { replace: true });
    }
  }, [tag, navigate]);

  const {
    data,
    isLoading: loading,
    isFetchingNextPage: loadingMore,
    hasNextPage: hasMore,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: ['trending', tag],
    queryFn: async ({ pageParam = 0 }) => {
      const response = await fetch(
        `/api/trending/${encodeURIComponent(tag!)}&limit=${PAGE_SIZE}&offset=${pageParam}`
      );

      if (!response.ok) {
        if (response.status === 404) {
          logger.warn('Tag not found', { tag }, 'TrendingTagPage');
        }
        throw new Error('Failed to fetch posts');
      }

      const responseData = (await response.json()) as TrendingResponse;
      return {
        posts: responseData.posts || [],
        tag: responseData.tag,
        nextOffset: pageParam + (responseData.posts?.length || 0),
        hasMore: (responseData.posts?.length || 0) === PAGE_SIZE,
      };
    },
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.nextOffset : undefined,
    initialPageParam: 0,
    enabled: !!tag,
  });

  // Derive posts and tagInfo from pages
  const { posts, tagInfo } = useMemo(() => {
    if (!data?.pages) {
      return { posts: [] as PostData[], tagInfo: null as TagInfo | null };
    }

    // Get tag info from first page
    const firstPageTag = data.pages[0]?.tag ?? null;

    // Combine all posts from all pages with deduplication
    const allPosts = data.pages.flatMap((page) => page.posts);
    const unique = new Map<string, PostData>();
    allPosts.forEach((post: PostData) => {
      if (post?.id) {
        unique.set(post.id, post);
      }
    });

    const deduped = Array.from(unique.values()).sort((a, b) => {
      const aTime = new Date(a.timestamp).getTime();
      const bTime = new Date(b.timestamp).getTime();
      return bTime - aTime;
    });

    return { posts: deduped, tagInfo: firstPageTag };
  }, [data]);

  const handleLoadMore = () => {
    if (!loading && !loadingMore && hasMore) {
      fetchNextPage();
    }
  };

  const handleBack = () => {
    navigate(-1);
  };

  // Don't render with missing tag - redirect will happen via useEffect
  if (!tag) {
    return null;
  }

  return (
    <PageContainer
      noPadding
      className="flex min-h-screen w-full flex-col overflow-visible"
    >
      {/* Mobile/Tablet: Header */}
      <div className="sticky top-0 z-10 shrink-0 border-border border-b bg-background px-4 py-3 lg:hidden">
        <div className="flex items-center gap-4">
          <button
            onClick={handleBack}
            className="rounded-full p-2 transition-colors hover:bg-muted"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1">
            {tagInfo ? (
              <>
                <h1 className="font-bold text-2xl">{tagInfo.displayName}</h1>
                {tagInfo.category && (
                  <p className="text-muted-foreground text-sm">
                    {tagInfo.category} · Trending
                  </p>
                )}
              </>
            ) : (
              <h1 className="font-bold text-2xl">{decodeURIComponent(tag)}</h1>
            )}
          </div>
        </div>
      </div>

      {/* Desktop: Multi-column layout with sidebar */}
      <div className="hidden min-h-0 flex-1 lg:flex">
        {/* Left: Feed area */}
        <div className="flex min-w-0 flex-1 flex-col border-[rgba(120,120,120,0.5)] border-r border-l">
          {/* Desktop Header */}
          <div className="sticky top-0 z-10 shrink-0 bg-background shadow-sm">
            <div className="px-6 py-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={handleBack}
                  className="rounded-full p-2 transition-colors hover:bg-muted"
                  aria-label="Go back"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div className="flex-1">
                  {tagInfo ? (
                    <>
                      <h1 className="font-bold text-2xl">
                        {tagInfo.displayName}
                      </h1>
                      {tagInfo.category && (
                        <p className="text-muted-foreground text-sm">
                          {tagInfo.category} · Trending
                        </p>
                      )}
                    </>
                  ) : (
                    <h1 className="font-bold text-2xl">
                      {decodeURIComponent(tag)}
                    </h1>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Feed content - Scrollable */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden bg-background">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-muted-foreground">Loading posts...</div>
              </div>
            ) : posts.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <h2 className="mb-2 font-semibold text-xl">No posts found</h2>
                  <p className="text-muted-foreground">
                    No posts have been tagged with &quot;
                    {tagInfo?.displayName || tag}&quot; yet.
                  </p>
                </div>
              </div>
            ) : (
              <div className="mx-auto max-w-feed space-y-0 px-6 py-4">
                {posts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}

                {hasMore && (
                  <div className="py-4 text-center">
                    {loadingMore ? (
                      <div className="text-muted-foreground text-sm">
                        Loading more posts...
                      </div>
                    ) : (
                      <button
                        onClick={handleLoadMore}
                        className="rounded-lg bg-primary px-6 py-2 text-primary-foreground transition-opacity hover:opacity-90"
                      >
                        Load More
                      </button>
                    )}
                  </div>
                )}

                {!hasMore && posts.length > 0 && (
                  <div className="py-4 text-center text-muted-foreground text-xs">
                    You&apos;re all caught up.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile/Tablet: Content */}
      <div className="flex w-full flex-1 overflow-y-auto overflow-x-hidden bg-background lg:hidden">
        {loading ? (
          <div className="flex w-full items-center justify-center py-12">
            <div className="text-muted-foreground">Loading posts...</div>
          </div>
        ) : posts.length === 0 ? (
          <div className="flex w-full items-center justify-center py-12">
            <div className="px-4 text-center">
              <h2 className="mb-2 font-semibold text-xl">No posts found</h2>
              <p className="text-muted-foreground">
                No posts have been tagged with &quot;
                {tagInfo?.displayName || tag}&quot; yet.
              </p>
            </div>
          </div>
        ) : (
          <div className="w-full px-4 py-4">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}

            {hasMore && (
              <div className="py-4 text-center">
                {loadingMore ? (
                  <div className="text-muted-foreground text-sm">
                    Loading more posts...
                  </div>
                ) : (
                  <button
                    onClick={handleLoadMore}
                    className="rounded-lg bg-primary px-6 py-2 text-primary-foreground transition-opacity hover:opacity-90"
                  >
                    Load More
                  </button>
                )}
              </div>
            )}

            {!hasMore && posts.length > 0 && (
              <div className="py-4 text-center text-muted-foreground text-xs">
                You&apos;re all caught up.
              </div>
            )}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
