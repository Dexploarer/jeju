/**
 * Unified Wallet Setup for All Jeju Apps
 * 
 * This is the CANONICAL wallet setup that all apps should use.
 * It imports configuration from the shared synpress.config.base.ts
 * to ensure consistency across all E2E tests.
 * 
 * Usage in app's wallet-setup/basic.setup.ts:
 * ```typescript
 * export { default, PASSWORD, SEED_PHRASE } from '@jejunetwork/tests/wallet-setup';
 * ```
 */

import { defineWalletSetup } from '@synthetixio/synpress';
import { MetaMask } from '@synthetixio/synpress/playwright';
import { PASSWORD, SEED_PHRASE, JEJU_CHAIN } from '../synpress.config.base';

export default defineWalletSetup(PASSWORD, async (context, walletPage) => {
  const metamask = new MetaMask(context, walletPage, PASSWORD);

  // Import the standard test wallet
  await metamask.importWallet(SEED_PHRASE);

  // Add the Jeju Localnet network
  await metamask.addNetwork({
    name: JEJU_CHAIN.name,
    rpcUrl: JEJU_CHAIN.rpcUrl,
    chainId: JEJU_CHAIN.chainId,
    symbol: JEJU_CHAIN.symbol,
  });

  // Switch to the Jeju network
  await metamask.switchNetwork(JEJU_CHAIN.name);
});

// Re-export constants for convenience
export { PASSWORD, SEED_PHRASE, JEJU_CHAIN } from '../synpress.config.base';
