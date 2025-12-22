import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  Copy,
  Gift,
  Mail,
  TrendingUp,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { apiFetch } from '../../lib/api';

interface WaitlistData {
  position: number;
  leaderboardRank: number;
  waitlistPosition: number;
  totalAhead: number;
  totalCount: number;
  percentile: number;
  inviteCode: string;
  points: number;
  pointsBreakdown: {
    total: number;
    invite: number;
    earned: number;
    bonus: number;
  };
  referralCount: number;
}

interface TopUser {
  id: string;
  username: string | null;
  displayName: string | null;
  profileImageUrl: string | null;
  invitePoints: number;
  reputationPoints: number;
  referralCount: number;
  rank: number;
}

interface LeaderboardResponse {
  leaderboard: TopUser[];
}

async function fetchWaitlistPosition(
  userId: string
): Promise<WaitlistData | null> {
  const response = await apiFetch(`/api/waitlist/position?userId=${userId}`);
  if (!response.ok) return null;
  return response.json() as Promise<WaitlistData>;
}

async function fetchLeaderboard(): Promise<TopUser[]> {
  const response = await apiFetch('/api/waitlist/leaderboard?limit=10');
  if (!response.ok) return [];
  const data = (await response.json()) as LeaderboardResponse;
  return data.leaderboard ?? [];
}

async function markWaitlisted(params: {
  userId: string;
  referralCode?: string;
}): Promise<void> {
  const response = await apiFetch('/api/waitlist/mark', {
    method: 'POST',
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    throw new Error('Failed to mark as waitlisted');
  }
}

async function awardEmailBonusApi(params: {
  userId: string;
  email: string;
}): Promise<void> {
  const response = await apiFetch('/api/waitlist/bonus/email', {
    method: 'POST',
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    throw new Error('Failed to award email bonus');
  }
}

async function awardWalletBonusApi(params: {
  userId: string;
  walletAddress: string;
}): Promise<void> {
  const response = await apiFetch('/api/waitlist/bonus/wallet', {
    method: 'POST',
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    throw new Error('Failed to award wallet bonus');
  }
}

/**
 * Coming Soon / Waitlist component.
 */
export function ComingSoonV2() {
  const { login, authenticated, user: dbUser, wallet, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const [copiedCode, setCopiedCode] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [previousRank, setPreviousRank] = useState<number | null>(null);
  const [showRankImprovement, setShowRankImprovement] = useState(false);
  const hasSetupWaitlist = useRef(false);

  const userId = dbUser?.id;

  const { data: waitlistData } = useQuery({
    queryKey: ['waitlist-position', userId],
    queryFn: () => fetchWaitlistPosition(userId!),
    enabled: !!userId && authenticated,
  });

  const { data: topUsers = [] } = useQuery({
    queryKey: ['waitlist-leaderboard'],
    queryFn: fetchLeaderboard,
    enabled: !!userId && authenticated,
  });

  const markWaitlistedMutation = useMutation({
    mutationFn: markWaitlisted,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['waitlist-position', userId],
      });
    },
  });

  const emailBonusMutation = useMutation({
    mutationFn: awardEmailBonusApi,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['waitlist-position', userId],
      });
      setShowEmailModal(false);
      setEmailInput('');
    },
    onError: (error: Error) => {
      console.error('Error adding email', error);
    },
  });

  const walletBonusMutation = useMutation({
    mutationFn: awardWalletBonusApi,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['waitlist-position', userId],
      });
    },
  });

  useEffect(() => {
    if (waitlistData?.leaderboardRank) {
      if (
        previousRank !== null &&
        waitlistData.leaderboardRank < previousRank
      ) {
        setShowRankImprovement(true);
        const timeout = setTimeout(() => setShowRankImprovement(false), 5000);
        return () => clearTimeout(timeout);
      }
      setPreviousRank(waitlistData.leaderboardRank);
    }
    return undefined;
  }, [waitlistData?.leaderboardRank, previousRank]);

  useEffect(() => {
    if (!authenticated || !userId || hasSetupWaitlist.current) return undefined;
    if (waitlistData) {
      hasSetupWaitlist.current = true;
      return undefined;
    }

    const setupWaitlist = async () => {
      hasSetupWaitlist.current = true;
      const referralCode = searchParams.get('ref') ?? undefined;

      await markWaitlistedMutation.mutateAsync({ userId, referralCode });

      const emailFromUser = dbUser?.email;
      if (emailFromUser) {
        await emailBonusMutation.mutateAsync({ userId, email: emailFromUser });
      }

      const walletAddress = wallet?.address;
      if (walletAddress) {
        await walletBonusMutation.mutateAsync({ userId, walletAddress });
      }
    };

    void setupWaitlist();
  }, [
    authenticated,
    userId,
    waitlistData,
    dbUser?.email,
    wallet?.address,
    searchParams,
    markWaitlistedMutation,
    emailBonusMutation,
    walletBonusMutation,
  ]);

  const handleCopyInviteCode = useCallback(() => {
    if (waitlistData?.inviteCode) {
      const inviteUrl = `${window.location.origin}/?ref=${waitlistData.inviteCode}&comingsoon=true`;
      void navigator.clipboard.writeText(inviteUrl);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  }, [waitlistData]);

  const handleAddEmail = () => {
    if (!emailInput || !userId) return;
    emailBonusMutation.mutate({ userId, email: emailInput });
  };

  const handleJoinWaitlist = () => {
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set('waitlist', 'true');
    navigate(currentUrl.pathname + currentUrl.search);
    login();
  };

  // Unauthenticated state - Show landing page
  if (!authenticated || !dbUser) {
    return (
      <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-gradient-to-br from-background via-sidebar to-background">
        <div className="absolute inset-0 overflow-hidden opacity-30">
          <div className="absolute -top-40 -right-40 h-80 w-80 animate-pulse rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute -bottom-40 -left-40 h-80 w-80 animate-pulse rounded-full bg-primary/20 blur-3xl" />
        </div>

        <div className="relative z-10 mx-auto max-w-2xl px-6 text-center">
          <div className="mb-8 flex justify-center">
            <div className="relative h-32 w-32 transition-transform duration-300 hover:scale-110">
              <img
                src="/assets/logos/logo.svg"
                alt="Logo"
                className="h-full w-full drop-shadow-2xl"
              />
            </div>
          </div>

          <h1 className="mb-6 font-bold text-6xl text-foreground md:text-7xl">
            Babylon
          </h1>

          <div className="mb-10 space-y-4 text-lg text-muted-foreground md:text-xl">
            <p className="leading-relaxed">
              A satirical prediction market game where you trade with autonomous
              AI agents in a Twitter-style social network.
            </p>
            <p className="leading-relaxed">
              Create markets, debate with NPCs, build relationships, and earn
              rewards in this experimental social prediction platform.
            </p>
          </div>

          <div className="mb-12">
            <button
              onClick={handleJoinWaitlist}
              className="rounded-xl bg-primary px-12 py-5 font-bold text-white text-xl shadow-lg transition-all duration-300 hover:scale-105 hover:bg-primary/90 hover:shadow-xl"
            >
              Join Waitlist
            </button>
            <p className="mt-4 text-muted-foreground text-sm">
              Sign in with X, Farcaster, Gmail, or Wallet
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="rounded-lg border border-border/50 bg-card/50 p-4 backdrop-blur-sm">
              <div className="mb-2 text-3xl">🎯</div>
              <h3 className="mb-1 font-semibold text-foreground">
                Prediction Markets
              </h3>
              <p className="text-muted-foreground text-sm">
                Trade on real-world events
              </p>
            </div>
            <div className="rounded-lg border border-border/50 bg-card/50 p-4 backdrop-blur-sm">
              <div className="mb-2 text-3xl">🤖</div>
              <h3 className="mb-1 font-semibold text-foreground">AI Agents</h3>
              <p className="text-muted-foreground text-sm">
                Interact with autonomous NPCs
              </p>
            </div>
            <div className="rounded-lg border border-border/50 bg-card/50 p-4 backdrop-blur-sm">
              <div className="mb-2 text-3xl">🎮</div>
              <h3 className="mb-1 font-semibold text-foreground">
                Gamified Trading
              </h3>
              <p className="text-muted-foreground text-sm">
                Earn rewards and build influence
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Loading waitlist data
  if (!waitlistData) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-gradient-to-br from-background via-sidebar to-background">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-primary border-b-2" />
          <p className="text-muted-foreground">
            Loading your waitlist position...
          </p>
        </div>
      </div>
    );
  }

  // Authenticated & waitlisted
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-gradient-to-br from-background via-sidebar to-background p-4">
      <div className="absolute inset-0 overflow-hidden opacity-30">
        <div className="absolute -top-40 -right-40 h-80 w-80 animate-pulse rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 animate-pulse rounded-full bg-primary/20 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-3xl">
        <div className="mb-6 flex justify-center">
          <div className="relative h-24 w-24">
            <img
              src="/assets/logos/logo.svg"
              alt="Logo"
              className="h-full w-full drop-shadow-2xl"
            />
          </div>
        </div>

        <h1 className="mb-4 text-center font-bold text-4xl text-foreground md:text-5xl">
          You're on the List
        </h1>

        {showRankImprovement && previousRank && (
          <div className="mb-6 rounded-2xl border-2 border-green-500 bg-green-500/20 p-6">
            <div className="text-center">
              <div className="mb-2 text-4xl">🎉</div>
              <h3 className="mb-2 font-bold text-green-500 text-xl">
                You Moved Up
              </h3>
              <p className="text-foreground">
                From #{previousRank} → #{waitlistData.position}
              </p>
              <p className="mt-2 text-muted-foreground text-sm">
                Keep inviting to move even higher
              </p>
            </div>
          </div>
        )}

        <div className="mb-6 rounded-2xl border border-border bg-card/80 p-8 backdrop-blur-sm">
          <div className="mb-6 flex items-center justify-center gap-3">
            <Users className="h-6 w-6 text-primary" />
            <h2 className="font-bold text-2xl">Your Waitlist Position</h2>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-6">
            <div className="rounded-xl bg-sidebar/50 p-6">
              <div className="mb-2 font-bold text-5xl text-primary">
                #{waitlistData.position}
              </div>
              <div className="text-muted-foreground text-sm">
                Your Position in Line
              </div>
              <div className="mt-1 text-muted-foreground text-xs">
                Top {waitlistData.percentile}% of waitlist
              </div>
            </div>
            <div className="rounded-xl bg-sidebar/50 p-6">
              <div className="mb-2 font-bold text-5xl text-foreground">
                {waitlistData.totalAhead}
              </div>
              <div className="text-muted-foreground text-sm">People Ahead</div>
              <div className="mt-1 text-muted-foreground text-xs">
                Out of {waitlistData.totalCount} total
              </div>
            </div>
          </div>

          <div className="mb-6 rounded-xl bg-sidebar/50 p-6">
            <div className="mb-4 flex items-center justify-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-lg">Your Points</h3>
            </div>
            <div className="mb-4 font-bold text-4xl text-primary">
              {waitlistData.points}
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <div className="font-semibold text-foreground">
                  {waitlistData.pointsBreakdown.invite}
                </div>
                <div className="text-muted-foreground">Invite Points</div>
              </div>
              <div>
                <div className="font-semibold text-foreground">
                  {waitlistData.pointsBreakdown.earned}
                </div>
                <div className="text-muted-foreground">Earned Points</div>
              </div>
              <div>
                <div className="font-semibold text-foreground">
                  {waitlistData.pointsBreakdown.bonus}
                </div>
                <div className="text-muted-foreground">Bonus Points</div>
              </div>
            </div>
          </div>

          {waitlistData.referralCount > 0 && (
            <div className="mb-6 rounded-xl border border-primary/20 bg-primary/10 p-4">
              <div className="flex items-center justify-center gap-2">
                <Gift className="h-5 w-5 text-primary" />
                <span className="font-semibold">
                  You've invited {waitlistData.referralCount}{' '}
                  {waitlistData.referralCount === 1 ? 'person' : 'people'}
                </span>
              </div>
            </div>
          )}

          <div className="border-border border-t pt-6">
            <h3 className="mb-3 font-semibold text-lg">
              Invite Friends & Move Up in Line
            </h3>
            <p className="mb-4 text-muted-foreground text-sm">
              Get <span className="font-bold text-primary">+50 points</span> for
              each friend who joins
              <br />
              <span className="font-bold text-green-500">
                More invites = Better position in line
              </span>
            </p>
            <div className="flex items-center gap-3 rounded-lg bg-sidebar/50 p-4">
              <div className="flex-1 break-all text-left font-mono text-sm">
                {window.location.origin}/?ref={waitlistData.inviteCode}
                &comingsoon=true
              </div>
              <button
                onClick={handleCopyInviteCode}
                className="flex flex-shrink-0 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-white transition-colors hover:bg-primary/90"
              >
                {copiedCode ? (
                  <>
                    <Check className="h-4 w-4" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Bonus Actions */}
        <div className="mb-6 rounded-2xl border border-border bg-card/80 p-6 backdrop-blur-sm">
          <h3 className="mb-4 font-semibold text-lg">Earn More Points</h3>
          <div className="space-y-3">
            {waitlistData.pointsBreakdown.bonus < 50 && (
              <>
                {!dbUser.email && (
                  <button
                    onClick={() => setShowEmailModal(true)}
                    className="flex w-full items-center justify-between rounded-lg bg-sidebar/50 p-4 transition-colors hover:bg-sidebar"
                  >
                    <div className="flex items-center gap-3">
                      <Mail className="h-5 w-5 text-primary" />
                      <span>Add Email Address</span>
                    </div>
                    <span className="font-semibold text-primary">
                      +25 points
                    </span>
                  </button>
                )}
                {wallet?.address ? (
                  <div className="flex w-full items-center justify-between rounded-lg border border-green-500/20 bg-green-500/10 p-4">
                    <div className="flex items-center gap-3">
                      <Check className="h-5 w-5 text-green-500" />
                      <span>Wallet Connected</span>
                    </div>
                    <span className="font-semibold text-green-500">
                      +25 points
                    </span>
                  </div>
                ) : (
                  <button
                    onClick={login}
                    className="flex w-full items-center justify-between rounded-lg bg-sidebar/50 p-4 transition-colors hover:bg-sidebar"
                  >
                    <div className="flex items-center gap-3">
                      <Wallet className="h-5 w-5 text-primary" />
                      <span>Connect Wallet</span>
                    </div>
                    <span className="font-semibold text-primary">
                      +25 points
                    </span>
                  </button>
                )}
              </>
            )}
            {waitlistData.pointsBreakdown.bonus >= 50 && (
              <div className="rounded-lg border border-primary/20 bg-primary/10 p-4 text-center">
                <Check className="mx-auto mb-2 h-6 w-6 text-primary" />
                <div className="font-semibold">All Bonuses Claimed</div>
              </div>
            )}
          </div>
        </div>

        {/* Leaderboard */}
        {topUsers.length > 0 && (
          <div className="mb-6 rounded-2xl border border-border bg-card/80 p-6 backdrop-blur-sm">
            <div className="mb-4 flex items-center justify-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-lg">Top Inviters</h3>
            </div>
            <div className="space-y-2">
              {topUsers.slice(0, 10).map((topUser) => {
                const isCurrentUser = topUser.id === dbUser.id;
                return (
                  <div
                    key={topUser.id}
                    className={`flex items-center justify-between rounded-lg p-3 ${
                      isCurrentUser
                        ? 'border-2 border-primary bg-primary/20'
                        : topUser.rank <= 3
                          ? 'border border-yellow-500/20 bg-yellow-500/10'
                          : 'bg-sidebar/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`font-bold text-lg ${
                          topUser.rank === 1
                            ? 'text-yellow-500'
                            : topUser.rank === 2
                              ? 'text-gray-400'
                              : topUser.rank === 3
                                ? 'text-orange-500'
                                : 'text-muted-foreground'
                        }`}
                      >
                        #{topUser.rank}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 font-semibold">
                          {topUser.displayName ||
                            topUser.username ||
                            'Anonymous'}
                          {isCurrentUser && (
                            <span className="rounded bg-primary px-2 py-0.5 text-white text-xs">
                              YOU
                            </span>
                          )}
                        </div>
                        <div className="text-muted-foreground text-xs">
                          {topUser.referralCount}{' '}
                          {topUser.referralCount === 1 ? 'invite' : 'invites'}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-primary">
                        {topUser.invitePoints}
                      </div>
                      <div className="text-muted-foreground text-xs">
                        points
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="text-center">
          <button
            onClick={logout}
            className="text-muted-foreground text-sm transition-colors hover:text-foreground"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Email Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-bold text-xl">Add Email Address</h3>
              <button
                onClick={() => setShowEmailModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-4 text-muted-foreground text-sm">
              Get notified when Babylon launches and earn +25 points
            </p>
            <input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="your.email@example.com"
              className="mb-4 w-full rounded-lg border border-border bg-sidebar px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              onClick={handleAddEmail}
              disabled={!emailInput || emailBonusMutation.isPending}
              className="w-full rounded-lg bg-primary px-4 py-3 font-semibold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {emailBonusMutation.isPending
                ? 'Adding...'
                : 'Add Email & Earn Points'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
