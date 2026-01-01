/**
 * Factory Environment Configuration
 *
 * Centralizes environment variables and provides proper defaults
 * for different deployment contexts (localnet, testnet, mainnet).
 */

import {
  getApiKey,
  getChainId,
  getCurrentNetwork,
  getLocalhostHost,
  getRpcUrl,
} from '@jejunetwork/config'

// Network from config (localnet, testnet, mainnet)
export const NETWORK = getCurrentNetwork()
export const CHAIN_ID = getChainId(NETWORK)
export const RPC_URL = getRpcUrl(NETWORK)

// WalletConnect - disabled by default in development
export const WALLETCONNECT_PROJECT_ID =
  NETWORK === 'localnet' ? '' : getApiKey('walletconnect')

/**
 * Get the Factory API base URL based on deployment context
 *
 * Rules:
 * - SSR/Node: Use localhost with port 4009
 * - Localhost development: Use localhost with port 4009
 * - Production (testnet/mainnet): Use same origin (API served via DWS app router)
 */
export function getFactoryApiUrl(): string {
  // Server-side rendering
  if (typeof window === 'undefined') {
    return `http://${getLocalhostHost()}:4009`
  }

  const { hostname, port, protocol } = window.location

  // Local development - frontend dev server proxies to API on port 4009
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    // If we're on port 4009, we're running the combined server
    if (port === '4009') {
      return ''
    }
    // Otherwise, frontend is on different port (e.g., 5173), point to API port
    return `http://${getLocalhostHost()}:4009`
  }

  // Local dev with custom domain (*.local.jejunetwork.org)
  if (hostname.includes('local.jejunetwork.org')) {
    return `${protocol}//${hostname}${port ? `:${port}` : ''}`
  }

  // Production/testnet - use same origin
  // DWS app router proxies /api/* to the backend worker
  // Using empty string for same-origin requests
  return ''
}

// Export the resolved API URL
export const FACTORY_API_URL = getFactoryApiUrl()
