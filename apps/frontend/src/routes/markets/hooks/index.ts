/**
 * Markets Page Hooks
 */

import { useState, useMemo, useCallback } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { usePerpMarkets } from '../../../hooks/usePerpMarkets';
import { usePredictionMarkets } from '../../../stores/predictionMarketsStore';
import type { PerpMarket, PredictionMarket, Position } from '../../../types/markets';

export interface CategoryPnLData {
  totalPnL: number;
  totalValue: number;
  positions: number;
}

export interface TrendingPerpMarket extends PerpMarket {
  volume24h?: number;
}

export interface TopPrediction extends PredictionMarket {
  volume?: number;
}

export interface MarketsPageData {
  // Auth
  authenticated: boolean;
  user: { id: string } | null;
  login: () => void;

  // Loading states
  loading: boolean;
  portfolioLoading: boolean;
  portfolioError: string | null;
  predictionsError: string | null;
  portfolioUpdatedAt: Date | null;

  // Portfolio data
  portfolioPnL: unknown;
  perpPnLData: CategoryPnLData;
  predictionPnLData: CategoryPnLData;

  // Positions
  perpPositions: Position[];
  predictionPositions: Position[];

  // Markets data
  trendingMarkets: TrendingPerpMarket[];
  topPredictions: TopPrediction[];
  filteredPerpMarkets: PerpMarket[];
  activePredictions: PredictionMarket[];
  resolvedPredictions: PredictionMarket[];

  // Search and sort
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  predictionSort: string;
  setPredictionSort: (sort: string) => void;

  // Actions
  handlePositionsRefresh: () => void;
  refreshPortfolio: () => void;
  triggerBalanceRefresh: () => void;
  refetchData: () => void;
}

export function useMarketsPageData(): MarketsPageData {
  const { authenticated, user, login } = useAuth();
  const { markets: perpMarkets, loading: perpLoading } = usePerpMarkets();
  const { markets: predictionMarkets, loading: predictionsLoading } = usePredictionMarkets();

  const [searchQuery, setSearchQuery] = useState('');
  const [predictionSort, setPredictionSort] = useState('volume');

  // Filter perp markets
  const filteredPerpMarkets = useMemo(() => {
    if (!searchQuery) return perpMarkets;
    const query = searchQuery.toLowerCase();
    return perpMarkets.filter(
      (m) =>
        m.ticker.toLowerCase().includes(query) ||
        m.name.toLowerCase().includes(query)
    );
  }, [perpMarkets, searchQuery]);

  // Separate active and resolved predictions
  const activePredictions = useMemo(
    () => predictionMarkets.filter((p) => p.status === 'active'),
    [predictionMarkets]
  );

  const resolvedPredictions = useMemo(
    () => predictionMarkets.filter((p) => p.status === 'resolved'),
    [predictionMarkets]
  );

  // Trending markets (sorted by change)
  const trendingMarkets = useMemo(
    () =>
      [...perpMarkets]
        .sort((a, b) => Math.abs(b.changePercent24h) - Math.abs(a.changePercent24h))
        .slice(0, 10),
    [perpMarkets]
  );

  // Top predictions
  const topPredictions = useMemo(
    () => activePredictions.slice(0, 10),
    [activePredictions]
  );

  const handlePositionsRefresh = useCallback(() => {
    // Implement position refresh
  }, []);

  const refreshPortfolio = useCallback(() => {
    // Implement portfolio refresh
  }, []);

  const triggerBalanceRefresh = useCallback(() => {
    // Implement balance refresh
  }, []);

  const refetchData = useCallback(() => {
    // Implement data refetch
  }, []);

  return {
    // Auth
    authenticated,
    user,
    login,

    // Loading states
    loading: perpLoading || predictionsLoading,
    portfolioLoading: false,
    portfolioError: null,
    predictionsError: null,
    portfolioUpdatedAt: null,

    // Portfolio data
    portfolioPnL: null,
    perpPnLData: { totalPnL: 0, totalValue: 0, positions: 0 },
    predictionPnLData: { totalPnL: 0, totalValue: 0, positions: 0 },

    // Positions
    perpPositions: [],
    predictionPositions: [],

    // Markets data
    trendingMarkets,
    topPredictions,
    filteredPerpMarkets,
    activePredictions,
    resolvedPredictions,

    // Search and sort
    searchQuery,
    setSearchQuery,
    predictionSort,
    setPredictionSort,

    // Actions
    handlePositionsRefresh,
    refreshPortfolio,
    triggerBalanceRefresh,
    refetchData,
  };
}
