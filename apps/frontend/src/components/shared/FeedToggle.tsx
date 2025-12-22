/**
 * Feed Toggle Component
 */
import { cn } from '@babylon/shared'

export interface FeedToggleProps {
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
  className?: string
}

export function FeedToggle({ options, value, onChange, className }: FeedToggleProps) {
  return (
    <div className={cn('flex gap-2', className)}>
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            value === option.value
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-accent'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
