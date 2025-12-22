import { cn } from '@babylon/shared'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  ArrowUpDown,
  Clock,
  TrendingDown,
  TrendingUp,
  User as UserIcon,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Skeleton } from '../shared/Skeleton'
import { usePredictionMarketStream } from '../../hooks/usePredictionMarketStream'
import { api } from '../../lib/api'

/**
 * Page size for pagination in trades feed.
 */
const PAGE_SIZE = 20
/**
 * Polling interval for fetching new trades (30 seconds).
 */
const POLL_INTERVAL = 30000
/**
 * Scroll threshold in pixels from top to consider "at top" for auto-polling.
 */
const SCROLL_THRESHOLD = 100

/**
 * Base trade user structure shared across trade types.
 */
interface BaseTradeUser {
  id: string
  username: string | null
  displayName: string | null
  profileImageUrl: string | null
  isActor: boolean
}

/**
 * Prediction market position trade structure.
 */
interface PositionTrade {
  id: string
  type: 'position'
  user: BaseTradeUser
  side: string
  shares: number
  avgPrice: number
  amount: number
  timestamp: string
  marketId: string
}

/**
 * Perpetual market trade structure.
 */
interface PerpTrade {
  id: string
  type: 'perp'
  user: BaseTradeUser
  side: string
  size: number
  leverage: number
  entryPrice: number
  currentPrice: number
  unrealizedPnL: number
  liquidationPrice: number
  timestamp: string
  closedAt: string | null
  ticker: string
}

/**
 * NPC trade structure for automated trading.
 */
interface NPCTrade {
  id: string
  type: 'npc'
  user: BaseTradeUser | null
  marketType: string
  ticker: string
  action: string
  side: string | null
  amount: number
  price: number
  sentiment: number | null
  reason: string | null
  timestamp: string
}

/**
 * Balance transaction trade structure.
 */
interface BalanceTrade {
  id: string
  type: 'balance'
  user: BaseTradeUser | null
  transactionType: string
  amount: number
  side?: string | null
  shares?: number | null
  price?: number | null
  size?: number | null
  leverage?: number | null
  ticker?: string
  marketId?: string
  timestamp: string
}

/**
 * Union type for all trade types.
 */
type Trade = PositionTrade | PerpTrade | NPCTrade | BalanceTrade

/**
 * Asset trades feed component for displaying recent trades for a market.
 */
interface AssetTradesFeedProps {
  marketType: 'prediction' | 'perp'
  assetId: string
  containerRef?: React.RefObject<HTMLDivElement | null>
}

/**
 * API response structure for trades endpoint.
 */
interface TradesApiResponse {
  trades: Trade[]
  hasMore: boolean
}

export function AssetTradesFeed({
  marketType,
  assetId,
  containerRef,
}: AssetTradesFeedProps) {
  const [isAtTop, setIsAtTop] = useState(true)
  const [needsRefresh, setNeedsRefresh] = useState(false)

  const loadMoreRef = useRef<HTMLDivElement | null>(null)
  const queryClient = useQueryClient()

  // Use infinite query for paginated trades
  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['markets', 'trades', marketType, assetId],
    queryFn: async ({ pageParam = 0 }): Promise<TradesApiResponse> => {
      const fetchFn =
        marketType === 'prediction'
          ? api.markets.getPredictionTrades
          : api.markets.getPerpTrades

      return fetchFn(assetId, {
        limit: PAGE_SIZE,
        offset: pageParam,
      }) as Promise<TradesApiResponse>
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.hasMore) return undefined
      const totalLoaded = allPages.reduce(
        (acc, page) => acc + page.trades.length,
        0
      )
      return totalLoaded
    },
    refetchInterval: isAtTop ? POLL_INTERVAL : false,
    enabled: !!assetId,
  })

  // Flatten paginated trades and deduplicate
  const trades = useMemo(() => {
    if (!data?.pages) return []
    const allTrades = data.pages.flatMap((page) => page?.trades ?? [])
    // Deduplicate by ID
    const seen = new Set<string>()
    return allTrades.filter((trade) => {
      if (seen.has(trade.id)) return false
      seen.add(trade.id)
      return true
    })
  }, [data?.pages])

  // Refresh trades
  const refreshTrades = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: ['markets', 'trades', marketType, assetId],
    })
  }, [queryClient, marketType, assetId])

  // Handle scroll to detect if user is at top
  useEffect(() => {
    const container = containerRef?.current
    if (!container) return

    const handleScroll = () => {
      const scrollTop = container.scrollTop
      const isNearTop = scrollTop <= SCROLL_THRESHOLD
      setIsAtTop(isNearTop)
    }

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [containerRef])

  // Infinite scroll observer
  useEffect(() => {
    if (!loadMoreRef.current || !hasNextPage || isFetchingNextPage) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void fetchNextPage()
        }
      },
      { threshold: 0.1 }
    )

    observer.observe(loadMoreRef.current)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  // Refresh when at top and needs refresh
  useEffect(() => {
    if (isAtTop && needsRefresh) {
      setNeedsRefresh(false)
      void refreshTrades()
    }
  }, [isAtTop, needsRefresh, refreshTrades])

  usePredictionMarketStream(marketType === 'prediction' ? assetId : null, {
    onTrade: () => {
      if (isAtTop) {
        void refreshTrades()
      } else {
        setNeedsRefresh(true)
      }
    },
    onResolution: () => {
      if (isAtTop) {
        void refreshTrades()
      } else {
        setNeedsRefresh(true)
      }
    },
  })

  const formatCurrency = (value: string | number) => {
    const num = typeof value === 'string' ? Number.parseFloat(value) : value
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num)
  }

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
          <div key={i} className="rounded-lg bg-muted/30 p-4">
            <div className="flex items-start gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="py-12 text-center">
        <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
          <AlertCircle className="h-6 w-6 text-red-500" />
        </div>
        <p className="mb-2 font-medium text-foreground text-sm">
          Failed to load trades
        </p>
        <p className="mb-4 text-muted-foreground text-xs">
          {error instanceof Error ? error.message : 'Unknown error'}
        </p>
        <button
          onClick={() => void refetch()}
          className="rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground text-sm transition-colors hover:bg-primary/90"
        >
          Try Again
        </button>
      </div>
    )
  }

  if (trades.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">No trades yet for this market</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {needsRefresh && !isAtTop && (
        <button
          type="button"
          onClick={() => {
            setNeedsRefresh(false)
            void refreshTrades()
          }}
          className="w-full rounded bg-primary/10 px-3 py-2 font-medium text-primary text-xs transition-colors hover:bg-primary/20"
        >
          New trades available — tap to refresh
        </button>
      )}
      {trades.map((trade) => (
        <TradeCard
          key={trade.id}
          trade={trade}
          formatCurrency={formatCurrency}
          formatTime={formatTime}
        />
      ))}

      {/* Load More Trigger */}
      {hasNextPage && (
        <div ref={loadMoreRef} className="py-4">
          {isFetchingNextPage && (
            <div className="text-center">
              <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
            </div>
          )}
        </div>
      )}

      {!hasNextPage && trades.length > 0 && (
        <div className="py-4 text-center text-muted-foreground text-sm">
          No more trades to load
        </div>
      )}
    </div>
  )
}

interface TradeCardProps {
  trade: Trade
  formatCurrency: (value: string | number) => string
  formatTime: (timestamp: string) => string
}

function TradeCard({ trade, formatCurrency, formatTime }: TradeCardProps) {
  const user = trade.user
  const profileUrl = user?.isActor
    ? `/profile/${user.id}`
    : user?.username
      ? `/profile/${user.username}`
      : '#'

  return (
    <div className="rounded-lg bg-muted/30 p-4 transition-colors hover:bg-muted/50">
      <div className="flex items-start gap-3">
        {/* User Avatar */}
        <Link to={user ? profileUrl : '#'} className="flex-shrink-0">
          {user?.profileImageUrl ? (
            <img
              src={user.profileImageUrl}
              alt={user.displayName || user.username || 'User'}
              className="h-10 w-10 rounded-full"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20">
              <UserIcon className="h-5 w-5 text-primary" />
            </div>
          )}
        </Link>

        {/* Trade Details */}
        <div className="min-w-0 flex-1">
          {/* User Name and Time */}
          <div className="mb-1 flex items-center gap-2">
            <Link
              to={user ? profileUrl : '#'}
              className="truncate font-medium text-sm hover:underline"
            >
              {user?.displayName ?? user?.username ?? 'Unknown'}
            </Link>
            {user?.isActor && (
              <span className="rounded bg-purple-600/20 px-2 py-0.5 text-purple-600 text-xs">
                NPC
              </span>
            )}
            <span className="flex items-center gap-1 text-muted-foreground text-xs">
              <Clock className="h-3 w-3" />
              {formatTime(trade.timestamp)}
            </span>
          </div>

          {/* Trade-specific Content */}
          {trade.type === 'position' && (
            <PositionTradeContent
              trade={trade}
              formatCurrency={formatCurrency}
            />
          )}
          {trade.type === 'perp' && (
            <PerpTradeContent trade={trade} formatCurrency={formatCurrency} />
          )}
          {trade.type === 'npc' && (
            <NPCTradeContent trade={trade} formatCurrency={formatCurrency} />
          )}
          {trade.type === 'balance' && (
            <BalanceTradeContent
              trade={trade}
              formatCurrency={formatCurrency}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function PositionTradeContent({
  trade,
  formatCurrency,
}: {
  trade: PositionTrade
  formatCurrency: (v: number) => string
}) {
  const isYes = trade.side === 'YES'

  return (
    <div className="text-sm">
      <div className="mb-1 flex items-center gap-2">
        <span
          className={cn(
            'rounded px-2 py-0.5 font-medium text-xs',
            isYes
              ? 'bg-green-600/20 text-green-600'
              : 'bg-red-600/20 text-red-600'
          )}
        >
          {trade.side}
        </span>
        <span className="font-medium">{trade.shares.toFixed(2)} shares</span>
        <span className="text-muted-foreground">@</span>
        <span className="font-medium">{formatCurrency(trade.avgPrice)}</span>
      </div>
      <div className="text-muted-foreground">
        Total: {formatCurrency(trade.amount)}
      </div>
    </div>
  )
}

function PerpTradeContent({
  trade,
  formatCurrency,
}: {
  trade: PerpTrade
  formatCurrency: (v: number) => string
}) {
  const isLong = trade.side === 'long'
  const isProfitable = trade.unrealizedPnL >= 0

  return (
    <div className="text-sm">
      <div className="mb-1 flex items-center gap-2">
        <span
          className={cn(
            'flex items-center gap-1 rounded px-2 py-0.5 font-medium text-xs',
            isLong
              ? 'bg-green-600/20 text-green-600'
              : 'bg-red-600/20 text-red-600'
          )}
        >
          {isLong ? (
            <TrendingUp className="h-3 w-3" />
          ) : (
            <TrendingDown className="h-3 w-3" />
          )}
          {trade.side.toUpperCase()}
        </span>
        <span className="font-medium">{trade.leverage}x</span>
        <span className="text-muted-foreground">•</span>
        <span className="font-medium">{formatCurrency(trade.size)}</span>
        <span className="text-muted-foreground">@</span>
        <span className="font-medium">{formatCurrency(trade.entryPrice)}</span>
      </div>
      {!trade.closedAt && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">P&L:</span>
          <span
            className={cn(
              'font-medium',
              isProfitable ? 'text-green-600' : 'text-red-600'
            )}
          >
            {isProfitable ? '+' : ''}
            {formatCurrency(trade.unrealizedPnL)}
          </span>
          <span className="text-muted-foreground">•</span>
          <span className="text-muted-foreground">
            Liq: {formatCurrency(trade.liquidationPrice)}
          </span>
        </div>
      )}
      {trade.closedAt && (
        <div className="text-muted-foreground text-xs">Position closed</div>
      )}
    </div>
  )
}

function NPCTradeContent({
  trade,
  formatCurrency,
}: {
  trade: NPCTrade
  formatCurrency: (v: number) => string
}) {
  return (
    <div className="text-sm">
      <div className="mb-1 flex items-center gap-2">
        <span className="font-medium">{trade.action}</span>
        <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
        <span className="font-medium">{formatCurrency(trade.amount)}</span>
        <span className="text-muted-foreground">@</span>
        <span className="font-medium">{formatCurrency(trade.price)}</span>
      </div>
      {trade.reason && (
        <div className="mt-1 line-clamp-2 text-muted-foreground text-xs italic">
          {trade.reason}
        </div>
      )}
      {trade.sentiment !== null && (
        <div className="mt-1 flex items-center gap-1 text-xs">
          <span className="text-muted-foreground">Sentiment:</span>
          <span
            className={cn(
              'font-medium',
              trade.sentiment > 0
                ? 'text-green-600'
                : trade.sentiment < 0
                  ? 'text-red-600'
                  : 'text-muted-foreground'
            )}
          >
            {trade.sentiment > 0 ? '🟢' : trade.sentiment < 0 ? '🔴' : '⚪'}{' '}
            {(trade.sentiment * 100).toFixed(0)}%
          </span>
        </div>
      )}
    </div>
  )
}

function BalanceTradeContent({
  trade,
  formatCurrency,
}: {
  trade: BalanceTrade
  formatCurrency: (v: number) => string
}) {
  const getActionLabel = (type: string) => {
    switch (type) {
      case 'pred_buy':
        return 'Bought prediction shares'
      case 'pred_sell':
        return 'Sold prediction shares'
      case 'perp_open':
        return 'Opened perp position'
      case 'perp_close':
        return 'Closed perp position'
      case 'perp_liquidation':
        return 'Liquidated'
      default:
        return type
    }
  }

  return (
    <div className="text-sm">
      <div className="mb-1">
        <span className="font-medium">
          {getActionLabel(trade.transactionType)}
        </span>
      </div>
      <div className="flex items-center gap-2 text-muted-foreground text-xs">
        <span>Amount: {formatCurrency(trade.amount)}</span>
        {trade.side && (
          <>
            <span>•</span>
            <span
              className={cn(
                'font-medium',
                trade.side === 'YES' || trade.side === 'long'
                  ? 'text-green-600'
                  : 'text-red-600'
              )}
            >
              {trade.side}
            </span>
          </>
        )}
        {trade.shares && (
          <>
            <span>•</span>
            <span>{trade.shares} shares</span>
          </>
        )}
        {trade.leverage && (
          <>
            <span>•</span>
            <span>{trade.leverage}x leverage</span>
          </>
        )}
      </div>
    </div>
  )
}
