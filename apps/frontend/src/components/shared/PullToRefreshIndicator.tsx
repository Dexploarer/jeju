/**
 * Pull to Refresh Indicator Component
 */
import { cn } from '@babylon/shared'

export interface PullToRefreshIndicatorProps {
  pulling?: boolean
  refreshing?: boolean
  className?: string
}

export function PullToRefreshIndicator({
  pulling: _pulling,
  refreshing,
  className,
}: PullToRefreshIndicatorProps) {
  if (!refreshing) return null

  return (
    <div className={cn('flex items-center justify-center py-4', className)}>
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  )
}
