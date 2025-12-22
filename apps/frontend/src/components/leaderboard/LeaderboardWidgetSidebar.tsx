import { formatCurrency } from '@babylon/shared'
import { ExternalLink, TrendingUp, Trophy, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useEffect, useRef } from 'react'
import { OnChainBadge } from '../profile/OnChainBadge'
import { Avatar } from '../shared/Avatar'
import { RankBadge, RankNumber } from '../shared/RankBadge'
import { VerifiedBadge } from '../shared/VerifiedBadge'

export interface SelectedUser {
  id: string
  username: string | null
  displayName: string | null
  profileImageUrl: string | null
  allPoints: number
  invitePoints: number
  earnedPoints: number
  bonusPoints: number
  referralCount: number
  balance: number
  lifetimePnL: number
  rank: number
  isActor?: boolean
  tier?: string | null
  onChainRegistered?: boolean
  nftTokenId?: number | null
}

interface LeaderboardWidgetSidebarProps {
  selectedUser: SelectedUser | null
  pointsCategory: 'all' | 'earned' | 'referral'
}

/**
 * Widget sidebar for leaderboard page.
 *
 * Shows selected user's profile info, stats, and a link to their profile.
 * Implements smart scrolling behavior on XL+ screens.
 */
export function LeaderboardWidgetSidebar({
  selectedUser,
  pointsCategory,
}: LeaderboardWidgetSidebarProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    const inner = innerRef.current
    if (!container || !inner) return

    // Only run on xl+ screens
    if (window.innerWidth < 1280) return

    let lastScrollTop = 0
    let direction: 'up' | 'down' = 'down'
    let translateY = 0
    let ticking = false

    const updateSidebar = () => {
      const scrollTop = document.scrollingElement?.scrollTop || 0
      const viewportHeight = window.innerHeight
      const sidebarHeight = inner.offsetHeight

      // Determine scroll direction
      if (scrollTop > lastScrollTop) {
        direction = 'down'
      } else if (scrollTop < lastScrollTop) {
        direction = 'up'
      }
      lastScrollTop = scrollTop

      // Check if sidebar fits in viewport
      const fitsInViewport = sidebarHeight <= viewportHeight

      if (fitsInViewport) {
        inner.style.position = 'fixed'
        inner.style.top = '0px'
        inner.style.transform = ''
      } else {
        // Sidebar is taller than viewport - implement bi-directional scroll lock
        const maxTranslate = sidebarHeight - viewportHeight

        if (direction === 'down') {
          // Scrolling down: pin sidebar bottom to viewport bottom
          translateY = Math.min(scrollTop, maxTranslate)
        } else {
          // Scrolling up: gradually reveal top of sidebar
          translateY = Math.max(0, Math.min(scrollTop, maxTranslate))
        }

        inner.style.position = 'fixed'
        inner.style.top = '0px'
        inner.style.transform = `translateY(-${translateY}px)`
      }

      ticking = false
    }

    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(updateSidebar)
        ticking = true
      }
    }

    const handleResize = () => {
      if (window.innerWidth < 1280) {
        if (inner) {
          inner.style.position = ''
          inner.style.top = ''
          inner.style.transform = ''
        }
        return
      }
      updateSidebar()
    }

    updateSidebar()

    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', handleResize, { passive: true })

    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  const getDisplayPoints = (user: SelectedUser) => {
    switch (pointsCategory) {
      case 'all':
        return user.allPoints
      case 'earned':
        return user.earnedPoints
      case 'referral':
        return user.invitePoints
    }
  }

  const getPointsLabel = () => {
    switch (pointsCategory) {
      case 'all':
        return 'All Points'
      case 'earned':
        return 'Earned Points'
      case 'referral':
        return 'Referral Points'
    }
  }

  return (
    <div
      ref={containerRef}
      className="hidden w-96 flex-shrink-0 flex-col xl:flex"
    >
      <div ref={innerRef} className="mr-28 flex flex-col gap-6 px-4 py-6">
        {/* Selected User Widget */}
        <div className="rounded-lg border border-border bg-card/50 p-4 backdrop-blur">
          <h3 className="mb-4 flex items-center gap-2 font-semibold text-foreground">
            <Trophy className="h-5 w-5 text-[#0066FF]" />
            Selected Player
          </h3>

          {selectedUser ? (
            <div className="space-y-4">
              {/* User Header */}
              <div className="flex items-center gap-3">
                <Avatar
                  id={selectedUser.id}
                  name={
                    selectedUser.displayName || selectedUser.username || 'User'
                  }
                  type={selectedUser.isActor ? 'actor' : undefined}
                  size="lg"
                  src={selectedUser.profileImageUrl || undefined}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="truncate font-semibold text-foreground">
                      {selectedUser.displayName ||
                        selectedUser.username ||
                        'Anonymous'}
                    </h4>
                    {selectedUser.isActor ? (
                      <VerifiedBadge size="sm" />
                    ) : (
                      <OnChainBadge
                        isRegistered={selectedUser.onChainRegistered ?? false}
                        nftTokenId={selectedUser.nftTokenId ?? null}
                        size="sm"
                      />
                    )}
                  </div>
                  {selectedUser.username && (
                    <p className="truncate text-muted-foreground text-sm">
                      @{selectedUser.username}
                    </p>
                  )}
                </div>
              </div>

              {/* Rank Display */}
              <div className="flex items-center justify-between rounded-lg bg-muted/30 p-3">
                <div className="flex items-center gap-3">
                  <RankNumber rank={selectedUser.rank} size="lg" />
                  <div>
                    <div className="font-bold text-foreground text-xl">
                      {getDisplayPoints(selectedUser).toLocaleString()}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {getPointsLabel()}
                    </div>
                  </div>
                </div>
                <RankBadge rank={selectedUser.rank} size="lg" showLabel />
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3">
                {/* P&L */}
                <div className="rounded-lg bg-muted/30 p-3">
                  <div className="flex items-center gap-1 text-muted-foreground text-xs">
                    <TrendingUp className="h-3 w-3" />
                    Lifetime P&L
                  </div>
                  <div
                    className={`font-bold ${
                      selectedUser.lifetimePnL === 0
                        ? 'text-muted-foreground'
                        : selectedUser.lifetimePnL > 0
                          ? 'text-green-500'
                          : 'text-red-500'
                    }`}
                  >
                    {selectedUser.lifetimePnL === 0
                      ? formatCurrency(0)
                      : `${selectedUser.lifetimePnL > 0 ? '+' : '-'}${formatCurrency(Math.abs(selectedUser.lifetimePnL))}`}
                  </div>
                </div>

                {/* Referrals */}
                <div className="rounded-lg bg-muted/30 p-3">
                  <div className="flex items-center gap-1 text-muted-foreground text-xs">
                    <Users className="h-3 w-3" />
                    Referrals
                  </div>
                  <div className="font-bold text-foreground">
                    {selectedUser.referralCount}
                  </div>
                </div>

                {/* All Points Breakdown */}
                {selectedUser.allPoints > 0 && (
                  <div className="col-span-2 rounded-lg bg-muted/30 p-3">
                    <div className="mb-2 text-muted-foreground text-xs">
                      Points Breakdown
                    </div>
                    <div className="space-y-1 text-sm">
                      {selectedUser.earnedPoints !== 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Earned</span>
                          <span
                            className={`font-semibold ${selectedUser.earnedPoints > 0 ? 'text-green-500' : 'text-red-500'}`}
                          >
                            {selectedUser.earnedPoints > 0 ? '+' : ''}
                            {selectedUser.earnedPoints.toLocaleString()}
                          </span>
                        </div>
                      )}
                      {selectedUser.invitePoints > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Referral
                          </span>
                          <span className="font-semibold text-primary">
                            +{selectedUser.invitePoints.toLocaleString()}
                          </span>
                        </div>
                      )}
                      {selectedUser.bonusPoints > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Bonus</span>
                          <span className="font-semibold text-yellow-500">
                            +{selectedUser.bonusPoints.toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* View Profile Button */}
              <Link
                to={`/profile/${selectedUser.username || selectedUser.id}`}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0066FF] px-4 py-3 font-semibold text-primary-foreground transition-colors hover:bg-[#2952d9]"
              >
                View Profile
                <ExternalLink className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Trophy className="mb-3 h-12 w-12 text-muted-foreground/50" />
              <p className="mb-1 font-medium text-muted-foreground">
                No Player Selected
              </p>
              <p className="text-muted-foreground text-sm">
                Click on a player in the leaderboard to view their stats
              </p>
            </div>
          )}
        </div>

        {/* Leaderboard Info */}
        <div className="rounded-lg border border-border bg-card/50 p-4 backdrop-blur">
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-foreground">
            <TrendingUp className="h-5 w-5 text-purple-500" />
            How Points Work
          </h3>
          <div className="space-y-2 text-muted-foreground text-sm">
            <p>
              <span className="font-semibold text-foreground">
                Earned Points:
              </span>{' '}
              From trading P&L across perps and prediction markets
            </p>
            <p>
              <span className="font-semibold text-foreground">
                Referral Points:
              </span>{' '}
              Invite friends and earn points when they join
            </p>
            <p>
              <span className="font-semibold text-foreground">
                Bonus Points:
              </span>{' '}
              Complete profile, link email and wallet
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
