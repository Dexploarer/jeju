/**
 * Default Bots Configuration
 * Defines the default trading bot configurations for different networks
 */

import type { Address } from 'viem'
import type {
  TradingBotChain,
  TradingBotStrategy,
  TradingBotStrategyType,
} from '../../lib/types'

export interface DefaultBotConfig {
  name: string
  description: string
  strategies: TradingBotStrategy[]
  chains: number[]
  initialFunding: string
}

export interface TradingBotOptions {
  agentId: bigint
  name: string
  strategies: TradingBotStrategy[]
  chains: TradingBotChain[]
  privateKey?: string
  maxConcurrentExecutions: number
  useFlashbots: boolean
  treasuryAddress?: Address
}

// Default chain configurations
export const DEFAULT_CHAINS: Record<string, TradingBotChain> = {
  mainnet: {
    chainId: 1,
    name: 'Ethereum',
    rpcUrl: 'https://eth.llamarpc.com',
    blockTime: 12000,
    isL2: false,
    nativeSymbol: 'ETH',
  },
  arbitrum: {
    chainId: 42161,
    name: 'Arbitrum',
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    blockTime: 250,
    isL2: true,
    nativeSymbol: 'ETH',
  },
  optimism: {
    chainId: 10,
    name: 'Optimism',
    rpcUrl: 'https://mainnet.optimism.io',
    blockTime: 2000,
    isL2: true,
    nativeSymbol: 'ETH',
  },
  base: {
    chainId: 8453,
    name: 'Base',
    rpcUrl: 'https://mainnet.base.org',
    blockTime: 2000,
    isL2: true,
    nativeSymbol: 'ETH',
  },
  bsc: {
    chainId: 56,
    name: 'BNB Chain',
    rpcUrl: 'https://bsc-dataseed.binance.org',
    blockTime: 3000,
    isL2: false,
    nativeSymbol: 'BNB',
  },
  jeju: {
    chainId: 420690,
    name: 'Jeju',
    rpcUrl: 'https://rpc.jejunetwork.io',
    blockTime: 1000,
    isL2: true,
    nativeSymbol: 'JEJU',
  },
  jejuTestnet: {
    chainId: 420691,
    name: 'Jeju Testnet',
    rpcUrl: 'https://testnet-rpc.jejunetwork.io',
    blockTime: 1000,
    isL2: true,
    nativeSymbol: 'JEJU',
  },
}

// Testnet chain IDs
const TESTNET_CHAIN_IDS = new Set([420690, 11155111, 84532, 421614])

// Mainnet to testnet chain mapping
const MAINNET_TO_TESTNET: Record<number, number> = {
  1: 11155111, // Ethereum -> Sepolia
  8453: 84532, // Base -> Base Sepolia
  42161: 421614, // Arbitrum -> Arbitrum Sepolia
  420690: 420690, // Jeju (same for testnet)
}

// Localnet chain ID
const LOCALNET_CHAIN_ID = 31337

/**
 * Default bot configurations for mainnet
 */
export const DEFAULT_BOTS: DefaultBotConfig[] = [
  {
    name: 'Arbitrage Scout',
    description: 'Cross-DEX arbitrage bot for high-liquidity pairs',
    strategies: [
      {
        type: 'DEX_ARBITRAGE' as TradingBotStrategyType,
        enabled: true,
        minProfitBps: 10,
        maxGasGwei: 100,
        maxSlippageBps: 50,
      },
    ],
    chains: [1, 42161, 10, 8453],
    initialFunding: '1.0',
  },
  {
    name: 'MEV Sandwich',
    description: 'Sandwich attack bot for mempool opportunities',
    strategies: [
      {
        type: 'SANDWICH' as TradingBotStrategyType,
        enabled: true,
        minProfitBps: 50,
        maxGasGwei: 200,
        maxSlippageBps: 100,
      },
    ],
    chains: [1, 42161],
    initialFunding: '5.0',
  },
  {
    name: 'Cross-Chain Arbitrageur',
    description: 'Arbitrage opportunities across L2 chains',
    strategies: [
      {
        type: 'CROSS_CHAIN_ARBITRAGE' as TradingBotStrategyType,
        enabled: true,
        minProfitBps: 25,
        maxGasGwei: 150,
        maxSlippageBps: 75,
      },
    ],
    chains: [42161, 10, 8453, 420690],
    initialFunding: '2.0',
  },
  {
    name: 'Liquidation Hunter',
    description: 'Liquidation bot for lending protocols',
    strategies: [
      {
        type: 'LIQUIDATION' as TradingBotStrategyType,
        enabled: true,
        minProfitBps: 100,
        maxGasGwei: 300,
        maxSlippageBps: 200,
      },
    ],
    chains: [1, 42161, 10],
    initialFunding: '10.0',
  },
  {
    name: 'Oracle Keeper',
    description: 'Oracle update bot for price feeds',
    strategies: [
      {
        type: 'ORACLE_KEEPER' as TradingBotStrategyType,
        enabled: true,
        minProfitBps: 5,
        maxGasGwei: 50,
        maxSlippageBps: 10,
      },
    ],
    chains: [1, 42161, 10, 8453, 420690],
    initialFunding: '0.5',
  },
  {
    name: 'Intent Solver',
    description: 'Intent-based solver for order fulfillment',
    strategies: [
      {
        type: 'SOLVER' as TradingBotStrategyType,
        enabled: true,
        minProfitBps: 15,
        maxGasGwei: 100,
        maxSlippageBps: 50,
      },
    ],
    chains: [1, 42161, 10, 8453],
    initialFunding: '3.0',
  },
]

/**
 * Get default bots configured for a specific network
 */
export function getDefaultBotsForNetwork(
  network: 'localnet' | 'testnet' | 'mainnet',
): DefaultBotConfig[] {
  if (network === 'mainnet') {
    return DEFAULT_BOTS
  }

  return DEFAULT_BOTS.map((bot) => {
    if (network === 'localnet') {
      return {
        ...bot,
        chains: [LOCALNET_CHAIN_ID],
        initialFunding: '0.01',
      }
    }

    // Testnet - map mainnet chains to testnet equivalents
    const testnetChains = bot.chains
      .map((chainId) => MAINNET_TO_TESTNET[chainId])
      .filter((chainId): chainId is number => chainId !== undefined)
      .filter((chainId) => TESTNET_CHAIN_IDS.has(chainId))

    const fundingMultiplier = 0.1 // 10% of mainnet funding for testnet
    const newFunding = (
      parseFloat(bot.initialFunding) * fundingMultiplier
    ).toString()

    return {
      ...bot,
      chains: testnetChains,
      initialFunding: newFunding,
    }
  })
}

/**
 * Get chain configuration by chain ID
 */
function getChainConfig(chainId: number): TradingBotChain | undefined {
  return Object.values(DEFAULT_CHAINS).find((c) => c.chainId === chainId)
}

/**
 * Create trading bot options from a bot configuration
 */
export function createTradingBotOptions(
  config: DefaultBotConfig,
  agentId: bigint,
  network: 'localnet' | 'testnet' | 'mainnet',
  treasuryAddress?: Address,
): TradingBotOptions {
  // Map chain IDs to chain configs
  const chains: TradingBotChain[] = config.chains
    .map((chainId) => getChainConfig(chainId))
    .filter((c): c is TradingBotChain => c !== undefined)

  return {
    agentId,
    name: config.name,
    strategies: config.strategies,
    chains,
    maxConcurrentExecutions: 5,
    useFlashbots: network !== 'localnet',
    treasuryAddress,
  }
}
