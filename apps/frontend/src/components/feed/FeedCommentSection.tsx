import { cn } from '@babylon/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageCircle, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Skeleton } from '../shared/Skeleton';
import { EmptyState } from '../shared/EmptyState';
import { apiFetch, apiCall } from '../../lib/api-client';

/**
 * Comment with replies structure
 */
interface CommentWithReplies {
  id: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  userName: string;
  userUsername: string | null;
  userAvatar?: string;
  parentCommentId?: string;
  parentCommentAuthorName?: string;
  likeCount: number;
  isLiked: boolean;
  replies: CommentWithReplies[];
}

interface PostData {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  authorUsername?: string | null;
  authorProfileImageUrl?: string | null;
  timestamp: string;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  isLiked: boolean;
  isShared: boolean;
}

interface PostResponse {
  data: PostData;
}

interface FeedCommentSectionProps {
  postId: string | null;
  postData?: PostData;
  onClose?: () => void;
}

/**
 * Feed comment section component for displaying post comments.
 * Converted from Next.js to plain React.
 */
export function FeedCommentSection({
  postId,
  postData,
  onClose,
}: FeedCommentSectionProps) {
  const queryClient = useQueryClient();
  const [comments, setComments] = useState<CommentWithReplies[]>([]);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'popular'>('newest');

  // Handle escape key and body scroll lock for modal
  useEffect(() => {
    if (!onClose) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  // Fetch post data
  const { data: post, isLoading: isLoadingPost } = useQuery({
    queryKey: ['post', postId],
    queryFn: async (): Promise<PostData | null> => {
      if (!postId) return null;
      if (postData) return postData;

      const response = await apiFetch(`/api/posts/${postId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch post');
      }
      const result: PostResponse = await response.json();
      return result.data;
    },
    enabled: !!postId,
    initialData: postData || undefined,
  });

  // Load comments
  const loadCommentsData = useCallback(async () => {
    if (!postId) return;
    const response = await apiCall<{ data: { comments: CommentWithReplies[] } }>(
      `/api/posts/${postId}/comments`
    );
    setComments(response.data.comments);
  }, [postId]);

  // Query for comments loading state
  const { isLoading: isLoadingComments } = useQuery({
    queryKey: ['comments', postId],
    queryFn: async () => {
      await loadCommentsData();
      return true;
    },
    enabled: !!postId,
  });

  // Reload comments when comment count changes
  useEffect(() => {
    if (post?.commentCount !== undefined && postId) {
      loadCommentsData();
    }
  }, [post?.commentCount, postId, loadCommentsData]);

  // Helper functions
  const removeCommentById = (
    commentList: CommentWithReplies[],
    commentId: string
  ): CommentWithReplies[] => {
    return commentList
      .filter((comment) => comment.id !== commentId)
      .map((comment) => ({
        ...comment,
        replies: removeCommentById(comment.replies, commentId),
      }));
  };

  const _handleEdit = async (commentId: string, _content: string) => {
    await apiCall(`/api/comments/${commentId}`, {
      method: 'PATCH',
      body: JSON.stringify({ content: _content }),
    });
    await loadCommentsData();
  };

  const _handleDelete = async (commentId: string) => {
    if (!postId) return;
    await apiCall(`/api/comments/${commentId}`, {
      method: 'DELETE',
    });
    setComments((prev) => removeCommentById(prev, commentId));
  };

  const sortedComments = useMemo(() => {
    return [...comments].sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        case 'oldest':
          return (
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
        case 'popular':
          return b.likeCount - a.likeCount;
        default:
          return 0;
      }
    });
  }, [comments, sortBy]);

  if (!postId) {
    return null;
  }

  if (isLoadingPost) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center overflow-hidden bg-background">
        <div className="w-full max-w-md space-y-3 p-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    );
  }

  if (!post) {
    return null;
  }

  const isModal = !!onClose;

  return (
    <>
      {/* Backdrop for modal only */}
      {isModal && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      {/* Modal Container */}
      {isModal ? (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-start justify-center px-4 pt-[10vh]">
          <div
            className={cn(
              'pointer-events-auto relative w-full max-w-[700px] rounded-2xl bg-background shadow-2xl',
              'fade-in-0 zoom-in-95 animate-in duration-200',
              'flex max-h-[85vh] flex-col'
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between gap-4 border-border border-b px-4 py-3">
              <button
                type="button"
                onClick={onClose}
                className="-ml-2 rounded-full p-2 transition-colors hover:bg-muted"
                aria-label="Close"
              >
                <X size={20} />
              </button>
              <div className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-[#0066FF]" />
                <h2 className="font-semibold text-base">Reply</h2>
              </div>
              <div className="w-10" />
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              <div className="px-4 pt-3">
                {/* Post preview would go here */}
                <div className="rounded-lg border border-border p-4">
                  <p className="font-semibold">{post.authorName}</p>
                  <p className="mt-2 text-sm">{post.content}</p>
                </div>
              </div>

              {/* Visual thread connector */}
              <div className="px-4">
                <div className="ml-6 h-4 border-border border-l-2" />
              </div>

              {/* Comment input placeholder */}
              <div className="px-4 pb-4">
                <div className="mt-2 rounded-lg border border-border p-3">
                  <textarea
                    placeholder={`Reply to ${post.authorName}...`}
                    className="w-full resize-none bg-transparent outline-none"
                    rows={3}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Non-modal inline view */
        <div className="relative flex w-full flex-col overflow-hidden bg-background">
          {/* Sort options */}
          {comments.length > 1 && (
            <div className="flex shrink-0 items-center gap-2 bg-background px-4 py-2">
              <span className="text-muted-foreground text-xs">Sort:</span>
              <div className="flex gap-1">
                {(['newest', 'oldest', 'popular'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setSortBy(option)}
                    className={cn(
                      'rounded px-2 py-0.5 text-xs capitalize transition-colors',
                      sortBy === option
                        ? 'bg-[#0066FF] text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Comments list */}
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {isLoadingComments ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-full space-y-3">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              </div>
            ) : sortedComments.length === 0 ? (
              <EmptyState
                icon={MessageCircle}
                title="No comments yet"
                description="Be the first to comment!"
              />
            ) : (
              <div className="space-y-4">
                {sortedComments.map((comment) => (
                  <div key={comment.id} className="rounded-lg border border-border p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold text-sm">{comment.userName}</span>
                      <span className="text-muted-foreground text-xs">
                        @{comment.userUsername || comment.userName}
                      </span>
                    </div>
                    <p className="text-sm">{comment.content}</p>
                    <div className="mt-2 flex items-center gap-4 text-muted-foreground text-xs">
                      <span>{comment.likeCount} likes</span>
                      <span>{comment.replies.length} replies</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
