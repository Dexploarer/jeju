import { getProfileUrl, POINTS } from '@babylon/shared';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Award, TrendingUp, UserPlus, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Avatar } from '../shared/Avatar';
import { Skeleton } from '../shared/Skeleton';
import { apiFetch } from '../../lib/api';

interface ReferredUser {
  id: string;
  username: string | null;
  displayName: string | null;
  profileImageUrl: string | null;
  createdAt: Date | string;
  reputationPoints: number;
  isFollowing: boolean;
  joinedAt: Date | string | null;
}

interface ReferralStats {
  totalReferrals: number;
  totalPointsEarned: number;
  pointsPerReferral: number;
  followingCount: number;
  weeklyReferralCount?: number;
  weeklyLimit?: number;
}

interface ReferralWidgetData {
  user: {
    id: string;
    username: string | null;
    displayName: string | null;
    profileImageUrl: string | null;
    referralCode: string | null;
    reputationPoints: number;
  };
  stats: ReferralStats;
  referredUsers: ReferredUser[];
  referralUrl: string | null;
}

interface RewardsWidgetProps {
  userId: string;
}

/**
 * Rewards widget component for displaying referral program information.
 */
export function RewardsWidget({ userId }: RewardsWidgetProps) {
  const { data, isLoading: loading } = useQuery({
    queryKey: ['rewards', 'referrals', userId],
    queryFn: async (): Promise<ReferralWidgetData | null> => {
      const response = await apiFetch(
        `/api/users/${encodeURIComponent(userId)}/referrals`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch referral data');
      }

      return response.json() as Promise<ReferralWidgetData>;
    },
    enabled: !!userId,
    refetchInterval: 30000,
  });

  if (loading) {
    return (
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-sidebar-accent/30 p-4">
        <div className="flex items-center gap-2">
          <Award className="h-5 w-5 text-[#0066FF]" />
          <h3 className="font-semibold text-foreground">Rewards</h3>
        </div>
        <div className="flex items-center justify-center py-8">
          <div className="w-full space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-sidebar-accent/30 p-4">
        <div className="flex items-center gap-2">
          <Award className="h-5 w-5 text-[#0066FF]" />
          <h3 className="font-semibold text-foreground">Rewards</h3>
        </div>
        <p className="text-muted-foreground text-sm">
          Unable to load rewards data
        </p>
      </div>
    );
  }

  const recentReferrals = data.referredUsers.slice(0, 5);

  return (
    <div className="flex flex-col gap-4">
      {/* Stats Summary */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-sidebar-accent/30 p-4">
        <div className="flex items-center gap-2">
          <Award className="h-5 w-5 text-[#0066FF]" />
          <h3 className="font-semibold text-foreground">Rewards</h3>
        </div>

        {/* Total Referrals */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground text-sm">Total</span>
            </div>
            <span className="font-bold text-foreground text-lg">
              {data.stats.totalReferrals}
            </span>
          </div>
          {data.stats.weeklyReferralCount !== undefined &&
            data.stats.weeklyLimit !== undefined && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">This Week</span>
                <span
                  className={`font-semibold ${
                    data.stats.weeklyReferralCount >= data.stats.weeklyLimit
                      ? 'text-red-500'
                      : data.stats.weeklyReferralCount >=
                          data.stats.weeklyLimit * 0.8
                        ? 'text-yellow-500'
                        : 'text-foreground'
                  }`}
                >
                  {data.stats.weeklyReferralCount}/{data.stats.weeklyLimit}
                </span>
              </div>
            )}
        </div>

        {/* Points Earned */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-yellow-500" />
            <span className="text-muted-foreground text-sm">Points Earned</span>
          </div>
          <span className="font-bold text-lg text-yellow-500">
            {data.stats.totalPointsEarned.toLocaleString()}
          </span>
        </div>

        {/* Following */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-[#0066FF]" />
            <span className="text-muted-foreground text-sm">Following</span>
          </div>
          <span className="font-bold text-[#0066FF] text-lg">
            {data.stats.followingCount}
          </span>
        </div>
      </div>

      {/* Recent Referrals */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-sidebar-accent/30 p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground text-sm">
            Recent Referrals
          </h3>
          {data.stats.totalReferrals > 5 && (
            <Link
              to="/rewards"
              className="flex items-center gap-1 text-[#0066FF] text-xs transition-colors hover:text-[#2952d9]"
            >
              View All
              <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>

        {recentReferrals.length === 0 ? (
          <div className="py-6 text-center">
            <Users className="mx-auto mb-2 h-8 w-8 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground text-xs">No referrals yet</p>
            <p className="mt-1 text-muted-foreground text-xs">
              Share your referral link to start earning
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {recentReferrals.map((referredUser) => (
              <Link
                key={referredUser.id}
                to={getProfileUrl(referredUser.id, referredUser.username)}
                className="group flex items-center gap-2 rounded-lg p-2 transition-colors hover:bg-sidebar-accent/50"
              >
                <Avatar
                  id={referredUser.id}
                  name={
                    referredUser.displayName || referredUser.username || 'User'
                  }
                  src={referredUser.profileImageUrl || undefined}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground text-sm transition-colors group-hover:text-[#0066FF]">
                    {referredUser.displayName ||
                      referredUser.username ||
                      'Anonymous'}
                  </p>
                  {referredUser.username && (
                    <p className="truncate text-muted-foreground text-xs">
                      @{referredUser.username}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <span className="font-semibold text-xs text-yellow-500">
                    +{POINTS.REFERRAL_SIGNUP}
                  </span>
                  {referredUser.isFollowing && (
                    <UserPlus className="h-3 w-3 text-[#0066FF]" />
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
