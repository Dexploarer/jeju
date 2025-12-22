/**
 * Eden Client for Training Services
 *
 * Type-safe HTTP client using Eden Treaty for DWS/compute API calls.
 */

import { treaty } from '@elysiajs/eden'
import { z } from 'zod'

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
  const { headers = {}, timeout = 60000 } = options
  const normalizedUrl = baseUrl.replace(/\/$/, '')

  // Create a basic treaty client - callers can cast to specific API types
  // biome-ignore lint/suspicious/noExplicitAny: treaty requires dynamic URL type
  const client = treaty(normalizedUrl as any, {
    fetcher: (url, init) =>
      fetch(url, {
        ...init,
        headers: {
          ...init?.headers,
          ...headers,
        },
        signal: AbortSignal.timeout(timeout),
      }),
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

// ============================================================================
// DWS-specific API Types and Client
// ============================================================================

export const DWSJobStatusSchema = z.enum([
  'pending',
  'queued',
  'running',
  'completed',
  'failed',
  'cancelled',
])

export const DWSJobResponseSchema = z.object({
  jobId: z.string(),
  status: DWSJobStatusSchema,
  result: z.unknown().optional(),
  error: z.string().optional(),
  logs: z.array(z.string()).optional(),
})

export const DWSSubmitResponseSchema = z.object({
  jobId: z.string(),
})

export type DWSJobStatus = z.infer<typeof DWSJobStatusSchema>
export type DWSJobResponse = z.infer<typeof DWSJobResponseSchema>
export type DWSSubmitResponse = z.infer<typeof DWSSubmitResponseSchema>

/**
 * Create a DWS-specific Eden client with typed methods
 */
export function createDWSClient(
  dwsUrl: string,
  options: EdenRequestOptions = {},
) {
  const normalizedUrl = dwsUrl.replace(/\/$/, '')
  const timeout = options.timeout ?? 120000

  async function submitJob(
    command: string,
    env?: Record<string, string>,
  ): Promise<DWSSubmitResponse> {
    const response = await fetch(`${normalizedUrl}/api/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: JSON.stringify({ command, env }),
      signal: AbortSignal.timeout(timeout),
    })

    if (!response.ok) {
      const error = await response.text().catch(() => '')
      throw new Error(
        `HTTP ${response.status}: ${error || response.statusText}`,
      )
    }

    const rawData: unknown = await response.json()
    return DWSSubmitResponseSchema.parse(rawData)
  }

  async function getJob(jobId: string): Promise<DWSJobResponse> {
    const response = await fetch(`${normalizedUrl}/api/jobs/${jobId}`, {
      headers: options.headers,
      signal: AbortSignal.timeout(timeout),
    })

    if (!response.ok) {
      const error = await response.text().catch(() => '')
      throw new Error(
        `HTTP ${response.status}: ${error || response.statusText}`,
      )
    }

    const rawData: unknown = await response.json()
    return DWSJobResponseSchema.parse(rawData)
  }

  async function cancelJob(jobId: string): Promise<void> {
    const response = await fetch(`${normalizedUrl}/api/jobs/${jobId}/cancel`, {
      method: 'POST',
      headers: options.headers,
      signal: AbortSignal.timeout(timeout),
    })

    if (!response.ok) {
      const error = await response.text().catch(() => '')
      throw new Error(
        `HTTP ${response.status}: ${error || response.statusText}`,
      )
    }
  }

  async function waitForJob(
    jobId: string,
    waitOptions: { pollInterval?: number; timeout?: number } = {},
  ): Promise<DWSJobResponse> {
    const { pollInterval = 2000, timeout: waitTimeout = 300000 } = waitOptions
    const startTime = Date.now()

    while (Date.now() - startTime < waitTimeout) {
      const job = await getJob(jobId)
      if (
        job.status === 'completed' ||
        job.status === 'failed' ||
        job.status === 'cancelled'
      ) {
        return job
      }
      await new Promise((r) => setTimeout(r, pollInterval))
    }

    throw new Error(`Job ${jobId} did not complete within ${waitTimeout}ms`)
  }

  async function checkHealth(): Promise<boolean> {
    return checkEdenHealth(normalizedUrl)
  }

  return { submitJob, getJob, cancelJob, waitForJob, checkHealth }
}
