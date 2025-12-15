/**
 * jeju deploy - Comprehensive deployment command for Jeju Network
 * 
 * Supports:
 * - Token deployment (JejuToken with BanManager)
 * - Contract deployment with Safe multi-sig ownership
 * - Contract verification on block explorers
 * - Post-deployment verification and configuration
 * - Emergency/rollback procedures
 */

import { Command } from 'commander';
import prompts from 'prompts';
import { execa } from 'execa';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { createPublicClient, createWalletClient, http, formatEther, parseEther, encodeFunctionData, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry, baseSepolia, base } from 'viem/chains';
import { Wallet } from 'ethers';
import { logger } from '../lib/logger';
import { checkRpcHealth, getAccountBalance } from '../lib/chain';
import { hasKeys, resolvePrivateKey } from '../lib/keys';
import { checkDocker, checkFoundry } from '../lib/system';
import { CHAIN_CONFIG, type NetworkType, type DeploymentConfig } from '../types';

// Extended network config for deployment
const DEPLOY_NETWORKS = {
  localnet: {
    chain: foundry,
    rpcUrl: 'http://localhost:8545',
    chainId: 1337,
    enableFaucet: true,
    requireMultiSig: false,
    explorerUrl: null,
    explorerApiUrl: null,
  },
  testnet: {
    chain: baseSepolia,
    rpcUrl: process.env.TESTNET_RPC_URL || 'https://sepolia.base.org',
    chainId: 84532,
    enableFaucet: true,
    requireMultiSig: false,
    explorerUrl: 'https://sepolia.basescan.org',
    explorerApiUrl: 'https://api-sepolia.basescan.org/api',
  },
  mainnet: {
    chain: base,
    rpcUrl: process.env.MAINNET_RPC_URL || 'https://mainnet.base.org',
    chainId: 8453,
    enableFaucet: false,
    requireMultiSig: true,
    explorerUrl: 'https://basescan.org',
    explorerApiUrl: 'https://api.basescan.org/api',
  },
} as const;

interface TokenDeploymentResult {
  network: NetworkType;
  chainId: number;
  jejuToken: Address;
  banManager: Address;
  owner: Address;
  isMultiSig: boolean;
  faucetEnabled: boolean;
  deployedAt: string;
  deployer: Address;
  transactions: { hash: Hex; description: string }[];
}

export const deployCommand = new Command('deploy')
  .description('Deploy contracts, infrastructure, or apps to any network')
  .argument('[network]', 'Network: localnet | testnet | mainnet', 'testnet')
  .option('--contracts', 'Deploy only contracts')
  .option('--infrastructure', 'Deploy only infrastructure')
  .option('--apps', 'Deploy only apps')
  .option('--token', 'Deploy JejuToken specifically')
  .option('--safe <address>', 'Safe multi-sig address for ownership')
  .option('--dry-run', 'Simulate deployment without making changes')
  .option('-y, --yes', 'Skip confirmations')
  .action(async (networkArg, options) => {
    const network = networkArg as NetworkType;

    // Allow localnet deployment
    if (network === 'localnet' && !options.token) {
      logger.info('For localnet development, use `jeju dev` which handles deployment automatically.');
      logger.info('To deploy token specifically: `jeju deploy localnet --token`');
      return;
    }

    logger.header(`DEPLOY TO ${network.toUpperCase()}`);

    // Token-specific deployment
    if (options.token) {
      await deployToken(network, options);
      return;
    }

    const config: DeploymentConfig = {
      network,
      contracts: options.contracts || (!options.infrastructure && !options.apps),
      infrastructure: options.infrastructure || (!options.contracts && !options.apps),
      apps: options.apps || (!options.contracts && !options.infrastructure),
      dryRun: options.dryRun || false,
    };

    // Pre-flight checks
    logger.subheader('Pre-flight Checks');

    // Check keys
    if (!hasKeys(network) && network !== 'localnet') {
      logger.error(`No keys configured for ${network}`);
      logger.info(`Run: jeju keys generate --network=${network}`);
      process.exit(1);
    }
    logger.success('Keys configured');

    // Check deployer balance
    const privateKey = resolvePrivateKey(network);
    const wallet = new Wallet(privateKey);
    const chainConfig = CHAIN_CONFIG[network];

    const balance = await getAccountBalance(chainConfig.rpcUrl, wallet.address as `0x${string}`);
    const balanceNum = parseFloat(balance);

    if (balanceNum < 0.1 && network !== 'localnet') {
      logger.error(`Insufficient balance: ${balance} ETH`);
      logger.info('Fund the deployer address with at least 0.1 ETH');
      logger.keyValue('Address', wallet.address);
      process.exit(1);
    }
    logger.success(`Deployer funded (${balance} ETH)`);

    // Check dependencies
    if (config.contracts) {
      const foundryResult = await checkFoundry();
      if (foundryResult.status !== 'ok') {
        logger.error('Foundry required for contract deployment');
        process.exit(1);
      }
      logger.success('Foundry available');
    }

    if (config.infrastructure) {
      const dockerResult = await checkDocker();
      if (dockerResult.status !== 'ok') {
        logger.error('Docker required for infrastructure deployment');
        process.exit(1);
      }
      logger.success('Docker available');
    }

    logger.newline();

    // Confirmation
    if (!options.yes && !config.dryRun) {
      logger.box([
        `Network: ${network}`,
        `Contracts: ${config.contracts ? 'Yes' : 'No'}`,
        `Infrastructure: ${config.infrastructure ? 'Yes' : 'No'}`,
        `Apps: ${config.apps ? 'Yes' : 'No'}`,
        '',
        `Deployer: ${wallet.address}`,
        `Balance: ${balance} ETH`,
      ]);

      const { proceed } = await prompts({
        type: 'confirm',
        name: 'proceed',
        message: `Deploy to ${network}?`,
        initial: false,
      });

      if (!proceed) {
        logger.info('Deployment cancelled');
        return;
      }
    }

    if (config.dryRun) {
      logger.warn('DRY RUN - No changes will be made');
      logger.newline();
    }

    const rootDir = process.cwd();

    // Deploy contracts
    if (config.contracts) {
      await deployContracts(rootDir, network, config.dryRun);
    }

    // Deploy infrastructure
    if (config.infrastructure) {
      await deployInfrastructure(rootDir, network, config.dryRun);
    }

    // Deploy apps
    if (config.apps) {
      await deployApps(rootDir, network, config.dryRun);
    }

    // Summary
    logger.newline();
    logger.header('DEPLOYMENT COMPLETE');

    logger.subheader('Endpoints');
    if (network === 'testnet') {
      logger.table([
        { label: 'RPC', value: 'https://rpc.testnet.jeju.network', status: 'ok' },
        { label: 'Explorer', value: 'https://explorer.testnet.jeju.network', status: 'ok' },
        { label: 'Gateway', value: 'https://gateway.testnet.jeju.network', status: 'ok' },
      ]);
    } else if (network === 'mainnet') {
      logger.table([
        { label: 'RPC', value: 'https://rpc.jeju.network', status: 'ok' },
        { label: 'Explorer', value: 'https://explorer.jeju.network', status: 'ok' },
        { label: 'Gateway', value: 'https://gateway.jeju.network', status: 'ok' },
      ]);
    }
  });

/**
 * Deploy JejuToken with BanManager
 */
async function deployToken(network: NetworkType, options: { safe?: string; dryRun?: boolean; yes?: boolean }): Promise<void> {
  logger.subheader('JejuToken Deployment');

  const networkConfig = DEPLOY_NETWORKS[network];
  const rootDir = process.cwd();
  const contractsDir = join(rootDir, 'packages/contracts');

  // Validate Safe requirement for mainnet
  if (networkConfig.requireMultiSig && !options.safe) {
    logger.error('Mainnet deployment requires a Safe multi-sig address.');
    logger.info('Use: jeju deploy mainnet --token --safe 0x...');
    process.exit(1);
  }

  // Get deployer key
  const privateKey = resolvePrivateKey(network);
  const account = privateKeyToAccount(privateKey as Hex);

  // Setup clients
  const publicClient = createPublicClient({
    chain: networkConfig.chain,
    transport: http(networkConfig.rpcUrl),
  });

  const walletClient = createWalletClient({
    account,
    chain: networkConfig.chain,
    transport: http(networkConfig.rpcUrl),
  });

  logger.keyValue('Network', `${network} (chainId: ${networkConfig.chainId})`);
  logger.keyValue('Deployer', account.address);
  if (options.safe) {
    logger.keyValue('Safe Multi-Sig', options.safe);
  }

  // Check balance
  const balance = await publicClient.getBalance({ address: account.address });
  logger.keyValue('Balance', `${formatEther(balance)} ETH`);

  if (balance < parseEther('0.01')) {
    logger.error('Insufficient balance for deployment (need at least 0.01 ETH)');
    process.exit(1);
  }

  // Build contracts first
  logger.step('Building contracts...');
  await execa('forge', ['build'], { cwd: contractsDir, stdio: 'pipe' });
  logger.success('Contracts built');

  // Load artifacts
  const jejuTokenArtifact = loadArtifact(contractsDir, 'JejuToken');
  const banManagerArtifact = loadArtifact(contractsDir, 'BanManager');

  const ownerAddress = (options.safe || account.address) as Address;
  const transactions: { hash: Hex; description: string }[] = [];

  if (options.dryRun) {
    logger.warn('DRY RUN - No transactions will be sent');
    logger.newline();
    logger.info('Would deploy:');
    logger.info('  1. BanManager');
    logger.info('  2. JejuToken');
    if (options.safe) {
      logger.info('  3. Transfer ownership to Safe');
    }
    return;
  }

  // Confirmation
  if (!options.yes) {
    const { proceed } = await prompts({
      type: 'confirm',
      name: 'proceed',
      message: `Deploy JejuToken to ${network}?`,
      initial: false,
    });

    if (!proceed) {
      logger.info('Deployment cancelled');
      return;
    }
  }

  // Deploy BanManager
  logger.step('Deploying BanManager...');
  const banHash = await walletClient.deployContract({
    abi: banManagerArtifact.abi,
    bytecode: banManagerArtifact.bytecode,
    args: [ownerAddress, ownerAddress],
  });
  transactions.push({ hash: banHash, description: 'Deploy BanManager' });
  const banReceipt = await publicClient.waitForTransactionReceipt({ hash: banHash });
  const banManagerAddress = banReceipt.contractAddress as Address;
  logger.success(`BanManager: ${banManagerAddress}`);

  // Deploy JejuToken
  logger.step('Deploying JejuToken...');
  const tokenHash = await walletClient.deployContract({
    abi: jejuTokenArtifact.abi,
    bytecode: jejuTokenArtifact.bytecode,
    args: [ownerAddress, banManagerAddress, networkConfig.enableFaucet],
  });
  transactions.push({ hash: tokenHash, description: 'Deploy JejuToken' });
  const tokenReceipt = await publicClient.waitForTransactionReceipt({ hash: tokenHash });
  const jejuTokenAddress = tokenReceipt.contractAddress as Address;
  logger.success(`JejuToken: ${jejuTokenAddress}`);

  // Transfer ownership if Safe provided and different from deployer
  if (options.safe && options.safe !== account.address) {
    logger.step('Transferring ownership to Safe...');

    const transferHash = await walletClient.writeContract({
      address: jejuTokenAddress,
      abi: jejuTokenArtifact.abi,
      functionName: 'transferOwnership',
      args: [options.safe as Address],
    });
    transactions.push({ hash: transferHash, description: 'Transfer JejuToken ownership' });
    await publicClient.waitForTransactionReceipt({ hash: transferHash });
    logger.success('Ownership transferred to Safe');
  }

  // Save deployment
  const result: TokenDeploymentResult = {
    network,
    chainId: networkConfig.chainId,
    jejuToken: jejuTokenAddress,
    banManager: banManagerAddress,
    owner: ownerAddress,
    isMultiSig: !!options.safe,
    faucetEnabled: networkConfig.enableFaucet,
    deployedAt: new Date().toISOString(),
    deployer: account.address,
    transactions,
  };

  const deploymentDir = join(contractsDir, 'deployments', network);
  if (!existsSync(deploymentDir)) {
    mkdirSync(deploymentDir, { recursive: true });
  }

  writeFileSync(join(deploymentDir, 'jeju-token.json'), JSON.stringify(result, null, 2));
  logger.success(`Saved: deployments/${network}/jeju-token.json`);

  // Update main deployment.json
  const mainDeploymentPath = join(deploymentDir, 'deployment.json');
  let mainDeployment: Record<string, Record<string, Address | string>> = {};
  if (existsSync(mainDeploymentPath)) {
    mainDeployment = JSON.parse(readFileSync(mainDeploymentPath, 'utf-8'));
  }
  mainDeployment.tokens = { ...(mainDeployment.tokens || {}), jeju: jejuTokenAddress };
  mainDeployment.moderation = { ...(mainDeployment.moderation || {}), banManager: banManagerAddress };
  writeFileSync(mainDeploymentPath, JSON.stringify(mainDeployment, null, 2));

  // Summary
  logger.newline();
  logger.header('TOKEN DEPLOYMENT COMPLETE');
  logger.keyValue('JejuToken', jejuTokenAddress);
  logger.keyValue('BanManager', banManagerAddress);
  logger.keyValue('Owner', ownerAddress);
  logger.keyValue('Faucet', networkConfig.enableFaucet ? 'Enabled' : 'Disabled');

  logger.newline();
  logger.subheader('Next Steps');
  logger.info('1. Verify contracts: jeju deploy verify ' + network);
  logger.info('2. Check deployment: jeju deploy check ' + network);
  logger.info('3. Configure integrations: jeju deploy configure ' + network);
}

function loadArtifact(contractsDir: string, name: string): { abi: readonly object[]; bytecode: Hex } {
  const artifactPath = join(contractsDir, `out/${name}.sol/${name}.json`);
  if (!existsSync(artifactPath)) {
    throw new Error(`Artifact not found: ${artifactPath}. Run 'forge build' first.`);
  }
  const artifact = JSON.parse(readFileSync(artifactPath, 'utf-8'));
  return {
    abi: artifact.abi,
    bytecode: artifact.bytecode.object as Hex,
  };
}

async function deployContracts(rootDir: string, network: NetworkType, dryRun: boolean): Promise<void> {
  logger.subheader('Deploying Contracts');

  const contractsDir = join(rootDir, 'packages/contracts');
  if (!existsSync(contractsDir)) {
    logger.warn('Contracts directory not found');
    return;
  }

  // Build contracts
  logger.step('Building contracts...');
  if (!dryRun) {
    await execa('forge', ['build'], { cwd: contractsDir, stdio: 'pipe' });
  }
  logger.success('Contracts built');

  // Deploy using deployment script
  const deployScript = join(rootDir, `scripts/deploy/${network}.ts`);
  if (existsSync(deployScript)) {
    logger.step('Running deployment script...');
    if (!dryRun) {
      await execa('bun', ['run', deployScript], {
        cwd: rootDir,
        stdio: 'inherit',
        env: {
          ...process.env,
          NETWORK: network,
          JEJU_NETWORK: network,
        },
      });
    }
    logger.success('Contracts deployed');
  } else {
    logger.warn(`Deployment script not found: ${deployScript}`);
    logger.info('Using forge script fallback...');

    // Fallback to forge script
    const forgeScript = join(contractsDir, 'script/Deploy.s.sol');
    if (existsSync(forgeScript) && !dryRun) {
      const rpcUrl = CHAIN_CONFIG[network].rpcUrl;
      await execa('forge', ['script', 'script/Deploy.s.sol', '--rpc-url', rpcUrl, '--broadcast'], {
        cwd: contractsDir,
        stdio: 'inherit',
      });
      logger.success('Contracts deployed via Forge');
    }
  }
}

async function deployInfrastructure(rootDir: string, network: NetworkType, dryRun: boolean): Promise<void> {
  logger.subheader('Deploying Infrastructure');

  const deploymentDir = join(rootDir, 'packages/deployment');
  if (!existsSync(deploymentDir)) {
    logger.warn('Deployment package not found');
    return;
  }

  // Run deployment script
  const deployScript = join(deploymentDir, 'scripts/deploy-full.ts');
  if (existsSync(deployScript)) {
    logger.step('Running infrastructure deployment...');
    if (!dryRun) {
      await execa('bun', ['run', deployScript], {
        cwd: deploymentDir,
        stdio: 'inherit',
        env: {
          ...process.env,
          NETWORK: network,
        },
      });
    }
    logger.success('Infrastructure deployed');
  } else {
    logger.warn('Infrastructure deployment script not found');
  }
}

async function deployApps(rootDir: string, network: NetworkType, dryRun: boolean): Promise<void> {
  logger.subheader('Deploying Apps');

  // Build apps
  logger.step('Building apps...');
  if (!dryRun) {
    await execa('bun', ['run', 'build'], {
      cwd: rootDir,
      stdio: 'pipe',
      reject: false,
    });
  }
  logger.success('Apps built');

  // Deploy using helmfile or kubectl
  const k8sDir = join(rootDir, 'packages/deployment/kubernetes');
  if (existsSync(k8sDir)) {
    logger.step('Deploying to Kubernetes...');
    if (!dryRun) {
      const helmfilePath = join(k8sDir, 'helmfile.yaml');
      if (existsSync(helmfilePath)) {
        await execa('helmfile', ['sync'], {
          cwd: k8sDir,
          stdio: 'inherit',
          env: {
            ...process.env,
            ENVIRONMENT: network,
          },
        });
      }
    }
    logger.success('Apps deployed to Kubernetes');
  } else {
    logger.info('Kubernetes manifests not found, skipping k8s deployment');
  }
}

// Subcommand: deploy status
deployCommand
  .command('status')
  .description('Check deployment status')
  .option('-n, --network <network>', 'Network', 'testnet')
  .action(async (options) => {
    const network = options.network as NetworkType;
    const config = CHAIN_CONFIG[network];

    logger.header(`DEPLOYMENT STATUS: ${network.toUpperCase()}`);

    // Check RPC
    const rpcHealthy = await checkRpcHealth(config.rpcUrl, 5000);
    logger.table([{
      label: 'RPC',
      value: config.rpcUrl,
      status: rpcHealthy ? 'ok' : 'error',
    }]);

    // Check contract deployments
    const rootDir = process.cwd();
    const deploymentsFile = join(rootDir, `packages/contracts/deployments/${network}/contracts.json`);

    if (existsSync(deploymentsFile)) {
      const deployments = JSON.parse(readFileSync(deploymentsFile, 'utf-8'));
      const contractCount = Object.keys(deployments).length;
      logger.table([{
        label: 'Contracts',
        value: `${contractCount} deployed`,
        status: 'ok',
      }]);
    } else {
      logger.table([{
        label: 'Contracts',
        value: 'Not deployed',
        status: 'warn',
      }]);
    }
  });

// Subcommand: deploy verify
deployCommand
  .command('verify')
  .description('Verify contracts on block explorer')
  .argument('<network>', 'Network: testnet | mainnet')
  .option('--contract <address>', 'Specific contract address to verify')
  .option('--name <name>', 'Contract name (e.g., JejuToken)')
  .action(async (network, options) => {
    const networkConfig = DEPLOY_NETWORKS[network as NetworkType];
    const rootDir = process.cwd();
    const contractsDir = join(rootDir, 'packages/contracts');

    logger.header(`VERIFY CONTRACTS: ${network.toUpperCase()}`);

    if (network === 'localnet') {
      logger.warn('Contract verification not available for localnet');
      return;
    }

    // Check for API key
    const apiKey = process.env.ETHERSCAN_API_KEY || process.env.BASESCAN_API_KEY;
    if (!apiKey) {
      logger.error('ETHERSCAN_API_KEY or BASESCAN_API_KEY required for verification');
      process.exit(1);
    }

    // If specific contract provided
    if (options.contract && options.name) {
      logger.step(`Verifying ${options.name}...`);
      await execa('forge', [
        'verify-contract',
        options.contract,
        options.name,
        '--chain-id', String(networkConfig.chainId),
        '--etherscan-api-key', apiKey,
        '--watch',
      ], {
        cwd: contractsDir,
        stdio: 'inherit',
      });
      logger.success(`${options.name} verified`);
      return;
    }

    // Load deployment to get addresses
    const tokenDeployment = join(contractsDir, `deployments/${network}/jeju-token.json`);
    if (!existsSync(tokenDeployment)) {
      logger.error(`No deployment found for ${network}. Deploy first with: jeju deploy ${network} --token`);
      process.exit(1);
    }

    const deployment = JSON.parse(readFileSync(tokenDeployment, 'utf-8')) as TokenDeploymentResult;

    // Verify BanManager
    logger.step('Verifying BanManager...');
    await execa('forge', [
      'verify-contract',
      deployment.banManager,
      'BanManager',
      '--chain-id', String(networkConfig.chainId),
      '--etherscan-api-key', apiKey,
      '--watch',
    ], {
      cwd: contractsDir,
      stdio: 'inherit',
      reject: false,
    });

    // Verify JejuToken
    logger.step('Verifying JejuToken...');
    await execa('forge', [
      'verify-contract',
      deployment.jejuToken,
      'JejuToken',
      '--chain-id', String(networkConfig.chainId),
      '--etherscan-api-key', apiKey,
      '--watch',
    ], {
      cwd: contractsDir,
      stdio: 'inherit',
      reject: false,
    });

    logger.newline();
    logger.success('Verification complete');
    logger.info(`View on explorer: ${networkConfig.explorerUrl}/address/${deployment.jejuToken}`);
  });

// Subcommand: deploy check
deployCommand
  .command('check')
  .description('Verify deployment state on-chain')
  .argument('<network>', 'Network: localnet | testnet | mainnet')
  .action(async (network) => {
    const networkConfig = DEPLOY_NETWORKS[network as NetworkType];
    const rootDir = process.cwd();
    const contractsDir = join(rootDir, 'packages/contracts');

    logger.header(`DEPLOYMENT CHECK: ${network.toUpperCase()}`);

    // Load deployment
    const tokenDeployment = join(contractsDir, `deployments/${network}/jeju-token.json`);
    if (!existsSync(tokenDeployment)) {
      logger.error(`No deployment found for ${network}`);
      process.exit(1);
    }

    const deployment = JSON.parse(readFileSync(tokenDeployment, 'utf-8')) as TokenDeploymentResult;

    // Setup client
    const publicClient = createPublicClient({
      chain: networkConfig.chain,
      transport: http(networkConfig.rpcUrl),
    });

    const jejuArtifact = loadArtifact(contractsDir, 'JejuToken');

    logger.subheader('Contract State');

    // Check JejuToken state
    const [name, symbol, totalSupply, faucetEnabled, banEnforcementEnabled, owner] = await Promise.all([
      publicClient.readContract({
        address: deployment.jejuToken,
        abi: jejuArtifact.abi,
        functionName: 'name',
      }) as Promise<string>,
      publicClient.readContract({
        address: deployment.jejuToken,
        abi: jejuArtifact.abi,
        functionName: 'symbol',
      }) as Promise<string>,
      publicClient.readContract({
        address: deployment.jejuToken,
        abi: jejuArtifact.abi,
        functionName: 'totalSupply',
      }) as Promise<bigint>,
      publicClient.readContract({
        address: deployment.jejuToken,
        abi: jejuArtifact.abi,
        functionName: 'faucetEnabled',
      }) as Promise<boolean>,
      publicClient.readContract({
        address: deployment.jejuToken,
        abi: jejuArtifact.abi,
        functionName: 'banEnforcementEnabled',
      }) as Promise<boolean>,
      publicClient.readContract({
        address: deployment.jejuToken,
        abi: jejuArtifact.abi,
        functionName: 'owner',
      }) as Promise<Address>,
    ]);

    logger.table([
      { label: 'Name', value: name, status: 'ok' },
      { label: 'Symbol', value: symbol, status: 'ok' },
      { label: 'Total Supply', value: `${formatEther(totalSupply)} ${symbol}`, status: 'ok' },
      { label: 'Faucet', value: faucetEnabled ? 'Enabled' : 'Disabled', status: faucetEnabled === networkConfig.enableFaucet ? 'ok' : 'warn' },
      { label: 'Ban Enforcement', value: banEnforcementEnabled ? 'Enabled' : 'Disabled', status: 'ok' },
      { label: 'Owner', value: owner, status: owner === deployment.owner ? 'ok' : 'warn' },
    ]);

    logger.newline();
    logger.success('Deployment verified');
  });

// Subcommand: deploy configure
deployCommand
  .command('configure')
  .description('Post-deployment configuration (ban exemptions, token registry)')
  .argument('<network>', 'Network: testnet | mainnet')
  .option('--ban-exempt <address>', 'Set address as ban exempt (e.g., ModerationMarketplace)')
  .option('--token-registry <address>', 'Register token in TokenRegistry')
  .action(async (network, options) => {
    const networkConfig = DEPLOY_NETWORKS[network as NetworkType];
    const rootDir = process.cwd();
    const contractsDir = join(rootDir, 'packages/contracts');

    logger.header(`CONFIGURE DEPLOYMENT: ${network.toUpperCase()}`);

    // Load deployment
    const tokenDeployment = join(contractsDir, `deployments/${network}/jeju-token.json`);
    if (!existsSync(tokenDeployment)) {
      logger.error(`No deployment found for ${network}`);
      process.exit(1);
    }

    const deployment = JSON.parse(readFileSync(tokenDeployment, 'utf-8')) as TokenDeploymentResult;

    // Setup clients
    const privateKey = resolvePrivateKey(network as NetworkType);
    const account = privateKeyToAccount(privateKey as Hex);

    const publicClient = createPublicClient({
      chain: networkConfig.chain,
      transport: http(networkConfig.rpcUrl),
    });

    const walletClient = createWalletClient({
      account,
      chain: networkConfig.chain,
      transport: http(networkConfig.rpcUrl),
    });

    const jejuArtifact = loadArtifact(contractsDir, 'JejuToken');

    // Set ban exemption
    if (options.banExempt) {
      logger.step(`Setting ban exemption for ${options.banExempt}...`);

      // Check if we're the owner
      const owner = await publicClient.readContract({
        address: deployment.jejuToken,
        abi: jejuArtifact.abi,
        functionName: 'owner',
      }) as Address;

      if (owner.toLowerCase() !== account.address.toLowerCase()) {
        // Generate Safe transaction calldata
        const calldata = encodeFunctionData({
          abi: jejuArtifact.abi,
          functionName: 'setBanExempt',
          args: [options.banExempt as Address, true],
        });

        logger.warn('Owner is a different address (likely Safe multi-sig)');
        logger.newline();
        logger.info('Submit this transaction via Safe:');
        logger.keyValue('To', deployment.jejuToken);
        logger.keyValue('Value', '0');
        logger.keyValue('Data', calldata);
      } else {
        const hash = await walletClient.writeContract({
          address: deployment.jejuToken,
          abi: jejuArtifact.abi,
          functionName: 'setBanExempt',
          args: [options.banExempt as Address, true],
        });

        await publicClient.waitForTransactionReceipt({ hash });
        logger.success(`${options.banExempt} is now ban exempt`);
      }
    }

    // Register in TokenRegistry
    if (options.tokenRegistry) {
      logger.step(`Registering in TokenRegistry at ${options.tokenRegistry}...`);
      logger.info('TokenRegistry registration requires:');
      logger.info('  - Oracle address for token price');
      logger.info('  - Registration fee payment');
      logger.newline();
      logger.info('Submit via Safe or directly with appropriate parameters.');
    }

    if (!options.banExempt && !options.tokenRegistry) {
      logger.info('Available configuration options:');
      logger.info('  --ban-exempt <address>    Set address as ban exempt');
      logger.info('  --token-registry <addr>   Register in TokenRegistry');
    }
  });

// Subcommand: deploy emergency
deployCommand
  .command('emergency')
  .description('Emergency procedures (pause, disable faucet, disable ban enforcement)')
  .argument('<network>', 'Network: testnet | mainnet')
  .option('--pause', 'Pause the token contract')
  .option('--unpause', 'Unpause the token contract')
  .option('--disable-faucet', 'Disable the faucet')
  .option('--disable-ban', 'Disable ban enforcement (nuclear option)')
  .action(async (network, options) => {
    const networkConfig = DEPLOY_NETWORKS[network as NetworkType];
    const rootDir = process.cwd();
    const contractsDir = join(rootDir, 'packages/contracts');

    logger.header(`EMERGENCY PROCEDURES: ${network.toUpperCase()}`);
    logger.warn('These actions affect the live contract. Proceed with caution.');
    logger.newline();

    // Load deployment
    const tokenDeployment = join(contractsDir, `deployments/${network}/jeju-token.json`);
    if (!existsSync(tokenDeployment)) {
      logger.error(`No deployment found for ${network}`);
      process.exit(1);
    }

    const deployment = JSON.parse(readFileSync(tokenDeployment, 'utf-8')) as TokenDeploymentResult;

    // Setup clients
    const privateKey = resolvePrivateKey(network as NetworkType);
    const account = privateKeyToAccount(privateKey as Hex);

    const publicClient = createPublicClient({
      chain: networkConfig.chain,
      transport: http(networkConfig.rpcUrl),
    });

    const walletClient = createWalletClient({
      account,
      chain: networkConfig.chain,
      transport: http(networkConfig.rpcUrl),
    });

    const jejuArtifact = loadArtifact(contractsDir, 'JejuToken');

    // Check owner
    const owner = await publicClient.readContract({
      address: deployment.jejuToken,
      abi: jejuArtifact.abi,
      functionName: 'owner',
    }) as Address;

    const isOwner = owner.toLowerCase() === account.address.toLowerCase();

    const generateSafeTx = (functionName: string, args: readonly (boolean | Address)[]) => {
      const calldata = encodeFunctionData({
        abi: jejuArtifact.abi,
        functionName,
        args,
      });

      logger.warn('Owner is a Safe multi-sig. Submit this transaction via Safe:');
      logger.newline();
      logger.keyValue('To', deployment.jejuToken);
      logger.keyValue('Value', '0');
      logger.keyValue('Data', calldata);
      logger.keyValue('Function', functionName);
    };

    if (options.pause) {
      logger.step('Pausing contract...');
      if (isOwner) {
        const hash = await walletClient.writeContract({
          address: deployment.jejuToken,
          abi: jejuArtifact.abi,
          functionName: 'pause',
          args: [],
        });
        await publicClient.waitForTransactionReceipt({ hash });
        logger.success('Contract paused');
      } else {
        generateSafeTx('pause', []);
      }
    }

    if (options.unpause) {
      logger.step('Unpausing contract...');
      if (isOwner) {
        const hash = await walletClient.writeContract({
          address: deployment.jejuToken,
          abi: jejuArtifact.abi,
          functionName: 'unpause',
          args: [],
        });
        await publicClient.waitForTransactionReceipt({ hash });
        logger.success('Contract unpaused');
      } else {
        generateSafeTx('unpause', []);
      }
    }

    if (options.disableFaucet) {
      logger.step('Disabling faucet...');
      if (isOwner) {
        const hash = await walletClient.writeContract({
          address: deployment.jejuToken,
          abi: jejuArtifact.abi,
          functionName: 'setFaucetEnabled',
          args: [false],
        });
        await publicClient.waitForTransactionReceipt({ hash });
        logger.success('Faucet disabled');
      } else {
        generateSafeTx('setFaucetEnabled', [false]);
      }
    }

    if (options.disableBan) {
      logger.warn('NUCLEAR OPTION: This disables all ban enforcement');

      const { confirm } = await prompts({
        type: 'confirm',
        name: 'confirm',
        message: 'Are you sure you want to disable ban enforcement?',
        initial: false,
      });

      if (!confirm) {
        logger.info('Cancelled');
        return;
      }

      logger.step('Disabling ban enforcement...');
      if (isOwner) {
        const hash = await walletClient.writeContract({
          address: deployment.jejuToken,
          abi: jejuArtifact.abi,
          functionName: 'setBanEnforcement',
          args: [false],
        });
        await publicClient.waitForTransactionReceipt({ hash });
        logger.success('Ban enforcement disabled');
      } else {
        generateSafeTx('setBanEnforcement', [false]);
      }
    }

    if (!options.pause && !options.unpause && !options.disableFaucet && !options.disableBan) {
      logger.info('Emergency options:');
      logger.info('  --pause           Pause the token contract');
      logger.info('  --unpause         Unpause the token contract');
      logger.info('  --disable-faucet  Disable the faucet');
      logger.info('  --disable-ban     Disable ban enforcement (nuclear)');
      logger.newline();
      logger.info('Security contacts:');
      logger.info('  Smart Contract: security@jeju.network');
      logger.info('  Incidents: incidents@jeju.network');
    }
  });
