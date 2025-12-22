import { cn } from '@babylon/shared';
import {
  ArrowDownRight,
  ArrowUpRight,
  Coins,
  Send,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Avatar } from '../shared/Avatar';

type TradeType = 'balance' | 'npc' | 'position' | 'perp' | 'transfer';

interface BaseTrade {
  type: TradeType;
  id: string;
  timestamp: Date | string;
  user: {
    id: string;
    username: string | null;
    displayName: string | null;
    profileImageUrl: string | null;
    isActor: boolean;
  } | null;
}

interface BalanceTrade extends BaseTrade {
  type: 'balance';
  amount: string;
  balanceBefore: string;
  balanceAfter: string;
  transactionType: string;
  description: string | null;
  relatedId: string | null;
}

interface NPCTrade extends BaseTrade {
  type: 'npc';
  marketType: string;
  ticker: string | null;
  marketId: string | null;
  action: string;
  side: string | null;
  amount: number;
  price: number;
  sentiment: number | null;
  reason: string | null;
}

interface PositionTrade extends BaseTrade {
  type: 'position';
  market: {
    id: string;
    question: string;
    resolved: boolean;
    resolution: boolean | null;
  } | null;
  side: string;
  shares: string;
  avgPrice: string;
  createdAt: Date | string;
}

interface PerpTrade extends BaseTrade {
  type: 'perp';
  ticker: string;
  organization: {
    id: string;
    name: string;
    ticker: string;
  } | null;
  side: 'long' | 'short';
  entryPrice: string;
  currentPrice: string;
  size: string;
  leverage: number;
  unrealizedPnL: string;
  liquidationPrice: string;
  closedAt: Date | string | null;
}

interface TransferTrade extends BaseTrade {
  type: 'transfer';
  otherParty: {
    id: string;
    username: string | null;
    displayName: string | null;
    profileImageUrl: string | null;
    isActor: boolean;
  } | null;
  amount: number;
  pointsBefore: number;
  pointsAfter: number;
  direction: 'sent' | 'received';
  message?: string;
}

export type Trade =
  | BalanceTrade
  | NPCTrade
  | PositionTrade
  | PerpTrade
  | TransferTrade;

interface TradeCardProps {
  trade: Trade;
}

/**
 * Trade card component for displaying individual trade entries.
 */
export function TradeCard({ trade }: TradeCardProps) {
  const navigate = useNavigate();

  if (!trade.user) return null;

  const displayName =
    trade.user.displayName || trade.user.username || 'Anonymous';

  const formatTime = (timestamp: Date | string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  const formatCurrency = (value: string | number) => {
    const num = typeof value === 'string' ? Number.parseFloat(value) : value;
    if (isNaN(num)) return '$0.00';
    if (num >= 1000000) return `$${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `$${(num / 1000).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };

  const handleProfileClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/profile/${trade.user!.id}`);
  };

  const handleAssetClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (trade.type === 'npc') {
      if (trade.marketType === 'perp' && trade.ticker) {
        navigate(`/markets/perps/${trade.ticker}`);
      } else if (trade.marketType === 'prediction' && trade.marketId) {
        navigate(`/markets/predictions/${trade.marketId}`);
      }
    } else if (trade.type === 'position' && trade.market) {
      navigate(`/markets/predictions/${trade.market.id}`);
    } else if (trade.type === 'perp') {
      navigate(`/markets/perps/${trade.ticker}`);
    }
  };

  return (
    <div className="border-border border-b bg-card p-4 transition-colors hover:bg-muted/30">
      <div className="flex items-start gap-3">
        <div
          className="flex-shrink-0 cursor-pointer"
          onClick={handleProfileClick}
        >
          <Avatar
            id={trade.user.id}
            name={displayName}
            src={trade.user.profileImageUrl || undefined}
            size="sm"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span
              className="cursor-pointer truncate font-medium hover:underline"
              onClick={handleProfileClick}
            >
              {displayName}
            </span>
            {trade.user.isActor && (
              <span className="rounded bg-purple-500/20 px-2 py-0.5 text-purple-500 text-xs">
                NPC
              </span>
            )}
            <span className="text-muted-foreground text-xs">
              {formatTime(trade.timestamp)}
            </span>
          </div>

          {trade.type === 'balance' && (
            <BalanceTradeContent
              trade={trade}
              onAssetClick={handleAssetClick}
              formatCurrency={formatCurrency}
            />
          )}
          {trade.type === 'npc' && (
            <NPCTradeContent
              trade={trade}
              onAssetClick={handleAssetClick}
              formatCurrency={formatCurrency}
            />
          )}
          {trade.type === 'position' && (
            <PositionTradeContent
              trade={trade}
              onAssetClick={handleAssetClick}
              formatCurrency={formatCurrency}
            />
          )}
          {trade.type === 'perp' && (
            <PerpTradeContent
              trade={trade}
              onAssetClick={handleAssetClick}
              formatCurrency={formatCurrency}
            />
          )}
          {trade.type === 'transfer' && (
            <TransferTradeContent trade={trade} navigate={navigate} />
          )}
        </div>
      </div>
    </div>
  );
}

function BalanceTradeContent({
  trade,
  onAssetClick,
  formatCurrency,
}: {
  trade: BalanceTrade;
  onAssetClick: (e: React.MouseEvent) => void;
  formatCurrency: (value: string | number) => string;
}) {
  const amount = Number.parseFloat(trade.amount);
  const isPositive = amount >= 0;
  const actionText = trade.transactionType.replace('_', ' ').toUpperCase();

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        {isPositive ? (
          <ArrowUpRight className="h-4 w-4 text-green-500" />
        ) : (
          <ArrowDownRight className="h-4 w-4 text-red-500" />
        )}
        <span className="text-muted-foreground text-sm">{actionText}</span>
        <span
          className={cn(
            'font-semibold text-base',
            isPositive ? 'text-green-600' : 'text-red-600'
          )}
        >
          {isPositive ? '+' : ''}
          {formatCurrency(amount)}
        </span>
      </div>
      {trade.description && (
        <p
          className="line-clamp-2 cursor-pointer text-foreground text-sm hover:underline"
          onClick={onAssetClick}
        >
          {trade.description}
        </p>
      )}
    </div>
  );
}

function NPCTradeContent({
  trade,
  onAssetClick,
  formatCurrency,
}: {
  trade: NPCTrade;
  onAssetClick: (e: React.MouseEvent) => void;
  formatCurrency: (value: string | number) => string;
}) {
  const isLong = trade.side === 'long' || trade.side === 'YES';
  const action = trade.action.toUpperCase();

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            'rounded px-2 py-1 font-medium text-xs',
            isLong
              ? 'bg-green-500/20 text-green-500'
              : 'bg-red-500/20 text-red-500'
          )}
        >
          {action}
        </span>
        {trade.ticker && (
          <span
            className="cursor-pointer font-bold hover:underline"
            onClick={onAssetClick}
          >
            {trade.ticker}
          </span>
        )}
        {trade.side && (
          <span
            className={cn(
              'font-medium text-xs',
              isLong ? 'text-green-600' : 'text-red-600'
            )}
          >
            {trade.side}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 text-muted-foreground text-sm">
        <span>Amount: {formatCurrency(trade.amount)}</span>
        <span>Price: {formatCurrency(trade.price)}</span>
      </div>
      {trade.reason && (
        <p className="line-clamp-2 text-muted-foreground text-xs italic">
          &quot;{trade.reason}&quot;
        </p>
      )}
    </div>
  );
}

function PositionTradeContent({
  trade,
  onAssetClick,
  formatCurrency,
}: {
  trade: PositionTrade;
  onAssetClick: (e: React.MouseEvent) => void;
  formatCurrency: (value: string | number) => string;
}) {
  const isYes = trade.side === 'YES';

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'rounded px-2 py-1 font-medium text-xs',
            isYes
              ? 'bg-green-500/20 text-green-500'
              : 'bg-red-500/20 text-red-500'
          )}
        >
          {trade.side}
        </span>
        <span className="text-muted-foreground text-sm">Position</span>
      </div>
      {trade.market && (
        <p
          className="line-clamp-2 cursor-pointer font-medium text-sm hover:underline"
          onClick={onAssetClick}
        >
          {trade.market.question}
        </p>
      )}
      <div className="flex items-center gap-3 text-muted-foreground text-xs">
        <span>Shares: {Number.parseFloat(trade.shares).toFixed(2)}</span>
        <span>Avg Price: {formatCurrency(trade.avgPrice)}</span>
      </div>
    </div>
  );
}

function PerpTradeContent({
  trade,
  onAssetClick,
  formatCurrency,
}: {
  trade: PerpTrade;
  onAssetClick: (e: React.MouseEvent) => void;
  formatCurrency: (value: string | number) => string;
}) {
  const isLong = trade.side === 'long';
  const pnl = Number.parseFloat(trade.unrealizedPnL);
  const isPnLPositive = pnl >= 0;
  const isClosed = trade.closedAt !== null;

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        {isLong ? (
          <TrendingUp className="h-4 w-4 text-green-500" />
        ) : (
          <TrendingDown className="h-4 w-4 text-red-500" />
        )}
        <span
          className={cn(
            'rounded px-2 py-1 font-medium text-xs',
            isLong
              ? 'bg-green-500/20 text-green-500'
              : 'bg-red-500/20 text-red-500'
          )}
        >
          {trade.side.toUpperCase()}
        </span>
        <span
          className="cursor-pointer font-bold hover:underline"
          onClick={onAssetClick}
        >
          {trade.ticker}
        </span>
        <span className="text-muted-foreground text-xs">{trade.leverage}x</span>
        {isClosed && (
          <span className="rounded bg-muted px-2 py-0.5 text-muted-foreground text-xs">
            CLOSED
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 text-muted-foreground text-sm">
        <span>Size: {formatCurrency(trade.size)}</span>
        <span>Entry: {formatCurrency(trade.entryPrice)}</span>
      </div>
      {!isClosed && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">PnL:</span>
          <span
            className={cn(
              'font-semibold',
              isPnLPositive ? 'text-green-600' : 'text-red-600'
            )}
          >
            {isPnLPositive ? '+' : ''}
            {formatCurrency(pnl)}
          </span>
        </div>
      )}
    </div>
  );
}

function TransferTradeContent({
  trade,
  navigate,
}: {
  trade: TransferTrade;
  navigate: (path: string) => void;
}) {
  const isSent = trade.direction === 'sent';
  const otherPartyName =
    trade.otherParty?.displayName || trade.otherParty?.username || 'Unknown';

  const handleOtherPartyClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (trade.otherParty) {
      navigate(`/profile/${trade.otherParty.id}`);
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        {isSent ? (
          <Send className="h-4 w-4 text-blue-500" />
        ) : (
          <Coins className="h-4 w-4 text-green-500" />
        )}
        <span className="text-muted-foreground text-sm">
          {isSent ? 'Sent points to' : 'Received points from'}
        </span>
        <span
          className="cursor-pointer font-medium hover:underline"
          onClick={handleOtherPartyClick}
        >
          {otherPartyName}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'font-semibold text-base',
            isSent ? 'text-red-600' : 'text-green-600'
          )}
        >
          {isSent ? '-' : '+'}
          {Math.abs(trade.amount)} pts
        </span>
        <span className="text-muted-foreground text-xs">
          Balance: {trade.pointsAfter} pts
        </span>
      </div>
      {trade.message && (
        <p className="text-muted-foreground text-sm italic">
          &quot;{trade.message}&quot;
        </p>
      )}
    </div>
  );
}
