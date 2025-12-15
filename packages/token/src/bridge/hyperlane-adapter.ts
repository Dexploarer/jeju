/**
 * Hyperlane Adapter
 *
 * Provides cross-chain messaging and token bridging via Hyperlane.
 * Used for EVM chain interconnectivity.
 */

import {
  createPublicClient,
  http,
  keccak256,
  type Address,
  type Hex,
  type PublicClient,
} from 'viem';
import { mainnet, optimism, base, arbitrum, polygon, bsc, avalanche, sepolia, baseSepolia, arbitrumSepolia } from 'viem/chains';
import { CHAIN_TO_DOMAIN, getDomainId } from '../config/domains';
import type { ChainConfig, ChainId, MultisigISMConfig, WarpRouteConfig } from '../types';

// Map EVM chain IDs to viem chains
const VIEM_CHAINS: Record<number, typeof mainnet> = {
  1: mainnet,
  10: optimism,
  8453: base,
  42161: arbitrum,
  137: polygon,
  56: bsc,
  43114: avalanche,
  11155111: sepolia,
  84532: baseSepolia,
  421614: arbitrumSepolia,
};

export class HyperlaneAdapter {
  private readonly chains: ChainConfig[];
  private readonly warpRoutes: Record<ChainId, Address>;
  private readonly clients: Map<number, PublicClient>;

  constructor(chains: ChainConfig[], warpRoutes: Record<ChainId, Address>) {
    this.chains = chains;
    this.warpRoutes = warpRoutes;
    this.clients = new Map();

    // Initialize EVM clients
    for (const chain of chains) {
      if (chain.chainType === 'evm' && typeof chain.chainId === 'number') {
        const viemChain = VIEM_CHAINS[chain.chainId];
        if (viemChain) {
          const client = createPublicClient({
            chain: viemChain,
            transport: http(chain.rpcUrl),
          });
          this.clients.set(chain.chainId, client);
        }
      }
    }
  }

  /**
   * Get the Hyperlane domain ID for a chain
   */
  getDomainId(chainId: ChainId): number {
    return getDomainId(chainId);
  }

  /**
   * Convert an EVM address to bytes32 format
   */
  addressToBytes32(address: string): Hex {
    const clean = address.startsWith('0x') ? address.slice(2) : address;
    return `0x${clean.toLowerCase().padStart(64, '0')}` as Hex;
  }

  /**
   * Convert bytes32 back to an EVM address
   */
  bytes32ToAddress(bytes32: Hex): Address {
    // Take last 40 characters (20 bytes)
    const addressPart = bytes32.slice(-40);
    return `0x${addressPart}` as Address;
  }

  /**
   * Get the warp route address for a chain
   */
  getWarpRoute(chainId: ChainId): Address {
    const route = this.warpRoutes[chainId];
    if (!route) {
      throw new Error(`No warp route configured for chain ${chainId}`);
    }
    return route;
  }

  /**
   * Get a public client for a chain
   */
  getClient(chainId: ChainId): PublicClient {
    if (typeof chainId !== 'number') {
      throw new Error(`No client for chain ${chainId} - SVM chains use SolanaAdapter`);
    }
    const client = this.clients.get(chainId);
    if (!client) {
      throw new Error(`No client for chain ${chainId}`);
    }
    return client;
  }

  /**
   * Generate warp route configuration for deployment
   */
  generateWarpRouteConfig(
    tokenAddress: Address,
    chains: ChainId[],
    homeChainId: ChainId,
    owner: Address,
    validators: string[],
    threshold: number
  ): Record<ChainId, WarpRouteConfig> {
    const configs: Record<ChainId, WarpRouteConfig> = {} as Record<ChainId, WarpRouteConfig>;

    const ismConfig: MultisigISMConfig = {
      type: 'multisig',
      validators,
      threshold,
    };

    for (const chainId of chains) {
      const isHome = chainId === homeChainId;
      configs[chainId] = {
        tokenType: isHome ? 'collateral' : 'synthetic',
        tokenAddress: isHome ? tokenAddress : '0x0000000000000000000000000000000000000000' as Address,
        owner,
        ismConfig,
      };
    }

    return configs;
  }

  /**
   * Generate a deterministic deployment salt
   */
  getDeploymentSalt(symbol: string, version: number): Hex {
    const data = `${symbol}:${version}`;
    return keccak256(Buffer.from(data) as Hex);
  }

  /**
   * Compute the CREATE2 address for a warp route
   */
  computeWarpRouteAddress(
    factory: Address,
    salt: Hex,
    initCodeHash: Hex
  ): Address {
    // CREATE2 address = keccak256(0xff ++ factory ++ salt ++ keccak256(initCode))[12:]
    const data = `0xff${factory.slice(2)}${salt.slice(2)}${initCodeHash.slice(2)}`;
    const hash = keccak256(data as Hex);
    return `0x${hash.slice(-40)}` as Address;
  }
}
