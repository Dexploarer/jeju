/**
 * PostHog Analytics
 *
 * PostHog initialization and client export
 */

import posthogLib from 'posthog-js'

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY || ''
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://app.posthog.com'

let initialized = false

export function initPostHog() {
  if (initialized || typeof window === 'undefined' || !POSTHOG_KEY) {
    return
  }

  posthogLib.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: false, // We handle this manually
    persistence: 'localStorage',
    autocapture: false,
  })

  initialized = true
}

export const posthog = posthogLib
