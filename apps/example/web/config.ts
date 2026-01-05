/**
 * Example App Configuration
 *
 * OAuth3 and network configuration for the example app.
 */

import type { OAuth3ProviderProps } from '@jejunetwork/auth/react'

type Network = 'localnet' | 'testnet' | 'mainnet'

const CHAIN_IDS: Record<Network, number> = {
  localnet: 31337,
  testnet: 10242,
  mainnet: 10241,
}

const SERVICES: Record<
  Network,
  { rpc: string; dws: string; oauth3Tee: string }
> = {
  localnet: {
    rpc: 'http://localhost:8545',
    dws: 'http://localhost:8787',
    oauth3Tee: 'http://localhost:8788',
  },
  testnet: {
    rpc: 'https://rpc.testnet.jejunetwork.org',
    dws: 'https://dws.testnet.jejunetwork.org',
    oauth3Tee: 'https://oauth3.testnet.jejunetwork.org',
  },
  mainnet: {
    rpc: 'https://rpc.jejunetwork.org',
    dws: 'https://dws.jejunetwork.org',
    oauth3Tee: 'https://oauth3.jejunetwork.org',
  },
}

/**
 * Detect network from hostname
 */
export function getNetwork(): Network {
  const hostname = window.location.hostname

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'localnet'
  }
  if (hostname.includes('testnet')) {
    return 'testnet'
  }
  return 'mainnet'
}

/**
 * Get services config for current network
 */
export function getServicesConfig() {
  return SERVICES[getNetwork()]
}

/**
 * Get the redirect URI for OAuth callbacks
 */
function getRedirectUri(): string {
  return `${window.location.origin}/auth/callback`
}

/**
 * Get API base URL
 */
export function getApiBaseUrl(): string {
  const network = getNetwork()
  if (network === 'localnet') {
    return 'http://localhost:4500/api/v1'
  }
  return `${window.location.origin}/api/v1`
}

/**
 * OAuth3 configuration for wallet authentication
 */
export function getOAuth3Config(): OAuth3ProviderProps['config'] {
  const services = getServicesConfig()
  const network = getNetwork()

  return {
    appId: 'example',
    appName: 'Example',
    redirectUri: getRedirectUri(),
    teeAgentUrl: services.oauth3Tee,
    rpcUrl: services.rpc,
    chainId: CHAIN_IDS[network],
    decentralized: network !== 'localnet',
    network,
  }
}

/**
 * Get chain ID for current network
 */
export function getChainId(): number {
  return CHAIN_IDS[getNetwork()]
}
