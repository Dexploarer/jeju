/**
 * On-Chain Badge Component
 */

import { cn } from '@babylon/shared';

interface OnChainBadgeProps {
  isRegistered: boolean;
  nftTokenId: number | null;
  size?: 'sm' | 'md' | 'lg';
}

export function OnChainBadge({ isRegistered, size = 'sm' }: OnChainBadgeProps) {
  if (!isRegistered) return null;

  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  };

  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-full bg-green-500 text-white',
        sizeClasses[size]
      )}
      title="On-chain verified"
    >
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3">
        <path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z" />
      </svg>
    </div>
  );
}
