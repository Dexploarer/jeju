/**
 * Leaderboard Toggle Component
 */

import { cn } from '@babylon/shared';

export type LeaderboardTab = 'all' | 'earned' | 'referral';

interface LeaderboardToggleProps {
  activeTab: LeaderboardTab;
  onTabChange: (tab: LeaderboardTab) => void;
}

export function LeaderboardToggle({ activeTab, onTabChange }: LeaderboardToggleProps) {
  const tabs: { id: LeaderboardTab; label: string }[] = [
    { id: 'all', label: 'All Points' },
    { id: 'earned', label: 'Earned' },
    { id: 'referral', label: 'Referrals' },
  ];

  return (
    <div className="flex gap-1 py-3">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            'rounded-full px-4 py-2 font-medium text-sm transition-all',
            activeTab === tab.id
              ? 'bg-[#0066FF] text-primary-foreground'
              : 'bg-muted/50 text-muted-foreground hover:bg-muted'
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
