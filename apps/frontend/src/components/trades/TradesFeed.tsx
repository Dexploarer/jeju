/**
 * TradesFeed Component
 *
 * Displays a feed of user's trades
 */

import { useQuery } from '@tanstack/react-query'
import { Clock } from 'lucide-react'
import { api } from '../../lib/api'
import { Skeleton } from '../shared/Skeleton'

interface TradesFeedProps {
  userId: string
}

interface Trade {
  id: string
  type: string
  ticker?: string
  side: string
  amount: number
  price: number
  timestamp: string
}

interface TradesResponse {
  trades: Trade[]
  hasMore: boolean
}

export function TradesFeed({ userId }: TradesFeedProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['trades', 'feed', userId],
    queryFn: async (): Promise<TradesResponse> => {
      // Fetch user's trade history
      const response = await fetch(
        `${api.API_BASE || ''}/api/users/${encodeURIComponent(userId)}/trades?limit=20`
      )
      if (!response.ok) {
        return { trades: [], hasMore: false }
      }
      return response.json()
    },
  })

  const trades = data?.trades ?? []

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = Date.now()
    const diff = now - date.getTime()

    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    )
  }

  if (trades.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        No trades yet
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {trades.map((trade) => (
        <div
          key={trade.id}
          className="rounded-lg border border-border bg-card p-4"
        >
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{trade.ticker || trade.type}</span>
              <span
                className={`rounded px-2 py-0.5 text-xs ${
                  trade.side === 'buy' || trade.side === 'long'
                    ? 'bg-green-500/20 text-green-500'
                    : 'bg-red-500/20 text-red-500'
                }`}
              >
                {trade.side.toUpperCase()}
              </span>
            </div>
            <span className="flex items-center gap-1 text-muted-foreground text-xs">
              <Clock className="h-3 w-3" />
              {formatTime(trade.timestamp)}
            </span>
          </div>
          <div className="text-muted-foreground text-sm">
            ${trade.amount.toFixed(2)} @ ${trade.price.toFixed(2)}
          </div>
        </div>
      ))}
    </div>
  )
}
