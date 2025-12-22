import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { Heart, MessageCircle, Share2, TrendingUp } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Skeleton } from '../shared/Skeleton';
import { apiFetch } from '../../lib/api-client';

interface TrendingPost {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  authorUsername?: string | null;
  timestamp: string;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  trendingScore: number;
}

interface TrendingPostsResponse {
  success: boolean;
  posts?: TrendingPost[];
}

/**
 * Helper to get profile URL
 */
function getProfileUrl(authorId: string, authorUsername?: string | null): string {
  if (authorUsername) {
    return `/profile/@${authorUsername}`;
  }
  return `/profile/${authorId}`;
}

/**
 * Trending posts panel component for displaying trending posts.
 * Converted from Next.js to plain React.
 */
export function TrendingPostsPanel() {
  const navigate = useNavigate();

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['feed', 'trending-posts'],
    queryFn: async (): Promise<TrendingPost[]> => {
      const response = await apiFetch('/api/feed/widgets/trending-posts');
      if (!response.ok) {
        throw new Error('Failed to fetch trending posts');
      }
      const data: TrendingPostsResponse = await response.json();
      if (!data.success) {
        return [];
      }
      if (!data.posts) {
        throw new Error(
          'Trending posts API returned success without posts data'
        );
      }
      return data.posts;
    },
    refetchInterval: 30000,
  });

  const handlePostClick = (postId: string) => {
    navigate(`/feed?post=${postId}`);
  };

  const truncateContent = (content: string, maxLength = 100) => {
    if (content.length <= maxLength) return content;
    return content.slice(0, maxLength) + '...';
  };

  return (
    <div className="flex flex-1 flex-col rounded-lg bg-sidebar p-4">
      <div className="mb-3 flex items-center gap-2">
        <TrendingUp className="h-5 w-5 text-[#0066FF]" />
        <h2 className="font-bold text-foreground text-xl">Trending</h2>
      </div>
      {isLoading ? (
        <div className="flex-1 space-y-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : posts.length === 0 ? (
        <div className="flex-1 text-muted-foreground text-sm">
          No trending posts at the moment.
        </div>
      ) : (
        <div className="flex-1 space-y-3">
          {posts.map((post) => {
            const postDate = new Date(post.timestamp);
            const timeAgo = formatDistanceToNow(postDate, { addSuffix: true });

            return (
              <div
                key={post.id}
                onClick={() => handlePostClick(post.id)}
                className="-mx-2 cursor-pointer rounded-lg p-2 transition-colors hover:bg-muted/50"
              >
                {/* Author */}
                <div className="mb-1.5 flex items-center gap-2">
                  <Link
                    to={getProfileUrl(post.authorId, post.authorUsername)}
                    onClick={(e) => e.stopPropagation()}
                    className="truncate font-semibold text-foreground text-sm hover:underline"
                  >
                    {post.authorName}
                  </Link>
                  <span className="truncate text-muted-foreground text-xs">
                    @{post.authorUsername || post.authorId}
                  </span>
                  <span className="ml-auto text-muted-foreground text-xs">
                    {timeAgo}
                  </span>
                </div>

                {/* Content */}
                <p className="mb-2 line-clamp-2 break-words text-foreground text-sm">
                  {truncateContent(post.content, 120)}
                </p>

                {/* Interaction counts */}
                <div className="flex items-center gap-4 text-muted-foreground text-xs">
                  <div className="flex items-center gap-1">
                    <Heart className="h-3 w-3" />
                    <span>{post.likeCount}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <MessageCircle className="h-3 w-3" />
                    <span>{post.commentCount}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Share2 className="h-3 w-3" />
                    <span>{post.shareCount}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
