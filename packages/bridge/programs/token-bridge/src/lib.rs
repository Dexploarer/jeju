//! Cross-Chain Token Bridge
//!
//! This program handles token transfers between Solana and EVM chains.
//! It integrates with the EVM Light Client to verify incoming transfers.
//!
//! Transfer Flows:
//!
//! Solana → EVM:
//! 1. User calls initiate_transfer, tokens are locked/burned
//! 2. Event is emitted with transfer details
//! 3. Relayer observes and submits to EVM bridge
//! 4. EVM bridge (with Solana light client) verifies and releases tokens
//!
//! EVM → Solana:
//! 1. User calls EVM bridge, tokens are locked/burned
//! 2. Relayer generates ZK proof of EVM state
//! 3. Relayer calls complete_transfer with proof
//! 4. This program verifies via EVM light client CPI
//! 5. Tokens are minted/unlocked to recipient

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer, MintTo, Burn};

declare_id!("TokenBridge11111111111111111111111111111111");

/// Maximum payload size for cross-chain messages
pub const MAX_PAYLOAD_SIZE: usize = 1024;

/// Groth16 proof size
pub const GROTH16_PROOF_SIZE: usize = 256;

#[program]
pub mod token_bridge {
    use super::*;

    /// Initialize the bridge with configuration
    pub fn initialize(
        ctx: Context<Initialize>,
        evm_chain_id: u64,
    ) -> Result<()> {
        let state = &mut ctx.accounts.state;

        state.admin = ctx.accounts.admin.key();
        state.evm_light_client = ctx.accounts.evm_light_client.key();
        state.evm_chain_id = evm_chain_id;
        state.transfer_nonce = 0;
        state.total_locked = 0;
        state.paused = false;

        msg!("Token Bridge initialized for EVM chain {}", evm_chain_id);

        Ok(())
    }

    /// Register a token for bridging
    pub fn register_token(
        ctx: Context<RegisterToken>,
        evm_token: [u8; 20],
        is_native_on_solana: bool,
    ) -> Result<()> {
        let token_config = &mut ctx.accounts.token_config;

        token_config.mint = ctx.accounts.mint.key();
        token_config.evm_token = evm_token;
        token_config.is_native_on_solana = is_native_on_solana;
        token_config.total_bridged = 0;
        token_config.enabled = true;

        msg!("Token registered: {} <-> 0x{}", 
            ctx.accounts.mint.key(),
            hex::encode(evm_token)
        );

        Ok(())
    }

    /// Initiate a transfer from Solana to EVM
    pub fn initiate_transfer(
        ctx: Context<InitiateTransfer>,
        evm_recipient: [u8; 20],
        amount: u64,
        payload: Vec<u8>,
    ) -> Result<()> {
        let state = &mut ctx.accounts.state;
        let token_config = &ctx.accounts.token_config;

        require!(!state.paused, ErrorCode::BridgePaused);
        require!(token_config.enabled, ErrorCode::TokenNotEnabled);
        require!(amount > 0, ErrorCode::ZeroAmount);
        require!(payload.len() <= MAX_PAYLOAD_SIZE, ErrorCode::PayloadTooLarge);

        // Generate transfer ID
        state.transfer_nonce += 1;
        let transfer_id = generate_transfer_id(
            &ctx.accounts.sender.key(),
            &evm_recipient,
            amount,
            state.transfer_nonce,
        );

        // Lock or burn tokens
        if token_config.is_native_on_solana {
            // Lock tokens in bridge vault
            let cpi_accounts = Transfer {
                from: ctx.accounts.sender_token_account.to_account_info(),
                to: ctx.accounts.bridge_vault.to_account_info(),
                authority: ctx.accounts.sender.to_account_info(),
            };
            let cpi_ctx = CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                cpi_accounts,
            );
            token::transfer(cpi_ctx, amount)?;

            state.total_locked += amount;
        } else {
            // Burn wrapped tokens
            let cpi_accounts = Burn {
                mint: ctx.accounts.mint.to_account_info(),
                from: ctx.accounts.sender_token_account.to_account_info(),
                authority: ctx.accounts.sender.to_account_info(),
            };
            let cpi_ctx = CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                cpi_accounts,
            );
            token::burn(cpi_ctx, amount)?;
        }

        // Create transfer record
        let transfer_record = &mut ctx.accounts.transfer_record;
        transfer_record.transfer_id = transfer_id;
        transfer_record.sender = ctx.accounts.sender.key();
        transfer_record.evm_recipient = evm_recipient;
        transfer_record.mint = ctx.accounts.mint.key();
        transfer_record.amount = amount;
        transfer_record.nonce = state.transfer_nonce;
        transfer_record.timestamp = Clock::get()?.unix_timestamp;
        transfer_record.status = TransferStatus::Pending;
        transfer_record.payload = payload.clone();

        // Emit event for relayers
        emit!(TransferInitiated {
            transfer_id,
            sender: ctx.accounts.sender.key(),
            evm_recipient,
            mint: ctx.accounts.mint.key(),
            amount,
            nonce: state.transfer_nonce,
            payload,
        });

        msg!("Transfer initiated: {} tokens to 0x{}", 
            amount,
            hex::encode(evm_recipient)
        );

        Ok(())
    }

    /// Complete a transfer from EVM to Solana
    pub fn complete_transfer(
        ctx: Context<CompleteTransfer>,
        transfer_id: [u8; 32],
        evm_sender: [u8; 20],
        amount: u64,
        evm_block_number: u64,
        proof: [u8; GROTH16_PROOF_SIZE],
        public_inputs: Vec<u8>,
    ) -> Result<()> {
        let state = &ctx.accounts.state;
        let token_config = &ctx.accounts.token_config;

        require!(!state.paused, ErrorCode::BridgePaused);
        require!(token_config.enabled, ErrorCode::TokenNotEnabled);

        // Verify the transfer hasn't been processed
        let completion_record = &ctx.accounts.completion_record;
        require!(!completion_record.completed, ErrorCode::TransferAlreadyCompleted);

        // Verify the ZK proof via EVM light client CPI
        // This proves the transfer was included in a verified EVM block
        verify_evm_transfer(
            &ctx.accounts.evm_light_client,
            &transfer_id,
            &evm_sender,
            &ctx.accounts.recipient.key().to_bytes(),
            amount,
            evm_block_number,
            &proof,
            &public_inputs,
        )?;

        // Mint or unlock tokens
        if token_config.is_native_on_solana {
            // Unlock from bridge vault
            let seeds = &[
                b"bridge_state".as_ref(),
                &[ctx.bumps.state],
            ];
            let signer = &[&seeds[..]];

            let cpi_accounts = Transfer {
                from: ctx.accounts.bridge_vault.to_account_info(),
                to: ctx.accounts.recipient_token_account.to_account_info(),
                authority: ctx.accounts.state.to_account_info(),
            };
            let cpi_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                cpi_accounts,
                signer,
            );
            token::transfer(cpi_ctx, amount)?;
        } else {
            // Mint wrapped tokens
            let seeds = &[
                b"bridge_state".as_ref(),
                &[ctx.bumps.state],
            ];
            let signer = &[&seeds[..]];

            let cpi_accounts = MintTo {
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.recipient_token_account.to_account_info(),
                authority: ctx.accounts.state.to_account_info(),
            };
            let cpi_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                cpi_accounts,
                signer,
            );
            token::mint_to(cpi_ctx, amount)?;
        }

        // Mark as completed
        let completion_record = &mut ctx.accounts.completion_record;
        completion_record.transfer_id = transfer_id;
        completion_record.completed = true;
        completion_record.completed_at = Clock::get()?.unix_timestamp;

        emit!(TransferCompleted {
            transfer_id,
            evm_sender,
            recipient: ctx.accounts.recipient.key(),
            mint: ctx.accounts.mint.key(),
            amount,
            evm_block_number,
        });

        msg!("Transfer completed: {} tokens from 0x{}", 
            amount,
            hex::encode(evm_sender)
        );

        Ok(())
    }

    /// Pause the bridge (admin only)
    pub fn pause(ctx: Context<AdminAction>) -> Result<()> {
        let state = &mut ctx.accounts.state;
        require!(ctx.accounts.admin.key() == state.admin, ErrorCode::Unauthorized);
        state.paused = true;
        msg!("Bridge paused");
        Ok(())
    }

    /// Unpause the bridge (admin only)
    pub fn unpause(ctx: Context<AdminAction>) -> Result<()> {
        let state = &mut ctx.accounts.state;
        require!(ctx.accounts.admin.key() == state.admin, ErrorCode::Unauthorized);
        state.paused = false;
        msg!("Bridge unpaused");
        Ok(())
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
        space = 8 + BridgeState::INIT_SPACE,
        seeds = [b"bridge_state"],
        bump
    )]
    pub state: Account<'info, BridgeState>,

    /// CHECK: EVM light client program account
    pub evm_light_client: AccountInfo<'info>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RegisterToken<'info> {
    #[account(
        seeds = [b"bridge_state"],
        bump
    )]
    pub state: Account<'info, BridgeState>,

    #[account(
        init,
        payer = admin,
        space = 8 + TokenConfig::INIT_SPACE,
        seeds = [b"token_config", mint.key().as_ref()],
        bump
    )]
    pub token_config: Account<'info, TokenConfig>,

    pub mint: Account<'info, Mint>,

    #[account(mut, constraint = admin.key() == state.admin @ ErrorCode::Unauthorized)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitiateTransfer<'info> {
    #[account(
        mut,
        seeds = [b"bridge_state"],
        bump
    )]
    pub state: Account<'info, BridgeState>,

    #[account(
        seeds = [b"token_config", mint.key().as_ref()],
        bump
    )]
    pub token_config: Account<'info, TokenConfig>,

    #[account(
        init,
        payer = sender,
        space = 8 + TransferRecord::INIT_SPACE,
        seeds = [b"transfer", &state.transfer_nonce.to_le_bytes()],
        bump
    )]
    pub transfer_record: Account<'info, TransferRecord>,

    #[account(mut)]
    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [b"bridge_vault", mint.key().as_ref()],
        bump
    )]
    pub bridge_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub sender_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub sender: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(transfer_id: [u8; 32])]
pub struct CompleteTransfer<'info> {
    #[account(
        seeds = [b"bridge_state"],
        bump
    )]
    pub state: Account<'info, BridgeState>,

    #[account(
        seeds = [b"token_config", mint.key().as_ref()],
        bump
    )]
    pub token_config: Account<'info, TokenConfig>,

    #[account(
        init,
        payer = relayer,
        space = 8 + CompletionRecord::INIT_SPACE,
        seeds = [b"completion", &transfer_id],
        bump
    )]
    pub completion_record: Account<'info, CompletionRecord>,

    /// CHECK: EVM light client state account for verification
    pub evm_light_client: AccountInfo<'info>,

    #[account(mut)]
    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [b"bridge_vault", mint.key().as_ref()],
        bump
    )]
    pub bridge_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub recipient_token_account: Account<'info, TokenAccount>,

    /// CHECK: Recipient of the tokens
    pub recipient: AccountInfo<'info>,

    #[account(mut)]
    pub relayer: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AdminAction<'info> {
    #[account(mut, seeds = [b"bridge_state"], bump)]
    pub state: Account<'info, BridgeState>,

    pub admin: Signer<'info>,
}

// =============================================================================
// STATE
// =============================================================================

#[account]
#[derive(InitSpace)]
pub struct BridgeState {
    pub admin: Pubkey,
    pub evm_light_client: Pubkey,
    pub evm_chain_id: u64,
    pub transfer_nonce: u64,
    pub total_locked: u64,
    pub paused: bool,
}

#[account]
#[derive(InitSpace)]
pub struct TokenConfig {
    pub mint: Pubkey,
    pub evm_token: [u8; 20],
    pub is_native_on_solana: bool,
    pub total_bridged: u64,
    pub enabled: bool,
}

#[account]
#[derive(InitSpace)]
pub struct TransferRecord {
    pub transfer_id: [u8; 32],
    pub sender: Pubkey,
    pub evm_recipient: [u8; 20],
    pub mint: Pubkey,
    pub amount: u64,
    pub nonce: u64,
    pub timestamp: i64,
    pub status: TransferStatus,
    #[max_len(1024)]
    pub payload: Vec<u8>,
}

#[account]
#[derive(InitSpace)]
pub struct CompletionRecord {
    pub transfer_id: [u8; 32],
    pub completed: bool,
    pub completed_at: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum TransferStatus {
    Pending,
    Completed,
    Failed,
}

// =============================================================================
// EVENTS
// =============================================================================

#[event]
pub struct TransferInitiated {
    pub transfer_id: [u8; 32],
    pub sender: Pubkey,
    pub evm_recipient: [u8; 20],
    pub mint: Pubkey,
    pub amount: u64,
    pub nonce: u64,
    pub payload: Vec<u8>,
}

#[event]
pub struct TransferCompleted {
    pub transfer_id: [u8; 32],
    pub evm_sender: [u8; 20],
    pub recipient: Pubkey,
    pub mint: Pubkey,
    pub amount: u64,
    pub evm_block_number: u64,
}

// =============================================================================
// ERRORS
// =============================================================================

#[error_code]
pub enum ErrorCode {
    #[msg("Bridge is paused")]
    BridgePaused,

    #[msg("Token not enabled for bridging")]
    TokenNotEnabled,

    #[msg("Transfer amount cannot be zero")]
    ZeroAmount,

    #[msg("Payload exceeds maximum size")]
    PayloadTooLarge,

    #[msg("Transfer already completed")]
    TransferAlreadyCompleted,

    #[msg("Unauthorized")]
    Unauthorized,

    #[msg("EVM proof verification failed")]
    EVMProofFailed,
}

// =============================================================================
// HELPERS
// =============================================================================

fn generate_transfer_id(
    sender: &Pubkey,
    evm_recipient: &[u8; 20],
    amount: u64,
    nonce: u64,
) -> [u8; 32] {
    let mut data = Vec::new();
    data.extend_from_slice(sender.as_ref());
    data.extend_from_slice(evm_recipient);
    data.extend_from_slice(&amount.to_le_bytes());
    data.extend_from_slice(&nonce.to_le_bytes());

    // Simple hash (in production, use proper hash)
    let mut result = [0u8; 32];
    for (i, byte) in data.iter().enumerate() {
        result[i % 32] ^= byte;
    }
    result
}

fn verify_evm_transfer(
    _evm_light_client: &AccountInfo,
    _transfer_id: &[u8; 32],
    _evm_sender: &[u8; 20],
    _recipient: &[u8; 32],
    _amount: u64,
    _evm_block_number: u64,
    _proof: &[u8; GROTH16_PROOF_SIZE],
    _public_inputs: &[u8],
) -> Result<()> {
    // TODO: CPI to EVM light client to verify proof
    // This would:
    // 1. Verify the ZK proof matches the claimed transfer
    // 2. Verify the block number is included in the light client
    // 3. Verify the state root matches

    msg!("EVM transfer verification (simulated)");
    Ok(())
}

// Hex encoding helper
mod hex {
    pub fn encode(bytes: &[u8]) -> String {
        bytes.iter().map(|b| format!("{:02x}", b)).collect()
    }
}
