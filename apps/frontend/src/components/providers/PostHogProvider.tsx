/**
 * PostHog provider component for initializing PostHog analytics.
 *
 * Initializes PostHog analytics client and automatically tracks page views
 * as users navigate. Provides PostHog context to child components.
 */
import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { initPostHog, posthog } from '../../lib/posthog'

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const initialized = useRef(false)

  // Initialize PostHog once
  useEffect(() => {
    if (!initialized.current) {
      initPostHog()
      initialized.current = true
    }
  }, [])

  // Track page views
  useEffect(() => {
    if (location.pathname) {
      let url = window.origin + location.pathname
      if (location.search) {
        url = url + location.search
      }

      // Track pageview with PostHog
      if (typeof window !== 'undefined' && posthog) {
        posthog.capture('$pageview', {
          $current_url: url,
          $pathname: location.pathname,
          $search_params: location.search || '',
        })
      }
    }
  }, [location.pathname, location.search])

  return <>{children}</>
}
