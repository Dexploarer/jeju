/**
 * Markets Widget Sidebar
 */

import type { PerpMarket } from '../../types/markets';

interface MarketsWidgetSidebarProps {
  onMarketClick: (market: PerpMarket) => void;
  onPredictionClick: (marketId: string) => void;
}

export function MarketsWidgetSidebar({}: MarketsWidgetSidebarProps) {
  return (
    <div className="w-80 border-l border-border p-4">
      <h3 className="mb-4 font-bold">Market Info</h3>
      <p className="text-muted-foreground text-sm">
        Select a market to view details
      </p>
    </div>
  );
}
