import { cn } from '@babylon/shared';
import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

/**
 * Empty state component for displaying when there's no content.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center px-4 py-12 text-center',
        className
      )}
    >
      {Icon && (
        <div className="mb-4 rounded-full bg-muted/50 p-4">
          <Icon size={48} className="text-muted-foreground/70" />
        </div>
      )}
      <h3 className="mb-2 font-semibold text-lg">{title}</h3>
      <p className="mb-6 max-w-sm text-muted-foreground text-sm">
        {description}
      </p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="rounded-md bg-primary px-6 py-2 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
