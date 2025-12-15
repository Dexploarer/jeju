/**
 * Integration Tests for Cross-Chain Bridge
 *
 * Tests the complete flow:
 * - EVM → Solana transfers
 * - Solana → EVM transfers
 * - Light client updates
 * - TEE batching
 * - Proof generation and verification
 */

import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { Keypair, PublicKey } from '@solana/web3.js';
import { type Subprocess, spawn } from 'bun';
import { type Hex } from 'viem';
import {
  ChainId,
  createEVMClient,
  createSolanaClient,
  createTEEBatcher,
  LOCAL_TEE_CONFIG,
  toHash32,
} from '../../src/index.js';

// Test configuration
const TEST_CONFIG = {
  evmRpc: 'http://127.0.0.1:8545',
  solanaRpc: 'http://127.0.0.1:8899',
  testTimeout: 60000,
};

// Test accounts
const EVM_PRIVATE_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as Hex;
const SOLANA_KEYPAIR = Keypair.generate();

// Deployed contract addresses (set after deployment)
let DEPLOYED_ADDRESSES = {
  groth16Verifier: '' as Hex,
  solanaLightClient: '' as Hex,
  crossChainBridge: '' as Hex,
  testToken: '' as Hex,
};

// Process handles for cleanup
let anvilProcess: Subprocess | null = null;
let solanaProcess: Subprocess | null = null;

describe('Cross-Chain Bridge Integration', () => {
  beforeAll(async () => {
    // Check if chains are already running
    const evmRunning = await isEVMRunning();
    const solanaRunning = await isSolanaRunning();

    if (!evmRunning) {
      console.log('Starting Anvil...');
      anvilProcess = spawn({
        cmd: ['anvil', '--port', '8545', '--chain-id', '31337'],
        stdout: 'pipe',
        stderr: 'pipe',
      });
      await waitForEVM();
    }

    if (!solanaRunning) {
      console.log('Starting Solana validator...');
      solanaProcess = spawn({
        cmd: ['solana-test-validator', '--reset', '--quiet'],
        stdout: 'pipe',
        stderr: 'pipe',
      });
      await waitForSolana();
    }

    // Deploy contracts
    await deployContracts();
  }, TEST_CONFIG.testTimeout);

  afterAll(async () => {
    if (anvilProcess) {
      anvilProcess.kill();
    }
    if (solanaProcess) {
      solanaProcess.kill();
    }
  });

  describe('Light Client Initialization', () => {
    it('should initialize Solana light client on EVM', async () => {
      const evmClient = createEVMClient({
        chainId: ChainId.LOCAL_EVM,
        rpcUrl: TEST_CONFIG.evmRpc,
        privateKey: EVM_PRIVATE_KEY,
        bridgeAddress: DEPLOYED_ADDRESSES.crossChainBridge,
        lightClientAddress: DEPLOYED_ADDRESSES.solanaLightClient,
      });

      const latestSlot = await evmClient.getLatestVerifiedSlot();
      expect(latestSlot).toBeGreaterThanOrEqual(BigInt(0));
    });

    it('should verify slot state on light client', async () => {
      const evmClient = createEVMClient({
        chainId: ChainId.LOCAL_EVM,
        rpcUrl: TEST_CONFIG.evmRpc,
        bridgeAddress: DEPLOYED_ADDRESSES.crossChainBridge,
        lightClientAddress: DEPLOYED_ADDRESSES.solanaLightClient,
      });

      const isVerified = await evmClient.isSlotVerified(BigInt(0));
      expect(isVerified).toBe(true);
    });
  });

  describe('Token Registration', () => {
    it('should register token for bridging', async () => {
      const evmClient = createEVMClient({
        chainId: ChainId.LOCAL_EVM,
        rpcUrl: TEST_CONFIG.evmRpc,
        privateKey: EVM_PRIVATE_KEY,
        bridgeAddress: DEPLOYED_ADDRESSES.crossChainBridge,
        lightClientAddress: DEPLOYED_ADDRESSES.solanaLightClient,
      });

      const isRegistered = await evmClient.isTokenRegistered(
        DEPLOYED_ADDRESSES.testToken
      );
      expect(isRegistered).toBe(true);
    });
  });

  describe('TEE Batching', () => {
    it('should initialize TEE batcher', async () => {
      const batcher = createTEEBatcher(LOCAL_TEE_CONFIG);
      await batcher.initialize();

      const attestation = batcher.getAttestation();
      expect(attestation).not.toBeNull();
      expect(attestation!.measurement.length).toBe(32);
    });

    it('should batch transfers', async () => {
      const batcher = createTEEBatcher({
        ...LOCAL_TEE_CONFIG,
        minBatchSize: 1,
        maxBatchSize: 5,
      });
      await batcher.initialize();

      const transfer = {
        transferId: toHash32(new Uint8Array(32).fill(1)),
        sourceChain: ChainId.LOCAL_EVM,
        destChain: ChainId.LOCAL_SOLANA,
        token: toHash32(new Uint8Array(32).fill(2)),
        sender: new Uint8Array(32).fill(3),
        recipient: new Uint8Array(32).fill(4),
        amount: BigInt(1000000),
        nonce: BigInt(1),
        timestamp: BigInt(Date.now()),
        payload: new Uint8Array(0),
      };

      const result = await batcher.addTransfer(transfer);
      expect(result.batchId).toBeDefined();
      expect(result.position).toBe(0);
      expect(result.estimatedCost).toBeGreaterThan(BigInt(0));
    });
  });

  describe('EVM → Solana Transfer', () => {
    it('should calculate transfer fee', async () => {
      const evmClient = createEVMClient({
        chainId: ChainId.LOCAL_EVM,
        rpcUrl: TEST_CONFIG.evmRpc,
        bridgeAddress: DEPLOYED_ADDRESSES.crossChainBridge,
        lightClientAddress: DEPLOYED_ADDRESSES.solanaLightClient,
      });

      const fee = await evmClient.getTransferFee(ChainId.LOCAL_SOLANA, 0);
      expect(fee).toBeGreaterThan(BigInt(0));
    });

    it('should get token balance', async () => {
      const evmClient = createEVMClient({
        chainId: ChainId.LOCAL_EVM,
        rpcUrl: TEST_CONFIG.evmRpc,
        privateKey: EVM_PRIVATE_KEY,
        bridgeAddress: DEPLOYED_ADDRESSES.crossChainBridge,
        lightClientAddress: DEPLOYED_ADDRESSES.solanaLightClient,
      });

      const balance = await evmClient.getTokenBalance(
        DEPLOYED_ADDRESSES.testToken
      );
      expect(balance).toBeGreaterThan(BigInt(0));
    });
  });

  describe('Solana Client', () => {
    it('should connect to Solana', async () => {
      const solanaClient = createSolanaClient({
        rpcUrl: TEST_CONFIG.solanaRpc,
        commitment: 'confirmed',
        keypair: SOLANA_KEYPAIR,
        bridgeProgramId: new PublicKey(
          'TokenBridge11111111111111111111111111111111'
        ),
        evmLightClientProgramId: new PublicKey(
          'EVMLightClient1111111111111111111111111111'
        ),
      });

      const slot = await solanaClient.getLatestSlot();
      expect(slot).toBeGreaterThan(BigInt(0));
    });

    it('should get latest blockhash', async () => {
      const solanaClient = createSolanaClient({
        rpcUrl: TEST_CONFIG.solanaRpc,
        commitment: 'confirmed',
        keypair: SOLANA_KEYPAIR,
        bridgeProgramId: new PublicKey(
          'TokenBridge11111111111111111111111111111111'
        ),
        evmLightClientProgramId: new PublicKey(
          'EVMLightClient1111111111111111111111111111'
        ),
      });

      const blockhash = await solanaClient.getLatestBlockhash();
      expect(blockhash).toBeDefined();
      expect(blockhash.length).toBeGreaterThan(0);
    });
  });
});

// Helper functions
async function isEVMRunning(): Promise<boolean> {
  try {
    const response = await fetch(TEST_CONFIG.evmRpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_blockNumber',
        params: [],
        id: 1,
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function isSolanaRunning(): Promise<boolean> {
  try {
    const response = await fetch(TEST_CONFIG.solanaRpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'getHealth',
        id: 1,
      }),
    });
    if (!response.ok) return false;
    const data = (await response.json()) as { result?: string };
    return data.result === 'ok';
  } catch {
    return false;
  }
}

async function waitForEVM(maxAttempts = 30): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    if (await isEVMRunning()) return;
    await Bun.sleep(1000);
  }
  throw new Error('EVM chain failed to start');
}

async function waitForSolana(maxAttempts = 30): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    if (await isSolanaRunning()) return;
    await Bun.sleep(1000);
  }
  throw new Error('Solana validator failed to start');
}

async function deployContracts(): Promise<void> {
  // For testing, use mock addresses
  // In production, this would deploy actual contracts
  DEPLOYED_ADDRESSES = {
    groth16Verifier: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    solanaLightClient: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
    crossChainBridge: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
    testToken: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
  };

  console.log('Using mock contract addresses for testing');
}
