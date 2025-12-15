//! EVM Light Client on Solana
//!
//! This program verifies Ethereum consensus using ZK proofs of sync committee
//! signatures. It maintains a verified state that can be used by other programs
//! to verify EVM state proofs (account balances, storage, etc.).
//!
//! Architecture:
//! - Sync committee updates are verified via Groth16 proofs
//! - BN254 pairing precompile is used for efficient verification
//! - State includes latest block, state root, and sync committee
//!
//! Usage:
//! 1. Initialize with a trusted sync committee
//! 2. Submit periodic updates with ZK proofs
//! 3. Other programs can CPI to verify EVM state proofs

use anchor_lang::prelude::*;

declare_id!("EVMLightClient1111111111111111111111111111");

/// Maximum sync committee size (512 validators)
pub const SYNC_COMMITTEE_SIZE: usize = 512;

/// Aggregated BLS public key size (48 bytes compressed)
pub const BLS_PUBKEY_SIZE: usize = 48;

/// Groth16 proof size (256 bytes: 2x G1 + 1x G2)
pub const GROTH16_PROOF_SIZE: usize = 256;

#[program]
pub mod evm_light_client {
    use super::*;

    /// Initialize the light client with a trusted sync committee
    pub fn initialize(
        ctx: Context<Initialize>,
        genesis_slot: u64,
        genesis_block_root: [u8; 32],
        genesis_state_root: [u8; 32],
        sync_committee_root: [u8; 32],
    ) -> Result<()> {
        let state = &mut ctx.accounts.state;

        state.admin = ctx.accounts.admin.key();
        state.latest_slot = genesis_slot;
        state.latest_block_root = genesis_block_root;
        state.latest_state_root = genesis_state_root;
        state.current_sync_committee_root = sync_committee_root;
        state.next_sync_committee_root = [0u8; 32];
        state.update_count = 0;
        state.initialized = true;

        msg!("EVM Light Client initialized at slot {}", genesis_slot);

        Ok(())
    }

    /// Update the light client with a new verified state
    ///
    /// Requires a ZK proof that:
    /// 1. The sync committee signed the new block root
    /// 2. At least 2/3 of validators participated
    /// 3. The sync committee matches our stored root
    pub fn update_state(
        ctx: Context<UpdateState>,
        new_slot: u64,
        new_block_root: [u8; 32],
        new_state_root: [u8; 32],
        new_sync_committee_root: Option<[u8; 32]>,
        proof: [u8; GROTH16_PROOF_SIZE],
        public_inputs: Vec<u8>,
    ) -> Result<()> {
        let state = &mut ctx.accounts.state;

        require!(state.initialized, ErrorCode::NotInitialized);
        require!(new_slot > state.latest_slot, ErrorCode::SlotNotAdvanced);

        // Verify the ZK proof using BN254 precompile
        verify_groth16_proof(&proof, &public_inputs, &state.current_sync_committee_root)?;

        // Validate public inputs encode the expected values
        validate_public_inputs(
            &public_inputs,
            state.latest_slot,
            &state.latest_block_root,
            new_slot,
            &new_block_root,
            &state.current_sync_committee_root,
        )?;

        // Update state
        state.latest_slot = new_slot;
        state.latest_block_root = new_block_root;
        state.latest_state_root = new_state_root;
        state.update_count += 1;

        // Handle sync committee rotation (every ~27 hours)
        if let Some(next_root) = new_sync_committee_root {
            if state.next_sync_committee_root != [0u8; 32] {
                // Rotate: next becomes current
                state.current_sync_committee_root = state.next_sync_committee_root;
            }
            state.next_sync_committee_root = next_root;
        }

        msg!("EVM Light Client updated to slot {}", new_slot);

        Ok(())
    }

    /// Verify an EVM account proof against the current state
    ///
    /// This is a CPI-friendly function that other programs can call
    /// to verify EVM state proofs.
    pub fn verify_account_proof(
        ctx: Context<VerifyProof>,
        account: [u8; 20],      // EVM address
        storage_slot: [u8; 32], // Storage key
        expected_value: [u8; 32],
        proof: Vec<[u8; 32]>,   // Merkle-Patricia proof nodes
    ) -> Result<bool> {
        let state = &ctx.accounts.state;

        require!(state.initialized, ErrorCode::NotInitialized);

        // Verify the Merkle-Patricia proof against state root
        let valid = verify_merkle_patricia_proof(
            &account,
            &storage_slot,
            &expected_value,
            &proof,
            &state.latest_state_root,
        )?;

        Ok(valid)
    }

    /// Get the latest verified state (for cross-program queries)
    pub fn get_latest_state(ctx: Context<GetState>) -> Result<LatestState> {
        let state = &ctx.accounts.state;

        Ok(LatestState {
            slot: state.latest_slot,
            block_root: state.latest_block_root,
            state_root: state.latest_state_root,
            sync_committee_root: state.current_sync_committee_root,
        })
    }
}

// =============================================================================
// ACCOUNTS
// =============================================================================

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + LightClientState::INIT_SPACE,
        seeds = [b"evm_light_client"],
        bump
    )]
    pub state: Account<'info, LightClientState>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateState<'info> {
    #[account(
        mut,
        seeds = [b"evm_light_client"],
        bump
    )]
    pub state: Account<'info, LightClientState>,

    pub relayer: Signer<'info>,
}

#[derive(Accounts)]
pub struct VerifyProof<'info> {
    #[account(
        seeds = [b"evm_light_client"],
        bump
    )]
    pub state: Account<'info, LightClientState>,
}

#[derive(Accounts)]
pub struct GetState<'info> {
    #[account(
        seeds = [b"evm_light_client"],
        bump
    )]
    pub state: Account<'info, LightClientState>,
}

// =============================================================================
// STATE
// =============================================================================

#[account]
#[derive(InitSpace)]
pub struct LightClientState {
    /// Admin who can update configuration
    pub admin: Pubkey,

    /// Latest verified beacon slot
    pub latest_slot: u64,

    /// Latest verified beacon block root
    pub latest_block_root: [u8; 32],

    /// Latest verified execution state root (for account proofs)
    pub latest_state_root: [u8; 32],

    /// Current sync committee root (for signature verification)
    pub current_sync_committee_root: [u8; 32],

    /// Next sync committee root (for rotation)
    pub next_sync_committee_root: [u8; 32],

    /// Number of successful updates
    pub update_count: u64,

    /// Whether the light client is initialized
    pub initialized: bool,
}

// =============================================================================
// RETURN TYPES
// =============================================================================

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct LatestState {
    pub slot: u64,
    pub block_root: [u8; 32],
    pub state_root: [u8; 32],
    pub sync_committee_root: [u8; 32],
}

// =============================================================================
// ERRORS
// =============================================================================

#[error_code]
pub enum ErrorCode {
    #[msg("Light client not initialized")]
    NotInitialized,

    #[msg("New slot must be greater than current slot")]
    SlotNotAdvanced,

    #[msg("Invalid Groth16 proof")]
    InvalidProof,

    #[msg("Public inputs do not match expected values")]
    PublicInputsMismatch,

    #[msg("Merkle proof verification failed")]
    MerkleProofFailed,

    #[msg("Sync committee mismatch")]
    SyncCommitteeMismatch,
}

// =============================================================================
// VERIFICATION HELPERS
// =============================================================================

/// Verify a Groth16 proof using Solana's BN254 precompiles
fn verify_groth16_proof(
    proof: &[u8; GROTH16_PROOF_SIZE],
    public_inputs: &[u8],
    _sync_committee_root: &[u8; 32],
) -> Result<()> {
    // In production, this would:
    // 1. Deserialize proof into G1 and G2 points
    // 2. Deserialize public inputs
    // 3. Call alt_bn128_pairing precompile for verification
    //
    // For now, we simulate the verification
    // The actual implementation requires proper BN254 curve operations

    // Validate proof structure
    if proof.len() != GROTH16_PROOF_SIZE {
        return Err(ErrorCode::InvalidProof.into());
    }

    // Validate public inputs are non-empty
    if public_inputs.is_empty() {
        return Err(ErrorCode::PublicInputsMismatch.into());
    }

    // TODO: Implement actual BN254 pairing check
    // This is a placeholder that accepts all proofs in development
    msg!("Groth16 proof verification (simulated)");

    Ok(())
}

/// Validate that public inputs encode the expected state transition
fn validate_public_inputs(
    public_inputs: &[u8],
    prev_slot: u64,
    prev_block_root: &[u8; 32],
    new_slot: u64,
    new_block_root: &[u8; 32],
    sync_committee_root: &[u8; 32],
) -> Result<()> {
    // Public inputs layout:
    // [0-7]   prev_slot (u64 le)
    // [8-39]  prev_block_root
    // [40-47] new_slot (u64 le)
    // [48-79] new_block_root
    // [80-111] sync_committee_root

    if public_inputs.len() < 112 {
        return Err(ErrorCode::PublicInputsMismatch.into());
    }

    let input_prev_slot = u64::from_le_bytes(public_inputs[0..8].try_into().unwrap());
    let input_prev_root: [u8; 32] = public_inputs[8..40].try_into().unwrap();
    let input_new_slot = u64::from_le_bytes(public_inputs[40..48].try_into().unwrap());
    let input_new_root: [u8; 32] = public_inputs[48..80].try_into().unwrap();
    let input_committee_root: [u8; 32] = public_inputs[80..112].try_into().unwrap();

    if input_prev_slot != prev_slot {
        msg!("Previous slot mismatch: {} != {}", input_prev_slot, prev_slot);
        return Err(ErrorCode::PublicInputsMismatch.into());
    }

    if input_prev_root != *prev_block_root {
        msg!("Previous block root mismatch");
        return Err(ErrorCode::PublicInputsMismatch.into());
    }

    if input_new_slot != new_slot {
        msg!("New slot mismatch: {} != {}", input_new_slot, new_slot);
        return Err(ErrorCode::PublicInputsMismatch.into());
    }

    if input_new_root != *new_block_root {
        msg!("New block root mismatch");
        return Err(ErrorCode::PublicInputsMismatch.into());
    }

    if input_committee_root != *sync_committee_root {
        msg!("Sync committee root mismatch");
        return Err(ErrorCode::SyncCommitteeMismatch.into());
    }

    Ok(())
}

/// Verify a Merkle-Patricia proof for an EVM account/storage
fn verify_merkle_patricia_proof(
    _account: &[u8; 20],
    _storage_slot: &[u8; 32],
    _expected_value: &[u8; 32],
    _proof: &[[u8; 32]],
    _state_root: &[u8; 32],
) -> Result<bool> {
    // TODO: Implement full Merkle-Patricia trie verification
    // This requires:
    // 1. Keccak256 hashing of account address
    // 2. RLP decoding of proof nodes
    // 3. Path traversal through the trie
    // 4. Value extraction and comparison

    msg!("Merkle-Patricia proof verification (simulated)");

    Ok(true)
}
