/**
 * Markets Page Components
 *
 * Stub components - implement based on requirements
 */

import type { MarketTab, PerpMarket, PredictionMarket, Position } from '../../../types/markets';

interface DashboardTabContentProps {
  authenticated: boolean;
  onLogin: () => void;
  portfolioPnL: unknown;
  portfolioLoading: boolean;
  portfolioError: string | null;
  onShowPnLShare: () => void;
  onShowBuyPoints: () => void;
  perpPositions: Position[];
  predictionPositions: Position[];
  onPositionClosed: () => void;
  onPositionSold: () => void;
  trendingMarkets: PerpMarket[];
  topPredictions: PredictionMarket[];
  onMarketClick: (market: PerpMarket) => void;
  onPredictionClick: (prediction: PredictionMarket) => void;
}

export function DashboardTabContent({
  authenticated,
  onLogin,
  trendingMarkets,
  topPredictions,
  onMarketClick,
  onPredictionClick,
}: DashboardTabContentProps) {
  return (
    <div className="space-y-6 p-4">
      {!authenticated && (
        <div className="rounded-lg border border-border bg-muted/30 p-6 text-center">
          <p className="mb-4 text-muted-foreground">Sign in to view your portfolio</p>
          <button
            onClick={onLogin}
            className="rounded-lg bg-[#0066FF] px-6 py-2 text-white"
          >
            Sign In
          </button>
        </div>
      )}

      <section>
        <h2 className="mb-4 font-bold text-xl">Trending Markets</h2>
        <div className="space-y-2">
          {trendingMarkets.slice(0, 5).map((market) => (
            <button
              key={market.ticker}
              onClick={() => onMarketClick(market)}
              className="w-full rounded-lg border border-border p-4 text-left hover:bg-muted"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold">${market.ticker}</span>
                <span>${market.currentPrice.toFixed(2)}</span>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-4 font-bold text-xl">Top Predictions</h2>
        <div className="space-y-2">
          {topPredictions.slice(0, 5).map((prediction) => (
            <button
              key={prediction.id}
              onClick={() => onPredictionClick(prediction)}
              className="w-full rounded-lg border border-border p-4 text-left hover:bg-muted"
            >
              <p className="line-clamp-2">{prediction.text}</p>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

interface PerpsTabContentProps {
  authenticated: boolean;
  perpPnLData: unknown;
  portfolioLoading: boolean;
  portfolioError: string | null;
  portfolioUpdatedAt: Date | null;
  onShowCategoryPnLShare: () => void;
  onRefreshPortfolio: () => void;
  perpPositions: Position[];
  onPositionClosed: () => void;
  filteredMarkets: PerpMarket[];
  onMarketClick: (market: PerpMarket) => void;
}

export function PerpsTabContent({
  filteredMarkets,
  onMarketClick,
}: PerpsTabContentProps) {
  return (
    <div className="space-y-4 p-4">
      {filteredMarkets.map((market) => (
        <button
          key={market.ticker}
          onClick={() => onMarketClick(market)}
          className="w-full rounded-lg border border-border p-4 text-left hover:bg-muted"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold">${market.ticker}</h3>
              <p className="text-muted-foreground text-sm">{market.name}</p>
            </div>
            <div className="text-right">
              <div className="font-bold">${market.currentPrice.toFixed(2)}</div>
              <div
                className={
                  market.change24h >= 0 ? 'text-green-500' : 'text-red-500'
                }
              >
                {market.change24h >= 0 ? '+' : ''}
                {market.changePercent24h.toFixed(2)}%
              </div>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

interface PredictionsTabContentProps {
  authenticated: boolean;
  predictionPnLData: unknown;
  portfolioLoading: boolean;
  portfolioError: string | null;
  portfolioUpdatedAt: Date | null;
  onShowCategoryPnLShare: () => void;
  onRefreshPortfolio: () => void;
  predictionPositions: Position[];
  onPositionSold: () => void;
  predictionSort: string;
  onSortChange: (sort: string) => void;
  activePredictions: PredictionMarket[];
  resolvedPredictions: PredictionMarket[];
  onPredictionClick: (prediction: PredictionMarket) => void;
  predictionsError: string | null;
  compact: boolean;
}

export function PredictionsTabContent({
  activePredictions,
  resolvedPredictions,
  onPredictionClick,
  predictionsError,
}: PredictionsTabContentProps) {
  if (predictionsError) {
    return (
      <div className="p-4 text-center text-red-500">{predictionsError}</div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      <section>
        <h2 className="mb-4 font-bold text-lg">Active Markets</h2>
        <div className="space-y-2">
          {activePredictions.map((prediction) => (
            <button
              key={prediction.id}
              onClick={() => onPredictionClick(prediction)}
              className="w-full rounded-lg border border-border p-4 text-left hover:bg-muted"
            >
              <p className="line-clamp-2">{prediction.text}</p>
              <div className="mt-2 flex gap-4 text-sm">
                <span className="text-green-500">
                  Yes: {((prediction.yesShares || 0) / ((prediction.yesShares || 0) + (prediction.noShares || 0) || 1) * 100).toFixed(0)}%
                </span>
                <span className="text-red-500">
                  No: {((prediction.noShares || 0) / ((prediction.yesShares || 0) + (prediction.noShares || 0) || 1) * 100).toFixed(0)}%
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {resolvedPredictions.length > 0 && (
        <section>
          <h2 className="mb-4 font-bold text-lg">Resolved</h2>
          <div className="space-y-2">
            {resolvedPredictions.map((prediction) => (
              <button
                key={prediction.id}
                onClick={() => onPredictionClick(prediction)}
                className="w-full rounded-lg border border-border bg-muted/30 p-4 text-left"
              >
                <p className="line-clamp-2 text-muted-foreground">{prediction.text}</p>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

interface LoginPromptProps {
  onLogin: () => void;
}

export function LoginPrompt({ onLogin }: LoginPromptProps) {
  return (
    <div className="border-t border-border bg-muted/30 p-4 text-center">
      <button
        onClick={onLogin}
        className="rounded-lg bg-[#0066FF] px-6 py-2 text-white"
      >
        Sign In to Trade
      </button>
    </div>
  );
}

interface MarketsSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  activeTab: MarketTab;
}

export function MarketsSearchInput({ value, onChange, activeTab }: MarketsSearchInputProps) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={`Search ${activeTab}...`}
      className="w-full rounded-lg border border-border bg-muted px-4 py-2 focus:border-[#0066FF] focus:outline-none"
    />
  );
}
