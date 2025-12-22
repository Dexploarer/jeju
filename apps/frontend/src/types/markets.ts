/**
 * Market Types
 */

export type MarketTab = 'dashboard' | 'perps' | 'predictions';

export interface PerpMarket {
  ticker: string;
  name: string;
  currentPrice: number;
  change24h: number;
  changePercent24h: number;
}

export interface PredictionMarket {
  id: string | number;
  text: string;
  status: 'active' | 'resolved' | 'pending';
  yesShares?: number;
  noShares?: number;
  resolutionDate?: string;
}

export interface Position {
  id: string;
  marketId: string;
  side: 'long' | 'short' | 'yes' | 'no';
  size: number;
  entryPrice: number;
  currentPrice?: number;
  pnl?: number;
}
