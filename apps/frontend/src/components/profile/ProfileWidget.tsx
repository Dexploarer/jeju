import type {
  PerpPositionFromAPI,
  PredictionPosition,
  UserBalanceData,
  UserProfileStats,
} from '@babylon/shared'
import { cn } from '@babylon/shared'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { HelpCircle, TrendingDown, TrendingUp } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { Skeleton } from '../shared/Skeleton'
import { useAuth } from '../../hooks/useAuth'
import { useWidgetCacheStore } from '../../stores/widgetCacheStore'
import { PositionDetailModal } from './PositionDetailModal'
import { api } from '../../lib/api'

/**
 * Profile widget component for displaying user profile summary.
 */
interface ProfileWidgetProps {
  userId: string
}

interface ProfileWidgetData {
  balance: UserBalanceData | null
  predictions: PredictionPosition[]
  perps: PerpPositionFromAPI[]
  stats: UserProfileStats | null
}

interface BalanceResponse {
  balance?: number
  totalDeposited?: number
  totalWithdrawn?: number
  lifetimePnL?: number
}

interface PositionsResponse {
  predictions?: { positions: PredictionPosition[] }
  perpetuals?: { positions: PerpPositionFromAPI[] }
}

interface ProfileResponse {
  needsOnboarding?: boolean
  user?: {
    stats?: {
      following?: number
      followers?: number
      comments?: number
      reactions?: number
      positions?: number
    }
  }
}

export function ProfileWidget({ userId }: ProfileWidgetProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { needsOnboarding, user } = useAuth()
  const widgetCache = useWidgetCacheStore()

  const [modalOpen, setModalOpen] = useState(false)
  const [modalType, setModalType] = useState<'prediction' | 'perp'>(
    'prediction'
  )
  const [selectedPosition, setSelectedPosition] = useState<
    PredictionPosition | PerpPositionFromAPI | null
  >(null)

  const isCurrentUser = user?.id === userId
  const shouldFetch = !!userId && !(isCurrentUser && needsOnboarding)

  const { data, isLoading } = useQuery({
    queryKey: ['profile', 'widget', userId],
    queryFn: async (): Promise<ProfileWidgetData> => {
      const [balanceRes, positionsRes, profileRes] = await Promise.all([
        api.users.getBalance(userId),
        api.markets.getPositions(userId),
        api.users.getProfile(userId),
      ])

      let balanceData: UserBalanceData | null = null
      let predictionsData: PredictionPosition[] = []
      let perpsData: PerpPositionFromAPI[] = []
      let statsData: UserProfileStats | null = null

      const balanceJson = balanceRes as BalanceResponse
      balanceData = {
        balance: Number(balanceJson.balance || 0),
        totalDeposited: Number(balanceJson.totalDeposited || 0),
        totalWithdrawn: Number(balanceJson.totalWithdrawn || 0),
        lifetimePnL: Number(balanceJson.lifetimePnL || 0),
      }

      const positionsJson = positionsRes as PositionsResponse
      predictionsData = positionsJson.predictions?.positions ?? []
      perpsData = positionsJson.perpetuals?.positions ?? []

      const profileJson = profileRes as ProfileResponse
      if (profileJson.needsOnboarding) {
        return {
          balance: null,
          predictions: [],
          perps: [],
          stats: null,
        }
      }

      const userStats = profileJson.user?.stats ?? {}
      statsData = {
        following: userStats.following ?? 0,
        followers: userStats.followers ?? 0,
        totalActivity:
          (userStats.comments ?? 0) +
          (userStats.reactions ?? 0) +
          (userStats.positions ?? 0),
      }

      widgetCache.setProfileWidget(userId, {
        balance: balanceData,
        predictions: predictionsData,
        perps: perpsData,
        stats: statsData,
      })

      return {
        balance: balanceData,
        predictions: predictionsData,
        perps: perpsData,
        stats: statsData,
      }
    },
    enabled: shouldFetch,
    initialData: () => {
      const cached = widgetCache.getProfileWidget(
        userId
      ) as ProfileWidgetData | null
      return cached || undefined
    },
    refetchInterval: 30000,
  })

  const balance = data?.balance ?? null
  const predictions = data?.predictions ?? []
  const perps = data?.perps ?? []
  const stats = data?.stats ?? null

  const formatPoints = (points: number) => {
    return points.toLocaleString('en-US', {
      maximumFractionDigits: 0,
    })
  }

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
  }

  const formatPrice = (price: number) => {
    return `$${price.toFixed(2)}`
  }

  const pointsInPositions = Math.max(
    0,
    (balance?.totalDeposited ?? 0) - (balance?.balance ?? 0)
  )
  const totalPortfolio = balance?.totalDeposited ?? 0
  const pnlPercent =
    totalPortfolio > 0
      ? ((balance?.lifetimePnL ?? 0) / totalPortfolio) * 100
      : 0

  const refreshData = async () => {
    await Promise.all([
      api.users.getBalance(userId),
      api.markets.getPositions(userId),
    ])
    queryClient.invalidateQueries({ queryKey: ['profile', 'widget', userId] })
  }

  if (isLoading) {
    return (
      <div className="flex h-full w-full flex-col overflow-y-auto">
        <div className="flex items-center justify-center py-8">
          <div className="w-full space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto">
      {/* Points Section */}
      <div className="mb-6">
        <h3 className="mb-3 font-bold text-foreground text-lg">Points</h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">Available</span>
            <span className="font-semibold text-foreground text-sm">
              {formatPoints(balance?.balance ?? 0)} pts
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">In Positions</span>
            <span className="font-semibold text-foreground text-sm">
              {formatPoints(pointsInPositions)} pts
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">
              Total Portfolio
            </span>
            <span className="font-semibold text-foreground text-sm">
              {formatPoints(totalPortfolio)} pts
            </span>
          </div>
          <div className="flex items-center justify-between border-border border-t pt-2">
            <span className="text-muted-foreground text-sm">P&L</span>
            <span
              className={cn(
                'font-semibold text-sm',
                (balance?.lifetimePnL ?? 0) >= 0
                  ? 'text-green-600'
                  : 'text-red-600'
              )}
            >
              {formatPoints(balance?.lifetimePnL ?? 0)} pts (
              {formatPercent(pnlPercent)})
            </span>
          </div>
        </div>
      </div>

      {/* Holdings Section */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/markets')}
          className="mb-3 cursor-pointer text-left font-bold text-foreground text-lg transition-colors hover:text-[#0066FF]"
        >
          Holdings
        </button>

        {predictions.length > 0 && (
          <div className="mb-4">
            <button
              onClick={() => navigate('/markets')}
              className="mb-2 block cursor-pointer font-semibold text-muted-foreground text-xs uppercase transition-colors hover:text-[#0066FF]"
            >
              PREDICTIONS
            </button>
            <div className="space-y-2">
              {predictions.slice(0, 3).map((pred) => {
                const pnlPercent =
                  pred.avgPrice > 0
                    ? ((pred.currentPrice - pred.avgPrice) / pred.avgPrice) *
                      100
                    : 0
                return (
                  <button
                    key={pred.id}
                    onClick={() => {
                      setSelectedPosition(pred)
                      setModalType('prediction')
                      setModalOpen(true)
                    }}
                    className="-ml-2 w-full cursor-pointer rounded p-2 text-left text-sm transition-colors hover:bg-muted/30"
                  >
                    <div className="truncate font-medium text-foreground">
                      {pred.question}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {pred.shares} shares {pred.side} @{' '}
                      {formatPrice(pred.avgPrice)}
                    </div>
                    <div
                      className={cn(
                        'mt-0.5 font-medium text-xs',
                        pnlPercent >= 0 ? 'text-green-600' : 'text-red-600'
                      )}
                    >
                      {formatPercent(pnlPercent)}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {perps.length > 0 && (
          <div className="mb-4">
            <button
              onClick={() => navigate('/markets')}
              className="mb-2 block cursor-pointer font-semibold text-muted-foreground text-xs uppercase transition-colors hover:text-[#0066FF]"
            >
              STOCKS
            </button>
            <div className="space-y-2">
              {perps.slice(0, 3).map((perp) => (
                <button
                  key={perp.id}
                  onClick={() => {
                    setSelectedPosition(perp)
                    setModalType('perp')
                    setModalOpen(true)
                  }}
                  className="-ml-2 w-full cursor-pointer rounded p-2 text-left text-sm transition-colors hover:bg-muted/30"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-foreground">
                      {perp.ticker}
                    </span>
                    {perp.unrealizedPnLPercent >= 0 ? (
                      <TrendingUp className="h-3 w-3 text-green-600" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-red-600" />
                    )}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {formatPoints(perp.size)} pts
                  </div>
                  <div
                    className={cn(
                      'mt-0.5 font-medium text-xs',
                      perp.unrealizedPnL >= 0
                        ? 'text-green-600'
                        : 'text-red-600'
                    )}
                  >
                    {formatPoints(perp.unrealizedPnL)} pts (
                    {formatPercent(perp.unrealizedPnLPercent)})
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {predictions.length === 0 && perps.length === 0 && (
          <div className="py-4 text-center text-muted-foreground text-sm">
            No holdings yet
          </div>
        )}
      </div>

      {/* Stats Section */}
      {stats && (
        <div className="mb-6">
          <h3 className="mb-3 font-bold text-foreground text-lg">Stats</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">
                {stats.following} Following
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">
                {stats.followers} Followers
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">
                {stats.totalActivity} Total Activity
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Help Icon */}
      <div className="mt-auto flex justify-end pt-4">
        <button
          type="button"
          className="text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Help"
        >
          <HelpCircle className="h-4 w-4" />
        </button>
      </div>

      {/* Position Detail Modal */}
      <PositionDetailModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setSelectedPosition(null)
        }}
        type={modalType}
        data={selectedPosition}
        userId={userId}
        onSuccess={refreshData}
      />
    </div>
  )
}
