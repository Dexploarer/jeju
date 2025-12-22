/**
 * usePredictionMarketStream Hook
 *
 * Hook for subscribing to real-time prediction market updates via SSE
 */

import { useEffect, useRef } from 'react'
import { API_BASE } from '../lib/api'

interface StreamCallbacks {
  onTrade?: () => void
  onResolution?: () => void
  onPriceUpdate?: (price: number) => void
}

export function usePredictionMarketStream(
  marketId: string | null,
  callbacks: StreamCallbacks
) {
  const eventSourceRef = useRef<EventSource | null>(null)
  const callbacksRef = useRef(callbacks)

  // Keep callbacks ref up to date
  useEffect(() => {
    callbacksRef.current = callbacks
  }, [callbacks])

  useEffect(() => {
    if (!marketId) return

    const url = `${API_BASE}/api/markets/predictions/${marketId}/stream`

    const eventSource = new EventSource(url)
    eventSourceRef.current = eventSource

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data) as {
        type: string
        price?: number
      }

      switch (data.type) {
        case 'trade':
          callbacksRef.current.onTrade?.()
          break
        case 'resolution':
          callbacksRef.current.onResolution?.()
          break
        case 'price':
          if (data.price !== undefined) {
            callbacksRef.current.onPriceUpdate?.(data.price)
          }
          break
      }
    }

    eventSource.onerror = () => {
      // Reconnect on error
      eventSource.close()
    }

    return () => {
      eventSource.close()
      eventSourceRef.current = null
    }
  }, [marketId])
}
