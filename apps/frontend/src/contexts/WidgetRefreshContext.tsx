/**
 * Widget Refresh Context
 */
import { createContext, useContext, useState, useCallback } from 'react'

interface WidgetRefreshContextValue {
  refreshKey: number
  refresh: () => void
}

const WidgetRefreshContext = createContext<WidgetRefreshContextValue>({
  refreshKey: 0,
  refresh: () => {},
})

export function WidgetRefreshProvider({ children }: { children: React.ReactNode }) {
  const [refreshKey, setRefreshKey] = useState(0)
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  return (
    <WidgetRefreshContext.Provider value={{ refreshKey, refresh }}>
      {children}
    </WidgetRefreshContext.Provider>
  )
}

export function useWidgetRefresh() {
  return useContext(WidgetRefreshContext)
}
