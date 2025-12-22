/**
 * Markets Toggle Component
 */

import { cn } from '@babylon/shared';
import type { MarketTab } from '../../types/markets';

interface MarketsToggleProps {
  activeTab: MarketTab;
  onTabChange: (tab: MarketTab) => void;
}

export function MarketsToggle({ activeTab, onTabChange }: MarketsToggleProps) {
  const tabs: { id: MarketTab; label: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'perps', label: 'Perps' },
    { id: 'predictions', label: 'Predictions' },
  ];

  return (
    <div className="flex gap-0 border-b border-border">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            'flex-1 px-4 py-3 font-medium text-sm transition-all',
            activeTab === tab.id
              ? 'border-b-2 border-[#0066FF] text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
