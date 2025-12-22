import { getDisplayReferralUrl, getReferralUrl } from '@babylon/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Copy, Key, LogOut, Settings } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar } from '@/components/shared/Avatar';
import { Dropdown, DropdownItem } from '@/components/shared/Dropdown';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/stores/authStore';

/**
 * Balance API response.
 */
interface BalanceResponse {
  balance: number | string;
}

/**
 * Profile API response.
 */
interface ProfileResponse {
  user?: {
    reputationPoints?: number;
  };
}

/**
 * User menu component displaying user profile and account actions.
 *
 * Shows user avatar, name, username, points balance, referral code, and logout
 * option in a dropdown menu. Automatically fetches and refreshes user data every
 * 30 seconds. Prevents duplicate API calls across multiple instances.
 *
 * Features:
 * - User profile display with avatar
 * - Points balance (total reputation and available trading balance)
 * - Referral code copy functionality
 * - Logout action
 *
 * @returns User menu dropdown element or null if no user
 */
export function UserMenu() {
  const { logout, refresh } = useAuth();
  const { user, setUser } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [copiedCode, setCopiedCode] = useState(false);

  // Fetch trading balance
  const { data: balanceData } = useQuery({
    queryKey: ['userMenu', 'balance', user?.id],
    queryFn: async (): Promise<BalanceResponse> => {
      const token = window.__oauth3AccessToken ?? null;
      if (!token || !user?.id) {
        return { balance: 0 };
      }

      const response = await fetch(
        `/api/users/${encodeURIComponent(user.id)}/balance`,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        return { balance: 0 };
      }

      return response.json() as Promise<BalanceResponse>;
    },
    enabled: !!user?.id,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch profile for reputation points
  const { data: profileData } = useQuery({
    queryKey: ['userMenu', 'profile', user?.id],
    queryFn: async (): Promise<ProfileResponse> => {
      const token = window.__oauth3AccessToken ?? null;
      if (!token || !user?.id) {
        return {};
      }

      const response = await fetch(
        `/api/users/${encodeURIComponent(user.id)}/profile`,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        return {};
      }

      return response.json() as Promise<ProfileResponse>;
    },
    enabled: !!user?.id,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const tradingBalance = Number(balanceData?.balance ?? 0);

  // Update reputation points in auth store when profile data changes
  useEffect(() => {
    if (profileData?.user?.reputationPoints !== undefined && user) {
      if (!profileData.user) {
        throw new Error('Profile data user is missing');
      }
      if (profileData.user.reputationPoints !== user.reputationPoints) {
        setUser({
          ...user,
          reputationPoints: profileData.user.reputationPoints,
        });
      }
    }
  }, [profileData?.user?.reputationPoints, user, setUser, profileData?.user]);

  // Listen for rewards-updated events to refresh auth state
  // This ensures the sidebar updates when rewards are claimed elsewhere
  useEffect(() => {
    const handleRewardsUpdated = () => {
      // Refresh the auth state to get latest reputation points
      refresh();
      // Also invalidate queries
      queryClient.invalidateQueries({ queryKey: ['userMenu'] });
    };

    window.addEventListener('rewards-updated', handleRewardsUpdated);
    return () => {
      window.removeEventListener('rewards-updated', handleRewardsUpdated);
    };
  }, [refresh, queryClient]);

  const handleCopyReferralCode = async () => {
    if (!user?.referralCode) return;
    const referralUrl = getReferralUrl(user.referralCode);
    await navigator.clipboard.writeText(referralUrl);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  if (!user) {
    return null;
  }

  const displayName =
    user.displayName || user.email?.split('@')[0] || 'Anonymous';
  const username = user.username || `user${user.id.slice(0, 8)}`;

  const trigger = (
    <div
      data-testid="user-menu"
      className="flex cursor-pointer items-center gap-3 rounded-full px-3 py-2.5 transition-colors hover:bg-sidebar-accent"
    >
      <Avatar
        id={user.id}
        name={displayName}
        type="user"
        size="sm"
        src={user.profileImageUrl || undefined}
        imageUrl={user.profileImageUrl || undefined}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-[15px] text-sidebar-foreground leading-5">
          {displayName}
        </p>
        <p className="truncate text-[13px] text-muted-foreground leading-4">
          @{username}
        </p>
      </div>
    </div>
  );

  // Use reputation points from authStore (synced when rewards are claimed)
  const reputationPoints = user.reputationPoints ?? 0;
  const tradingBalanceValue = tradingBalance;

  return (
    <Dropdown trigger={trigger} placement="top-right" width="default">
      {/* Points Display */}
      <div className="border-sidebar-accent border-b px-5 py-4">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-muted-foreground text-sm">
            Reputation
          </span>
          <span className="font-bold text-foreground text-xl">
            {reputationPoints.toLocaleString()}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-muted-foreground text-xs">Trading Balance</span>
          <span className="font-semibold text-foreground text-sm">
            {tradingBalanceValue.toLocaleString()}
          </span>
        </div>
      </div>

      {user?.referralCode && (
        <DropdownItem onClick={handleCopyReferralCode}>
          <div className="flex items-center gap-3 py-2">
            {copiedCode ? (
              <>
                <Check className="h-5 w-5 text-green-500" />
                <span className="font-semibold text-green-500 text-sm">
                  Link Copied!
                </span>
              </>
            ) : (
              <>
                <Copy className="h-5 w-5" style={{ color: '#0066FF' }} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="font-semibold text-foreground text-sm">
                    Copy Referral Link
                  </span>
                  <span className="truncate font-mono text-muted-foreground text-xs">
                    {getDisplayReferralUrl(user.referralCode)}
                  </span>
                </div>
              </>
            )}
          </div>
        </DropdownItem>
      )}

      <DropdownItem onClick={() => navigate('/settings')}>
        <div className="flex items-center gap-3 py-2">
          <Settings className="h-5 w-5" style={{ color: '#0066FF' }} />
          <span className="font-semibold text-foreground text-sm">
            Settings
          </span>
        </div>
      </DropdownItem>

      <DropdownItem onClick={() => navigate('/settings?tab=api')}>
        <div className="flex items-center gap-3 py-2">
          <Key className="h-5 w-5" style={{ color: '#0066FF' }} />
          <span className="font-semibold text-foreground text-sm">
            API Keys
          </span>
        </div>
      </DropdownItem>

      <DropdownItem onClick={logout}>
        <div className="flex items-center gap-3 py-2 text-destructive hover:text-destructive/90">
          <LogOut className="h-5 w-5" />
          <span className="font-semibold">Logout</span>
        </div>
      </DropdownItem>
    </Dropdown>
  );
}
