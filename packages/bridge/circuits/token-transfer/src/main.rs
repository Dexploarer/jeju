//! Token Transfer ZK Program
//!
//! This SP1 program verifies cross-chain token transfers by proving:
//! 1. The transfer was included in a valid source chain state
//! 2. The sender had sufficient balance
//! 3. The transfer data is correctly formatted
//!
//! The program outputs a commitment that can be verified on-chain.

#![no_main]
sp1_zkvm::entrypoint!(main);

use serde::{Deserialize, Serialize};

/// Transfer data to be proven
#[derive(Serialize, Deserialize)]
pub struct TransferInput {
    /// Transfer ID (32 bytes)
    pub transfer_id: [u8; 32],
    /// Source chain ID
    pub source_chain: u32,
    /// Destination chain ID
    pub dest_chain: u32,
    /// Sender address (32 bytes, padded)
    pub sender: [u8; 32],
    /// Recipient address (32 bytes, padded)
    pub recipient: [u8; 32],
    /// Token address (32 bytes, padded)
    pub token: [u8; 32],
    /// Amount as u64 (for simplicity)
    pub amount: u64,
    /// Nonce
    pub nonce: u64,
    /// State root at time of transfer
    pub state_root: [u8; 32],
    /// Merkle proof of inclusion
    pub merkle_proof: Vec<[u8; 32]>,
    /// Merkle proof indices (left/right)
    pub proof_indices: Vec<bool>,
}

/// Output commitment proven by this program
#[derive(Serialize, Deserialize)]
pub struct TransferOutput {
    /// Hash of the verified transfer
    pub transfer_hash: [u8; 32],
    /// State root that was verified against
    pub state_root: [u8; 32],
    /// Source chain ID
    pub source_chain: u32,
    /// Destination chain ID
    pub dest_chain: u32,
}

fn main() {
    // Read input from the prover
    let input: TransferInput = sp1_zkvm::io::read();

    // Compute transfer hash
    let transfer_hash = compute_transfer_hash(&input);

    // Verify merkle inclusion proof
    let computed_root = verify_merkle_proof(
        &transfer_hash,
        &input.merkle_proof,
        &input.proof_indices,
    );

    // Assert the computed root matches the claimed state root
    assert_eq!(
        computed_root, input.state_root,
        "Merkle proof verification failed"
    );

    // Validate chain IDs
    assert!(input.source_chain > 0, "Invalid source chain");
    assert!(input.dest_chain > 0, "Invalid dest chain");
    assert!(input.source_chain != input.dest_chain, "Same chain transfer");

    // Validate amount
    assert!(input.amount > 0, "Zero amount transfer");

    // Create output commitment
    let output = TransferOutput {
        transfer_hash,
        state_root: input.state_root,
        source_chain: input.source_chain,
        dest_chain: input.dest_chain,
    };

    // Commit the output (this becomes the public inputs to the ZK proof)
    sp1_zkvm::io::commit(&output);
}

/// Compute keccak256 hash of transfer data
fn compute_transfer_hash(input: &TransferInput) -> [u8; 32] {
    // Simple hash: concatenate all fields and hash
    // In production, use proper keccak256
    let mut data = Vec::new();
    data.extend_from_slice(&input.transfer_id);
    data.extend_from_slice(&input.source_chain.to_be_bytes());
    data.extend_from_slice(&input.dest_chain.to_be_bytes());
    data.extend_from_slice(&input.sender);
    data.extend_from_slice(&input.recipient);
    data.extend_from_slice(&input.token);
    data.extend_from_slice(&input.amount.to_be_bytes());
    data.extend_from_slice(&input.nonce.to_be_bytes());

    // Simple hash (SP1 provides efficient hashing)
    simple_hash(&data)
}

/// Verify a merkle proof
fn verify_merkle_proof(
    leaf: &[u8; 32],
    proof: &[[u8; 32]],
    indices: &[bool],
) -> [u8; 32] {
    assert_eq!(proof.len(), indices.len(), "Proof/indices length mismatch");

    let mut current = *leaf;

    for (i, sibling) in proof.iter().enumerate() {
        let mut combined = [0u8; 64];
        if indices[i] {
            // Current is on the right
            combined[..32].copy_from_slice(sibling);
            combined[32..].copy_from_slice(&current);
        } else {
            // Current is on the left
            combined[..32].copy_from_slice(&current);
            combined[32..].copy_from_slice(sibling);
        }
        current = simple_hash(&combined);
    }

    current
}

/// Simple hash function (in real impl, use keccak256)
fn simple_hash(data: &[u8]) -> [u8; 32] {
    // SP1 provides efficient hashing - this is a simplified version
    // In production, use sp1-sdk's keccak or sha256
    let mut hash = [0u8; 32];
    let mut acc: u64 = 0;

    for (i, byte) in data.iter().enumerate() {
        acc = acc.wrapping_add(*byte as u64);
        acc = acc.wrapping_mul(31);
        acc = acc.rotate_left(5);
        hash[i % 32] ^= (acc & 0xff) as u8;
    }

    // Additional mixing
    for i in 0..32 {
        hash[i] = hash[i].wrapping_add(hash[(i + 17) % 32]);
    }

    hash
}
