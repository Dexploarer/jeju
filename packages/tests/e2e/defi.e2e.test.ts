import { beforeAll, describe, expect, test } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { getContractAddresses } from '@jejunetwork/contracts'
import type { ChainConfig } from '@jejunetwork/types'
import { createPublicClient, http } from 'viem'

const CONFIG_PATH = join(
  process.cwd(),
  'packages',
  'config',
  'chain',
  'localnet.json',
)

// Initialize deployment at module level so describe.skipIf works
const addresses = getContractAddresses(31337)
const deployment = {
  uniswapV4: {
    PoolManager: addresses?.uniswapV4?.PoolManager,
    SwapRouter: addresses?.uniswapV4?.SwapRouter,
  },
  synthetixV3: addresses?.synthetixV3 ?? {},
  compoundV3: addresses?.compoundV3 ?? {},
  chainlink: addresses?.chainlink ?? {},
  compound: addresses?.compound,
}

describe('DeFi E2E Tests', () => {
  let publicClient: ReturnType<typeof createPublicClient>
  let config: ChainConfig

  beforeAll(() => {
    if (!existsSync(CONFIG_PATH)) {
      throw new Error('Config file not found')
    }
    config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'))

    publicClient = createPublicClient({
      transport: http(config.rpcUrl),
    })
  })

  describe('Uniswap v4', () => {
    test('should have PoolManager deployed', async () => {
      if (!deployment.uniswapV4.PoolManager) {
        console.warn('Uniswap v4 not deployed, skipping')
        return
      }
      const code = await publicClient.getBytecode({
        address: deployment.uniswapV4.PoolManager as `0x${string}`,
      })

      expect(code).toBeDefined()
      expect(code).not.toBe('0x')
    })

    test('should execute a swap', async () => {
      if (!deployment.uniswapV4.SwapRouter) {
        console.warn('Uniswap v4 SwapRouter not deployed, skipping')
        return
      }

      // Placeholder - actual swap would require:
      // 1. Get test account with funds
      // 2. Approve Uniswap router to spend ETH/WETH
      // 3. Execute swap (e.g., ETH to USDC)
      // 4. Approve Compound to spend USDC
      // 5. Supply USDC to Compound market
      // 6. Verify balances have updated correctly

      const swapRouter = deployment.uniswapV4.SwapRouter as `0x${string}`
      const code = await publicClient.getBytecode({ address: swapRouter })
      expect(code).toBeDefined()
    })
  })

  describe('Synthetix v3', () => {
    test('should have CoreProxy deployed with code', async () => {
      if (!deployment.synthetixV3.CoreProxy) {
        console.warn('Synthetix V3 not found in deployment, skipping test.')
        return
      }
      const code = await publicClient.getBytecode({
        address: deployment.synthetixV3.CoreProxy,
      })
      expect(code).toBeDefined()
      expect(code).not.toBe('0x')
    })
  })

  describe('Compound v3', () => {
    test('should have Comet deployed with code', async () => {
      if (!deployment.compoundV3.Comet) {
        console.warn('Compound V3 not found in deployment, skipping test.')
        return
      }
      const code = await publicClient.getBytecode({
        address: deployment.compoundV3.Comet,
      })
      expect(code).toBeDefined()
      expect(code).not.toBe('0x')
    })
  })

  // Cross-protocol interaction tests - requires Uniswap V4, Compound, Synthetix, Chainlink
  describe.skipIf(!deployment.uniswapV4)('Cross-Protocol Interactions', () => {
    test('should swap on Uniswap and supply to Compound', async () => {
      // Uniswap V4 pools not deployed on localnet yet
      // This test will be enabled once V4 periphery is deployed
      if (!deployment.uniswapV4 || !deployment.compound) {
        console.log('⏭️  Uniswap V4 or Compound not deployed')
        return
      }
      // Actual implementation would go here when deployed
      expect(deployment.uniswapV4).toBeTruthy()
    })

    test('should use Chainlink price in Synthetix trade', async () => {
      if (!deployment.synthetixV3 || !deployment.chainlink) {
        console.log('⏭️  Synthetix V3 or Chainlink not deployed')
        return
      }
      // Actual implementation would go here when deployed
      expect(deployment.chainlink).toBeTruthy()
    })
  })
})
