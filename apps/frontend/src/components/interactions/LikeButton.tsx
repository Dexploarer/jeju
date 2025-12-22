/**
 * Like Button Component
 */
import { cn } from '@babylon/shared'

export interface LikeButtonProps {
  liked?: boolean
  count?: number
  onClick?: () => void
  className?: string
}

export function LikeButton({ liked, count = 0, onClick, className }: LikeButtonProps) {
  return (
    <button
      className={cn(
        'flex items-center gap-1 text-sm',
        liked ? 'text-red-500' : 'text-muted-foreground',
        className
      )}
      onClick={onClick}
    >
      <span>{liked ? '❤️' : '🤍'}</span>
      <span>{count}</span>
    </button>
  )
}
