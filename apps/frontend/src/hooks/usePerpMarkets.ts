/**
 * Perp Markets Hook
 */

import { useState, useEffect } from 'react';
import { edenClient } from '../lib/eden';

export interface PerpMarket {
  ticker: string;
  name: string;
  currentPrice: number;
  change24h: number;
  changePercent24h: number;
}

interface PerpMarketsState {
  markets: PerpMarket[];
  loading: boolean;
  error: string | null;
}

export function usePerpMarkets(): PerpMarketsState {
  const [markets, setMarkets] = useState<PerpMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMarkets() {
      const response = await edenClient.api.markets.perps.get();
      if (response.error) {
        setError('Failed to fetch perp markets');
      } else {
        setMarkets(response.data as PerpMarket[]);
      }
      setLoading(false);
    }
    fetchMarkets();
  }, []);

  return { markets, loading, error };
}
