import { type Address, parseAbi } from 'viem';

const NETWORK = process.env.NEXT_PUBLIC_NETWORK || 'testnet';

interface ChainlinkAddresses {
  vrfCoordinator: Address;
  automationRegistry: Address;
  oracleRouter: Address;
  chainlinkGovernance: Address;
}

const ADDRESSES: Record<string, ChainlinkAddresses> = {
  testnet: {
    vrfCoordinator: (process.env.NEXT_PUBLIC_VRF_COORDINATOR || '0x0') as Address,
    automationRegistry: (process.env.NEXT_PUBLIC_AUTOMATION_REGISTRY || '0x0') as Address,
    oracleRouter: (process.env.NEXT_PUBLIC_ORACLE_ROUTER || '0x0') as Address,
    chainlinkGovernance: (process.env.NEXT_PUBLIC_CHAINLINK_GOVERNANCE || '0x0') as Address,
  },
  mainnet: {
    vrfCoordinator: (process.env.NEXT_PUBLIC_VRF_COORDINATOR || '0x0') as Address,
    automationRegistry: (process.env.NEXT_PUBLIC_AUTOMATION_REGISTRY || '0x0') as Address,
    oracleRouter: (process.env.NEXT_PUBLIC_ORACLE_ROUTER || '0x0') as Address,
    chainlinkGovernance: (process.env.NEXT_PUBLIC_CHAINLINK_GOVERNANCE || '0x0') as Address,
  },
};

export const CHAINLINK_CONTRACTS = ADDRESSES[NETWORK] ?? ADDRESSES.testnet;

export const VRF_COORDINATOR_ABI = parseAbi([
  'function feeConfig() view returns (uint32, uint32, uint8, uint8)',
  'function minimumRequestConfirmations() view returns (uint16)',
  'function maxGasLimit() view returns (uint32)',
  'function feeRecipient() view returns (address)',
  'function setConfig(uint16, uint32, (uint32,uint32,uint8,uint8))',
  'function setFeeRecipient(address)',
]);

export const AUTOMATION_REGISTRY_ABI = parseAbi([
  'function config() view returns (uint32, uint32, uint32, uint16, uint16, uint32, uint32, uint96)',
  'function getState() view returns (uint256, uint256, uint256, uint256, uint256)',
  'function getActiveKeepers() view returns (address[])',
  'function setConfig((uint32,uint32,uint32,uint16,uint16,uint32,uint32,uint96))',
  'function approveKeeper(address)',
  'function pause()',
  'function unpause()',
]);

export const ORACLE_ROUTER_ABI = parseAbi([
  'function config() view returns (uint96, uint32, uint16, uint16, uint32)',
  'function getStats() view returns (uint256, uint256, uint256, uint256, uint256)',
  'function getActiveOracles() view returns (address[])',
  'function setConfig((uint96,uint32,uint16,uint16,uint32))',
  'function approveOracle(address)',
]);

export const CHAINLINK_GOVERNANCE_ABI = parseAbi([
  'function config() view returns (uint256, uint256, uint256, uint256)',
  'function revenueConfig() view returns (uint16, uint16, uint16, address, address, address)',
  'function paused() view returns (bool)',
  'function emergencyPause()',
  'function emergencyUnpause()',
  'function setRevenueConfig((uint16,uint16,uint16,address,address,address))',
]);

export interface VRFFeeConfig {
  fulfillmentFlatFeeLinkPPM: number;
  fulfillmentFlatFeeNativePPM: number;
  premiumPercentage: number;
  nativePremiumPercentage: number;
}

export interface AutomationConfig {
  minUpkeepBalance: bigint;
  maxPerformGas: number;
  keeperFeeBps: number;
  protocolFeeBps: number;
  minKeeperStake: bigint;
  maxKeepers: number;
}

export interface OracleConfig {
  minPayment: bigint;
  requestTimeout: number;
  oracleFeeBps: number;
  protocolFeeBps: number;
  maxDataSize: number;
}

export interface RevenueConfig {
  treasuryBps: number;
  operationalBps: number;
  communityBps: number;
}

export interface ChainlinkStats {
  vrf: { totalSubscriptions: number; totalRequests: bigint; totalFeesCollected: bigint };
  automation: { totalUpkeeps: number; activeUpkeeps: number; totalPerforms: bigint; totalFeesCollected: bigint; activeKeepers: number };
  oracle: { totalRequests: bigint; totalFulfilled: bigint; totalFeesCollected: bigint; activeJobs: number; activeOracles: number };
}
