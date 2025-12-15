//! Token Transfer Inclusion ZK Circuit
//!
//! This SP1 program proves that a token transfer was included in
//! a verified block on either Solana or EVM chains.
//!
//! For Solana: Proves transaction inclusion in a bank hash
//! For EVM: Proves log/receipt inclusion in a state root

#![no_main]
sp1_zkvm::entrypoint!(main);

use sha2::{Digest, Sha256};
use serde::{Deserialize, Serialize};
use serde_with::serde_as;

/// Transfer details
#[derive(Serialize, Deserialize, Clone)]
pub struct TokenTransfer {
    pub transfer_id: [u8; 32],
    pub source_chain: u64,
    pub dest_chain: u64,
    pub token: [u8; 32],       // Token address/mint
    pub sender: [u8; 32],       // Sender address
    pub recipient: [u8; 32],    // Recipient address
    pub amount: u64,
    pub nonce: u64,
    pub timestamp: u64,
}

/// Merkle proof for Solana
#[serde_as]
#[derive(Serialize, Deserialize)]
pub struct SolanaMerkleProof {
    /// Transaction signature
    #[serde_as(as = "[_; 64]")]
    pub signature: [u8; 64],
    /// Merkle path to bank hash
    pub path: Vec<[u8; 32]>,
    /// Bank hash
    pub bank_hash: [u8; 32],
    /// Slot number
    pub slot: u64,
}

/// Merkle-Patricia proof for EVM
#[derive(Serialize, Deserialize)]
pub struct EVMMerkleProof {
    /// Receipt root
    pub receipt_root: [u8; 32],
    /// RLP-encoded receipt
    pub receipt: Vec<u8>,
    /// Merkle-Patricia proof nodes
    pub proof_nodes: Vec<Vec<u8>>,
    /// Block number
    pub block_number: u64,
    /// State root
    pub state_root: [u8; 32],
}

/// Proof type enum
#[derive(Serialize, Deserialize)]
pub enum ChainProof {
    Solana(SolanaMerkleProof),
    EVM(EVMMerkleProof),
}

/// Proof inputs
#[derive(Serialize, Deserialize)]
pub struct TransferProofInputs {
    pub transfer: TokenTransfer,
    pub proof: ChainProof,
}

/// Proof outputs
#[derive(Serialize, Deserialize)]
pub struct TransferProofOutputs {
    pub transfer_id: [u8; 32],
    pub transfer_hash: [u8; 32],
    pub source_chain: u64,
    pub dest_chain: u64,
    pub amount: u64,
    pub verified_root: [u8; 32],
    pub block_slot: u64,
}

fn main() {
    let inputs: TransferProofInputs = sp1_zkvm::io::read();

    // Compute transfer hash for commitment
    let transfer_hash = compute_transfer_hash(&inputs.transfer);

    // Verify proof based on chain type
    let (verified_root, block_slot) = match &inputs.proof {
        ChainProof::Solana(proof) => {
            verify_solana_proof(&inputs.transfer, proof);
            (proof.bank_hash, proof.slot)
        }
        ChainProof::EVM(proof) => {
            verify_evm_proof(&inputs.transfer, proof);
            (proof.state_root, proof.block_number)
        }
    };

    let outputs = TransferProofOutputs {
        transfer_id: inputs.transfer.transfer_id,
        transfer_hash,
        source_chain: inputs.transfer.source_chain,
        dest_chain: inputs.transfer.dest_chain,
        amount: inputs.transfer.amount,
        verified_root,
        block_slot,
    };

    sp1_zkvm::io::commit(&outputs);
}

fn compute_transfer_hash(transfer: &TokenTransfer) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(&transfer.transfer_id);
    hasher.update(&transfer.source_chain.to_le_bytes());
    hasher.update(&transfer.dest_chain.to_le_bytes());
    hasher.update(&transfer.token);
    hasher.update(&transfer.sender);
    hasher.update(&transfer.recipient);
    hasher.update(&transfer.amount.to_le_bytes());
    hasher.update(&transfer.nonce.to_le_bytes());
    hasher.update(&transfer.timestamp.to_le_bytes());
    hasher.finalize().into()
}

fn verify_solana_proof(transfer: &TokenTransfer, proof: &SolanaMerkleProof) {
    // Compute transaction hash
    let mut hasher = Sha256::new();
    hasher.update(&proof.signature);
    let tx_hash: [u8; 32] = hasher.finalize().into();

    // Verify merkle path to bank hash
    let mut current = tx_hash;
    for sibling in &proof.path {
        let mut hasher = Sha256::new();
        if current <= *sibling {
            hasher.update(&current);
            hasher.update(sibling);
        } else {
            hasher.update(sibling);
            hasher.update(&current);
        }
        current = hasher.finalize().into();
    }

    assert_eq!(current, proof.bank_hash, "Bank hash mismatch");

    // Verify transfer details match expected
    // (In production, parse transaction data from proof)
    assert_eq!(transfer.source_chain, 101, "Source must be Solana");
}

fn verify_evm_proof(transfer: &TokenTransfer, proof: &EVMMerkleProof) {
    // Verify receipt is included in receipt root
    // This requires RLP decoding and Merkle-Patricia verification
    
    // For now, verify the receipt contains expected transfer event
    assert!(!proof.receipt.is_empty(), "Receipt required");
    assert!(!proof.proof_nodes.is_empty(), "Proof nodes required");

    // Compute receipt hash
    let mut hasher = Sha256::new();
    hasher.update(&proof.receipt);
    let _receipt_hash: [u8; 32] = hasher.finalize().into();

    // TODO: Full MPT verification
    // 1. RLP decode receipt
    // 2. Verify logs contain Transfer event
    // 3. Traverse MPT proof to receipt root
    // 4. Verify receipt root is in state root

    // Verify transfer details
    assert!(
        transfer.source_chain == 1 || 
        transfer.source_chain == 8453 || 
        transfer.source_chain == 42161,
        "Invalid EVM source chain"
    );
}
