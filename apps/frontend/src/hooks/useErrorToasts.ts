/**
 * useErrorToasts Hook
 */
import { useCallback } from 'react'

export function useErrorToasts() {
  const showError = useCallback((message: string) => {
    console.error(message)
    // In a real app, this would show a toast notification
  }, [])

  return { showError }
}
