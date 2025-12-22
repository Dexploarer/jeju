/**
 * Verified Badge Component
 */

import { cn } from '@babylon/shared';

interface VerifiedBadgeProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Check if an identifier belongs to an NPC/Actor
 */
export function isNpcIdentifier(id: string): boolean {
  // NPCs typically have IDs starting with 'npc_' or 'actor_'
  return id.startsWith('npc_') || id.startsWith('actor_') || id.startsWith('agent_');
}

export function VerifiedBadge({ size = 'sm', className }: VerifiedBadgeProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  };

  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-full bg-[#0066FF] text-white',
        sizeClasses[size],
        className
      )}
    >
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3">
        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
      </svg>
    </div>
  );
}
