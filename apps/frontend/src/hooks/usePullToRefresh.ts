/**
 * usePullToRefresh Hook
 */
import { useState, useCallback } from 'react'

export interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void>
}

export function usePullToRefresh({ onRefresh }: UsePullToRefreshOptions) {
  const [isPulling, setIsPulling] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    await onRefresh()
    setIsRefreshing(false)
  }, [onRefresh])

  return {
    isPulling,
    isRefreshing,
    setIsPulling,
    handleRefresh,
  }
}
