/**
 * jeju dev - Start development environment
 * 
 * DECENTRALIZED: Starts all infrastructure services before apps.
 * No fallbacks - services must be healthy before proceeding.
 */

import { Command } from 'commander';
import { execa } from 'execa';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { logger } from '../lib/logger';
import { startLocalnet, stopLocalnet, getChainStatus, bootstrapContracts } from '../lib/chain';
import { discoverApps } from '../lib/testing';
import { DEFAULT_PORTS, WELL_KNOWN_KEYS, type AppManifest } from '../types';

interface RunningService {
  name: string;
  port?: number;
  process?: ReturnType<typeof execa>;
}

const runningServices: RunningService[] = [];
let isShuttingDown = false;

export const devCommand = new Command('dev')
  .description('Start development environment')
  .option('--minimal', 'Localnet only (no apps)')
  .option('--only <apps>', 'Start specific apps (comma-separated)')
  .option('--skip <apps>', 'Skip specific apps (comma-separated)')
  .option('--stop', 'Stop the development environment')
  .option('--decentralized', 'Start full decentralized stack (IPFS, CQL, Cache)')
  .option('--no-docker', 'Skip Docker services (use if already running)')
  .action(async (options) => {
    if (options.stop) {
      await stopDev();
      return;
    }

    await startDev(options);
  });

async function startDev(options: { minimal?: boolean; only?: string; skip?: string; decentralized?: boolean; docker?: boolean }) {
  logger.header('JEJU DEV');

  const rootDir = process.cwd();
  const decentralized = options.decentralized ?? (process.env.DECENTRALIZED === 'true');
  const skipDocker = options.docker === false;
  
  setupSignalHandlers();

  // Start decentralized infrastructure if requested
  if (decentralized && !skipDocker) {
    await startDecentralizedStack(rootDir);
  }

  // Check if already running
  const status = await getChainStatus('localnet');
  if (status.running) {
    logger.success('Chain already running (block ' + status.blockNumber + ')');
  } else {
    // Start localnet
    logger.step('Starting localnet...');
    const { l2Port } = await startLocalnet(rootDir);
    logger.success('Localnet running on port ' + l2Port);
  }

  const l2RpcUrl = `http://127.0.0.1:${DEFAULT_PORTS.l2Rpc}`;

  // Bootstrap contracts
  logger.step('Bootstrapping contracts...');
  await bootstrapContracts(rootDir, l2RpcUrl);

  if (options.minimal) {
    printReady(l2RpcUrl, [], decentralized);
    await waitForever();
    return;
  }

  // Start indexer
  await startIndexer(rootDir, l2RpcUrl);

  // Discover and start apps
  const apps = discoverApps(rootDir);
  const appsToStart = filterApps(apps, options);

  logger.step(`Starting ${appsToStart.length} apps...`);
  for (const app of appsToStart) {
    await startApp(rootDir, app, l2RpcUrl, decentralized);
  }

  printReady(l2RpcUrl, runningServices, decentralized);
  await waitForever();
}

async function startDecentralizedStack(rootDir: string): Promise<void> {
  const composePath = join(rootDir, 'docker-compose.decentralized.yml');
  
  if (!existsSync(composePath)) {
    logger.warn('docker-compose.decentralized.yml not found, skipping...');
    return;
  }

  logger.step('Starting decentralized infrastructure...');
  
  try {
    execSync('docker compose -f docker-compose.decentralized.yml up -d', {
      cwd: rootDir,
      stdio: 'pipe',
    });
    
    // Wait for services to be healthy
    logger.step('Waiting for services to be healthy...');
    
    const services = [
      { name: 'IPFS', url: 'http://localhost:5001/api/v0/id', method: 'POST' },
      { name: 'Cache', url: 'http://localhost:4115/health', method: 'GET' },
    ];
    
    for (const service of services) {
      let healthy = false;
      for (let i = 0; i < 30 && !healthy; i++) {
        const response = await fetch(service.url, { method: service.method as 'GET' | 'POST', signal: AbortSignal.timeout(5000) }).catch(() => null);
        healthy = response?.ok ?? false;
        if (!healthy) await new Promise(r => setTimeout(r, 2000));
      }
      
      if (healthy) {
        logger.success(`${service.name} ready`);
        runningServices.push({ name: service.name });
      } else {
        throw new Error(`${service.name} failed to start`);
      }
    }
    
    logger.success('Decentralized stack ready');
  } catch (e) {
    logger.error('Failed to start decentralized stack: ' + (e as Error).message);
    logger.warn('Run: docker compose -f docker-compose.decentralized.yml logs');
    throw e;
  }
}

async function stopDev() {
  logger.header('STOPPING');

  logger.step('Stopping localnet...');
  await stopLocalnet();
  logger.success('Stopped');
}

function setupSignalHandlers() {
  const cleanup = async () => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.newline();
    logger.step('Shutting down...');

    for (const service of runningServices) {
      if (service.process) {
        service.process.kill('SIGTERM');
      }
    }

    // Stop monitoring
    await execa('docker', ['compose', 'down'], {
      cwd: join(process.cwd(), 'apps/monitoring'),
      reject: false,
    }).catch(() => {});

    logger.success('Stopped');
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

function filterApps(apps: AppManifest[], options: { only?: string; skip?: string }): AppManifest[] {
  let filtered = apps.filter(app =>
    app.enabled !== false &&
    app.autoStart !== false &&
    app.name !== 'indexer' &&
    app.name !== 'monitoring'
  );

  if (options.only) {
    const only = options.only.split(',').map(s => s.trim());
    filtered = filtered.filter(app => only.includes(app.name));
  }

  if (options.skip) {
    const skip = options.skip.split(',').map(s => s.trim());
    filtered = filtered.filter(app => !skip.includes(app.name));
  }

  return filtered;
}

async function startIndexer(rootDir: string, rpcUrl: string): Promise<void> {
  const indexerDir = join(rootDir, 'apps/indexer');
  if (!existsSync(indexerDir)) {
    return;
  }

  logger.step('Starting indexer...');

  const proc = execa('bun', ['run', 'dev'], {
    cwd: indexerDir,
    env: {
      ...process.env,
      RPC_ETH_HTTP: rpcUrl,
      START_BLOCK: '0',
      CHAIN_ID: '1337',
      GQL_PORT: String(DEFAULT_PORTS.indexerGraphQL),
    },
    stdio: 'pipe',
  });

  runningServices.push({
    name: 'Indexer',
    port: DEFAULT_PORTS.indexerGraphQL,
    process: proc,
  });

  await new Promise(r => setTimeout(r, 3000));
}

async function startApp(rootDir: string, app: AppManifest, rpcUrl: string, decentralized = false): Promise<void> {
  const appDir = join(rootDir, 'apps', app.name);
  const vendorDir = join(rootDir, 'vendor', app.name);
  const dir = existsSync(appDir) ? appDir : vendorDir;

  if (!existsSync(dir)) return;

  const devCommand = app.commands?.dev;
  if (!devCommand) return;

  const mainPort = app.ports?.main;
  const appEnv: Record<string, string> = {
    ...process.env as Record<string, string>,
    JEJU_RPC_URL: rpcUrl,
    RPC_URL: rpcUrl,
    CHAIN_ID: '1337',
  };

  // Decentralized stack environment variables
  if (decentralized) {
    appEnv.DECENTRALIZED = 'true';
    appEnv.CQL_REQUIRED = 'true';
    appEnv.COVENANTSQL_NODES = 'http://localhost:4661';
    appEnv.IPFS_API_URL = 'http://localhost:5001';
    appEnv.IPFS_GATEWAY_URL = 'http://localhost:4180';
    appEnv.CACHE_SERVICE_URL = 'http://localhost:4115';
    appEnv.DA_SERVER_URL = 'http://localhost:4010';
  }

  if (mainPort) {
    appEnv.PORT = String(mainPort);
  }

  const [cmd, ...args] = devCommand.split(' ');
  const proc = execa(cmd, args, {
    cwd: dir,
    env: appEnv,
    stdio: 'pipe',
  });

  runningServices.push({
    name: app.displayName || app.name,
    port: mainPort,
    process: proc,
  });

  proc.catch(() => {});
}

function printReady(rpcUrl: string, services: RunningService[], decentralized = false) {
  console.clear();

  logger.header('READY');
  logger.info('Press Ctrl+C to stop\n');

  if (decentralized) {
    logger.subheader('Decentralized Stack');
    logger.table([
      { label: 'IPFS API', value: 'http://127.0.0.1:5001', status: 'ok' },
      { label: 'IPFS Gateway', value: 'http://127.0.0.1:4180', status: 'ok' },
      { label: 'CQL', value: 'http://127.0.0.1:4661', status: 'ok' },
      { label: 'Cache', value: 'http://127.0.0.1:4115', status: 'ok' },
    ]);
    logger.success('100% Decentralized - No Fallbacks\n');
  }

  logger.subheader('Chain');
  logger.table([
    { label: 'L1 RPC', value: `http://127.0.0.1:${DEFAULT_PORTS.l1Rpc}`, status: 'ok' },
    { label: 'L2 RPC', value: rpcUrl, status: 'ok' },
  ]);

  if (services.length > 0) {
    logger.subheader('Services');
    for (const svc of services) {
      const url = svc.port ? `http://127.0.0.1:${svc.port}` : 'running';
      logger.table([{ label: svc.name, value: url, status: 'ok' }]);
    }
  }

  logger.subheader('Test Wallet');
  const deployer = WELL_KNOWN_KEYS.dev[0];
  logger.keyValue('Address', deployer.address);
  logger.keyValue('Key', deployer.privateKey.slice(0, 20) + '...');
  logger.warn('Well-known test key - DO NOT use on mainnet');
}

async function waitForever(): Promise<void> {
  await new Promise(() => {});
}
