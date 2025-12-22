import { cn } from '@babylon/shared';

interface SeparatorProps {
  className?: string;
  orientation?: 'horizontal' | 'vertical';
}

/**
 * Separator component for visual division.
 */
export function Separator({
  className,
  orientation = 'horizontal',
}: SeparatorProps) {
  return (
    <div
      role="separator"
      className={cn(
        'shrink-0 bg-border',
        orientation === 'horizontal' ? 'h-[1px] w-full' : 'h-full w-[1px]',
        className
      )}
    />
  );
}
