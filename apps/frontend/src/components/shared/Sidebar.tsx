import { cn, getReferralUrl } from '@babylon/shared';
import {
  Bell,
  Bot,
  Check,
  Copy,
  Gift,
  Home,
  LogOut,
  MessageCircle,
  Shield,
  TrendingUp,
  Trophy,
  User,
  Vote,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { Avatar } from './Avatar';
import { Separator } from './Separator';
import { useAuth } from '../../hooks/useAuth';
import { useUnreadMessages } from '../../hooks/useUnreadMessages';
import { useUnreadNotifications } from '../../hooks/useUnreadNotifications';

/**
 * Main sidebar content component with navigation and user menu.
 */
function SidebarContent() {
  const [showMdMenu, setShowMdMenu] = useState(false);
  const [copiedReferral, setCopiedReferral] = useState(false);
  const mdMenuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const pathname = location.pathname;
  const { ready, authenticated, user, logout } = useAuth();
  const { totalUnread: unreadMessages } = useUnreadMessages();
  const { unreadCount: unreadNotifications } = useUnreadNotifications();

  const isWaitlistMode = import.meta.env.VITE_WAITLIST_MODE === 'true';
  const isHomePage = pathname === '/';
  const shouldHideSidebar = isWaitlistMode && isHomePage;

  const isAdmin = user ? (user.isAdmin ?? false) : false;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        mdMenuRef.current &&
        !mdMenuRef.current.contains(event.target as Node)
      ) {
        setShowMdMenu(false);
      }
    };

    if (showMdMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () =>
        document.removeEventListener('mousedown', handleClickOutside);
    }
    return undefined;
  }, [showMdMenu]);

  const copyReferralCode = async () => {
    if (!user?.referralCode) return;

    const referralUrl = getReferralUrl(user.referralCode);
    await navigator.clipboard.writeText(referralUrl);
    setCopiedReferral(true);
    setTimeout(() => setCopiedReferral(false), 2000);
  };

  if (shouldHideSidebar) {
    return null;
  }

  const navItems = [
    {
      name: 'Home',
      href: '/feed',
      icon: Home,
      color: '#0066FF',
      active: pathname === '/feed' || pathname === '/',
    },
    {
      name: 'Notifications',
      href: '/notifications',
      icon: Bell,
      color: '#0066FF',
      active: pathname === '/notifications',
    },
    {
      name: 'Leaderboard',
      href: '/leaderboard',
      icon: Trophy,
      color: '#0066FF',
      active: pathname === '/leaderboard',
    },
    {
      name: 'Markets',
      href: '/markets',
      icon: TrendingUp,
      color: '#0066FF',
      active: pathname === '/markets',
    },
    {
      name: 'Chats',
      href: '/chats',
      icon: MessageCircle,
      color: '#0066FF',
      active: pathname === '/chats',
    },
    {
      name: 'Agents',
      href: '/agents',
      icon: Bot,
      color: '#0066FF',
      active: pathname === '/agents' || pathname.startsWith('/agents/'),
    },
    {
      name: 'DAO',
      href: '/dao',
      icon: Vote,
      color: '#22c55e',
      active: pathname === '/dao',
    },
    {
      name: 'Rewards',
      href: '/rewards',
      icon: Gift,
      color: '#a855f7',
      active: pathname === '/rewards',
    },
    {
      name: 'Profile',
      href: '/profile',
      icon: User,
      color: '#0066FF',
      active: pathname === '/profile',
    },
    ...(isAdmin
      ? [
          {
            name: 'Admin',
            href: '/admin',
            icon: Shield,
            color: '#f97316',
            active: pathname === '/admin',
          },
        ]
      : []),
  ];

  return (
    <>
      <aside
        className={cn(
          'sticky top-0 isolate z-40 hidden h-screen md:flex md:flex-col',
          'bg-sidebar',
          'transition-all duration-300',
          'md:w-20 lg:w-64'
        )}
      >
        {/* Header - Logo */}
        <div className="flex items-center justify-center p-6 lg:justify-start">
          <Link
            to="/feed"
            className="transition-transform duration-300 hover:scale-105"
          >
            <img
              src="/assets/logos/logo.svg"
              alt="Logo"
              className="h-8 w-8 lg:hidden"
            />
            <img
              src="/assets/logos/logo_full.svg"
              alt="Babylon"
              className="hidden h-8 w-auto lg:block"
            />
          </Link>
        </div>

        {/* Navigation */}
        <nav className="pointer-events-auto relative z-20 flex-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const hasNotificationBadge =
              (item.name === 'Notifications' && unreadNotifications > 0) ||
              (item.name === 'Chats' && unreadMessages > 0);
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  'group pointer-events-auto relative z-10 flex items-center px-4 py-3',
                  'transition-colors duration-200',
                  'md:justify-center lg:justify-start',
                  !item.active && 'bg-transparent hover:bg-sidebar-accent'
                )}
                title={item.name}
                style={{
                  backgroundColor: item.active ? item.color : undefined,
                }}
                onMouseEnter={(e) => {
                  if (!item.active) {
                    e.currentTarget.style.backgroundColor = item.color;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!item.active) {
                    e.currentTarget.style.backgroundColor = '';
                  }
                }}
              >
                <div className="relative lg:mr-3">
                  <Icon
                    className={cn(
                      'h-6 w-6 flex-shrink-0',
                      'transition-all duration-300',
                      'group-hover:scale-110',
                      !item.active && 'text-sidebar-foreground'
                    )}
                    style={{
                      color: item.active ? '#e4e4e4' : undefined,
                    }}
                    onMouseEnter={(e) => {
                      if (!item.active) {
                        e.currentTarget.style.color = '#e4e4e4';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!item.active) {
                        e.currentTarget.style.color = '';
                      }
                    }}
                  />
                  {hasNotificationBadge && (
                    <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-blue-500 ring-2 ring-sidebar" />
                  )}
                </div>

                <span
                  className={cn(
                    'hidden lg:block',
                    'text-lg transition-colors duration-300',
                    item.active ? 'font-semibold' : 'text-sidebar-foreground'
                  )}
                  style={{
                    color: item.active ? '#e4e4e4' : undefined,
                  }}
                  onMouseEnter={(e) => {
                    if (!item.active) {
                      e.currentTarget.style.color = '#e4e4e4';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!item.active) {
                      e.currentTarget.style.color = '';
                    }
                  }}
                >
                  {item.name}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Separator */}
        <div className="hidden px-4 py-2 lg:block">
          <Separator />
        </div>

        {/* Bottom Section - Authentication (Desktop lg+) */}
        <div className="hidden p-4 lg:block">
          {!ready ? (
            <div className="flex animate-pulse items-center gap-3 p-3">
              <div className="h-10 w-10 rounded-full bg-sidebar-accent/50" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-4 w-24 rounded bg-sidebar-accent/50" />
                <div className="h-3 w-16 rounded bg-sidebar-accent/30" />
              </div>
            </div>
          ) : authenticated && user ? (
            <div className="flex items-center gap-3 p-3">
              <Avatar
                id={user.id}
                name={user.displayName || user.email || 'User'}
                type="user"
                size="md"
                src={user.profileImageUrl}
                imageUrl={user.profileImageUrl}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate font-bold text-foreground text-sm">
                  {user.displayName || user.email || 'User'}
                </div>
                <div className="truncate text-muted-foreground text-xs">
                  @{user.username ?? `user${user.id.slice(0, 8)}`}
                </div>
              </div>
              <button
                onClick={logout}
                className="p-2 text-muted-foreground transition-colors hover:text-destructive"
                title="Logout"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button className="w-full rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
              Login
            </button>
          )}
        </div>

        {/* Bottom Section - User Icon (Tablet md) */}
        {authenticated && user && (
          <div className="relative md:block lg:hidden" ref={mdMenuRef}>
            <div className="flex justify-center p-4">
              <button
                onClick={() => setShowMdMenu(!showMdMenu)}
                className="transition-opacity hover:opacity-80"
                aria-label="Open user menu"
              >
                <Avatar
                  id={user.id}
                  name={user.displayName || user.email || 'User'}
                  type="user"
                  size="md"
                  src={user.profileImageUrl}
                  imageUrl={user.profileImageUrl}
                />
              </button>
            </div>

            {showMdMenu && (
              <div className="absolute bottom-full left-1/2 z-50 mb-2 w-auto -translate-x-1/2 overflow-hidden rounded-lg border border-border bg-sidebar shadow-lg">
                {user.referralCode && (
                  <button
                    onClick={copyReferralCode}
                    className="flex w-full items-center justify-center p-3 transition-colors hover:bg-sidebar-accent"
                    title={copiedReferral ? 'Copied' : 'Copy Referral Link'}
                    aria-label={copiedReferral ? 'Copied' : 'Copy Referral Link'}
                  >
                    {copiedReferral ? (
                      <Check className="h-5 w-5 flex-shrink-0 text-green-500" />
                    ) : (
                      <Copy className="h-5 w-5 flex-shrink-0 text-sidebar-foreground" />
                    )}
                  </button>
                )}

                {user.referralCode && (
                  <div className="border-border border-t" />
                )}

                <button
                  onClick={() => {
                    setShowMdMenu(false);
                    logout();
                  }}
                  className="flex w-full items-center justify-center p-3 text-destructive transition-colors hover:bg-destructive/10"
                  title="Logout"
                  aria-label="Logout"
                >
                  <LogOut className="h-5 w-5 flex-shrink-0" />
                </button>
              </div>
            )}
          </div>
        )}
      </aside>
    </>
  );
}

/**
 * Sidebar component with navigation and user menu.
 */
export function Sidebar() {
  return <SidebarContent />;
}
