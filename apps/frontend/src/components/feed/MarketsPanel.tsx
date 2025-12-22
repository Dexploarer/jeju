import { cn } from '@babylon/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '../shared/Skeleton';
import { apiFetch } from '../../lib/api-client';

interface Market {
  id: string;
  question: string;
  yesPrice: number;
  noPrice: number;
  volume: number;
  endDate: string;
  priceChange24h?: number;
  changePercent24h?: number;
}

interface PerpMarket {
  ticker: string;
  currentPrice: number;
  changePercent24h: number;
}

interface MarketsResponse {
  success: boolean;
  markets?: Market[];
}

interface PerpMarketsResponse {
  markets: PerpMarket[];
}

/**
 * Markets panel component for displaying prediction and perpetual markets.
 * Converted from Next.js to plain React.
 */
export function MarketsPanel() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Fetch perpetual markets
  const { data: perpMarkets = [], isLoading: perpLoading } = useQuery({
    queryKey: ['perpMarkets'],
    queryFn: async (): Promise<PerpMarket[]> => {
      const response = await apiFetch('/api/markets/perps');
      if (!response.ok) {
        throw new Error(`Failed to fetch perp markets: ${response.status}`);
      }
      const data: PerpMarketsResponse = await response.json();
      return data.markets;
    },
    staleTime: 30000,
  });

  // Fetch prediction markets
  const { data: markets = [], isLoading: predictionsLoading } = useQuery({
    queryKey: ['feed', 'markets', 'predictions'],
    queryFn: async (): Promise<Market[]> => {
      const response = await apiFetch('/api/feed/widgets/markets');

      if (!response.ok) {
        console.error('Failed to fetch markets:', response.status, response.statusText);
        return [];
      }

      const text = await response.text();
      if (!text) {
        console.error('Empty response from markets API');
        return [];
      }

      const data: MarketsResponse = JSON.parse(text);
      if (!data.success) {
        return [];
      }
      if (!data.markets) {
        throw new Error('Markets API returned success without markets data');
      }
      return data.markets;
    },
  });

  const loading = predictionsLoading && perpLoading;

  const refetchPerps = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['perpMarkets'] });
  }, [queryClient]);

  const _refetchAll = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ['feed', 'markets', 'predictions'],
      }),
      refetchPerps(),
    ]);
  }, [queryClient, refetchPerps]);

  const handleMarketClick = (marketId: string) => {
    navigate(`/markets/predictions/${marketId}`);
  };

  const handleTokenClick = (ticker: string) => {
    navigate(`/markets/perps/${ticker}`);
  };

  // Memoize computed values
  const topMovers = useMemo(
    () =>
      markets
        .filter(
          (m): m is Market & { changePercent24h: number } =>
            m.changePercent24h !== undefined && m.changePercent24h !== 0
        )
        .sort(
          (a, b) => Math.abs(b.changePercent24h) - Math.abs(a.changePercent24h)
        )
        .slice(0, 3),
    [markets]
  );

  const { tokenGainers, tokenLosers } = useMemo(() => {
    const sorted = [...perpMarkets].sort(
      (a, b) => b.changePercent24h - a.changePercent24h
    );
    return {
      tokenGainers: sorted.slice(0, 3),
      tokenLosers: sorted.slice(-3).reverse(),
    };
  }, [perpMarkets]);

  return (
    <div className="flex flex-1 flex-col rounded-2xl bg-sidebar px-4 py-3">
      <h2 className="mb-3 text-left font-bold text-foreground text-lg">
        Markets
      </h2>
      {loading ? (
        <div className="flex-1 space-y-3 pl-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : markets.length === 0 && perpMarkets.length === 0 ? (
        <div className="flex-1 pl-3 text-muted-foreground text-sm">
          No active markets at the moment.
        </div>
      ) : (
        <>
          {/* Top Movers Section */}
          {topMovers.length > 0 && (
            <div className="mb-4 pl-3">
              <div className="mb-2 flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4 text-[#0066FF]" />
                <h3 className="font-semibold text-foreground text-sm">
                  Top Movers (24h)
                </h3>
              </div>
              <div className="space-y-2">
                {topMovers.map((market) => (
                  <div
                    key={`mover-${market.id}`}
                    onClick={() => handleMarketClick(market.id)}
                    className="-ml-1.5 flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2 transition-colors duration-200 hover:bg-muted/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 font-medium text-foreground text-sm leading-snug">
                        {market.question}
                      </p>
                      <div className="mt-1 flex items-center gap-3">
                        <span className="text-green-500 text-xs">
                          Yes {(market.yesPrice * 100).toFixed(0)}%
                        </span>
                        <div
                          className={cn(
                            'flex items-center gap-0.5 font-semibold text-xs',
                            market.changePercent24h >= 0
                              ? 'text-green-600'
                              : 'text-red-600'
                          )}
                        >
                          {market.changePercent24h >= 0 ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <TrendingDown className="h-3 w-3" />
                          )}
                          {market.changePercent24h >= 0 ? '+' : ''}
                          {market.changePercent24h.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 border-border border-t pt-3" />
            </div>
          )}

          {/* Trending Tokens Section */}
          {perpMarkets.length > 0 && (
            <div className="mb-4 pl-3">
              <div className="grid grid-cols-2 gap-3">
                {/* Top Gainers Column */}
                <div>
                  <div className="mb-2 flex items-center gap-1">
                    <TrendingUp className="h-3 w-3 text-green-600" />
                    <h4 className="font-semibold text-green-600 text-xs">
                      Gainers
                    </h4>
                  </div>
                  <div className="space-y-1.5">
                    {tokenGainers.map((token) => (
                      <div
                        key={`gainer-${token.ticker}`}
                        onClick={() => handleTokenClick(token.ticker)}
                        className="cursor-pointer rounded p-1.5 transition-colors duration-200 hover:bg-muted/50"
                      >
                        <p className="font-bold text-foreground text-xs">
                          ${token.ticker}
                        </p>
                        <div className="mt-0.5 flex items-center justify-between gap-1">
                          <span className="truncate text-muted-foreground text-xs">
                            ${token.currentPrice.toFixed(2)}
                          </span>
                          <span
                            className={cn(
                              'font-semibold text-xs',
                              token.changePercent24h >= 0
                                ? 'text-green-600'
                                : 'text-muted-foreground'
                            )}
                          >
                            {token.changePercent24h >= 0 ? '+' : ''}
                            {token.changePercent24h.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Top Losers Column */}
                <div>
                  <div className="mb-2 flex items-center gap-1">
                    <TrendingDown className="h-3 w-3 text-red-600" />
                    <h4 className="font-semibold text-red-600 text-xs">
                      Losers
                    </h4>
                  </div>
                  <div className="space-y-1.5">
                    {tokenLosers.map((token) => (
                      <div
                        key={`loser-${token.ticker}`}
                        onClick={() => handleTokenClick(token.ticker)}
                        className="cursor-pointer rounded p-1.5 transition-colors duration-200 hover:bg-muted/50"
                      >
                        <p className="font-bold text-foreground text-xs">
                          ${token.ticker}
                        </p>
                        <div className="mt-0.5 flex items-center justify-between gap-1">
                          <span className="truncate text-muted-foreground text-xs">
                            ${token.currentPrice.toFixed(2)}
                          </span>
                          <span
                            className={cn(
                              'font-semibold text-xs',
                              token.changePercent24h < 0
                                ? 'text-red-600'
                                : 'text-muted-foreground'
                            )}
                          >
                            {token.changePercent24h.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Prediction Markets List */}
          {markets.length > 0 && (
            <div className="flex-1 pl-3">
              <div className="space-y-2.5">
                {markets.slice(0, 5).map((market) => (
                  <div
                    key={market.id}
                    onClick={() => handleMarketClick(market.id)}
                    className="-ml-1.5 flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2 transition-colors duration-200 hover:bg-muted/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 font-semibold text-foreground text-sm leading-snug">
                        {market.question}
                      </p>
                      <div className="mt-1 flex items-center gap-3">
                        <span className="text-green-500 text-xs">
                          Yes {(market.yesPrice * 100).toFixed(0)}%
                        </span>
                        <span className="text-red-500 text-xs">
                          No {(market.noPrice * 100).toFixed(0)}%
                        </span>
                        {market.volume > 0 && (
                          <span className="text-muted-foreground text-xs">
                            ${market.volume.toFixed(0)}
                          </span>
                        )}
                        {market.changePercent24h !== undefined &&
                          market.changePercent24h !== 0 && (
                            <span
                              className={cn(
                                'font-medium text-xs',
                                market.changePercent24h >= 0
                                  ? 'text-green-600'
                                  : 'text-red-600'
                              )}
                            >
                              {market.changePercent24h >= 0 ? '+' : ''}
                              {market.changePercent24h.toFixed(1)}%
                            </span>
                          )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
