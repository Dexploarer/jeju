/**
 * @fileoverview Config Update Utilities
 * @module config/update
 * 
 * Utilities for updating config files after deployments.
 * Used by deploy scripts to automatically save deployed addresses and URLs.
 * 
 * @example
 * ```ts
 * import { updateContractAddress, updateServiceUrl } from '@jejunetwork/config/update';
 * 
 * // After deploying a contract
 * await updateContractAddress('oif', 'solverRegistry', '0x...', 'testnet');
 * 
 * // After deploying a service
 * await updateServiceUrl('indexer', 'graphql', 'https://...', 'testnet');
 * ```
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONFIG_DIR = __dirname;
const ARTIFACTS_DIR = join(__dirname, '../deployment/.artifacts');

// ============================================================================
// Types
// ============================================================================

export type NetworkType = 'localnet' | 'testnet' | 'mainnet';
export type ContractCategoryKey = 
  | 'tokens' | 'registry' | 'moderation' | 'nodeStaking' | 'jns'
  | 'payments' | 'commerce' | 'defi' | 'compute' | 'governance' | 'oif' | 'eil' | 'fees';

export interface DeploymentArtifact {
  network: NetworkType;
  timestamp: string;
  deployer: string;
  contracts: Record<string, {
    address: string;
    txHash?: string;
    blockNumber?: number;
  }>;
  services?: Record<string, string>;
}

// ============================================================================
// Contract Updates
// ============================================================================

/**
 * Update a contract address in contracts.json
 */
export function updateContractAddress(
  category: ContractCategoryKey,
  name: string,
  address: string,
  network: NetworkType
): void {
  const contractsPath = join(CONFIG_DIR, 'contracts.json');
  const contracts = JSON.parse(readFileSync(contractsPath, 'utf-8'));
  
  if (!contracts[network]) {
    throw new Error(`Unknown network: ${network}`);
  }
  
  if (!contracts[network][category]) {
    contracts[network][category] = {};
  }
  
  contracts[network][category][name] = address;
  contracts.lastUpdated = new Date().toISOString().split('T')[0];
  
  writeFileSync(contractsPath, JSON.stringify(contracts, null, 2) + '\n');
  console.log(`✅ Updated contracts.json: ${network}.${category}.${name} = ${address}`);
}

/**
 * Update multiple contract addresses at once
 */
export function updateContracts(
  updates: Array<{ category: ContractCategoryKey; name: string; address: string }>,
  network: NetworkType
): void {
  const contractsPath = join(CONFIG_DIR, 'contracts.json');
  const contracts = JSON.parse(readFileSync(contractsPath, 'utf-8'));
  
  for (const { category, name, address } of updates) {
    if (!contracts[network][category]) {
      contracts[network][category] = {};
    }
    contracts[network][category][name] = address;
  }
  
  contracts.lastUpdated = new Date().toISOString().split('T')[0];
  writeFileSync(contractsPath, JSON.stringify(contracts, null, 2) + '\n');
  console.log(`✅ Updated ${updates.length} contract addresses in contracts.json`);
}

/**
 * Update an external chain contract address
 */
export function updateExternalContract(
  chain: string,
  category: 'oif' | 'eil' | 'payments' | 'tokens',
  name: string,
  address: string
): void {
  const contractsPath = join(CONFIG_DIR, 'contracts.json');
  const contracts = JSON.parse(readFileSync(contractsPath, 'utf-8'));
  
  if (!contracts.external[chain]) {
    throw new Error(`Unknown external chain: ${chain}`);
  }
  
  if (!contracts.external[chain][category]) {
    contracts.external[chain][category] = {};
  }
  
  contracts.external[chain][category][name] = address;
  contracts.lastUpdated = new Date().toISOString().split('T')[0];
  
  writeFileSync(contractsPath, JSON.stringify(contracts, null, 2) + '\n');
  console.log(`✅ Updated contracts.json: external.${chain}.${category}.${name} = ${address}`);
}

// ============================================================================
// Service URL Updates
// ============================================================================

type ServiceCategory = 'rpc' | 'indexer' | 'gateway' | 'storage' | 'compute' | 'oif' | 'leaderboard' | 'monitoring' | 'crucible' | 'cql' | 'dws' | 'autocrat';

/**
 * Update a service URL in services.json
 */
export function updateServiceUrl(
  category: ServiceCategory,
  subKey: string,
  url: string,
  network: NetworkType
): void {
  const servicesPath = join(CONFIG_DIR, 'services.json');
  const services = JSON.parse(readFileSync(servicesPath, 'utf-8'));
  
  if (!services[network]) {
    throw new Error(`Unknown network: ${network}`);
  }
  
  if (typeof services[network][category] === 'string') {
    services[network][category] = url;
  } else if (typeof services[network][category] === 'object') {
    services[network][category][subKey] = url;
  } else {
    services[network][category] = { [subKey]: url };
  }
  
  writeFileSync(servicesPath, JSON.stringify(services, null, 2) + '\n');
  console.log(`✅ Updated services.json: ${network}.${category}.${subKey} = ${url}`);
}

/**
 * Update external RPC URL
 */
export function updateExternalRpc(chainName: string, url: string, network: NetworkType): void {
  const servicesPath = join(CONFIG_DIR, 'services.json');
  const services = JSON.parse(readFileSync(servicesPath, 'utf-8'));
  
  if (!services[network].externalRpcs) {
    services[network].externalRpcs = {};
  }
  
  services[network].externalRpcs[chainName] = url;
  writeFileSync(servicesPath, JSON.stringify(services, null, 2) + '\n');
  console.log(`✅ Updated services.json: ${network}.externalRpcs.${chainName} = ${url}`);
}

// ============================================================================
// EIL Config Updates
// ============================================================================

/**
 * Update EIL chain config
 */
export function updateEILChain(
  chainName: string,
  updates: {
    crossChainPaymaster?: string;
    l1StakeManager?: string;
    status?: 'active' | 'planned';
    tokens?: Record<string, string>;
  },
  network: NetworkType
): void {
  const eilPath = join(CONFIG_DIR, 'eil.json');
  const eil = JSON.parse(readFileSync(eilPath, 'utf-8'));
  
  if (!eil[network]?.chains?.[chainName]) {
    throw new Error(`Unknown EIL chain: ${chainName} on ${network}`);
  }
  
  const chain = eil[network].chains[chainName];
  
  if (updates.crossChainPaymaster) chain.crossChainPaymaster = updates.crossChainPaymaster;
  if (updates.l1StakeManager) chain.l1StakeManager = updates.l1StakeManager;
  if (updates.status) chain.status = updates.status;
  if (updates.tokens) chain.tokens = { ...chain.tokens, ...updates.tokens };
  
  eil.lastUpdated = new Date().toISOString().split('T')[0];
  writeFileSync(eilPath, JSON.stringify(eil, null, 2) + '\n');
  console.log(`✅ Updated eil.json: ${network}.chains.${chainName}`);
}

// ============================================================================
// Deployment Artifacts
// ============================================================================

/**
 * Save deployment artifact for tracking
 */
export function saveDeploymentArtifact(artifact: DeploymentArtifact): void {
  const networkDir = join(ARTIFACTS_DIR, artifact.network);
  
  if (!existsSync(networkDir)) {
    mkdirSync(networkDir, { recursive: true });
  }
  
  // Save timestamped artifact
  const timestamp = artifact.timestamp.replace(/[:.]/g, '-');
  const artifactPath = join(networkDir, `deploy-${timestamp}.json`);
  writeFileSync(artifactPath, JSON.stringify(artifact, null, 2));
  
  // Also save as latest
  const latestPath = join(networkDir, 'latest.json');
  writeFileSync(latestPath, JSON.stringify(artifact, null, 2));
  
  console.log(`✅ Saved deployment artifact: ${artifactPath}`);
}

/**
 * Load latest deployment artifact
 */
export function loadLatestArtifact(network: NetworkType): DeploymentArtifact | null {
  const latestPath = join(ARTIFACTS_DIR, network, 'latest.json');
  
  if (!existsSync(latestPath)) {
    return null;
  }
  
  return JSON.parse(readFileSync(latestPath, 'utf-8'));
}

/**
 * Apply artifact to config files
 */
export function applyArtifactToConfig(artifact: DeploymentArtifact): void {
  const { network, contracts, services } = artifact;
  
  // Update contracts
  for (const [key, data] of Object.entries(contracts)) {
    const [category, name] = key.split('.');
    if (category && name && data.address) {
      updateContractAddress(category as ContractCategoryKey, name, data.address, network);
    }
  }
  
  // Update services
  if (services) {
    for (const [key, url] of Object.entries(services)) {
      const [category, subKey] = key.split('.');
      if (category && url) {
        updateServiceUrl(category as ServiceCategory, subKey ?? 'default', url, network);
      }
    }
  }
}

// ============================================================================
// Terraform Integration
// ============================================================================

interface TerraformOutputs {
  [key: string]: {
    value: string | Record<string, string>;
    type?: string;
  };
}

/**
 * Parse Terraform outputs and update config
 */
export function applyTerraformOutputs(
  outputs: TerraformOutputs,
  network: NetworkType
): void {
  // Common Terraform output mappings
  const mappings: Record<string, { category: ServiceCategory; subKey: string }> = {
    rpc_endpoint: { category: 'rpc', subKey: 'l2' },
    ws_endpoint: { category: 'rpc', subKey: 'ws' },
    l1_rpc_endpoint: { category: 'rpc', subKey: 'l1' },
    indexer_url: { category: 'indexer', subKey: 'graphql' },
    gateway_url: { category: 'gateway', subKey: 'ui' },
    gateway_api_url: { category: 'gateway', subKey: 'api' },
    storage_url: { category: 'storage', subKey: 'api' },
    compute_url: { category: 'compute', subKey: 'marketplace' },
  };
  
  for (const [outputKey, config] of Object.entries(mappings)) {
    const output = outputs[outputKey];
    if (output && typeof output.value === 'string') {
      updateServiceUrl(config.category, config.subKey, output.value, network);
    }
  }
}

/**
 * Load Terraform outputs from file and apply
 */
export function applyTerraformOutputsFile(
  outputsPath: string,
  network: NetworkType
): void {
  if (!existsSync(outputsPath)) {
    console.error(`Terraform outputs file not found: ${outputsPath}`);
    return;
  }
  
  const outputs: TerraformOutputs = JSON.parse(readFileSync(outputsPath, 'utf-8'));
  applyTerraformOutputs(outputs, network);
}

// ============================================================================
// Chain Config Updates
// ============================================================================

/**
 * Update chain-specific config (L1/L2 contracts, etc.)
 */
export function updateChainConfig(
  network: NetworkType,
  updates: {
    l1?: Record<string, string>;
    l2?: Record<string, string>;
  }
): void {
  const chainPath = join(CONFIG_DIR, `chain/${network}.json`);
  const chain = JSON.parse(readFileSync(chainPath, 'utf-8'));
  
  if (updates.l1) {
    chain.contracts.l1 = { ...chain.contracts.l1, ...updates.l1 };
  }
  if (updates.l2) {
    chain.contracts.l2 = { ...chain.contracts.l2, ...updates.l2 };
  }
  
  writeFileSync(chainPath, JSON.stringify(chain, null, 2) + '\n');
  console.log(`✅ Updated chain/${network}.json`);
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate config files are properly formatted
 */
export function validateConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  const files = ['contracts.json', 'services.json', 'eil.json', 'federation.json'];
  
  for (const file of files) {
    const path = join(CONFIG_DIR, file);
    try {
      JSON.parse(readFileSync(path, 'utf-8'));
    } catch (e) {
      errors.push(`Invalid JSON in ${file}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Print config update summary
 */
export function printConfigSummary(network: NetworkType): void {
  console.log(`\n📋 Config Summary for ${network}\n`);
  console.log('─'.repeat(60));
  
  // Count contracts
  const contracts = JSON.parse(readFileSync(join(CONFIG_DIR, 'contracts.json'), 'utf-8'));
  const netContracts = contracts[network];
  let total = 0;
  let configured = 0;
  
  for (const category of Object.keys(netContracts)) {
    if (category === 'chainId') continue;
    for (const [, address] of Object.entries(netContracts[category] as Record<string, string>)) {
      total++;
      if (address) configured++;
    }
  }
  
  console.log(`Contracts: ${configured}/${total} configured`);
  
  // Services
  const services = JSON.parse(readFileSync(join(CONFIG_DIR, 'services.json'), 'utf-8'));
  console.log(`Services: Configured for ${network}`);
  
  console.log('─'.repeat(60));
}


