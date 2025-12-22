import { cn } from '@babylon/shared';
import { Bell, Bot, Home, MessageCircle, TrendingUp } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useUnreadMessages } from '../../hooks/useUnreadMessages';
import { useUnreadNotifications } from '../../hooks/useUnreadNotifications';

/**
 * Bottom navigation content component for mobile devices.
 */
function BottomNavContent() {
  const location = useLocation();
  const pathname = location.pathname;
  const { totalUnread: unreadMessages } = useUnreadMessages();
  const { unreadCount: unreadNotifications } = useUnreadNotifications();

  const isWaitlistMode = import.meta.env.VITE_WAITLIST_MODE === 'true';
  const isHomePage = pathname === '/';
  const shouldHide = isWaitlistMode && isHomePage;

  if (shouldHide) {
    return null;
  }

  const navItems = [
    {
      name: 'Feed',
      href: '/feed',
      icon: Home,
      color: '#0066FF',
      active: pathname === '/feed' || pathname === '/',
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
      name: 'Notifications',
      href: '/notifications',
      icon: Bell,
      color: '#0066FF',
      active: pathname === '/notifications',
    },
  ];

  return (
    <nav className="fixed right-0 bottom-0 bottom-nav-rounded left-0 z-50 border-border border-t bg-sidebar md:hidden">
      <div className="safe-area-bottom flex h-14 items-center justify-between px-4">
        <div className="flex flex-1 items-center justify-around">
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
                  'flex h-12 w-12 items-center justify-center rounded-lg transition-colors duration-200',
                  'hover:bg-sidebar-accent/50',
                  'relative'
                )}
                aria-label={item.name}
              >
                <Icon
                  className={cn(
                    'h-6 w-6 transition-colors duration-200',
                    item.active
                      ? 'text-sidebar-primary'
                      : 'text-sidebar-foreground'
                  )}
                  style={{
                    color: item.active ? item.color : undefined,
                  }}
                />
                {hasNotificationBadge && (
                  <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-blue-500 ring-2 ring-sidebar" />
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

/**
 * Bottom navigation component for mobile devices.
 */
export function BottomNav() {
  return <BottomNavContent />;
}
