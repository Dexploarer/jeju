/**
 * Rank Badge Components
 */

import { cn } from '@babylon/shared';

interface RankBadgeProps {
  rank: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export function RankBadge({ rank, size = 'sm', showLabel = true }: RankBadgeProps) {
  if (rank > 3) return null;

  const colors = {
    1: 'bg-yellow-500 text-yellow-950',
    2: 'bg-gray-400 text-gray-950',
    3: 'bg-amber-600 text-amber-950',
  };

  const sizeClasses = {
    sm: 'h-5 w-5 text-xs',
    md: 'h-6 w-6 text-sm',
    lg: 'h-8 w-8 text-base',
  };

  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-full font-bold',
        colors[rank as 1 | 2 | 3],
        sizeClasses[size]
      )}
    >
      {showLabel ? rank : ''}
    </div>
  );
}

interface RankNumberProps {
  rank: number;
  size?: 'sm' | 'md' | 'lg';
}

export function RankNumber({ rank, size = 'md' }: RankNumberProps) {
  const sizeClasses = {
    sm: 'w-6 text-xs',
    md: 'w-8 text-sm',
    lg: 'w-10 text-base',
  };

  return (
    <div className={cn('font-bold text-muted-foreground', sizeClasses[size])}>
      #{rank}
    </div>
  );
}
