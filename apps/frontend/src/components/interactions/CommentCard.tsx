import { cn } from '@babylon/shared';
import { formatDistanceToNow } from 'date-fns';
import { Edit2, MessageCircle, MoreVertical, Trash2, Heart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

/**
 * Comment with replies structure
 */
interface CommentWithReplies {
  id: string;
  content: string;
  createdAt: Date | string;
  updatedAt: Date | string;
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

interface CommentCardProps {
  comment: CommentWithReplies;
  postId: string;
  onEdit?: (commentId: string, content: string) => Promise<void>;
  onDelete?: (commentId: string) => Promise<void>;
  onReply?: (commentId: string) => void;
  onReplySubmit?: (replyComment: CommentData) => void;
  className?: string;
}

interface CommentData {
  id: string;
  content: string;
  authorId: string;
  author?: {
    displayName?: string;
    username?: string;
    profileImageUrl?: string;
  };
  parentCommentId?: string;
  likeCount?: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

const MAX_REPLY_COUNT = 99;

/**
 * Count total replies recursively
 */
function countAllReplies(replies: CommentWithReplies[]): number {
  let count = replies.length;
  for (const reply of replies) {
    if (reply.replies && reply.replies.length > 0) {
      count += countAllReplies(reply.replies);
    }
  }
  return count;
}

/**
 * Comment card component for displaying comments with Twitter-like threading.
 * Converted from Next.js to plain React.
 */
export function CommentCard({
  comment,
  postId: _postId,
  onReply,
  onEdit,
  onDelete,
  onReplySubmit: _onReplySubmit,
  className,
}: CommentCardProps) {
  const navigate = useNavigate();
  const [showActions, setShowActions] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);

  const hasReplies = comment.replies && comment.replies.length > 0;
  const replyCount = hasReplies ? countAllReplies(comment.replies) : 0;

  const handleReply = () => {
    setIsReplying(true);
    if (onReply) {
      onReply(comment.id);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
    setShowActions(false);
  };

  const handleSaveEdit = () => {
    if (onEdit && editContent.trim() !== comment.content) {
      onEdit(comment.id, editContent.trim());
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditContent(comment.content);
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (onDelete && confirm('Are you sure you want to delete this comment?')) {
      onDelete(comment.id);
    }
    setShowActions(false);
  };

  const handleNavigateToThread = () => {
    navigate(`/comment/${comment.id}`);
  };

  return (
    <div className={cn('flex gap-3', className)}>
      {/* Avatar */}
      <div className="shrink-0">
        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
          {comment.userName.charAt(0).toUpperCase()}
        </div>
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        {/* Header */}
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="truncate font-semibold text-sm">
              {comment.userName}
            </span>
            <span className="truncate text-muted-foreground text-xs">
              @{comment.userUsername || comment.userName}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-muted-foreground text-xs">
              {formatDistanceToNow(new Date(comment.createdAt), {
                addSuffix: true,
              })}
            </span>

            {/* Actions menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowActions(!showActions)}
                className={cn(
                  'rounded-md p-1',
                  'text-muted-foreground hover:text-foreground',
                  'transition-colors hover:bg-muted'
                )}
              >
                <MoreVertical size={16} />
              </button>

              {showActions && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowActions(false)}
                  />
                  <div className="fade-in slide-in-from-top-2 absolute top-full right-0 z-20 mt-1 min-w-[120px] animate-in rounded-md border border-border bg-popover py-1 shadow-lg duration-150">
                    <button
                      type="button"
                      onClick={handleEdit}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                    >
                      <Edit2 size={14} />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-destructive text-sm transition-colors hover:bg-muted"
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Replying to indicator */}
        {comment.parentCommentId && comment.parentCommentAuthorName && (
          <div className="mb-1 flex items-center gap-1 text-muted-foreground text-xs">
            <span>Replying to</span>
            <span className="font-medium text-primary">
              @{comment.parentCommentAuthorName}
            </span>
          </div>
        )}

        {/* Comment body */}
        {isEditing ? (
          <div className="mb-2">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="min-h-[60px] w-full resize-none rounded-md border border-border bg-muted p-2 text-sm focus:border-border focus:outline-none"
              autoFocus
            />
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={!editContent.trim()}
                className="rounded-md bg-primary px-3 py-1 text-primary-foreground text-sm transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                Save
              </button>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="px-3 py-1 text-muted-foreground text-sm transition-colors hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleNavigateToThread}
            className="mb-2 w-full cursor-pointer text-left transition-colors hover:text-muted-foreground"
          >
            <p className="whitespace-pre-wrap break-words text-foreground text-sm">
              {comment.content}
            </p>
          </button>
        )}

        {/* Footer actions */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleReply}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-2 py-1 text-xs transition-colors',
              'text-muted-foreground hover:bg-[#0066FF]/10 hover:text-[#0066FF]',
              isReplying && 'bg-[#0066FF]/10 text-[#0066FF]'
            )}
          >
            <MessageCircle size={14} />
            <span>
              {hasReplies
                ? replyCount >= MAX_REPLY_COUNT
                  ? `${MAX_REPLY_COUNT}+`
                  : replyCount
                : ''}
            </span>
          </button>

          {/* Like button */}
          <button
            type="button"
            className={cn(
              'flex items-center gap-1.5 rounded-full px-2 py-1 text-xs transition-colors',
              'text-muted-foreground hover:bg-red-500/10 hover:text-red-500',
              comment.isLiked && 'text-red-500'
            )}
          >
            <Heart size={14} fill={comment.isLiked ? 'currentColor' : 'none'} />
            <span>{comment.likeCount > 0 ? comment.likeCount : ''}</span>
          </button>
        </div>

        {/* Reply input */}
        {isReplying && (
          <div className="mt-3">
            <div className="rounded-lg border border-border p-3">
              <textarea
                placeholder={`Reply to ${comment.userName}...`}
                className="w-full resize-none bg-transparent outline-none text-sm"
                rows={2}
                autoFocus
              />
              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsReplying(false)}
                  className="px-3 py-1 text-muted-foreground text-sm transition-colors hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="rounded-md bg-primary px-3 py-1 text-primary-foreground text-sm transition-colors hover:bg-primary/90"
                >
                  Reply
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
