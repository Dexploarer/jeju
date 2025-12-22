/**
 * PositionDetailModal Component
 *
 * Modal for viewing and managing position details
 */

import type {
  PerpPositionFromAPI,
  PredictionPosition,
} from '@babylon/shared'
import { X } from 'lucide-react'

interface PositionDetailModalProps {
  isOpen: boolean
  onClose: () => void
  type: 'prediction' | 'perp'
  data: PredictionPosition | PerpPositionFromAPI | null
  userId: string
  onSuccess?: () => void
}

export function PositionDetailModal({
  isOpen,
  onClose,
  type,
  data,
  onSuccess,
}: PositionDetailModalProps) {
  if (!isOpen || !data) return null

  const isPrediction = type === 'prediction'

  return (
    <>
      <div
        className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div
          className="w-full max-w-md rounded-lg border border-border bg-background p-6 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold text-lg">
              {isPrediction ? 'Prediction Position' : 'Perpetual Position'}
            </h2>
            <button
              onClick={onClose}
              className="rounded p-1 hover:bg-muted"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {isPrediction ? (
            <PredictionPositionDetail
              position={data as PredictionPosition}
              onClose={onClose}
              onSuccess={onSuccess}
            />
          ) : (
            <PerpPositionDetail
              position={data as PerpPositionFromAPI}
              onClose={onClose}
              onSuccess={onSuccess}
            />
          )}
        </div>
      </div>
    </>
  )
}

function PredictionPositionDetail({
  position,
  onClose,
}: {
  position: PredictionPosition
  onClose: () => void
  onSuccess?: () => void
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1 text-muted-foreground text-sm">Market</p>
        <p className="font-medium">{position.question}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="mb-1 text-muted-foreground text-sm">Side</p>
          <p className={`font-semibold ${
            position.side === 'YES' ? 'text-green-500' : 'text-red-500'
          }`}>
            {position.side}
          </p>
        </div>
        <div>
          <p className="mb-1 text-muted-foreground text-sm">Shares</p>
          <p className="font-semibold">{position.shares.toFixed(2)}</p>
        </div>
        <div>
          <p className="mb-1 text-muted-foreground text-sm">Avg Price</p>
          <p className="font-semibold">${position.avgPrice.toFixed(3)}</p>
        </div>
        <div>
          <p className="mb-1 text-muted-foreground text-sm">Current Price</p>
          <p className="font-semibold">${position.currentPrice.toFixed(3)}</p>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onClose}
          className="flex-1 rounded-lg bg-muted px-4 py-2 font-semibold"
        >
          Close
        </button>
      </div>
    </div>
  )
}

function PerpPositionDetail({
  position,
  onClose,
}: {
  position: PerpPositionFromAPI
  onClose: () => void
  onSuccess?: () => void
}) {
  const isLong = position.side === 'long'
  const isProfitable = position.unrealizedPnL >= 0

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="font-bold text-xl">{position.ticker}</span>
        <span
          className={`rounded px-2 py-0.5 text-sm font-medium ${
            isLong
              ? 'bg-green-500/20 text-green-500'
              : 'bg-red-500/20 text-red-500'
          }`}
        >
          {position.side.toUpperCase()} {position.leverage}x
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="mb-1 text-muted-foreground text-sm">Size</p>
          <p className="font-semibold">${position.size.toFixed(2)}</p>
        </div>
        <div>
          <p className="mb-1 text-muted-foreground text-sm">Entry Price</p>
          <p className="font-semibold">${position.entryPrice.toFixed(2)}</p>
        </div>
        <div>
          <p className="mb-1 text-muted-foreground text-sm">Current Price</p>
          <p className="font-semibold">${position.currentPrice.toFixed(2)}</p>
        </div>
        <div>
          <p className="mb-1 text-muted-foreground text-sm">Unrealized P&L</p>
          <p
            className={`font-semibold ${
              isProfitable ? 'text-green-500' : 'text-red-500'
            }`}
          >
            {isProfitable ? '+' : ''}${position.unrealizedPnL.toFixed(2)}
          </p>
        </div>
        <div>
          <p className="mb-1 text-muted-foreground text-sm">Liquidation</p>
          <p className="font-semibold text-red-500">
            ${position.liquidationPrice.toFixed(2)}
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onClose}
          className="flex-1 rounded-lg bg-muted px-4 py-2 font-semibold"
        >
          Close
        </button>
      </div>
    </div>
  )
}
