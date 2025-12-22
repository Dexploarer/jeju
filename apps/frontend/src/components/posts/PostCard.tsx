import type { PostInteraction } from '@babylon/shared'
import { cn, getProfileUrl } from '@babylon/shared'
import { Repeat2 } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import {
  type KeyboardEvent,
  type MouseEvent,
  memo,
  useEffect,
  useState,
} from 'react'
import { InteractionBar } from '../interactions'
import { ModerationMenu } from '../moderation/ModerationMenu'
import { Avatar } from '../shared/Avatar'
import { TaggedText } from '../shared/TaggedText'
import {
  isNpcIdentifier,
  VerifiedBadge,
} from '../shared/VerifiedBadge'
import { useFontSize } from '../../contexts/FontSizeContext'
import { useAuth } from '../../hooks/useAuth'

/**
 * Post card component for displaying feed posts.
 */
export interface PostCardProps {
  post: {
    id: string
    type?: string
    content: string
    articleTitle?: string | null
    byline?: string | null
    biasScore?: number | null
    sentiment?: string | null
    category?: string | null
    authorId: string
    authorName: string
    authorUsername?: string | null
    authorProfileImageUrl?: string | null
    timestamp: string
    likeCount?: number
    commentCount?: number
    shareCount?: number
    isLiked?: boolean
    isShared?: boolean
    deletedAt?: string | null
    isRepost?: boolean
    isQuote?: boolean
    quoteComment?: string | null
    originalPostId?: string | null
    originalPost?: {
      id: string
      content: string
      authorId: string
      authorName: string
      authorUsername: string | null
      authorProfileImageUrl: string | null
      timestamp: string
    } | null
  }
  className?: string
  onCommentClick?: () => void
  showInteractions?: boolean
  isDetail?: boolean
}

export const PostCard = memo(function PostCard({
  post,
  className,
  onCommentClick,
  showInteractions = true,
  isDetail = false,
}: PostCardProps) {
  const navigate = useNavigate()
  const { fontSize } = useFontSize()
  const [isDesktop, setIsDesktop] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const { user } = useAuth()

  useEffect(() => {
    const checkScreenSize = () => {
      setIsDesktop(window.innerWidth >= 1024)
      setIsMobile(window.innerWidth < 640)
    }
    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)
    return () => window.removeEventListener('resize', checkScreenSize)
  }, [])

  const postDate = new Date(post.timestamp)
  const now = new Date()
  const diffMs = now.getTime() - postDate.getTime()
  const diffMinutes = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)

  let timeAgo: string
  if (diffMinutes < 1) {
    timeAgo = 'Just now'
  } else if (diffMinutes < 60) {
    timeAgo = `${diffMinutes}m ago`
  } else if (diffHours < 24) {
    timeAgo = `${diffHours}h ago`
  } else {
    timeAgo = postDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year:
        postDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    })
  }

  const initialInteractions: PostInteraction = {
    postId: post.id,
    likeCount: post.likeCount ?? 0,
    commentCount: post.commentCount ?? 0,
    shareCount: post.shareCount ?? 0,
    isLiked: post.isLiked ?? false,
    isShared: post.isShared ?? false,
  }

  const isSimpleRepost = post.isRepost && !post.isQuote && !post.quoteComment

  const displayAuthorId =
    isSimpleRepost && post.originalPost
      ? post.originalPost.authorId
      : post.authorId
  const displayAuthorName =
    isSimpleRepost && post.originalPost
      ? post.originalPost.authorName
      : post.authorName
  const displayAuthorUsername =
    isSimpleRepost && post.originalPost
      ? post.originalPost.authorUsername
      : post.authorUsername
  const displayAuthorProfileImageUrl =
    isSimpleRepost && post.originalPost
      ? post.originalPost.authorProfileImageUrl
      : post.authorProfileImageUrl

  const authorIsNPC = isNpcIdentifier(displayAuthorId)
  const showVerifiedBadge = authorIsNPC

  const quotedPostId = post.originalPost
    ? post.originalPostId
    : post.isRepost && post.isQuote
      ? post.id
      : null

  const handleCardClick = () => {
    if (isSimpleRepost && post.originalPostId) {
      navigate(`/post/${post.originalPostId}`)
    } else {
      navigate(`/post/${post.id}`)
    }
  }

  const handleQuotedPostClick = (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()

    if (quotedPostId) {
      navigate(`/post/${quotedPostId}`)
    }
  }

  const handleQuotedPostKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return
    }

    event.preventDefault()
    event.stopPropagation()

    if (quotedPostId) {
      navigate(`/post/${quotedPostId}`)
    }
  }

  if (post.deletedAt) {
    return (
      <article
        className={cn(
          'px-4 py-3',
          'w-full overflow-hidden',
          'border-border/5 border-b',
          className
        )}
      >
        <div className="flex items-center justify-center py-8 text-muted-foreground italic">
          (no post)
        </div>
      </article>
    )
  }

  return (
    <article
      className={cn(
        'px-4 py-3',
        !isDetail &&
          'cursor-pointer transition-all duration-200 hover:bg-muted/30',
        'w-full overflow-hidden',
        'border-border/5 border-b',
        className
      )}
      style={{
        fontSize: `${fontSize}rem`,
      }}
      onClick={!isDetail ? handleCardClick : undefined}
    >
      {/* Repost Indicator */}
      {isSimpleRepost && (
        <div className="mb-3 flex items-center gap-3 text-muted-foreground text-sm">
          <Repeat2 size={14} className="text-green-600" />
          <span>
            Reposted by{' '}
            {user?.id === post.authorId ? (
              <span className="font-semibold text-foreground">you</span>
            ) : (
              <Link
                to={getProfileUrl(post.authorId, post.authorUsername)}
                className="font-semibold text-foreground hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {post.authorName}
              </Link>
            )}
          </span>
        </div>
      )}

      {/* Row 1: Avatar + Name/Handle/Timestamp Header */}
      {!isSimpleRepost && (
        <div className="mb-3 flex w-full items-start gap-3">
          <Link
            to={getProfileUrl(displayAuthorId, displayAuthorUsername)}
            className="shrink-0 transition-opacity hover:opacity-80"
            onClick={(e) => e.stopPropagation()}
          >
            <Avatar
              id={displayAuthorId}
              name={displayAuthorName}
              type={post.type === 'article' ? 'business' : 'actor'}
              size="md"
              src={displayAuthorProfileImageUrl || undefined}
              scaleFactor={
                isDetail
                  ? fontSize
                  : fontSize * (isDesktop ? 1.4 : isMobile ? 0.8 : 1)
              }
            />
          </Link>

          <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col">
              <div className="flex min-w-0 items-center gap-1.5">
                <Link
                  to={getProfileUrl(displayAuthorId, displayAuthorUsername)}
                  className="truncate font-semibold text-foreground text-lg hover:underline sm:text-xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  {displayAuthorName}
                </Link>
                {showVerifiedBadge && (
                  <VerifiedBadge size="md" className="sm:h-6 sm:w-6" />
                )}
              </div>
              <Link
                to={getProfileUrl(displayAuthorId, displayAuthorUsername)}
                className="truncate text-base text-muted-foreground hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                @{displayAuthorUsername || displayAuthorId}
              </Link>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <time
                className="text-base text-muted-foreground"
                title={postDate.toLocaleString()}
              >
                {timeAgo}
              </time>
              {user && user.id !== displayAuthorId && (
                <div onClick={(e) => e.stopPropagation()}>
                  <ModerationMenu
                    targetUserId={displayAuthorId}
                    targetUsername={displayAuthorUsername || undefined}
                    targetDisplayName={displayAuthorName}
                    targetProfileImageUrl={
                      displayAuthorProfileImageUrl || undefined
                    }
                    postId={post.id}
                    isNPC={authorIsNPC}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Row 2: Post Content */}
      {post.type === 'article' ? (
        <div className="mb-3 w-full">
          <div className="mb-3 flex items-start justify-between gap-4">
            <h2 className="flex-1 font-bold text-foreground text-lg leading-tight sm:text-xl">
              {post.articleTitle || 'Untitled Article'}
            </h2>
            {!isDetail && (
              <button
                className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg bg-[#0066FF] px-3 py-2 font-semibold text-primary-foreground text-sm transition-colors hover:bg-[#2952d9]"
                onClick={handleCardClick}
              >
                Read Full Article →
              </button>
            )}
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-3 text-muted-foreground text-sm">
            {post.byline && <span>{post.byline}</span>}
          </div>

          <div className="mb-3 whitespace-pre-wrap break-words text-foreground leading-relaxed">
            {post.content}
          </div>
        </div>
      ) : post.isRepost ? (
        <div className="mb-4 w-full">
          {post.quoteComment && (
            <div className="post-content mb-4 whitespace-pre-wrap break-words text-foreground leading-relaxed">
              <TaggedText
                text={post.quoteComment}
                onTagClick={(tag) => {
                  if (tag.startsWith('@')) {
                    const username = tag.slice(1)
                    navigate(getProfileUrl('', username))
                  } else if (tag.startsWith('$')) {
                    const symbol = tag.slice(1)
                    navigate(`/markets?search=${encodeURIComponent(symbol)}`)
                  }
                }}
              />
            </div>
          )}

          <div
            className={cn(
              'rounded-xl border border-white/10 p-4',
              'bg-white/5',
              'overflow-hidden transition-colors',
              quotedPostId
                ? 'cursor-pointer hover:bg-white/[0.07]'
                : 'cursor-default'
            )}
            role={quotedPostId ? 'link' : undefined}
            tabIndex={quotedPostId ? 0 : undefined}
            aria-label={quotedPostId ? 'View quoted post' : undefined}
            onClick={handleQuotedPostClick}
            onKeyDown={handleQuotedPostKeyDown}
          >
            {post.originalPost ? (
              <>
                <div className="mb-3 flex items-start gap-3">
                  <Link
                    to={getProfileUrl(
                      post.originalPost.authorId,
                      post.originalPost.authorUsername
                    )}
                    className="shrink-0 transition-opacity hover:opacity-80"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Avatar
                      id={post.originalPost.authorId}
                      name={post.originalPost.authorName}
                      type="actor"
                      size="sm"
                      src={post.originalPost.authorProfileImageUrl || undefined}
                    />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Link
                        to={getProfileUrl(
                          post.originalPost.authorId,
                          post.originalPost.authorUsername
                        )}
                        className="truncate font-semibold text-foreground hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {post.originalPost.authorName}
                      </Link>
                      {isNpcIdentifier(post.originalPost.authorId) && (
                        <VerifiedBadge size="sm" />
                      )}
                    </div>
                    <Link
                      to={getProfileUrl(
                        post.originalPost.authorId,
                        post.originalPost.authorUsername
                      )}
                      className="text-foreground/50 text-sm hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      @
                      {post.originalPost.authorUsername ||
                        post.originalPost.authorId}
                    </Link>
                  </div>
                </div>

                <div className="whitespace-pre-wrap break-words text-foreground/90 leading-relaxed">
                  <TaggedText
                    text={post.originalPost.content}
                    onTagClick={(tag) => {
                      if (tag.startsWith('@')) {
                        const username = tag.slice(1)
                        navigate(getProfileUrl('', username))
                      } else if (tag.startsWith('$')) {
                        const symbol = tag.slice(1)
                        navigate(
                          `/markets?search=${encodeURIComponent(symbol)}`
                        )
                      }
                    }}
                  />
                </div>
              </>
            ) : (
              <div className="py-4 text-center text-foreground/50 italic">
                This post has been deleted
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="post-content mb-4 w-full whitespace-pre-wrap break-words text-foreground leading-relaxed">
          <TaggedText
            text={post.content}
            onTagClick={(tag) => {
              if (tag.startsWith('@')) {
                const username = tag.slice(1)
                navigate(getProfileUrl('', username))
              } else if (tag.startsWith('$')) {
                const symbol = tag.slice(1)
                navigate(`/markets?search=${encodeURIComponent(symbol)}`)
              }
            }}
          />
        </div>
      )}

      {/* Row 3: Interaction Bar */}
      {showInteractions && (
        <div onClick={(e) => e.stopPropagation()} className="w-full">
          <InteractionBar
            postId={post.id}
            initialInteractions={initialInteractions}
            onCommentClick={onCommentClick}
            postData={post}
          />
        </div>
      )}
    </article>
  )
})
