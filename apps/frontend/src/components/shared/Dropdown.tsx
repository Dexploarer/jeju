/**
 * Dropdown Component
 */
import { cn } from '@babylon/shared'
import { useState } from 'react'

export interface DropdownProps {
  trigger: React.ReactNode
  children: React.ReactNode
  className?: string
  align?: 'left' | 'right'
}

export function Dropdown({
  trigger,
  children,
  className,
  align = 'left',
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className={cn('relative inline-block', className)}>
      <div onClick={() => setIsOpen(!isOpen)}>{trigger}</div>
      {isOpen && (
        <div
          className={cn(
            'absolute z-50 mt-2 min-w-[160px] rounded-md border bg-popover p-1 shadow-md',
            align === 'right' ? 'right-0' : 'left-0'
          )}
        >
          {children}
        </div>
      )}
    </div>
  )
}

export function DropdownItem({
  children,
  onClick,
  className,
}: {
  children: React.ReactNode
  onClick?: () => void
  className?: string
}) {
  return (
    <div
      className={cn(
        'cursor-pointer rounded-sm px-2 py-1.5 text-sm hover:bg-accent',
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  )
}
