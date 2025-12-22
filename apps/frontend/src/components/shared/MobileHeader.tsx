import { cn, getDisplayReferralUrl, getReferralUrl } from '@babylon/shared';
import { useQuery } from '@tanstack/react-query';
import {
  Bell,
  Check,
  Copy,
  Gift,
  Home,
  LogOut,
  MessageCircle,
  TrendingUp,
  Trophy,
  X,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Avatar } from './Avatar';
import { useAuth } from '../../hooks/useAuth';
import { useUnreadNotifications } from '../../hooks/useUnreadNotifications';
import { useAuthStore } from '../../stores/authStore';
import { apiFetch } from '../../lib/api';

interface ProfileResponse {
  user?: {
    profileImageUrl?: string;
    coverImageUrl?: string;
    reputationPoints?: number;
  };
}

interface BalanceResponse {
  balance: number | string;
}

/**
 * Mobile header content component for mobile devices.
 */
function MobileHeaderContent() {
  const { authenticated, logout } = useAuth();
  const { user, setUser } = useAuthStore();
  const [showSideMenu, setShowSideMenu] = useState(false);
  const [copiedReferral, setCopiedReferral] = useState(false);
  const location = useLocation();
  const pathname = location.pathname;

  const isWaitlistMode = import.meta.env.VITE_WAITLIST_MODE === 'true';
  const isHomePage = pathname === '/';
  const shouldHide = isWaitlistMode && isHomePage;

  const { data: profileData } = useQuery({
    queryKey: ['mobileHeader', 'profile', user?.id],
    queryFn: async (): Promise<ProfileResponse> => {
      if (!user?.id) return {};

      const response = await apiFetch(
        `/api/users/${encodeURIComponent(user.id)}/profile`
      );

      if (!response.ok) return {};
      return response.json() as Promise<ProfileResponse>;
    },
    enabled: authenticated && !!user?.id,
    refetchInterval: 30000,
  });

  const { data: balanceData } = useQuery({
    queryKey: ['mobileHeader', 'balance', user?.id],
    queryFn: async (): Promise<BalanceResponse> => {
      if (!user?.id) {
        return { balance: 0 };
      }

      const response = await apiFetch(
        `/api/users/${encodeURIComponent(user.id)}/balance`
      );

      if (!response.ok) {
        return { balance: 0 };
      }

      return response.json() as Promise<BalanceResponse>;
    },
    enabled: authenticated && !!user?.id,
    refetchInterval: 30000,
  });

  const { unreadCount: unreadNotifications } = useUnreadNotifications();

  const pointsData = {
    available: Number(balanceData?.balance ?? 0),
    total: user?.reputationPoints ?? 0,
  };

  useEffect(() => {
    if (!user || user.profileImageUrl) return;

    const profileUrl = profileData?.user?.profileImageUrl;
    const coverUrl = profileData?.user?.coverImageUrl;
    if (profileUrl || coverUrl) {
      setUser({
        ...user,
        profileImageUrl: profileUrl ?? user.profileImageUrl,
        coverImageUrl: coverUrl ?? user.coverImageUrl,
      });
    }
  }, [profileData, user, setUser]);

  useEffect(() => {
    if (!user || !profileData?.user?.reputationPoints) return;

    if (profileData.user.reputationPoints !== user.reputationPoints) {
      setUser({
        ...user,
        reputationPoints: profileData.user.reputationPoints,
      });
    }
  }, [profileData?.user?.reputationPoints, user, setUser]);

  const copyReferralCode = async () => {
    if (!user?.referralCode) return;

    const referralUrl = getReferralUrl(user.referralCode);
    await navigator.clipboard.writeText(referralUrl);
    setCopiedReferral(true);
    setTimeout(() => setCopiedReferral(false), 2000);
  };

  if (shouldHide) {
    return null;
  }

  const menuItems = [
    {
      name: 'Feed',
      href: '/feed',
      icon: Home,
      active: pathname === '/feed' || pathname === '/',
    },
    {
      name: 'Markets',
      href: '/markets',
      icon: TrendingUp,
      active: pathname === '/markets',
    },
    {
      name: 'Chats',
      href: '/chats',
      icon: MessageCircle,
      active: pathname === '/chats',
    },
    {
      name: 'Leaderboards',
      href: '/leaderboard',
      icon: Trophy,
      active: pathname === '/leaderboard',
    },
    {
      name: 'Rewards',
      href: '/rewards',
      icon: Gift,
      active: pathname === '/rewards',
    },
    {
      name: 'Notifications',
      href: '/notifications',
      icon: Bell,
      active: pathname === '/notifications',
    },
  ];

  return (
    <>
      <header
        className={cn(
          'md:hidden',
          'fixed top-0 right-0 left-0 z-40',
          'bg-sidebar/95'
        )}
      >
        <div className="flex h-14 items-center justify-between px-4">
          <div className="w-8 shrink-0">
            {authenticated && user ? (
              <button
                onClick={() => setShowSideMenu(true)}
                className="transition-opacity hover:opacity-80"
                aria-label="Open profile menu"
              >
                <Avatar
                  id={user.id}
                  name={user.displayName ?? user.email ?? 'User'}
                  type="user"
                  size="sm"
                  src={user.profileImageUrl}
                  imageUrl={user.profileImageUrl}
                />
              </button>
            ) : (
              <div className="w-8" />
            )}
          </div>

          <div className="absolute left-1/2 -translate-x-1/2 transform">
            <Link
              to="/feed"
              className="transition-transform duration-300 hover:scale-105"
            >
              <img
                src="/assets/logos/logo.svg"
                alt="Logo"
                className="h-7 w-7"
              />
            </Link>
          </div>

          <div className="w-8 shrink-0" />
        </div>
      </header>

      {/* Side Menu */}
      {showSideMenu && authenticated && user && (
        <>
          <div
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm md:hidden"
            onClick={() => setShowSideMenu(false)}
          />

          <div className="slide-in-from-left fixed top-0 bottom-0 left-0 z-50 flex w-[280px] animate-in flex-col bg-sidebar duration-300 md:hidden">
            <Link
              to="/profile"
              onClick={() => setShowSideMenu(false)}
              className="flex shrink-0 items-center justify-between p-4 transition-colors hover:bg-sidebar-accent"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar
                  id={user.id}
                  name={user.displayName ?? user.email ?? 'User'}
                  type="user"
                  size="md"
                  src={user.profileImageUrl}
                  imageUrl={user.profileImageUrl}
                  className="shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold text-foreground text-sm">
                    {user.displayName ?? user.email ?? 'User'}
                  </div>
                  <div className="truncate text-muted-foreground text-xs">
                    @{user.username ?? `user${user.id.slice(0, 8)}`}
                  </div>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  setShowSideMenu(false);
                }}
                className="shrink-0 p-2 transition-colors hover:bg-muted"
              >
                <X size={20} style={{ color: '#0066FF' }} />
              </button>
            </Link>

            <div className="shrink-0 bg-muted/30 px-4 py-4">
              <div className="flex items-start gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: '#0066FF' }}
                >
                  <Trophy className="h-5 w-5 text-foreground" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                      Reputation
                    </div>
                    <div className="font-bold text-base text-foreground">
                      {(user.reputationPoints ?? 0).toLocaleString()}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="text-muted-foreground text-xs">
                      Trading Balance
                    </div>
                    <div className="font-semibold text-foreground text-sm">
                      {(pointsData.available ?? 0).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <nav className="min-h-0 flex-1 overflow-y-auto">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const hasNotifications =
                  item.name === 'Notifications' && unreadNotifications > 0;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setShowSideMenu(false)}
                    className={cn(
                      'relative flex items-center gap-4 px-4 py-3 transition-colors',
                      item.active
                        ? 'bg-[#0066FF] font-bold text-primary-foreground'
                        : 'font-semibold text-sidebar-foreground hover:bg-sidebar-accent'
                    )}
                  >
                    <div className="relative">
                      <Icon className="h-5 w-5" />
                      {hasNotifications && (
                        <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-blue-500 ring-2 ring-sidebar" />
                      )}
                    </div>
                    <span className="text-base">{item.name}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="shrink-0 border-border border-t bg-sidebar pb-20">
              {user.referralCode && (
                <button
                  onClick={copyReferralCode}
                  className="flex w-full items-center gap-4 px-4 py-3 text-left font-semibold transition-colors hover:bg-sidebar-accent"
                >
                  {copiedReferral ? (
                    <>
                      <Check className="h-5 w-5 text-green-500" />
                      <span className="text-base text-green-500">
                        Referral Link Copied
                      </span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-5 w-5" style={{ color: '#0066FF' }} />
                      <div className="min-w-0 flex-1">
                        <div className="text-base text-foreground">
                          Copy Referral Link
                        </div>
                        <div className="truncate font-mono text-muted-foreground text-xs">
                          {getDisplayReferralUrl(user.referralCode)}
                        </div>
                      </div>
                    </>
                  )}
                </button>
              )}

              {user.referralCode && <div className="border-border border-t" />}

              <button
                onClick={() => {
                  setShowSideMenu(false);
                  logout();
                }}
                className="flex w-full items-center gap-4 px-4 py-3 text-left font-semibold text-destructive transition-colors hover:bg-destructive/10"
              >
                <LogOut className="h-5 w-5" />
                <span className="text-base">Logout</span>
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

/**
 * Mobile header component for mobile devices.
 */
export function MobileHeader() {
  return <MobileHeaderContent />;
}
