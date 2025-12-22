/**
 * Dropdown Menu Components
 * Placeholder implementation
 */
import { cn } from '@babylon/shared'

export function DropdownMenu({ children }: { children: React.ReactNode }) {
  return <div className="relative inline-block">{children}</div>
}

export function DropdownMenuTrigger({
  children,
  asChild: _asChild,
}: {
  children: React.ReactNode
  asChild?: boolean
}) {
  return <div className="inline-flex">{children}</div>
}

export function DropdownMenuContent({
  children,
  className,
  align: _align,
}: {
  children: React.ReactNode
  className?: string
  align?: 'start' | 'end' | 'center'
}) {
  return (
    <div
      className={cn(
        'absolute z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
        className
      )}
    >
      {children}
    </div>
  )
}

export function DropdownMenuItem({
  children,
  className,
  onClick,
}: {
  children: React.ReactNode
  className?: string
  onClick?: () => void
}) {
  return (
    <div
      className={cn(
        'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground',
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  )
}

export function DropdownMenuSeparator({ className }: { className?: string }) {
  return <div className={cn('-mx-1 my-1 h-px bg-muted', className)} />
}
