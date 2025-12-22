/**
 * Comment Detail Page
 *
 * @route /comment/:id
 */

import { cn } from '@babylon/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { CommentInput } from '@/components/interactions/CommentInput';
import { LikeButton } from '@/components/interactions/LikeButton';
import { Avatar } from '@/components/shared/Avatar';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageContainer } from '@/components/shared/PageContainer';
import { Skeleton } from '@/components/shared/Skeleton';
import { TaggedText } from '@/components/shared/TaggedText';
import {
  isNpcIdentifier,
  VerifiedBadge,
} from '@/components/shared/VerifiedBadge';
import { MAX_REPLY_COUNT } from '@/lib/constants';

interface CommentDetail {
  id: string;
  content: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorUsername: string | null;
  authorProfileImageUrl: string | null;
  parentCommentId: string | null;
  parentComment: {
    id: string;
    content: string;
    authorId: string;
    authorName: string;
    authorUsername: string | null;
    authorProfileImageUrl: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
  likeCount: number;
  replyCount: number;
  isLiked: boolean;
}

interface Reply {
  id: string;
  content: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorUsername: string | null;
  authorProfileImageUrl: string | null;
  parentCommentId: string | null;
  parentCommentAuthorName: string | null;
  createdAt: string;
  updatedAt: string;
  likeCount: number;
  replyCount: number;
  isLiked: boolean;
}

interface ParentComment {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  authorUsername: string | null;
  authorProfileImageUrl: string | null;
  createdAt: string;
}

interface PostData {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  authorUsername: string | null;
  authorProfileImageUrl: string | null;
  createdAt: string;
}

interface CommentApiResponse {
  comment: CommentDetail;
  replies: Reply[];
  parentChain: ParentComment[];
  post: PostData | null;
}

interface CommentApiResult {
  data?: CommentApiResponse;
  comment?: CommentDetail;
  replies?: Reply[];
  parentChain?: ParentComment[];
  post?: PostData | null;
}

function OriginalPostCard({ post }: { post: PostData }) {
  const navigate = useNavigate();
  const showVerifiedBadge = isNpcIdentifier(post.authorId);

  return (
    <div className="relative">
      <div className="absolute top-10 bottom-0 left-[1.625rem] w-0.5 bg-border sm:left-[1.875rem]" />

      <div
        className="flex cursor-pointer gap-3 px-4 py-3 transition-colors hover:bg-muted/50 sm:px-6"
        onClick={() => navigate(`/post/${post.id}`)}
      >
        <div className="relative z-10 shrink-0">
          <Avatar
            id={post.authorId}
            name={post.authorName}
            size="sm"
            imageUrl={post.authorProfileImageUrl || undefined}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="truncate font-semibold text-sm">
              {post.authorName}
            </span>
            {showVerifiedBadge && <VerifiedBadge size="sm" className="-ml-1" />}
            <span className="truncate text-muted-foreground text-xs">
              @{post.authorUsername || post.authorName}
            </span>
            <span className="text-muted-foreground text-xs">·</span>
            <span className="text-muted-foreground text-xs">
              {formatDistanceToNow(new Date(post.createdAt), {
                addSuffix: true,
              })}
            </span>
          </div>

          <p className="line-clamp-3 text-foreground text-sm">
            <TaggedText text={post.content} />
          </p>
        </div>
      </div>
    </div>
  );
}

function ParentCommentCard({
  parent,
  showConnector,
}: {
  parent: ParentComment;
  showConnector: boolean;
}) {
  const navigate = useNavigate();
  const showVerifiedBadge = isNpcIdentifier(parent.authorId);

  return (
    <div className="relative">
      {showConnector && (
        <div className="absolute top-10 bottom-0 left-[1.625rem] w-0.5 bg-border sm:left-[1.875rem]" />
      )}

      <div
        className="flex cursor-pointer gap-3 px-4 py-3 transition-colors hover:bg-muted/50 sm:px-6"
        onClick={() => navigate(`/comment/${parent.id}`)}
      >
        <div className="relative z-10 shrink-0">
          <Avatar
            id={parent.authorId}
            name={parent.authorName}
            size="sm"
            imageUrl={parent.authorProfileImageUrl || undefined}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="truncate font-semibold text-sm">
              {parent.authorName}
            </span>
            {showVerifiedBadge && <VerifiedBadge size="sm" className="-ml-1" />}
            <span className="truncate text-muted-foreground text-xs">
              @{parent.authorUsername || parent.authorName}
            </span>
            <span className="text-muted-foreground text-xs">·</span>
            <span className="text-muted-foreground text-xs">
              {formatDistanceToNow(new Date(parent.createdAt), {
                addSuffix: true,
              })}
            </span>
          </div>

          <p className="line-clamp-2 text-foreground text-sm">
            <TaggedText text={parent.content} />
          </p>
        </div>
      </div>
    </div>
  );
}

function ReplyCard({
  reply,
  postId,
  onReplySubmit,
}: {
  reply: Reply;
  postId: string;
  onReplySubmit: () => void;
}) {
  const navigate = useNavigate();
  const showVerifiedBadge = isNpcIdentifier(reply.authorId);
  const hasReplies = reply.replyCount > 0;
  const [isReplying, setIsReplying] = useState(false);

  const handleNavigateToReply = () => {
    navigate(`/comment/${reply.id}`);
  };

  return (
    <div className="flex gap-3 border-border border-b py-4 last:border-b-0">
      <div className="shrink-0">
        <Avatar
          id={reply.authorId}
          name={reply.authorName}
          size="sm"
          imageUrl={reply.authorProfileImageUrl || undefined}
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <span className="truncate font-semibold text-sm">
            {reply.authorName}
          </span>
          {showVerifiedBadge && <VerifiedBadge size="sm" className="-ml-1" />}
          <span className="truncate text-muted-foreground text-xs">
            @{reply.authorUsername || reply.authorName}
          </span>
          <span className="text-muted-foreground text-xs">·</span>
          <span className="text-muted-foreground text-xs">
            {formatDistanceToNow(new Date(reply.createdAt), {
              addSuffix: true,
            })}
          </span>
        </div>

        <button
          type="button"
          onClick={handleNavigateToReply}
          className="mb-2 w-full cursor-pointer text-left transition-colors hover:text-muted-foreground"
        >
          <p className="whitespace-pre-wrap break-words text-foreground text-sm">
            <TaggedText
              text={reply.content}
              onTagClick={(tag) => {
                if (tag.startsWith('@')) {
                  const username = tag.slice(1);
                  navigate(`/profile/${username}`);
                } else if (tag.startsWith('$')) {
                  const symbol = tag.slice(1);
                  navigate(`/markets?search=${encodeURIComponent(symbol)}`);
                }
              }}
            />
          </p>
        </button>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIsReplying(!isReplying)}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-2 py-1 text-xs transition-colors',
              'text-muted-foreground hover:bg-[#0066FF]/10 hover:text-[#0066FF]',
              isReplying && 'bg-[#0066FF]/10 text-[#0066FF]'
            )}
          >
            <MessageCircle size={14} />
            <span>
              {hasReplies
                ? reply.replyCount >= MAX_REPLY_COUNT
                  ? `${MAX_REPLY_COUNT}+`
                  : reply.replyCount
                : ''}
            </span>
          </button>

          <LikeButton
            targetId={reply.id}
            targetType="comment"
            initialLiked={reply.isLiked}
            initialCount={reply.likeCount}
            size="sm"
            showCount
          />
        </div>

        {isReplying && (
          <div className="mt-3">
            <CommentInput
              postId={postId}
              parentCommentId={reply.id}
              placeholder={`Reply to ${reply.authorName}...`}
              replyingToName={reply.authorName}
              autoFocus
              onSubmit={async () => {
                setIsReplying(false);
                onReplySubmit();
              }}
              onCancel={() => setIsReplying(false)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default function CommentDetailPage() {
  const { id: commentId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const mainCommentRef = useRef<HTMLDivElement>(null);
  const [isReplying, setIsReplying] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['comment', commentId],
    queryFn: async (): Promise<CommentApiResponse> => {
      const response = await fetch(`/api/comments/${commentId}`);

      if (!response.ok) {
        throw new Error('Comment not found');
      }

      const result = (await response.json()) as CommentApiResult;
      const apiData = result.data ?? result;

      return {
        comment: apiData.comment as CommentDetail,
        replies: apiData.replies ?? [],
        parentChain: apiData.parentChain ?? [],
        post: apiData.post ?? null,
      };
    },
    enabled: !!commentId,
  });

  const comment = data?.comment ?? null;
  const replies = data?.replies ?? [];
  const parentChain = data?.parentChain ?? [];
  const post = data?.post ?? null;

  useEffect(() => {
    if (
      !isLoading &&
      comment &&
      parentChain.length > 0 &&
      mainCommentRef.current
    ) {
      setTimeout(() => {
        mainCommentRef.current?.scrollIntoView({ behavior: 'instant' });
      }, 50);
    }
  }, [isLoading, comment, parentChain.length]);

  const handleReplySubmit = async () => {
    setIsReplying(false);
    await queryClient.invalidateQueries({ queryKey: ['comment', commentId] });
  };

  const showVerifiedBadge = comment ? isNpcIdentifier(comment.authorId) : false;

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex min-h-screen items-center justify-center">
          <div className="w-full max-w-feed space-y-4 px-4 py-3">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </div>
      </PageContainer>
    );
  }

  if (error || !comment) {
    return (
      <PageContainer>
        <div className="flex min-h-screen flex-col items-center justify-center px-4 py-3">
          <div className="text-center">
            <h1 className="mb-2 font-bold text-2xl">Comment Not Found</h1>
            <p className="mb-4 text-muted-foreground">
              {error?.message ||
                'The comment you are looking for does not exist.'}
            </p>
            <button
              onClick={() => navigate('/feed')}
              className="rounded-md bg-primary px-4 py-2 text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Go to Feed
            </button>
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div className="sticky top-0 z-10 shrink-0 border-border border-b bg-background shadow-sm">
          <div className="px-4 py-3 sm:px-6 sm:py-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  if (parentChain.length > 0) {
                    navigate(
                      `/comment/${parentChain[parentChain.length - 1]?.id}`
                    );
                  } else if (post) {
                    navigate(`/post/${post.id}`);
                  } else {
                    navigate('/feed');
                  }
                }}
                className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ArrowLeft size={20} />
              </button>
              <div className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-[#0066FF]" />
                <h1 className="font-semibold text-lg">Thread</h1>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-feed">
            {post && <OriginalPostCard post={post} />}

            {parentChain.length > 0 && (
              <div>
                {parentChain.map((parent, index) => (
                  <ParentCommentCard
                    key={parent.id}
                    parent={parent}
                    showConnector={index < parentChain.length}
                  />
                ))}
              </div>
            )}

            {/* Main comment */}
            <div
              ref={mainCommentRef}
              className="border-border border-b px-4 py-4 sm:px-6"
            >
              <div className="flex gap-3">
                <div className="shrink-0">
                  <Avatar
                    id={comment.authorId}
                    name={comment.authorName}
                    size="md"
                    imageUrl={comment.authorProfileImageUrl || undefined}
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="font-semibold">{comment.authorName}</span>
                    {showVerifiedBadge && (
                      <VerifiedBadge size="sm" className="-ml-1" />
                    )}
                    <span className="text-muted-foreground text-sm">
                      @{comment.authorUsername || comment.authorName}
                    </span>
                  </div>

                  <div className="mb-3">
                    <p className="whitespace-pre-wrap break-words text-base text-foreground leading-relaxed">
                      <TaggedText
                        text={comment.content}
                        onTagClick={(tag) => {
                          if (tag.startsWith('@')) {
                            const username = tag.slice(1);
                            navigate(`/profile/${username}`);
                          } else if (tag.startsWith('$')) {
                            const symbol = tag.slice(1);
                            navigate(
                              `/markets?search=${encodeURIComponent(symbol)}`
                            );
                          }
                        }}
                      />
                    </p>
                  </div>

                  <div className="mb-3 text-muted-foreground text-sm">
                    {new Date(comment.createdAt).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </div>

                  <div className="flex items-center gap-1 border-border border-t pt-3">
                    <button
                      type="button"
                      onClick={() => setIsReplying(!isReplying)}
                      className={cn(
                        'flex items-center gap-1.5 rounded-full px-2 py-1 text-sm transition-colors',
                        'text-muted-foreground hover:bg-[#0066FF]/10 hover:text-[#0066FF]',
                        isReplying && 'bg-[#0066FF]/10 text-[#0066FF]'
                      )}
                    >
                      <MessageCircle size={16} />
                      <span>
                        {comment.replyCount > 0
                          ? comment.replyCount >= MAX_REPLY_COUNT
                            ? `${MAX_REPLY_COUNT}+`
                            : comment.replyCount
                          : ''}
                      </span>
                    </button>

                    <LikeButton
                      targetId={comment.id}
                      targetType="comment"
                      initialLiked={comment.isLiked}
                      initialCount={comment.likeCount}
                      size="sm"
                      showCount
                    />
                  </div>

                  {isReplying && post && (
                    <div className="mt-4">
                      <CommentInput
                        postId={post.id}
                        parentCommentId={comment.id}
                        placeholder={`Reply to ${comment.authorName}...`}
                        replyingToName={comment.authorName}
                        autoFocus
                        onSubmit={handleReplySubmit}
                        onCancel={() => setIsReplying(false)}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Replies section */}
            <div className="px-4 sm:px-6">
              {replies.length === 0 ? (
                <EmptyState
                  icon={MessageCircle}
                  title="No replies yet"
                  description="Be the first to reply"
                  className="py-12"
                />
              ) : (
                <div>
                  {replies.map((reply) => (
                    <ReplyCard
                      key={reply.id}
                      reply={reply}
                      postId={post?.id ?? ''}
                      onReplySubmit={() => {
                        queryClient.invalidateQueries({
                          queryKey: ['comment', commentId],
                        });
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
