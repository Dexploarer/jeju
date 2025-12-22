/**
 * Prediction Markets Store
 */

import { useState, useEffect } from 'react';
import { edenClient } from '../lib/eden';

export interface PredictionMarket {
  id: string | number;
  text: string;
  status: 'active' | 'resolved' | 'pending';
  yesShares?: number;
  noShares?: number;
  resolutionDate?: string;
  oracleCommitTxHash?: string;
}

interface PredictionMarketsState {
  markets: PredictionMarket[];
  loading: boolean;
  error: string | null;
}

export function usePredictionMarkets(): PredictionMarketsState {
  const [markets, setMarkets] = useState<PredictionMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMarkets() {
      const response = await edenClient.api.markets.predictions.get();
      if (response.error) {
        setError('Failed to fetch prediction markets');
      } else {
        setMarkets(response.data as PredictionMarket[]);
      }
      setLoading(false);
    }
    fetchMarkets();
  }, []);

  return { markets, loading, error };
}
