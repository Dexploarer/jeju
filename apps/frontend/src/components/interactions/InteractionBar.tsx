/**
 * InteractionBar Component
 *
 * Post interaction bar with like, comment, share buttons
 */

import type { PostInteraction } from '@babylon/shared'
import { Heart, MessageCircle, Share2 } from 'lucide-react'
import { useState } from 'react'

interface InteractionBarProps {
  postId: string
  initialInteractions: PostInteraction
  onCommentClick?: () => void
  postData?: Record<string, unknown>
}

export function InteractionBar({
  postId,
  initialInteractions,
  onCommentClick,
}: InteractionBarProps) {
  const [interactions, setInteractions] = useState(initialInteractions)

  const handleLike = async () => {
    setInteractions((prev) => ({
      ...prev,
      isLiked: !prev.isLiked,
      likeCount: prev.isLiked ? prev.likeCount - 1 : prev.likeCount + 1,
    }))
    // TODO: Call API to like/unlike post
  }

  const handleShare = async () => {
    setInteractions((prev) => ({
      ...prev,
      isShared: !prev.isShared,
      shareCount: prev.isShared ? prev.shareCount - 1 : prev.shareCount + 1,
    }))
    // TODO: Call API to share/unshare post
  }

  return (
    <div className="flex items-center gap-6">
      <button
        type="button"
        onClick={handleLike}
        className={`flex items-center gap-1.5 transition-colors ${
          interactions.isLiked
            ? 'text-red-500'
            : 'text-muted-foreground hover:text-red-500'
        }`}
      >
        <Heart
          className="h-5 w-5"
          fill={interactions.isLiked ? 'currentColor' : 'none'}
        />
        <span className="text-sm">{interactions.likeCount}</span>
      </button>

      <button
        type="button"
        onClick={onCommentClick}
        className="flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-blue-500"
      >
        <MessageCircle className="h-5 w-5" />
        <span className="text-sm">{interactions.commentCount}</span>
      </button>

      <button
        type="button"
        onClick={handleShare}
        className={`flex items-center gap-1.5 transition-colors ${
          interactions.isShared
            ? 'text-green-500'
            : 'text-muted-foreground hover:text-green-500'
        }`}
      >
        <Share2 className="h-5 w-5" />
        <span className="text-sm">{interactions.shareCount}</span>
      </button>
    </div>
  )
}
