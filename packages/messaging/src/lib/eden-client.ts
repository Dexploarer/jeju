/**
 * Eden Client for Messaging Services
 *
 * Type-safe HTTP client using Eden Treaty for internal API calls.
 */

import { treaty } from '@elysiajs/eden'
import type { z } from 'zod'

/** Request options for Eden client */
export interface EdenRequestOptions {
  headers?: Record<string, string>
  timeout?: number
}

/** Eden result wrapper */
export interface EdenResult<T> {
  data: T | null
  error: Error | null
  status: number
}

/**
 * Create an Eden Treaty client for a service endpoint.
 * Uses type assertion since we don't have server types available.
 */
export function createEdenClient(
  baseUrl: string,
  options: EdenRequestOptions = {},
) {
  const { headers = {}, timeout = 30000 } = options
  const normalizedUrl = baseUrl.replace(/\/$/, '')

  const client = treaty(normalizedUrl, {
    fetch: {
      headers,
      signal: AbortSignal.timeout(timeout),
    },
  })

  return client
}

/**
 * Unwrap Eden result, throwing on error
 */
export function unwrapEden<T>(result: { data: T | null; error: unknown }): T {
  if (result.error) {
    const message =
      result.error instanceof Error
        ? result.error.message
        : String(result.error)
    throw new Error(message)
  }
  return result.data as T
}

/**
 * Unwrap Eden result, returning null on error
 */
export function unwrapEdenOptional<T>(result: {
  data: T | null
  error: unknown
}): T | null {
  if (result.error) return null
  return result.data
}

/**
 * Check health of an endpoint
 */
export async function checkEdenHealth(
  baseUrl: string,
  path = '/health',
  timeout = 5000,
): Promise<boolean> {
  const response = await fetch(`${baseUrl}${path}`, {
    signal: AbortSignal.timeout(timeout),
  }).catch(() => null)
  return response?.ok ?? false
}

/**
 * Validated fetch helper for when you need Zod validation with Eden
 */
export async function fetchAndValidate<T>(
  url: string,
  schema: z.ZodSchema<T>,
  options?: RequestInit & { timeout?: number },
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(options?.timeout ?? 30000),
  })

  if (!response.ok) {
    const error = await response.text().catch(() => '')
    throw new Error(`HTTP ${response.status}: ${error || response.statusText}`)
  }

  const rawData: unknown = await response.json()
  return schema.parse(rawData)
}
