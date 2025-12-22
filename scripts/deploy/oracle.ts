/**
 * Oracle Network Deployment Helper
 * 
 * This script generates the Forge deployment command and validates environment.
 * Actual deployment is done via Forge script for deterministic addresses.
 * 
 * Usage:
 *   bun scripts/deploy-oracle-network.ts [testnet|mainnet|localnet]
 */

const NETWORKS = {
  testnet: {
    rpc: process.env.JEJU_TESTNET_RPC_URL || 'https://testnet-rpc.jejunetwork.org',
    chainId: 420690,
    verify: true,
    explorerApi: 'https://testnet-explorer.jejunetwork.org/api',
  },
  mainnet: {
    rpc: process.env.JEJU_RPC_URL || 'https://rpc.jejunetwork.org',
    chainId: 420691,
    verify: true,
    explorerApi: 'https://explorer.jejunetwork.org/api',
  },
  localnet: {
    rpc: 'http://localhost:6546',
    chainId: 1337,
    verify: false,
    explorerApi: '',
  },
};

type Network = keyof typeof NETWORKS;

function validateEnv(network: Network): boolean {
  const required = ['DEPLOYER_PRIVATE_KEY'];
  const optional = ['IDENTITY_REGISTRY_ADDRESS', 'REPUTATION_REGISTRY_ADDRESS', 'ORACLE_STAKING_ADDRESS'];
  
  let valid = true;
  
  console.log('Environment check:');
  for (const key of required) {
    if (!process.env[key]) {
      console.log(`  ❌ ${key} - REQUIRED`);
      valid = false;
    } else {
      console.log(`  ✅ ${key}`);
    }
  }
  
  for (const key of optional) {
    if (process.env[key]) {
      console.log(`  ✅ ${key} = ${process.env[key]}`);
    } else {
      console.log(`  ⚠️  ${key} - not set (will deploy without)`);
    }
  }
  
  if (network !== 'localnet' && !process.env.EXPLORER_API_KEY) {
    console.log(`  ⚠️  EXPLORER_API_KEY - not set (verification may fail)`);
  }
  
  return valid;
}

async function main() {
  const network = (process.argv[2] || 'testnet') as Network;
  
  if (!['testnet', 'mainnet', 'localnet'].includes(network)) {
    console.error('Usage: bun scripts/deploy-oracle-network.ts [testnet|mainnet|localnet]');
    process.exit(1);
  }
  
  const config = NETWORKS[network];
  
  console.log('');
  console.log('==========================================');
  console.log('Oracle Network Deployment');
  console.log('==========================================');
  console.log(`Network: ${network}`);
  console.log(`RPC: ${config.rpc}`);
  console.log('');
  
  if (!validateEnv(network)) {
    console.log('');
    console.error('Missing required environment variables. Aborting.');
    process.exit(1);
  }
  
  console.log('');
  console.log('Deploy command:');
  console.log('');
  
  let cmd = `cd packages/contracts && forge script script/DeployOracleNetwork.s.sol:DeployOracleNetwork \\
  --rpc-url ${config.rpc} \\
  --broadcast`;
  
  if (config.verify && config.explorerApi) {
    cmd += ` \\
  --verify \\
  --verifier blockscout \\
  --verifier-url ${config.explorerApi}`;
  }
  
  console.log(cmd);
  console.log('');
  
  if (network === 'localnet') {
    console.log('Running deployment...');
    console.log('');
    
    const proc = Bun.spawn(['forge', 'script', 'script/DeployOracleNetwork.s.sol:DeployOracleNetwork', 
      '--rpc-url', config.rpc, '--broadcast'], {
      cwd: './packages/contracts',
      stdout: 'inherit',
      stderr: 'inherit',
      env: process.env,
    });
    
    await proc.exited;
    
    if (proc.exitCode !== 0) {
      console.error('Deployment failed');
      process.exit(1);
    }
  } else {
    console.log('To deploy, run the command above.');
    console.log('');
    console.log('Post-deployment steps:');
    console.log('  1. Copy deployed addresses from output');
    console.log('  2. Update apps/gateway/src/lib/oracleNetwork.ts');
    console.log('  3. Register oracle operators');
    console.log('  4. Form committees for each feed');
  }
}

main().catch(console.error);
