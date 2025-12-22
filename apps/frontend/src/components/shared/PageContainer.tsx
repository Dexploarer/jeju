/**
 * Page Container Component
 */

import { cn } from '@babylon/shared';
import { ReactNode } from 'react';

interface PageContainerProps {
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function PageContainer({ children, className, noPadding }: PageContainerProps) {
  return (
    <div
      className={cn(
        'min-h-screen w-full',
        !noPadding && 'p-4 md:p-6',
        className
      )}
    >
      {children}
    </div>
  );
}
