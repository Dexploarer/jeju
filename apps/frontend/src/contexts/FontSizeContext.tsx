/**
 * FontSizeContext
 *
 * Context for managing global font size settings
 */

import { createContext, useContext, useState, type ReactNode } from 'react'

interface FontSizeContextValue {
  fontSize: number
  setFontSize: (size: number) => void
}

const FontSizeContext = createContext<FontSizeContextValue | null>(null)

export function FontSizeProvider({ children }: { children: ReactNode }) {
  const [fontSize, setFontSize] = useState(1) // 1 = 100%

  return (
    <FontSizeContext.Provider value={{ fontSize, setFontSize }}>
      {children}
    </FontSizeContext.Provider>
  )
}

export function useFontSize(): FontSizeContextValue {
  const context = useContext(FontSizeContext)
  if (!context) {
    // Return default values if not in provider
    return { fontSize: 1, setFontSize: () => {} }
  }
  return context
}
