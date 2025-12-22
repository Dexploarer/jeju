import { useQuery } from '@tanstack/react-query';
import {
  Calendar,
  FileText,
  Heart,
  MessageSquare,
  TrendingUp,
  Trophy,
  User,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { apiFetch } from '../../lib/api';

interface UserProfile {
  id: string;
  username: string | null;
  displayName: string | null;
  bio: string | null;
  profileImageUrl: string | null;
  coverImageUrl: string | null;
  walletAddress: string | null;
  virtualBalance: number;
  lifetimePnL: number;
  reputationPoints: number;
  referralCount: number;
  invitePoints: number;
  createdAt: string;
  stats: {
    positions: number;
    comments: number;
    reactions: number;
    followers: number;
    following: number;
    posts: number;
  };
}

interface UserProfileResponse {
  user: UserProfile | null;
}

interface PlayerStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string | null;
}

/**
 * Player stats modal component.
 */
export function PlayerStatsModal({
  isOpen,
  onClose,
  userId,
}: PlayerStatsModalProps) {
  const {
    data: profile,
    isLoading: loading,
    error,
  } = useQuery({
    queryKey: ['playerStats', 'profile', userId],
    queryFn: async (): Promise<UserProfile> => {
      const response = await apiFetch(`/api/users/${userId}/profile`);
      if (!response.ok) {
        throw new Error('Failed to fetch profile');
      }
      const data: UserProfileResponse = await response.json();
      if (!data.user) {
        throw new Error('User not found');
      }
      return data.user;
    },
    enabled: isOpen && !!userId,
  });

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="mx-auto max-h-[90vh] w-full max-w-2xl overflow-y-auto p-0">
        <div className="p-4 sm:p-5">
          {/* Header with close button */}
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold text-lg sm:text-xl">Player Stats</h2>
            <button
              onClick={onClose}
              className="flex min-h-[36px] min-w-[36px] touch-manipulation items-center justify-center rounded-lg p-1.5 transition-colors hover:bg-background/50"
              aria-label="Close modal"
            >
              <X className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-primary border-b-2 sm:h-8 sm:w-8" />
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
              <p className="mb-3 text-red-500 text-sm">
                {error instanceof Error ? error.message : 'An error occurred'}
              </p>
              <button
                onClick={onClose}
                className="min-h-[44px] touch-manipulation rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground text-sm transition-colors hover:bg-primary/90"
              >
                Close
              </button>
            </div>
          )}

          {profile && !loading && !error && (
            <div className="space-y-4 sm:space-y-5">
              {/* Profile Header */}
              <div className="relative">
                {profile.coverImageUrl && (
                  <div className="relative mb-3 h-20 w-full overflow-hidden rounded-lg sm:h-28">
                    <img
                      src={profile.coverImageUrl}
                      alt="Cover"
                      className="h-full w-full rounded-lg object-cover"
                    />
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full border-2 border-background sm:h-16 sm:w-16">
                    {profile.profileImageUrl ? (
                      <img
                        src={profile.profileImageUrl}
                        alt={profile.displayName || profile.username || 'User'}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-primary/20">
                        <User className="h-7 w-7 text-primary sm:h-8 sm:w-8" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-bold text-base sm:text-lg">
                      {profile.displayName || profile.username || 'Anonymous'}
                    </h3>
                    {profile.username && (
                      <p className="mt-0.5 text-muted-foreground text-xs sm:text-sm">
                        @{profile.username}
                      </p>
                    )}
                    {profile.bio && (
                      <p className="mt-1.5 line-clamp-2 whitespace-pre-wrap break-words text-xs">
                        {profile.bio}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
                <div className="rounded-lg border border-border bg-background/50 p-2.5 sm:p-3">
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <Trophy className="h-3.5 w-3.5 shrink-0 text-yellow-500" />
                    <span className="truncate text-muted-foreground text-xs">
                      Reputation
                    </span>
                  </div>
                  <p className="break-words font-bold text-lg sm:text-xl">
                    {profile.reputationPoints.toLocaleString()}
                  </p>
                </div>

                <div className="rounded-lg border border-border bg-background/50 p-2.5 sm:p-3">
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <Wallet className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span className="truncate text-muted-foreground text-xs">
                      Balance
                    </span>
                  </div>
                  <p className="break-words font-bold text-lg sm:text-xl">
                    ${profile.virtualBalance.toLocaleString()}
                  </p>
                </div>

                <div className="rounded-lg border border-border bg-background/50 p-2.5 sm:p-3">
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <TrendingUp
                      className={`h-3.5 w-3.5 shrink-0 ${profile.lifetimePnL >= 0 ? 'text-green-500' : 'text-red-500'}`}
                    />
                    <span className="truncate text-muted-foreground text-xs">
                      Lifetime PnL
                    </span>
                  </div>
                  <p
                    className={`break-words font-bold text-lg sm:text-xl ${profile.lifetimePnL >= 0 ? 'text-green-500' : 'text-red-500'}`}
                  >
                    ${profile.lifetimePnL >= 0 ? '+' : ''}
                    {profile.lifetimePnL.toLocaleString()}
                  </p>
                </div>

                <div className="rounded-lg border border-border bg-background/50 p-2.5 sm:p-3">
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span className="truncate text-muted-foreground text-xs">
                      Referrals
                    </span>
                  </div>
                  <p className="font-bold text-lg sm:text-xl">
                    {profile.referralCount}
                  </p>
                </div>

                <div className="rounded-lg border border-border bg-background/50 p-2.5 sm:p-3">
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <Trophy className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span className="truncate text-muted-foreground text-xs">
                      Invite Points
                    </span>
                  </div>
                  <p className="break-words font-bold text-lg sm:text-xl">
                    {profile.invitePoints.toLocaleString()}
                  </p>
                </div>

                <div className="rounded-lg border border-border bg-background/50 p-2.5 sm:p-3">
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span className="truncate text-muted-foreground text-xs">
                      Positions
                    </span>
                  </div>
                  <p className="font-bold text-lg sm:text-xl">
                    {profile.stats.positions}
                  </p>
                </div>
              </div>

              {/* Activity Stats */}
              <div className="border-border border-t pt-4">
                <h4 className="mb-3 font-semibold text-sm sm:text-base">
                  Activity
                </h4>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
                  <div className="p-2 text-center">
                    <div className="mb-1 flex items-center justify-center gap-1">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <p className="font-bold text-lg sm:text-xl">
                      {profile.stats.posts}
                    </p>
                    <p className="mt-0.5 text-muted-foreground text-xs">
                      Posts
                    </p>
                  </div>
                  <div className="p-2 text-center">
                    <div className="mb-1 flex items-center justify-center gap-1">
                      <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <p className="font-bold text-lg sm:text-xl">
                      {profile.stats.comments}
                    </p>
                    <p className="mt-0.5 text-muted-foreground text-xs">
                      Comments
                    </p>
                  </div>
                  <div className="p-2 text-center">
                    <div className="mb-1 flex items-center justify-center gap-1">
                      <Heart className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <p className="font-bold text-lg sm:text-xl">
                      {profile.stats.reactions}
                    </p>
                    <p className="mt-0.5 text-muted-foreground text-xs">
                      Reactions
                    </p>
                  </div>
                  <div className="p-2 text-center">
                    <div className="mb-1 flex items-center justify-center gap-1">
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <p className="font-bold text-lg sm:text-xl">
                      {profile.stats.followers}
                    </p>
                    <p className="mt-0.5 text-muted-foreground text-xs">
                      Followers
                    </p>
                  </div>
                </div>
              </div>

              {/* Additional Info */}
              <div className="space-y-1.5 border-border border-t pt-4">
                <div className="flex items-start gap-2 text-muted-foreground text-xs">
                  <Calendar className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span className="break-words">
                    Joined{' '}
                    {new Date(profile.createdAt).toLocaleDateString('en-US', {
                      month: 'long',
                      year: 'numeric',
                      day: 'numeric',
                    })}
                  </span>
                </div>
                {profile.walletAddress && (
                  <div className="flex items-start gap-2 text-muted-foreground text-xs">
                    <Wallet className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span className="break-all font-mono">
                      {profile.walletAddress}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
