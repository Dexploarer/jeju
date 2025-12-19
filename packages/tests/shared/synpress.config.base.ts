/**
 * Base Synpress Configuration for Wallet E2E Tests
 * 
 * SINGLE SOURCE OF TRUTH for all Synpress/wallet testing.
 * All apps should use this config to ensure consistency.
 * 
 * Usage in app synpress.config.ts:
 * ```typescript
 * import { createSynpressConfig, createWalletSetup, PASSWORD } from '@jejunetwork/tests';
 * export default createSynpressConfig({ appName: 'gateway', port: 4001 });
 * export const basicSetup = createWalletSetup();
 * export { PASSWORD };
 * ```
 * 
 * Usage in wallet-setup/basic.setup.ts:
 * ```typescript
 * import { defineWalletSetup } from '@synthetixio/synpress';
 * import { MetaMask } from '@synthetixio/synpress/playwright';
 * import { PASSWORD, SEED_PHRASE, JEJU_CHAIN } from '@jejunetwork/tests';
 * 
 * export default defineWalletSetup(PASSWORD, async (context, walletPage) => {
 *   const metamask = new MetaMask(context, walletPage, PASSWORD);
 *   await metamask.importWallet(SEED_PHRASE);
 *   await metamask.addNetwork(JEJU_CHAIN);
 *   await metamask.switchNetwork(JEJU_CHAIN.name);
 * });
 * ```
 */

import { defineConfig, devices, type PlaywrightTestConfig } from '@playwright/test';
import { join } from 'path';

// ============================================================================
// CANONICAL TEST CONSTANTS - USE THESE EVERYWHERE
// ============================================================================

/** Standard test seed phrase (Anvil default) */
export const SEED_PHRASE = 'test test test test test test test test test test test junk';

/** Standard test wallet password for MetaMask */
export const PASSWORD = 'Tester@1234';

/** Default test wallet address (account 0 from seed phrase) */
export const TEST_WALLET_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

/** Chain ID for localnet (matches Anvil default) */
export const JEJU_CHAIN_ID = parseInt(process.env.CHAIN_ID || '1337');

/** RPC URL for localnet */
export const JEJU_RPC_URL = process.env.L2_RPC_URL || process.env.JEJU_RPC_URL || 'http://127.0.0.1:9545';

/** Synpress cache directory */
export const SYNPRESS_CACHE_DIR = join(process.cwd(), '..', '..', '.jeju', '.synpress-cache');

/** Global setup path */
export const GLOBAL_SETUP_PATH = join(__dirname, 'global-setup.ts');

/** Global teardown path */
export const GLOBAL_TEARDOWN_PATH = join(__dirname, 'global-teardown.ts');

/** Test accounts (Anvil defaults) */
export const TEST_ACCOUNTS = {
  deployer: {
    address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as const,
    privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as const,
  },
  user1: {
    address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as const,
    privateKey: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' as const,
  },
  user2: {
    address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC' as const,
    privateKey: '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a' as const,
  },
  user3: {
    address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906' as const,
    privateKey: '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6' as const,
  },
  operator: {
    address: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65' as const,
    privateKey: '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a' as const,
  },
} as const;

// ============================================================================
// NETWORK CONFIGURATION
// ============================================================================

/**
 * Network Localnet chain configuration for MetaMask
 * This is the PRIMARY chain config - all apps should use this.
 */
export const JEJU_CHAIN = {
  chainId: JEJU_CHAIN_ID,
  chainIdHex: `0x${JEJU_CHAIN_ID.toString(16)}`,
  name: 'Jeju Localnet',
  rpcUrl: JEJU_RPC_URL,
  symbol: 'ETH',
  blockExplorerUrl: '',
} as const;

// ============================================================================
// CONFIG OPTIONS
// ============================================================================

export interface SynpressConfigOptions {
  appName: string;
  port: number;
  testDir?: string;
  timeout?: number;
  baseURL?: string;
  overrides?: Partial<PlaywrightTestConfig>;
  webServer?: {
    command: string;
    timeout?: number;
  };
}

export interface SmokeTestConfigOptions {
  appName: string;
  port: number;
}

// ============================================================================
// CONFIG FACTORIES
// ============================================================================

/**
 * Create Synpress-compatible Playwright config for wallet E2E tests
 */
export function createSynpressConfig(options: SynpressConfigOptions): PlaywrightTestConfig {
  const {
    appName,
    port,
    testDir = './tests/synpress',
    timeout = 300000,
    baseURL = `http://localhost:${port}`,
    webServer,
    overrides = {},
  } = options;

  return defineConfig({
    testDir,
    fullyParallel: false, // Synpress requires sequential execution
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: 1, // Synpress requires single worker for MetaMask
    timeout,
    globalTimeout: 1800000, // 30 min global timeout

    expect: {
      timeout: 30000,
    },

    reporter: [
      ['list'],
      ['html', { outputFolder: `test-results/synpress-report-${appName}` }],
      ['json', { outputFile: `test-results/synpress-results-${appName}.json` }],
    ],

    use: {
      baseURL,
      trace: 'retain-on-failure',
      screenshot: 'only-on-failure',
      video: 'retain-on-failure',
      actionTimeout: 30000,
      navigationTimeout: 30000,
    },

    projects: [
      {
        name: 'chromium',
        use: {
          ...devices['Desktop Chrome'],
          viewport: { width: 1280, height: 720 },
        },
      },
    ],

    webServer: webServer
      ? {
          command: webServer.command,
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          timeout: webServer.timeout || 120000,
        }
      : undefined,

    ...overrides,
  });
}

/**
 * Create a minimal smoke test config (no webServer required)
 */
export function createSmokeTestConfig(options: SmokeTestConfigOptions): PlaywrightTestConfig {
  return createSynpressConfig({
    appName: options.appName,
    port: options.port,
    testDir: './tests/smoke',
    timeout: 120000,
    overrides: {
      retries: 0,
    },
  });
}

// ============================================================================
// WALLET SETUP
// ============================================================================

export interface WalletSetupOptions {
  seedPhrase?: string;
  password?: string;
  addNetwork?: boolean;
  switchToNetwork?: boolean;
}

export interface WalletSetupResult {
  seedPhrase: string;
  walletPassword: string;
  addNetwork: boolean;
  switchToNetwork: boolean;
  chain: typeof JEJU_CHAIN;
  testAccounts: typeof TEST_ACCOUNTS;
  testWalletAddress: string;
}

/**
 * Create wallet setup configuration for Synpress tests.
 * Returns a configuration object that can be used with defineWalletSetup.
 * 
 * Example wallet-setup/basic.setup.ts:
 * ```typescript
 * import { defineWalletSetup } from '@synthetixio/synpress';
 * import { MetaMask } from '@synthetixio/synpress/playwright';
 * import { PASSWORD, SEED_PHRASE, JEJU_CHAIN } from '@jejunetwork/tests';
 * 
 * export default defineWalletSetup(PASSWORD, async (context, walletPage) => {
 *   const metamask = new MetaMask(context, walletPage, PASSWORD);
 *   await metamask.importWallet(SEED_PHRASE);
 *   await metamask.addNetwork(JEJU_CHAIN);
 *   await metamask.switchNetwork(JEJU_CHAIN.name);
 * });
 * 
 * export { PASSWORD };
 * ```
 */
export function createWalletSetup(options: WalletSetupOptions = {}): WalletSetupResult {
  const {
    seedPhrase = SEED_PHRASE,
    password = PASSWORD,
    addNetwork = true,
    switchToNetwork = true,
  } = options;

  return {
    seedPhrase,
    walletPassword: password,
    addNetwork,
    switchToNetwork,
    chain: JEJU_CHAIN,
    testAccounts: TEST_ACCOUNTS,
    testWalletAddress: TEST_WALLET_ADDRESS,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default createSynpressConfig;
