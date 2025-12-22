/**
 * Typed HTTP Client for Training Services
 *
 * Type-safe fetch wrapper with Zod validation for DWS/compute API calls.
 */

import { z } from 'zod'

/** Request options for typed client - body will be JSON.stringified */
interface TypedRequestOptions {
  method?: string
  headers?: Record<string, string>
  /** Body will be JSON.stringified - accepts any serializable value */
  body?: Record<string, unknown>
}

/**
 * Create a typed HTTP client for a service endpoint
 */
export function createTypedClient(
  baseUrl: string,
  options: {
    headers?: Record<string, string>
    timeout?: number
  } = {},
) {
  const { headers: defaultHeaders = {}, timeout = 60000 } = options
  const normalizedUrl = baseUrl.replace(/\/$/, '')

  async function request<T>(
    path: string,
    schema: z.ZodSchema<T>,
    init?: TypedRequestOptions,
  ): Promise<T> {
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...defaultHeaders,
      ...init?.headers,
    }

    const response = await fetch(`${normalizedUrl}${path}`, {
      method: init?.method,
      headers: requestHeaders,
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(timeout),
    })

    if (!response.ok) {
      const error = await response.text().catch(() => '')
      throw new Error(
        `HTTP ${response.status}: ${error || response.statusText}`,
      )
    }

    const rawData: unknown = await response.json()
    return schema.parse(rawData)
  }

  async function requestVoid(
    path: string,
    init?: TypedRequestOptions,
  ): Promise<void> {
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...defaultHeaders,
      ...init?.headers,
    }

    const response = await fetch(`${normalizedUrl}${path}`, {
      method: init?.method,
      headers: requestHeaders,
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(timeout),
    })

    if (!response.ok) {
      const error = await response.text().catch(() => '')
      throw new Error(
        `HTTP ${response.status}: ${error || response.statusText}`,
      )
    }
  }

  async function checkHealth(path = '/health'): Promise<boolean> {
    const response = await fetch(`${normalizedUrl}${path}`, {
      signal: AbortSignal.timeout(5000),
    }).catch(() => null)
    return response?.ok ?? false
  }

  return { request, requestVoid, checkHealth, baseUrl: normalizedUrl }
}

// ============================================================================
// DWS-specific typed client
// ============================================================================

export const DWSJobStatusSchema = z.enum([
  'pending',
  'queued',
  'running',
  'completed',
  'failed',
  'cancelled',
])

/**
 * Job result schema - accepts common result types from DWS jobs.
 * Using passthrough for flexibility since job results vary by job type.
 */
const JobResultSchema = z
  .object({
    modelCid: z.string().optional(),
    checkpointCid: z.string().optional(),
    metrics: z.record(z.string(), z.number()).optional(),
    artifacts: z.array(z.string()).optional(),
  })
  .passthrough()

export const DWSJobResponseSchema = z
  .object({
    jobId: z.string().min(1).max(255),
    status: DWSJobStatusSchema,
    result: JobResultSchema.optional(),
    error: z.string().max(10000).optional(),
    logs: z.array(z.string().max(10000)).optional(),
  })
  .strict()

export const DWSSubmitResponseSchema = z
  .object({
    jobId: z.string().min(1).max(255),
  })
  .strict()

export type DWSJobResponse = z.infer<typeof DWSJobResponseSchema>
export type DWSSubmitResponse = z.infer<typeof DWSSubmitResponseSchema>

/**
 * Create a DWS-specific typed client
 */
export function createDWSClient(
  dwsUrl: string,
  options: { headers?: Record<string, string> } = {},
) {
  const client = createTypedClient(dwsUrl, { ...options, timeout: 120000 })

  return {
    async submitJob(
      command: string,
      env: Record<string, string> = {},
    ): Promise<DWSSubmitResponse> {
      return client.request('/api/jobs', DWSSubmitResponseSchema, {
        method: 'POST',
        body: { command, env },
      })
    },

    async getJob(jobId: string): Promise<DWSJobResponse> {
      return client.request(`/api/jobs/${jobId}`, DWSJobResponseSchema)
    },

    async cancelJob(jobId: string): Promise<void> {
      return client.requestVoid(`/api/jobs/${jobId}/cancel`, { method: 'POST' })
    },

    async waitForJob(
      jobId: string,
      options: { pollInterval?: number; timeout?: number } = {},
    ): Promise<DWSJobResponse> {
      const { pollInterval = 2000, timeout = 300000 } = options
      const startTime = Date.now()

      while (Date.now() - startTime < timeout) {
        const job = await this.getJob(jobId)
        if (
          job.status === 'completed' ||
          job.status === 'failed' ||
          job.status === 'cancelled'
        ) {
          return job
        }
        await new Promise((r) => setTimeout(r, pollInterval))
      }

      throw new Error(`Job ${jobId} did not complete within ${timeout}ms`)
    },

    checkHealth: client.checkHealth,
  }
}
