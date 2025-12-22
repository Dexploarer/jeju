/**
 * Typed Eden Treaty Client for Autocrat API
 *
 * Provides full type inference from the Elysia server
 */

import { treaty } from '@elysiajs/eden'
import type { App } from '../../../src/server'

const API_BASE = import.meta.env.VITE_AUTOCRAT_API || ''

/**
 * Typed Eden Treaty client for Autocrat API
 * All endpoints are fully typed based on the server definition
 */
export const api = treaty<App>(API_BASE)

/**
 * Eden error value - possible structures from validation errors
 */
interface EdenErrorValue {
  type?: string
  on?: string
  summary?: string
  message?: string
  error?: { message: string }
}

/**
 * Extract error message from Eden Treaty error value
 */
function getErrorMessage(value: unknown): string {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object') {
    const v = value as EdenErrorValue
    return v.message || v.summary || v.error?.message || 'API error'
  }
  return 'API error'
}

/**
 * Extract data from Eden response, throwing on error
 * Uses generic error type to accept actual TreatyResponse shape
 */
export function extractData<T>(response: {
  data: T | null
  error: { value: unknown } | null
}): T {
  if (response.error) {
    throw new Error(getErrorMessage(response.error.value))
  }
  if (response.data === null) {
    throw new Error('No data returned')
  }
  return response.data
}

/**
 * Extract data with a default value for null responses
 */
export function extractDataOrDefault<T>(
  response: {
    data: T | null
    error: { value: unknown } | null
  },
  defaultValue: T,
): T {
  if (response.error) {
    throw new Error(getErrorMessage(response.error.value))
  }
  return response.data ?? defaultValue
}
