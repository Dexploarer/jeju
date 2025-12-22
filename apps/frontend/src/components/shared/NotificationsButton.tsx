import { cn } from '@babylon/shared';
import { Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useUnreadNotifications } from '../../hooks/useUnreadNotifications';

interface NotificationsButtonProps {
  className?: string;
  compact?: boolean;
}

/**
 * Notifications button component with unread count badge.
 */
export function NotificationsButton({
  className,
  compact = false,
}: NotificationsButtonProps) {
  const { authenticated } = useAuth();
  const navigate = useNavigate();
  const { unreadCount, isLoading } = useUnreadNotifications();

  if (!authenticated) {
    return null;
  }

  const handleClick = () => {
    navigate('/notifications');
  };

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className={cn(
        'relative p-2 transition-colors hover:bg-sidebar-accent',
        isLoading && 'cursor-wait opacity-50'
      )}
      aria-label="Notifications"
      aria-busy={isLoading}
    >
      <Bell
        className={cn(
          compact ? 'h-5 w-5' : 'h-6 w-6',
          'transition-colors duration-200',
          isLoading && 'animate-pulse',
          className || 'text-sidebar-foreground'
        )}
      />
      {unreadCount > 0 && (
        <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-background" />
      )}
    </button>
  );
}
