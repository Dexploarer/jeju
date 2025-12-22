/**
 * Wagmi Configuration
 */

import { createConfig, http } from 'wagmi';
import { baseSepolia, base } from 'wagmi/chains';

const chainId = Number(import.meta.env.VITE_CHAIN_ID || 84532);
const rpcUrl = import.meta.env.VITE_RPC_URL || 'https://sepolia.base.org';

export const wagmiConfig = createConfig({
  chains: [baseSepolia, base],
  transports: {
    [baseSepolia.id]: http(rpcUrl),
    [base.id]: http('https://mainnet.base.org'),
  },
});

export { chainId, rpcUrl };
