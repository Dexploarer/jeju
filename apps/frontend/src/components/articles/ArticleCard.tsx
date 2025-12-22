import { cn } from '@babylon/shared';
import { memo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Avatar } from '@/components/shared/Avatar';

/**
 * Article card post schema for validation.
 */
const _ArticleCardPostSchema = z.object({
  id: z.string(),
  type: z.string().optional(),
  content: z.string(),
  fullContent: z.string().nullable().optional(),
  articleTitle: z.string().nullable().optional(),
  byline: z.string().nullable().optional(),
  biasScore: z.number().nullable().optional(),
  category: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  authorId: z.string(),
  authorName: z.string(),
  authorUsername: z.string().nullable().optional(),
  authorProfileImageUrl: z.string().nullable().optional(),
  timestamp: z.string(),
});

/**
 * Article card component for displaying article posts.
 *
 * Displays a formatted card for article posts with title, byline, content
 * preview, author information, and timestamp. Includes bias score display
 * and click handling for navigation.
 *
 * Features:
 * - Article title and byline
 * - Content preview
 * - Author display
 * - Timestamp formatting
 * - Bias score indicator
 * - Click handling
 * - Memoized for performance
 *
 * @param props - ArticleCard component props
 * @returns Article card element
 *
 * @example
 * ```tsx
 * <ArticleCard
 *   post={articleData}
 *   onClick={() => navigate(`/articles/${post.id}`)}
 * />
 * ```
 */
export type ArticleCardProps = {
  post: z.infer<typeof _ArticleCardPostSchema>;
  className?: string;
  onClick?: () => void;
};

export const ArticleCard = memo(function ArticleCard({
  post,
  className,
  onClick,
}: ArticleCardProps) {
  const navigate = useNavigate();
  const publishedDate = new Date(post.timestamp);
  const now = new Date();
  const diffMs = now.getTime() - publishedDate.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  let timeAgo: string;
  if (diffMinutes < 1) {
    timeAgo = 'Just now';
  } else if (diffMinutes < 60) {
    timeAgo = `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    timeAgo = `${diffHours}h ago`;
  } else {
    // Show date for articles older than 24 hours
    timeAgo = publishedDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year:
        publishedDate.getFullYear() !== now.getFullYear()
          ? 'numeric'
          : undefined,
    });
  }

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      // Navigate directly to article page (ArticleCard is only used for article-type posts)
      navigate(`/article/${post.id}`);
    }
  };

  return (
    <article
      className={cn(
        'px-4 py-3',
        'cursor-pointer transition-all duration-200 hover:bg-muted/30',
        'w-full overflow-hidden',
        'border-border/5 border-b',
        className
      )}
      onClick={handleClick}
    >
      {/* Header: Avatar + Author + Timestamp */}
      <div className="mb-3 flex w-full items-start gap-3">
        {/* Avatar */}
        <Link
          to={`/profile/${post.authorId}`}
          className="shrink-0 transition-opacity hover:opacity-80"
          onClick={(e) => e.stopPropagation()}
        >
          <Avatar
            id={post.authorId}
            name={post.authorName}
            type="business"
            size="md"
            src={post.authorProfileImageUrl || undefined}
          />
        </Link>

        {/* Author name and timestamp */}
        <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col">
            <Link
              to={`/profile/${post.authorId}`}
              className="truncate font-semibold text-foreground text-lg hover:underline sm:text-xl"
              onClick={(e) => e.stopPropagation()}
            >
              {post.authorName}
            </Link>
          </div>
          <time
            className="ml-2 shrink-0 text-base text-muted-foreground"
            title={publishedDate.toLocaleString()}
          >
            {timeAgo}
          </time>
        </div>
      </div>

      {/* Mobile: Article Image (shown full width on small screens) */}
      {post.imageUrl && (
        <div className="relative mb-3 aspect-video w-full overflow-hidden rounded-lg sm:hidden">
          <img
            src={post.imageUrl}
            alt={post.articleTitle || 'Article image'}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
          />
        </div>
      )}

      {/* Article Content: Image + Text (desktop) */}
      <div className="mb-3 flex gap-4">
        {/* Article Image thumbnail (desktop only) */}
        {post.imageUrl && (
          <div className="relative hidden aspect-video w-32 shrink-0 overflow-hidden rounded-lg sm:block md:w-40">
            <img
              src={post.imageUrl}
              alt={post.articleTitle || 'Article image'}
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
            />
          </div>
        )}

        {/* Title and Summary */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Article Title with Read More Button */}
          <div className="mb-2 flex items-start justify-between gap-4">
            <h2 className="flex-1 font-bold text-foreground text-lg leading-tight sm:text-xl">
              {post.articleTitle || 'Untitled Article'}
            </h2>
            <button
              type="button"
              className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg bg-[#0066FF] px-3 py-2 font-semibold text-primary-foreground text-sm transition-colors hover:bg-[#2952d9]"
              onClick={handleClick}
            >
              Read Full Article →
            </button>
          </div>

          {/* Article Summary */}
          <div className="line-clamp-3 whitespace-pre-wrap break-words text-foreground leading-relaxed">
            {post.content}
          </div>
        </div>
      </div>
    </article>
  );
});
