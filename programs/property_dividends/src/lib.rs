use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("BEyV8219psLA9Rjdb3jFGrASszbzVvCDDtdUvF85HZup");

#[program]
pub mod property_dividends {
    use super::*;

    /// Initialize a dividend pool for a tokenized property
    pub fn initialize_pool(
        ctx: Context<InitializePool>,
        property_id: String,
        distribution_frequency_days: u64,
    ) -> Result<()> {
        let pool = &mut ctx.accounts.dividend_pool;
        
        require!(property_id.len() <= 64, DividendError::PropertyIdTooLong);
        require!(distribution_frequency_days > 0, DividendError::InvalidFrequency);
        
        pool.authority = ctx.accounts.authority.key();
        pool.property_mint = ctx.accounts.property_mint.key();
        pool.dividend_vault = ctx.accounts.dividend_vault.key();
        pool.property_id = property_id;
        pool.total_distributed = 0;
        pool.current_epoch = 0;
        pool.distribution_frequency_days = distribution_frequency_days;
        pool.last_distribution_time = 0;
        pool.total_deposited_current_epoch = 0;
        pool.bump = ctx.bumps.dividend_pool;
        
        emit!(PoolInitialized {
            pool: pool.key(),
            property_mint: pool.property_mint,
            authority: pool.authority,
        });
        
        Ok(())
    }

    /// Deposit rental income/dividends into the pool (called by property manager)
    pub fn deposit_dividend(ctx: Context<DepositDividend>, amount: u64) -> Result<()> {
        require!(amount > 0, DividendError::InvalidAmount);
        
        let pool = &mut ctx.accounts.dividend_pool;
        
        // Transfer SOL from authority to vault
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.authority.to_account_info(),
                to: ctx.accounts.dividend_vault.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi_context, amount)?;
        
        pool.total_deposited_current_epoch = pool
            .total_deposited_current_epoch
            .checked_add(amount)
            .ok_or(DividendError::Overflow)?;
        
        emit!(DividendDeposited {
            pool: pool.key(),
            amount,
            epoch: pool.current_epoch,
            depositor: ctx.accounts.authority.key(),
        });
        
        Ok(())
    }

    /// Start a new distribution epoch (snapshot token holdings)
    pub fn start_distribution(ctx: Context<StartDistribution>) -> Result<()> {
        let pool = &mut ctx.accounts.dividend_pool;
        let clock = Clock::get()?;
        
        require!(
            pool.total_deposited_current_epoch > 0,
            DividendError::NoDividendsToDistribute
        );
        
        // Get total supply of property tokens
        let total_supply = ctx.accounts.property_mint.supply;
        require!(total_supply > 0, DividendError::NoTokensInCirculation);
        
        // Create distribution record
        let distribution = &mut ctx.accounts.distribution_record;
        distribution.pool = pool.key();
        distribution.epoch = pool.current_epoch;
        distribution.total_amount = pool.total_deposited_current_epoch;
        distribution.total_token_supply = total_supply;
        distribution.amount_per_token = pool
            .total_deposited_current_epoch
            .checked_div(total_supply)
            .ok_or(DividendError::Overflow)?;
        distribution.distributed_at = clock.unix_timestamp;
        distribution.total_claimed = 0;
        distribution.bump = ctx.bumps.distribution_record;
        
        // Update pool state
        pool.total_distributed = pool
            .total_distributed
            .checked_add(pool.total_deposited_current_epoch)
            .ok_or(DividendError::Overflow)?;
        pool.last_distribution_time = clock.unix_timestamp;
        pool.current_epoch = pool.current_epoch.checked_add(1).ok_or(DividendError::Overflow)?;
        pool.total_deposited_current_epoch = 0;
        
        emit!(DistributionStarted {
            pool: pool.key(),
            epoch: distribution.epoch,
            total_amount: distribution.total_amount,
            amount_per_token: distribution.amount_per_token,
        });
        
        Ok(())
    }

    /// Claim dividends for a specific epoch
    pub fn claim_dividend(ctx: Context<ClaimDividend>, epoch: u64) -> Result<()> {
        let distribution = &ctx.accounts.distribution_record;
        let claim_record = &mut ctx.accounts.claim_record;
        let pool = &ctx.accounts.dividend_pool;
        
        // Check if already claimed
        require!(!claim_record.claimed, DividendError::AlreadyClaimed);
        
        // Get user's token balance
        let user_token_balance = ctx.accounts.user_token_account.amount;
        require!(user_token_balance > 0, DividendError::NoTokensHeld);
        
        // Calculate dividend amount
        let dividend_amount = user_token_balance
            .checked_mul(distribution.amount_per_token)
            .ok_or(DividendError::Overflow)?;
        
        require!(dividend_amount > 0, DividendError::NoDividendsToClaim);
        
        // Transfer SOL from vault to user
        let pool_key = pool.key();
        let seeds = &[
            b"dividend_vault",
            pool_key.as_ref(),
            &[ctx.bumps.dividend_vault],
        ];
        let signer_seeds = &[&seeds[..]];
        
        let transfer_ix = anchor_lang::system_program::Transfer {
            from: ctx.accounts.dividend_vault.to_account_info(),
            to: ctx.accounts.user.to_account_info(),
        };
        
        anchor_lang::system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                transfer_ix,
                signer_seeds,
            ),
            dividend_amount,
        )?;
        
        // Update claim record
        claim_record.user = ctx.accounts.user.key();
        claim_record.distribution = distribution.key();
        claim_record.epoch = epoch;
        claim_record.amount_claimed = dividend_amount;
        claim_record.claimed_at = Clock::get()?.unix_timestamp;
        claim_record.claimed = true;
        claim_record.bump = ctx.bumps.claim_record;
        
        emit!(DividendClaimed {
            pool: pool.key(),
            user: ctx.accounts.user.key(),
            epoch,
            amount: dividend_amount,
        });
        
        Ok(())
    }

    /// Get claimable dividend amount for a user (view function)
    pub fn get_claimable_amount(ctx: Context<GetClaimableAmount>, epoch: u64) -> Result<u64> {
        let distribution = &ctx.accounts.distribution_record;
        let user_token_balance = ctx.accounts.user_token_account.amount;
        
        if user_token_balance == 0 {
            return Ok(0);
        }
        
        let dividend_amount = user_token_balance
            .checked_mul(distribution.amount_per_token)
            .ok_or(DividendError::Overflow)?;
        
        Ok(dividend_amount)
    }

    /// Update pool authority (transfer ownership)
    pub fn update_authority(ctx: Context<UpdateAuthority>, new_authority: Pubkey) -> Result<()> {
        let pool = &mut ctx.accounts.dividend_pool;
        
        emit!(AuthorityUpdated {
            pool: pool.key(),
            old_authority: pool.authority,
            new_authority,
        });
        
        pool.authority = new_authority;
        
        Ok(())
    }
}

// ============================================================================
// Account Structures
// ============================================================================

#[account]
#[derive(Default)]
pub struct DividendPool {
    /// Authority who can deposit dividends and manage the pool
    pub authority: Pubkey,
    /// The property token mint
    pub property_mint: Pubkey,
    /// Vault holding SOL for dividends
    pub dividend_vault: Pubkey,
    /// Property identifier
    pub property_id: String,
    /// Total SOL distributed all time
    pub total_distributed: u64,
    /// Current distribution epoch
    pub current_epoch: u64,
    /// How often dividends are distributed (in days)
    pub distribution_frequency_days: u64,
    /// Last distribution timestamp
    pub last_distribution_time: i64,
    /// SOL deposited in current epoch (not yet distributed)
    pub total_deposited_current_epoch: u64,
    /// PDA bump
    pub bump: u8,
}

#[account]
#[derive(Default)]
pub struct DistributionRecord {
    /// The dividend pool
    pub pool: Pubkey,
    /// Distribution epoch number
    pub epoch: u64,
    /// Total SOL distributed this epoch
    pub total_amount: u64,
    /// Total token supply at distribution time
    pub total_token_supply: u64,
    /// SOL amount per token
    pub amount_per_token: u64,
    /// Timestamp of distribution
    pub distributed_at: i64,
    /// Total amount claimed so far
    pub total_claimed: u64,
    /// PDA bump
    pub bump: u8,
}

#[account]
#[derive(Default)]
pub struct ClaimRecord {
    /// User who claimed
    pub user: Pubkey,
    /// Distribution record
    pub distribution: Pubkey,
    /// Epoch number
    pub epoch: u64,
    /// Amount claimed
    pub amount_claimed: u64,
    /// Claim timestamp
    pub claimed_at: i64,
    /// Whether claimed
    pub claimed: bool,
    /// PDA bump
    pub bump: u8,
}

// ============================================================================
// Contexts
// ============================================================================

#[derive(Accounts)]
#[instruction(property_id: String)]
pub struct InitializePool<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    /// The property token mint
    pub property_mint: Account<'info, Mint>,
    
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 32 + 32 + 4 + 64 + 8 + 8 + 8 + 8 + 8 + 1 + 64,
        seeds = [b"dividend_pool", property_mint.key().as_ref()],
        bump
    )]
    pub dividend_pool: Account<'info, DividendPool>,
    
    /// CHECK: PDA vault for holding SOL dividends
    #[account(
        mut,
        seeds = [b"dividend_vault", dividend_pool.key().as_ref()],
        bump
    )]
    pub dividend_vault: AccountInfo<'info>,
    
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct DepositDividend<'info> {
    #[account(
        mut,
        constraint = authority.key() == dividend_pool.authority @ DividendError::Unauthorized
    )]
    pub authority: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"dividend_pool", dividend_pool.property_mint.as_ref()],
        bump = dividend_pool.bump
    )]
    pub dividend_pool: Account<'info, DividendPool>,
    
    /// CHECK: PDA vault for holding SOL dividends
    #[account(
        mut,
        seeds = [b"dividend_vault", dividend_pool.key().as_ref()],
        bump
    )]
    pub dividend_vault: AccountInfo<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct StartDistribution<'info> {
    #[account(
        mut,
        constraint = authority.key() == dividend_pool.authority @ DividendError::Unauthorized
    )]
    pub authority: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"dividend_pool", dividend_pool.property_mint.as_ref()],
        bump = dividend_pool.bump
    )]
    pub dividend_pool: Account<'info, DividendPool>,
    
    pub property_mint: Account<'info, Mint>,
    
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 8 + 8 + 8 + 8 + 8 + 8 + 1 + 32,
        seeds = [b"distribution", dividend_pool.key().as_ref(), &dividend_pool.current_epoch.to_le_bytes()],
        bump
    )]
    pub distribution_record: Account<'info, DistributionRecord>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(epoch: u64)]
pub struct ClaimDividend<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(
        seeds = [b"dividend_pool", dividend_pool.property_mint.as_ref()],
        bump = dividend_pool.bump
    )]
    pub dividend_pool: Account<'info, DividendPool>,
    
    #[account(
        seeds = [b"distribution", dividend_pool.key().as_ref(), &epoch.to_le_bytes()],
        bump = distribution_record.bump
    )]
    pub distribution_record: Account<'info, DistributionRecord>,
    
    /// CHECK: PDA vault for holding SOL dividends
    #[account(
        mut,
        seeds = [b"dividend_vault", dividend_pool.key().as_ref()],
        bump
    )]
    pub dividend_vault: AccountInfo<'info>,
    
    /// User's property token account
    #[account(
        constraint = user_token_account.owner == user.key() @ DividendError::InvalidTokenOwner,
        constraint = user_token_account.mint == dividend_pool.property_mint @ DividendError::InvalidMint
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    
    #[account(
        init,
        payer = user,
        space = 8 + 32 + 32 + 8 + 8 + 8 + 1 + 1 + 32,
        seeds = [b"claim", distribution_record.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub claim_record: Account<'info, ClaimRecord>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(epoch: u64)]
pub struct GetClaimableAmount<'info> {
    pub user: Signer<'info>,
    
    #[account(
        seeds = [b"dividend_pool", dividend_pool.property_mint.as_ref()],
        bump = dividend_pool.bump
    )]
    pub dividend_pool: Account<'info, DividendPool>,
    
    #[account(
        seeds = [b"distribution", dividend_pool.key().as_ref(), &epoch.to_le_bytes()],
        bump = distribution_record.bump
    )]
    pub distribution_record: Account<'info, DistributionRecord>,
    
    #[account(
        constraint = user_token_account.owner == user.key() @ DividendError::InvalidTokenOwner,
        constraint = user_token_account.mint == dividend_pool.property_mint @ DividendError::InvalidMint
    )]
    pub user_token_account: Account<'info, TokenAccount>,
}

#[derive(Accounts)]
pub struct UpdateAuthority<'info> {
    #[account(
        mut,
        constraint = authority.key() == dividend_pool.authority @ DividendError::Unauthorized
    )]
    pub authority: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"dividend_pool", dividend_pool.property_mint.as_ref()],
        bump = dividend_pool.bump
    )]
    pub dividend_pool: Account<'info, DividendPool>,
}

// ============================================================================
// Events
// ============================================================================

#[event]
pub struct PoolInitialized {
    pub pool: Pubkey,
    pub property_mint: Pubkey,
    pub authority: Pubkey,
}

#[event]
pub struct DividendDeposited {
    pub pool: Pubkey,
    pub amount: u64,
    pub epoch: u64,
    pub depositor: Pubkey,
}

#[event]
pub struct DistributionStarted {
    pub pool: Pubkey,
    pub epoch: u64,
    pub total_amount: u64,
    pub amount_per_token: u64,
}

#[event]
pub struct DividendClaimed {
    pub pool: Pubkey,
    pub user: Pubkey,
    pub epoch: u64,
    pub amount: u64,
}

#[event]
pub struct AuthorityUpdated {
    pub pool: Pubkey,
    pub old_authority: Pubkey,
    pub new_authority: Pubkey,
}

// ============================================================================
// Errors
// ============================================================================

#[error_code]
pub enum DividendError {
    #[msg("You are not authorized to perform this action")]
    Unauthorized,
    #[msg("Property ID is too long (max 64 characters)")]
    PropertyIdTooLong,
    #[msg("Invalid distribution frequency")]
    InvalidFrequency,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("No dividends to distribute")]
    NoDividendsToDistribute,
    #[msg("No tokens in circulation")]
    NoTokensInCirculation,
    #[msg("Already claimed for this epoch")]
    AlreadyClaimed,
    #[msg("User holds no tokens")]
    NoTokensHeld,
    #[msg("No dividends to claim")]
    NoDividendsToClaim,
    #[msg("Invalid token account owner")]
    InvalidTokenOwner,
    #[msg("Invalid token mint")]
    InvalidMint,
}
