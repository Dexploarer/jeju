/**
 * Layout Component
 *
 * Main application layout with header and content area
 */

import { ReactNode } from 'react';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="flex-1">{children}</main>
    </div>
  );
}
