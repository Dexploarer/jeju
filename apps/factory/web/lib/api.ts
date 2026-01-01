/**
 * API Client Utilities
 *
 * Shared helpers for API requests in frontend hooks.
 */

import { FACTORY_API_URL } from '../config/env'

export const API_BASE = FACTORY_API_URL

/** Build headers with optional wallet address authentication */
export function getHeaders(address?: string): Record<string, string> {
  const headers: Record<string, string> = {}
  if (address) {
    headers['x-wallet-address'] = address
    headers.authorization = `Bearer ${address}`
  }
  return headers
}

/** Typed fetch wrapper that handles JSON responses */
export async function apiFetch<T>(
  path: string,
  options?: RequestInit & { address?: string },
): Promise<T> {
  const { address, ...fetchOptions } = options ?? {}
  const headers = {
    ...getHeaders(address),
    ...fetchOptions.headers,
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...fetchOptions,
    headers,
  })

  return response.json()
}

/** POST request helper */
export async function apiPost<T>(
  path: string,
  body: unknown,
  address?: string,
): Promise<T> {
  return apiFetch<T>(path, {
    method: 'POST',
    address,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/** DELETE request helper */
export async function apiDelete<T>(
  path: string,
  body?: unknown,
  address?: string,
): Promise<T> {
  const options: RequestInit & { address?: string } = {
    method: 'DELETE',
    address,
  }
  if (body) {
    options.headers = { 'Content-Type': 'application/json' }
    options.body = JSON.stringify(body)
  }
  return apiFetch<T>(path, options)
}
