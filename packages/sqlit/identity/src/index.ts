/**
 * SQLit Identity Service
 *
 * Bridges on-chain SQLitIdentityRegistry with SQLit node configuration.
 * Provides cryptographic identity verification tied to Jeju OP Stack L2.
 *
 * Architecture:
 * 1. Node generates identity locally (publicKey, nonce, nodeId)
 * 2. Node registers identity on-chain (verified by smart contract)
 * 3. All nodes discover peers from on-chain registry
 * 4. Config is generated with verified peer identities
 *
 * @example
 * ```typescript
 * import { SQLitIdentityService } from '@jejunetwork/sqlit-identity'
 *
 * const service = new SQLitIdentityService({
 *   rpcUrl: 'https://rpc.testnet.jejunetwork.org',
 *   registryAddress: '0x...',
 *   privateKey: process.env.OPERATOR_PRIVATE_KEY,
 * })
 *
 * // Generate and register identity
 * const identity = await service.generateIdentity()
 * await service.registerOnChain(identity, 'blockproducer', 'sqlit-0:4661', 100000n)
 *
 * // Discover peers and generate config
 * const peers = await service.discoverPeers()
 * const config = await service.generateConfig(identity, peers)
 * ```
 */

import { blake2b } from '@noble/hashes/blake2b'
import { sha256 } from '@noble/hashes/sha256'
import { secp256k1 } from '@noble/curves/secp256k1'
import {
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
  createPublicClient,
  createWalletClient,
  http,
  encodeFunctionData,
  decodeAbiParameters,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import * as yaml from 'yaml'

// ============================================================================
// Types
// ============================================================================

export interface SQLitIdentity {
  /** 32-byte NodeID (hex without 0x) */
  nodeId: string
  /** 33-byte compressed public key (hex without 0x) */
  publicKey: string
  /** 32-byte private key (hex without 0x) */
  privateKey: string
  /** Proof-of-work nonce */
  nonce: {
    a: bigint
    b: bigint
    c: bigint
    d: bigint
  }
  /** Difficulty (leading zero bits) */
  difficulty: number
}

export interface PeerIdentity {
  nodeId: string
  publicKey: string
  nonce: {
    a: bigint
    b: bigint
    c: bigint
    d: bigint
  }
  endpoint: string
  role: 'Leader' | 'Follower' | 'Client'
  operator: Address
}

export interface SQLitIdentityServiceConfig {
  /** Jeju L2 RPC URL */
  rpcUrl: string
  /** SQLitIdentityRegistry contract address */
  registryAddress: Address
  /** Operator private key (for registration) */
  privateKey?: Hex
  /** Chain ID */
  chainId?: number
}

export interface SQLitConfig {
  UseTestMasterKey: boolean
  WorkingRoot: string
  PubKeyStoreFile: string
  PrivateKeyFile: string
  DHTFileName: string
  ListenAddr: string
  ThisNodeID: string
  QPS: number
  MinNodeIDDifficulty: number
  BlockProducer: {
    PublicKey: string
    NodeID: string
    Nonce: { a: number; b: number; c: number; d: number }
    ChainFileName: string
    BPGenesisInfo: {
      Version: number
      BlockHash: string
      Producer: string
      MerkleRoot: string
      ParentHash: string
      Timestamp: string
      BaseAccounts: never[]
    }
  }
  KnownNodes: Array<{
    ID: string
    Role: string
    Addr: string
    PublicKey: string
    Nonce: { a: number; b: number; c: number; d: number }
  }>
}

// ============================================================================
// Contract ABI (minimal)
// ============================================================================

const REGISTRY_ABI = [
  {
    name: 'registerIdentity',
    type: 'function',
    inputs: [
      { name: 'publicKey', type: 'bytes' },
      { name: 'nonce', type: 'tuple', components: [
        { name: 'a', type: 'uint64' },
        { name: 'b', type: 'uint64' },
        { name: 'c', type: 'uint64' },
        { name: 'd', type: 'uint64' },
      ]},
      { name: 'nodeId', type: 'bytes32' },
      { name: 'role', type: 'uint8' },
      { name: 'endpoint', type: 'string' },
      { name: 'stakeAmount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'getActiveBlockProducers',
    type: 'function',
    inputs: [],
    outputs: [
      { name: 'nodeIds', type: 'bytes32[]' },
      { name: 'endpoints', type: 'string[]' },
      { name: 'publicKeys', type: 'bytes[]' },
      { name: 'nonces', type: 'tuple[]', components: [
        { name: 'a', type: 'uint64' },
        { name: 'b', type: 'uint64' },
        { name: 'c', type: 'uint64' },
        { name: 'd', type: 'uint64' },
      ]},
    ],
    stateMutability: 'view',
  },
  {
    name: 'verifyIdentity',
    type: 'function',
    inputs: [
      { name: 'publicKey', type: 'bytes' },
      { name: 'nonce', type: 'tuple', components: [
        { name: 'a', type: 'uint64' },
        { name: 'b', type: 'uint64' },
        { name: 'c', type: 'uint64' },
        { name: 'd', type: 'uint64' },
      ]},
      { name: 'nodeId', type: 'bytes32' },
    ],
    outputs: [{ name: 'valid', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    name: 'getIdentity',
    type: 'function',
    inputs: [{ name: 'nodeId', type: 'bytes32' }],
    outputs: [{ name: 'identity', type: 'tuple', components: [
      { name: 'nodeId', type: 'bytes32' },
      { name: 'publicKey', type: 'bytes' },
      { name: 'nonce', type: 'tuple', components: [
        { name: 'a', type: 'uint64' },
        { name: 'b', type: 'uint64' },
        { name: 'c', type: 'uint64' },
        { name: 'd', type: 'uint64' },
      ]},
      { name: 'operator', type: 'address' },
      { name: 'stakedAmount', type: 'uint256' },
      { name: 'registeredAt', type: 'uint256' },
      { name: 'lastHeartbeat', type: 'uint256' },
      { name: 'endpoint', type: 'string' },
      { name: 'role', type: 'uint8' },
      { name: 'status', type: 'uint8' },
    ]}],
    stateMutability: 'view',
  },
] as const

// ============================================================================
// SQLit Identity Service
// ============================================================================

export class SQLitIdentityService {
  private publicClient: PublicClient
  private walletClient?: WalletClient
  private registryAddress: Address

  constructor(config: SQLitIdentityServiceConfig) {
    this.registryAddress = config.registryAddress

    this.publicClient = createPublicClient({
      transport: http(config.rpcUrl),
    })

    if (config.privateKey) {
      const account = privateKeyToAccount(config.privateKey)
      this.walletClient = createWalletClient({
        account,
        transport: http(config.rpcUrl),
      })
    }
  }

  // ==========================================================================
  // Identity Generation
  // ==========================================================================

  /**
   * Generate a new SQLit identity with proof-of-work
   * Uses CovenantSQL algorithm: NodeID = sha256(blake2b-512(publicKey || nonce))
   *
   * @param targetDifficulty Minimum leading zero bits (default: 24 = 6 hex zeros)
   * @param onProgress Callback for mining progress
   * @returns Generated identity
   */
  async generateIdentity(
    targetDifficulty = 24,
    onProgress?: (difficulty: number, elapsed: number) => void
  ): Promise<SQLitIdentity> {
    // Generate secp256k1 keypair
    const privateKeyBytes = secp256k1.utils.randomPrivateKey()
    const publicKeyBytes = secp256k1.getPublicKey(privateKeyBytes, true) // compressed

    const privateKey = Buffer.from(privateKeyBytes).toString('hex')
    const publicKey = Buffer.from(publicKeyBytes).toString('hex')

    // Mine for valid nonce
    const startTime = Date.now()
    let bestDifficulty = 0

    for (let attempt = 0; ; attempt++) {
      // Random nonce
      const nonce = {
        a: BigInt(Math.floor(Math.random() * 0xFFFFFFFF)),
        b: BigInt(Math.floor(Math.random() * 0xFFFFFFFF)),
        c: BigInt(Math.floor(Math.random() * 0xFFFFFFFF)),
        d: BigInt(0),
      }

      // Compute NodeID
      const nodeId = this.computeNodeId(publicKey, nonce)
      const difficulty = this.countLeadingZeroBits(nodeId)

      if (difficulty > bestDifficulty) {
        bestDifficulty = difficulty
        if (onProgress) {
          onProgress(difficulty, (Date.now() - startTime) / 1000)
        }
      }

      if (difficulty >= targetDifficulty) {
        return {
          nodeId,
          publicKey,
          privateKey,
          nonce,
          difficulty,
        }
      }

      // Yield to event loop periodically
      if (attempt % 10000 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0))
      }
    }
  }

  /**
   * Compute NodeID from public key and nonce
   * Algorithm: NodeID = reverse(sha256(blake2b-512(publicKey || nonce)))
   *
   * - Nonce is serialized as 4x uint64 big-endian (A, B, C, D sequential)
   * - Final hash is byte-reversed (Bitcoin-style hash display, matching CovenantSQL)
   */
  computeNodeId(
    publicKey: string,
    nonce: { a: bigint; b: bigint; c: bigint; d: bigint }
  ): string {
    // Convert public key to bytes
    const pubKeyBytes = Buffer.from(publicKey, 'hex')

    // Convert nonce to BIG-ENDIAN bytes (32 bytes total)
    // CovenantSQL uses binary.BigEndian for Uint256.Bytes()
    const nonceBytes = Buffer.alloc(32)
    nonceBytes.writeBigUInt64BE(nonce.a, 0)   // A at offset 0
    nonceBytes.writeBigUInt64BE(nonce.b, 8)   // B at offset 8
    nonceBytes.writeBigUInt64BE(nonce.c, 16)  // C at offset 16
    nonceBytes.writeBigUInt64BE(nonce.d, 24)  // D at offset 24

    // Concatenate: publicKey || nonce
    const input = Buffer.concat([pubKeyBytes, nonceBytes])

    // THashH: blake2b-512 then sha256
    const blake2bHash = blake2b(input, { dkLen: 64 })
    const sha256Hash = sha256(blake2bHash)

    // Reverse bytes for CovenantSQL NodeID format (Bitcoin-style)
    const reversed = Buffer.from(sha256Hash).reverse()

    return reversed.toString('hex')
  }

  /**
   * Count leading zero bits in a hex string
   */
  countLeadingZeroBits(hex: string): number {
    let bits = 0
    for (const char of hex) {
      const value = parseInt(char, 16)
      if (value === 0) {
        bits += 4
      } else {
        // Count remaining leading zeros in this nibble
        if ((value & 0b1000) === 0) bits++
        if ((value & 0b1100) === 0) bits++
        if ((value & 0b1110) === 0) bits++
        break
      }
    }
    return bits
  }

  // ==========================================================================
  // On-Chain Registration
  // ==========================================================================

  /**
   * Register identity on Jeju L2 chain
   */
  async registerOnChain(
    identity: SQLitIdentity,
    role: 'blockproducer' | 'miner',
    endpoint: string,
    stakeAmount: bigint
  ): Promise<Hex> {
    if (!this.walletClient) {
      throw new Error('Wallet client required for registration')
    }

    const roleEnum = role === 'blockproducer' ? 0 : 1

    const hash = await this.walletClient.writeContract({
      address: this.registryAddress,
      abi: REGISTRY_ABI,
      functionName: 'registerIdentity',
      args: [
        `0x${identity.publicKey}` as Hex,
        {
          a: identity.nonce.a,
          b: identity.nonce.b,
          c: identity.nonce.c,
          d: identity.nonce.d,
        },
        `0x${identity.nodeId}` as Hex,
        roleEnum,
        endpoint,
        stakeAmount,
      ],
    })

    return hash
  }

  /**
   * Verify identity on-chain
   */
  async verifyOnChain(identity: SQLitIdentity): Promise<boolean> {
    const result = await this.publicClient.readContract({
      address: this.registryAddress,
      abi: REGISTRY_ABI,
      functionName: 'verifyIdentity',
      args: [
        `0x${identity.publicKey}` as Hex,
        {
          a: identity.nonce.a,
          b: identity.nonce.b,
          c: identity.nonce.c,
          d: identity.nonce.d,
        },
        `0x${identity.nodeId}` as Hex,
      ],
    })

    return result as boolean
  }

  // ==========================================================================
  // Peer Discovery
  // ==========================================================================

  /**
   * Discover all active block producer peers from on-chain registry
   */
  async discoverBlockProducers(): Promise<PeerIdentity[]> {
    const result = await this.publicClient.readContract({
      address: this.registryAddress,
      abi: REGISTRY_ABI,
      functionName: 'getActiveBlockProducers',
      args: [],
    }) as [Hex[], string[], Hex[], { a: bigint; b: bigint; c: bigint; d: bigint }[]]

    const [nodeIds, endpoints, publicKeys, nonces] = result

    const peers: PeerIdentity[] = []
    for (let i = 0; i < nodeIds.length; i++) {
      peers.push({
        nodeId: nodeIds[i].slice(2), // Remove 0x prefix
        publicKey: publicKeys[i].slice(2),
        nonce: nonces[i],
        endpoint: endpoints[i],
        role: i === 0 ? 'Leader' : 'Follower',
        operator: '0x0000000000000000000000000000000000000000' as Address, // Not returned by this call
      })
    }

    return peers
  }

  // ==========================================================================
  // Config Generation
  // ==========================================================================

  /**
   * Generate SQLit config.yaml from identity and discovered peers
   */
  generateConfig(
    identity: SQLitIdentity,
    peers: PeerIdentity[],
    options: {
      workingRoot?: string
      listenAddr?: string
      role?: 'Leader' | 'Follower'
    } = {}
  ): string {
    const workingRoot = options.workingRoot ?? '/data/sqlit'
    const listenAddr = options.listenAddr ?? '0.0.0.0:4661'

    // Find the leader (first BP)
    const leader = peers.find((p) => p.role === 'Leader') ?? peers[0]

    const config: SQLitConfig = {
      UseTestMasterKey: true,
      WorkingRoot: workingRoot,
      PubKeyStoreFile: `${workingRoot}/public.keystore`,
      PrivateKeyFile: `${workingRoot}/private.key`,
      DHTFileName: `${workingRoot}/dht.db`,
      ListenAddr: listenAddr,
      ThisNodeID: identity.nodeId,
      QPS: 1000,
      MinNodeIDDifficulty: 2,
      BlockProducer: {
        PublicKey: leader.publicKey,
        NodeID: leader.nodeId,
        Nonce: {
          a: Number(leader.nonce.a),
          b: Number(leader.nonce.b),
          c: Number(leader.nonce.c),
          d: Number(leader.nonce.d),
        },
        ChainFileName: 'chain.db',
        BPGenesisInfo: {
          Version: 1,
          BlockHash: '0000000000000000000000000000000000000000000000000000000000000000',
          Producer: leader.nodeId,
          MerkleRoot: '0000000000000000000000000000000000000000000000000000000000000000',
          ParentHash: '0000000000000000000000000000000000000000000000000000000000000000',
          Timestamp: '2025-01-01T00:00:00Z',
          BaseAccounts: [],
        },
      },
      KnownNodes: peers.map((peer) => ({
        ID: peer.nodeId,
        Role: peer.role,
        Addr: peer.endpoint,
        PublicKey: peer.publicKey,
        Nonce: {
          a: Number(peer.nonce.a),
          b: Number(peer.nonce.b),
          c: Number(peer.nonce.c),
          d: Number(peer.nonce.d),
        },
      })),
    }

    return yaml.stringify(config)
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Verify identity locally (without on-chain call)
 */
export function verifyIdentityLocal(
  publicKey: string,
  nonce: { a: bigint; b: bigint; c: bigint; d: bigint },
  expectedNodeId: string
): boolean {
  const service = new SQLitIdentityService({
    rpcUrl: 'http://localhost:8545',
    registryAddress: '0x0000000000000000000000000000000000000000',
  })

  const computed = service.computeNodeId(publicKey, nonce)
  return computed === expectedNodeId
}

/**
 * Parse SQLit identity from generated config.yaml
 */
export function parseIdentityFromConfig(configYaml: string): {
  nodeId: string
  publicKey: string
  nonce: { a: bigint; b: bigint; c: bigint; d: bigint }
} | null {
  try {
    const config = yaml.parse(configYaml)
    const knownNode = config.KnownNodes?.[0]

    if (!knownNode) return null

    return {
      nodeId: config.ThisNodeID ?? knownNode.ID,
      publicKey: knownNode.PublicKey,
      nonce: {
        a: BigInt(knownNode.Nonce?.a ?? 0),
        b: BigInt(knownNode.Nonce?.b ?? 0),
        c: BigInt(knownNode.Nonce?.c ?? 0),
        d: BigInt(knownNode.Nonce?.d ?? 0),
      },
    }
  } catch {
    return null
  }
}
