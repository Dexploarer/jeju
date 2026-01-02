import {
  CORE_PORTS,
  getCurrentNetwork,
  getLocalhostHost,
  getServicesConfig,
} from '@jejunetwork/config'

export const NETWORK_NAME = 'Jeju Network'

const NETWORK = getCurrentNetwork()

// Crucible API runs on the executor port (4021)
export const CRUCIBLE_PORT = CORE_PORTS.CRUCIBLE_API.DEFAULT
export const CRUCIBLE_API_PORT = CORE_PORTS.CRUCIBLE_EXECUTOR.DEFAULT

/**
 * Get the API base URL based on current environment
 * In production, uses the centralized services config (crucible.api URL)
 * In development, uses localhost
 */
function getApiBaseUrl(): string {
  const localhost = getLocalhostHost()

  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname

    // Local development - use localhost with proper port
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.endsWith('.local.jejunetwork.org')
    ) {
      return `http://${localhost}:${CRUCIBLE_API_PORT}`
    }

    // Production/testnet - use the centralized services config
    // The frontend is served from IPFS/CDN, but API is on a separate server
    if (hostname.endsWith('.jejunetwork.org')) {
      const services = getServicesConfig()
      // Use the executor URL since that's where the main API runs
      return services.crucible.executor
    }
  }

  // Fallback for SSR/node - use local URLs
  return `http://${localhost}:${CRUCIBLE_API_PORT}`
}

export const API_URL = getApiBaseUrl()

/**
 * Get the redirect URI for OAuth callbacks
 */
function getRedirectUri(): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/auth/callback`
  }
  // Fallback for SSR
  return 'http://localhost:4020/auth/callback'
}

/**
 * OAuth3 configuration for wallet authentication
 */
export function getOAuth3Config() {
  const services = getServicesConfig()

  return {
    appId: 'crucible',
    appName: 'Crucible',
    // Redirect URI for OAuth callbacks
    redirectUri: getRedirectUri(),
    // OAuth3 TEE agent URL
    teeAgentUrl: services.oauth3.tee,
    // Enable decentralized discovery via JNS
    decentralized: NETWORK !== 'localnet',
    // Network for chain interactions
    network: NETWORK,
  }
}

export { NETWORK }
