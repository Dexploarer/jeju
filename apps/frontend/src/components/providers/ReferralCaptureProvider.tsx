import { logger } from '@babylon/shared'
import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * Referral capture provider component for capturing referral codes from URL.
 *
 * Captures the referral code from URL query parameter (?ref=CODE) and stores
 * it in sessionStorage for use during signup/onboarding. Ensures the referral
 * code persists across navigation until the user completes signup. Automatically
 * cleans up expired referral codes (older than 30 days).
 */
export function ReferralCaptureProvider() {
  const [searchParams] = useSearchParams()

  useEffect(() => {
    // Get referral code from URL
    const refCode = searchParams.get('ref')

    if (refCode) {
      // Store in sessionStorage (persists until browser tab is closed)
      sessionStorage.setItem('referralCode', refCode)

      logger.info(
        `Captured referral code: ${refCode}`,
        { code: refCode },
        'ReferralCaptureProvider'
      )

      // Also store timestamp to track how old the referral is
      sessionStorage.setItem('referralCodeTimestamp', Date.now().toString())
    }

    // Clean up expired referral codes (older than 30 days)
    const timestamp = sessionStorage.getItem('referralCodeTimestamp')
    if (timestamp) {
      const age = Date.now() - Number.parseInt(timestamp)
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000

      if (age > thirtyDaysMs) {
        sessionStorage.removeItem('referralCode')
        sessionStorage.removeItem('referralCodeTimestamp')
        logger.info(
          'Removed expired referral code',
          undefined,
          'ReferralCaptureProvider'
        )
      }
    }
  }, [searchParams])

  // This component doesn't render anything
  return null
}

/**
 * Get the stored referral code
 *
 * Call this function during signup/onboarding to retrieve the
 * referral code that was captured from the URL.
 */
export function getReferralCode(): string | null {
  return sessionStorage.getItem('referralCode')
}

/**
 * Clear the stored referral code
 *
 * Call this after successful signup to prevent reuse.
 */
export function clearReferralCode(): void {
  sessionStorage.removeItem('referralCode')
  sessionStorage.removeItem('referralCodeTimestamp')
}
