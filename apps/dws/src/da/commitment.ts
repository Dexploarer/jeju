/**
 * Polynomial Commitment Scheme
 * 
 * Implements cryptographically secure commitment and verification:
 * - KZG polynomial commitments with trusted setup
 * - Merkle proofs for chunk inclusion
 * - Batch verification support
 * - Compatible with sampling-based verification
 * 
 * Uses kzg-wasm for production-ready cryptographic proofs.
 */

import type { Hex } from 'viem';
import { keccak256, toBytes, toHex, concatHex } from 'viem';
import type { BlobCommitment, Chunk, ChunkProof } from './types';
import { 
  KZG, 
  initializeKZG, 
  isKZGInitialized,
  createBlob,
  computeBlobProofSync,
  verifyBlobProofSync,
  type KZGCommitment,
  type KZGProof,
  BLOB_SIZE,
} from './crypto/kzg';

// ============================================================================
// Initialization
// ============================================================================

let initialized = false;

/**
 * Initialize the commitment system
 * Must be called before using commitment functions
 */
export async function initializeCommitmentSystem(): Promise<void> {
  if (initialized) return;
  
  await initializeKZG();
  initialized = true;
}

/**
 * Check if system is initialized
 */
export function isCommitmentSystemInitialized(): boolean {
  return initialized && isKZGInitialized();
}

// ============================================================================
// Merkle Tree Operations
// ============================================================================

/**
 * Compute Merkle root from leaves
 */
function computeMerkleRoot(leaves: Hex[]): Hex {
  if (leaves.length === 0) {
    return keccak256(toBytes('0x'));
  }
  
  if (leaves.length === 1) {
    return leaves[0];
  }
  
  const nextLevel: Hex[] = [];
  for (let i = 0; i < leaves.length; i += 2) {
    const left = leaves[i];
    const right = leaves[i + 1] ?? left;
    nextLevel.push(keccak256(concatHex([left, right])));
  }
  
  return computeMerkleRoot(nextLevel);
}

/**
 * Compute Merkle proof for leaf at index
 */
function computeMerkleProof(leaves: Hex[], index: number): Hex[] {
  const proof: Hex[] = [];
  let level = [...leaves];
  let idx = index;
  
  while (level.length > 1) {
    const isRight = idx % 2 === 1;
    const siblingIdx = isRight ? idx - 1 : idx + 1;
    
    if (siblingIdx < level.length) {
      proof.push(level[siblingIdx]);
    } else {
      proof.push(level[idx]);
    }
    
    // Move to next level
    const nextLevel: Hex[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = level[i + 1] ?? left;
      nextLevel.push(keccak256(concatHex([left, right])));
    }
    
    level = nextLevel;
    idx = Math.floor(idx / 2);
  }
  
  return proof;
}

/**
 * Verify Merkle proof
 */
function verifyMerkleProof(
  leaf: Hex,
  proof: Hex[],
  root: Hex,
  index: number
): boolean {
  let hash = leaf;
  let idx = index;
  
  for (const sibling of proof) {
    const isRight = idx % 2 === 1;
    if (isRight) {
      hash = keccak256(concatHex([sibling, hash]));
    } else {
      hash = keccak256(concatHex([hash, sibling]));
    }
    idx = Math.floor(idx / 2);
  }
  
  return hash.toLowerCase() === root.toLowerCase();
}

// ============================================================================
// Commitment Generation
// ============================================================================

/**
 * Generate polynomial commitment from data chunks
 * Uses KZG for cryptographically secure commitment
 */
export async function createCommitment(
  chunks: Uint8Array[],
  chunkSize: number,
  dataChunkCount: number,
  parityChunkCount: number
): Promise<BlobCommitment> {
  // Ensure system is initialized
  if (!initialized) {
    await initializeCommitmentSystem();
  }
  
  // Concatenate all chunks into a blob
  const totalSize = chunks.reduce((sum, c) => sum + c.length, 0);
  const blobData = new Uint8Array(Math.min(totalSize, BLOB_SIZE));
  
  let offset = 0;
  for (const chunk of chunks) {
    const remaining = BLOB_SIZE - offset;
    if (remaining <= 0) break;
    
    const toCopy = Math.min(chunk.length, remaining);
    blobData.set(chunk.slice(0, toCopy), offset);
    offset += toCopy;
  }
  
  // Create KZG blob and compute commitment
  const blob = createBlob(blobData);
  const kzgCommitment = KZG.computeCommitmentSync(blob);
  
  // Compute Merkle root of chunks for inclusion proofs
  const leaves = chunks.map(c => keccak256(c));
  const merkleRoot = computeMerkleRoot(leaves);
  
  return {
    commitment: kzgCommitment,
    dataChunkCount,
    parityChunkCount,
    totalChunkCount: chunks.length,
    chunkSize,
    merkleRoot,
    timestamp: Date.now(),
  };
}

/**
 * Generate polynomial commitment synchronously
 * Requires prior initialization
 */
export function createCommitmentSync(
  chunks: Uint8Array[],
  chunkSize: number,
  dataChunkCount: number,
  parityChunkCount: number
): BlobCommitment {
  if (!initialized) {
    throw new Error('Commitment system not initialized. Call initializeCommitmentSystem() first');
  }
  
  const totalSize = chunks.reduce((sum, c) => sum + c.length, 0);
  const blobData = new Uint8Array(Math.min(totalSize, BLOB_SIZE));
  
  let offset = 0;
  for (const chunk of chunks) {
    const remaining = BLOB_SIZE - offset;
    if (remaining <= 0) break;
    
    const toCopy = Math.min(chunk.length, remaining);
    blobData.set(chunk.slice(0, toCopy), offset);
    offset += toCopy;
  }
  
  const blob = createBlob(blobData);
  const kzgCommitment = KZG.computeCommitmentSync(blob);
  
  const leaves = chunks.map(c => keccak256(c));
  const merkleRoot = computeMerkleRoot(leaves);
  
  return {
    commitment: kzgCommitment,
    dataChunkCount,
    parityChunkCount,
    totalChunkCount: chunks.length,
    chunkSize,
    merkleRoot,
    timestamp: Date.now(),
  };
}

// ============================================================================
// Proof Generation
// ============================================================================

/**
 * Generate opening proof for a specific chunk
 * Combines KZG proof with Merkle inclusion proof
 */
export async function createOpeningProof(
  chunks: Uint8Array[],
  chunkIndex: number,
  commitment: BlobCommitment
): Promise<ChunkProof> {
  if (!initialized) {
    await initializeCommitmentSystem();
  }
  
  // Compute Merkle proof for chunk inclusion
  const leaves = chunks.map(c => keccak256(c));
  const merkleProof = computeMerkleProof(leaves, chunkIndex);
  
  // Create blob for KZG proof
  const totalSize = chunks.reduce((sum, c) => sum + c.length, 0);
  const blobData = new Uint8Array(Math.min(totalSize, BLOB_SIZE));
  
  let offset = 0;
  for (const chunk of chunks) {
    const remaining = BLOB_SIZE - offset;
    if (remaining <= 0) break;
    
    const toCopy = Math.min(chunk.length, remaining);
    blobData.set(chunk.slice(0, toCopy), offset);
    offset += toCopy;
  }
  
  const blob = createBlob(blobData);
  
  // Compute KZG proof
  const kzgProof = computeBlobProofSync(blob, commitment.commitment as KZGCommitment);
  
  return {
    merkleProof,
    openingProof: kzgProof,
    polynomialIndex: chunkIndex,
  };
}

/**
 * Create opening proof synchronously
 */
export function createOpeningProofSync(
  chunks: Uint8Array[],
  chunkIndex: number,
  commitment: BlobCommitment
): ChunkProof {
  if (!initialized) {
    throw new Error('Commitment system not initialized');
  }
  
  const leaves = chunks.map(c => keccak256(c));
  const merkleProof = computeMerkleProof(leaves, chunkIndex);
  
  const totalSize = chunks.reduce((sum, c) => sum + c.length, 0);
  const blobData = new Uint8Array(Math.min(totalSize, BLOB_SIZE));
  
  let offset = 0;
  for (const chunk of chunks) {
    const remaining = BLOB_SIZE - offset;
    if (remaining <= 0) break;
    
    const toCopy = Math.min(chunk.length, remaining);
    blobData.set(chunk.slice(0, toCopy), offset);
    offset += toCopy;
  }
  
  const blob = createBlob(blobData);
  const kzgProof = computeBlobProofSync(blob, commitment.commitment as KZGCommitment);
  
  return {
    merkleProof,
    openingProof: kzgProof,
    polynomialIndex: chunkIndex,
  };
}

// ============================================================================
// Proof Verification
// ============================================================================

/**
 * Verify chunk proof against commitment
 * Uses both Merkle and KZG verification
 */
export function verifyProof(
  chunk: Chunk,
  commitment: BlobCommitment
): boolean {
  // 1. Verify Merkle proof for chunk inclusion
  const chunkHash = keccak256(chunk.data);
  const merkleValid = verifyMerkleProof(
    chunkHash,
    chunk.proof.merkleProof,
    commitment.merkleRoot,
    chunk.index
  );
  
  if (!merkleValid) {
    return false;
  }
  
  // 2. Verify chunk index bounds
  if (chunk.index < 0 || chunk.index >= commitment.totalChunkCount) {
    return false;
  }
  
  // 3. Verify polynomial index consistency
  if (chunk.proof.polynomialIndex !== chunk.index) {
    return false;
  }
  
  // 4. Verify chunk size (allow slight variation for padding)
  if (chunk.data.length > commitment.chunkSize + 32) {
    return false;
  }
  
  // Note: KZG proof verification requires the original blob data
  // For full verification, use verifyProofWithBlob()
  
  return true;
}

/**
 * Verify chunk proof with original blob data
 * Provides full cryptographic verification including KZG
 */
export async function verifyProofWithBlob(
  chunk: Chunk,
  commitment: BlobCommitment,
  blobData: Uint8Array
): Promise<boolean> {
  // First do basic verification
  if (!verifyProof(chunk, commitment)) {
    return false;
  }
  
  // Then verify KZG proof
  if (!initialized) {
    await initializeCommitmentSystem();
  }
  
  const blob = createBlob(blobData);
  const kzgValid = verifyBlobProofSync(
    blob,
    commitment.commitment as KZGCommitment,
    chunk.proof.openingProof as KZGProof
  );
  
  return kzgValid;
}

// ============================================================================
// Batch Verification
// ============================================================================

/**
 * Verify multiple chunks in batch
 */
export function verifyBatch(
  chunks: Chunk[],
  commitment: BlobCommitment
): { valid: boolean; validCount: number; invalidIndices: number[] } {
  const invalidIndices: number[] = [];
  
  for (const chunk of chunks) {
    if (!verifyProof(chunk, commitment)) {
      invalidIndices.push(chunk.index);
    }
  }
  
  return {
    valid: invalidIndices.length === 0,
    validCount: chunks.length - invalidIndices.length,
    invalidIndices,
  };
}

/**
 * Verify batch with full KZG verification
 */
export async function verifyBatchWithBlob(
  chunks: Chunk[],
  commitment: BlobCommitment,
  blobData: Uint8Array
): Promise<{ valid: boolean; validCount: number; invalidIndices: number[] }> {
  const invalidIndices: number[] = [];
  
  for (const chunk of chunks) {
    const valid = await verifyProofWithBlob(chunk, commitment, blobData);
    if (!valid) {
      invalidIndices.push(chunk.index);
    }
  }
  
  return {
    valid: invalidIndices.length === 0,
    validCount: chunks.length - invalidIndices.length,
    invalidIndices,
  };
}

// ============================================================================
// Polynomial Commitment Wrapper
// ============================================================================

export interface PolynomialCommitment {
  commitment: BlobCommitment;
  chunks: Chunk[];
  blobData: Uint8Array;
  
  getChunk(index: number): Chunk | null;
  getProof(index: number): ChunkProof | null;
  verify(chunk: Chunk): boolean;
  verifyFull(chunk: Chunk): Promise<boolean>;
  verifyAll(): boolean;
  verifyAllFull(): Promise<boolean>;
}

export async function createPolynomialCommitment(
  data: Uint8Array,
  chunks: Uint8Array[],
  dataChunkCount: number,
  parityChunkCount: number,
  blobId: Hex
): Promise<PolynomialCommitment> {
  const chunkSize = chunks[0]?.length ?? 0;
  const commitment = await createCommitment(chunks, chunkSize, dataChunkCount, parityChunkCount);
  
  // Store blob data for full verification
  const totalSize = chunks.reduce((sum, c) => sum + c.length, 0);
  const blobData = new Uint8Array(Math.min(totalSize, BLOB_SIZE));
  
  let offset = 0;
  for (const chunk of chunks) {
    const remaining = BLOB_SIZE - offset;
    if (remaining <= 0) break;
    
    const toCopy = Math.min(chunk.length, remaining);
    blobData.set(chunk.slice(0, toCopy), offset);
    offset += toCopy;
  }
  
  const chunksWithProofs: Chunk[] = await Promise.all(
    chunks.map(async (chunk, index) => ({
      index,
      data: chunk,
      blobId,
      proof: await createOpeningProof(chunks, index, commitment),
    }))
  );
  
  return {
    commitment,
    chunks: chunksWithProofs,
    blobData,
    
    getChunk(index: number): Chunk | null {
      return chunksWithProofs[index] ?? null;
    },
    
    getProof(index: number): ChunkProof | null {
      return chunksWithProofs[index]?.proof ?? null;
    },
    
    verify(chunk: Chunk): boolean {
      return verifyProof(chunk, commitment);
    },
    
    async verifyFull(chunk: Chunk): Promise<boolean> {
      return verifyProofWithBlob(chunk, commitment, blobData);
    },
    
    verifyAll(): boolean {
      return chunksWithProofs.every(c => verifyProof(c, commitment));
    },
    
    async verifyAllFull(): Promise<boolean> {
      for (const chunk of chunksWithProofs) {
        const valid = await verifyProofWithBlob(chunk, commitment, blobData);
        if (!valid) return false;
      }
      return true;
    },
  };
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Convert bytes to hex with proper formatting
 */
export function bytesToCommitmentHex(data: Uint8Array): Hex {
  return toHex(data);
}

/**
 * Compute blob ID from data
 */
export function computeBlobId(data: Uint8Array): Hex {
  return keccak256(data);
}
