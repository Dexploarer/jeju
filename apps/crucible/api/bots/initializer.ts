/**
 * Bot Initializer
 * Initializes and manages trading bots based on configuration
 */

import type { PublicClient } from 'viem'
import type { CrucibleConfig } from '../../lib/types'
import type { AgentSDK } from '../sdk/agent'
import type { KMSSigner } from '../sdk/kms-signer'
import {
  createTradingBotOptions,
  getDefaultBotsForNetwork,
} from './default-bots'
import { createTradingBot, type TradingBot } from './trading-bot'

export interface BotInitializerConfig {
  crucibleConfig: CrucibleConfig
  agentSdk: AgentSDK
  publicClient: PublicClient
  kmsSigner: KMSSigner
}

/**
 * Bot Initializer class for managing trading bot lifecycle
 */
export class BotInitializer {
  private config: CrucibleConfig
  private agentSdk: AgentSDK
  private kmsSigner: KMSSigner
  private bots: Map<bigint, TradingBot> = new Map()

  constructor(options: BotInitializerConfig) {
    this.config = options.crucibleConfig
    this.agentSdk = options.agentSdk
    this.kmsSigner = options.kmsSigner
  }

  /**
   * Check if we have a valid signer (either private key or initialized KMS)
   */
  private hasSigner(): boolean {
    return (
      this.config.privateKey !== undefined || this.kmsSigner.isInitialized()
    )
  }

  /**
   * Initialize all default bots for the configured network
   */
  async initializeDefaultBots(): Promise<Map<bigint, TradingBot>> {
    // Check if we have a signer
    if (!this.hasSigner()) {
      console.log(
        '[BotInitializer] No signer available, skipping bot initialization',
      )
      return this.bots
    }

    const network = this.config.network ?? 'localnet'
    const defaultBots = getDefaultBotsForNetwork(network)

    // Initialize bots in parallel
    const results = await Promise.allSettled(
      defaultBots.map(async (botConfig) => {
        try {
          // Register the agent
          const registration = await this.agentSdk.registerAgent(
            {
              id: `bot-${botConfig.name.toLowerCase().replace(/\s+/g, '-')}`,
              name: botConfig.name,
              description: botConfig.description,
              system: `You are ${botConfig.name}, a trading bot.`,
              bio: [botConfig.description],
              messageExamples: [],
              topics: ['trading', 'defi'],
              adjectives: ['efficient', 'fast', 'precise'],
              style: { all: [], chat: [], post: [] },
            },
            {
              botType: 'trading_bot',
              initialFunding: BigInt(
                Math.floor(parseFloat(botConfig.initialFunding) * 1e18),
              ),
            },
          )

          // Create trading bot options
          const options = createTradingBotOptions(
            botConfig,
            registration.agentId,
            network,
            this.config.contracts.agentVault,
          )

          // Add private key if available
          if (this.config.privateKey) {
            options.privateKey = this.config.privateKey
          }

          // Create and start the bot
          const bot = createTradingBot(options)
          await bot.start()

          this.bots.set(registration.agentId, bot)
          return { agentId: registration.agentId, bot }
        } catch (error) {
          console.error(
            `[BotInitializer] Failed to initialize ${botConfig.name}:`,
            error,
          )
          throw error
        }
      }),
    )

    // Log results
    const successful = results.filter((r) => r.status === 'fulfilled').length
    const failed = results.filter((r) => r.status === 'rejected').length
    console.log(
      `[BotInitializer] Initialized ${successful} bots, ${failed} failed`,
    )

    return this.bots
  }

  /**
   * Get a bot by agent ID
   */
  getBot(agentId: bigint): TradingBot | undefined {
    return this.bots.get(agentId)
  }

  /**
   * Get all bots
   */
  getAllBots(): Map<bigint, TradingBot> {
    return this.bots
  }

  /**
   * Stop all bots
   */
  async stopAll(): Promise<void> {
    const stopPromises = Array.from(this.bots.values()).map(async (bot) => {
      try {
        await bot.stop()
      } catch (error) {
        console.error(`[BotInitializer] Error stopping bot ${bot.name}:`, error)
      }
    })

    await Promise.all(stopPromises)
    this.bots.clear()
  }
}

/**
 * Create a bot initializer
 */
export function createBotInitializer(
  config: BotInitializerConfig,
): BotInitializer {
  return new BotInitializer(config)
}




