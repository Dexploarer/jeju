import {
  CORE_PORTS,
  getCurrentNetwork,
  getLocalhostHost,
} from '@jejunetwork/config'

export const NETWORK_NAME = 'Jeju Network'

const _NETWORK = getCurrentNetwork()

// Crucible API runs on the executor port (4021)
export const CRUCIBLE_PORT = CORE_PORTS.CRUCIBLE_API.DEFAULT
export const CRUCIBLE_API_PORT = CORE_PORTS.CRUCIBLE_EXECUTOR.DEFAULT

// API URL - crucible API server runs on executor port
// In production, we use relative URLs so the DWS app router can proxy API requests
const getApiBaseUrl = (): string => {
  const localhost = getLocalhostHost()
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname
    // Local development
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.endsWith('.local.jejunetwork.org')
    ) {
      return `http://${localhost}:${CRUCIBLE_API_PORT}`
    }
    // Production: use same-origin relative paths for DWS proxy
    if (hostname.endsWith('.jejunetwork.org')) {
      return '' // Relative URL - /api will be proxied by DWS
    }
  }
  // Fallback for SSR/node
  return `http://${localhost}:${CRUCIBLE_API_PORT}`
}

export const API_URL = getApiBaseUrl()
