use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer, MintTo};

declare_id!("4Z1kEyhP41YaKoKKaEKfA6JR2kvHewjCFJH7w5iYTY3v");

#[program]
pub mod crowdfunding {
    use super::*;

    /// Initialize the platform configuration (called once by platform admin)
    pub fn initialize_platform(
        ctx: Context<InitializePlatform>,
        platform_wallet: Pubkey,
    ) -> Result<()> {
        let config = &mut ctx.accounts.platform_config;
        config.admin = ctx.accounts.admin.key();
        config.platform_wallet = platform_wallet;
        config.total_campaigns = 0;
        config.bump = ctx.bumps.platform_config;
        
        emit!(PlatformInitialized {
            admin: config.admin,
            platform_wallet: config.platform_wallet,
        });
        
        Ok(())
    }

    /// Add a wallet to the whitelist (only admin)
    pub fn add_to_whitelist(ctx: Context<ManageWhitelist>) -> Result<()> {
        let whitelist_entry = &mut ctx.accounts.whitelist_entry;
        whitelist_entry.wallet = ctx.accounts.wallet_to_whitelist.key();
        whitelist_entry.whitelisted_by = ctx.accounts.admin.key();
        whitelist_entry.whitelisted_at = Clock::get()?.unix_timestamp;
        whitelist_entry.is_active = true;
        whitelist_entry.bump = ctx.bumps.whitelist_entry;
        
        emit!(WalletWhitelisted {
            wallet: whitelist_entry.wallet,
            whitelisted_by: whitelist_entry.whitelisted_by,
        });
        
        Ok(())
    }

    /// Remove a wallet from the whitelist (only admin)
    pub fn remove_from_whitelist(ctx: Context<RemoveFromWhitelist>) -> Result<()> {
        let whitelist_entry = &mut ctx.accounts.whitelist_entry;
        whitelist_entry.is_active = false;
        
        emit!(WalletRemovedFromWhitelist {
            wallet: whitelist_entry.wallet,
        });
        
        Ok(())
    }

    /// Create a new crowdfunding campaign (only whitelisted wallets)
    pub fn create_campaign(
        ctx: Context<CreateCampaign>,
        property_id: String,
        funding_goal: u64,
        platform_equity_bps: u16, // Platform equity in basis points (100 = 1%)
        funding_deadline: i64,
        token_price: u64,
        total_tokens: u64,
    ) -> Result<()> {
        // Verify whitelist
        require!(
            ctx.accounts.whitelist_entry.is_active,
            CrowdfundingError::NotWhitelisted
        );
        
        require!(property_id.len() <= 64, CrowdfundingError::PropertyIdTooLong);
        require!(funding_goal > 0, CrowdfundingError::InvalidFundingGoal);
        require!(platform_equity_bps <= 5000, CrowdfundingError::PlatformEquityTooHigh); // Max 50%
        require!(funding_deadline > Clock::get()?.unix_timestamp, CrowdfundingError::InvalidDeadline);
        require!(token_price > 0, CrowdfundingError::InvalidTokenPrice);
        require!(total_tokens > 0, CrowdfundingError::InvalidTokenCount);
        
        let campaign = &mut ctx.accounts.campaign;
        campaign.creator = ctx.accounts.creator.key();
        campaign.property_mint = ctx.accounts.property_mint.key();
        campaign.escrow_vault = ctx.accounts.escrow_vault.key();
        campaign.property_id = property_id.clone();
        campaign.funding_goal = funding_goal;
        campaign.total_raised = 0;
        campaign.platform_equity_bps = platform_equity_bps;
        campaign.funding_deadline = funding_deadline;
        campaign.token_price = token_price;
        campaign.total_tokens = total_tokens;
        campaign.tokens_sold = 0;
        campaign.investor_count = 0;
        campaign.status = CampaignStatus::Active;
        campaign.created_at = Clock::get()?.unix_timestamp;
        campaign.bump = ctx.bumps.campaign;
        campaign.escrow_bump = ctx.bumps.escrow_vault;
        
        // Update platform stats
        let config = &mut ctx.accounts.platform_config;
        config.total_campaigns = config.total_campaigns.checked_add(1).ok_or(CrowdfundingError::Overflow)?;
        
        // Calculate tokens reserved for platform
        let platform_tokens = (total_tokens as u128)
            .checked_mul(platform_equity_bps as u128)
            .ok_or(CrowdfundingError::Overflow)?
            .checked_div(10000)
            .ok_or(CrowdfundingError::Overflow)? as u64;
        
        emit!(CampaignCreated {
            campaign: campaign.key(),
            creator: campaign.creator,
            property_id,
            funding_goal,
            platform_equity_bps,
            platform_tokens,
            tokens_available: total_tokens - platform_tokens,
            deadline: funding_deadline,
        });
        
        Ok(())
    }

    /// Invest in a campaign (any user)
    pub fn invest(ctx: Context<Invest>, amount: u64) -> Result<()> {
        let campaign = &ctx.accounts.campaign;
        let clock = Clock::get()?;
        
        // Validations
        require!(campaign.status == CampaignStatus::Active, CrowdfundingError::CampaignNotActive);
        require!(clock.unix_timestamp < campaign.funding_deadline, CrowdfundingError::CampaignExpired);
        require!(amount > 0, CrowdfundingError::InvalidAmount);
        require!(amount >= campaign.token_price, CrowdfundingError::AmountBelowMinimum);
        
        // Calculate tokens to purchase
        let tokens_to_buy = amount.checked_div(campaign.token_price).ok_or(CrowdfundingError::Overflow)?;
        
        // Calculate available tokens (excluding platform equity)
        let platform_tokens = (campaign.total_tokens as u128)
            .checked_mul(campaign.platform_equity_bps as u128)
            .ok_or(CrowdfundingError::Overflow)?
            .checked_div(10000)
            .ok_or(CrowdfundingError::Overflow)? as u64;
        let available_tokens = campaign.total_tokens
            .checked_sub(platform_tokens)
            .ok_or(CrowdfundingError::Overflow)?
            .checked_sub(campaign.tokens_sold)
            .ok_or(CrowdfundingError::Overflow)?;
        
        require!(tokens_to_buy <= available_tokens, CrowdfundingError::InsufficientTokensAvailable);
        
        // Transfer SOL to escrow
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.investor.to_account_info(),
                to: ctx.accounts.escrow_vault.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi_context, amount)?;
        
        // Update investor record
        let investor_record = &mut ctx.accounts.investor_record;
        let is_new_investor = investor_record.amount_invested == 0;
        
        investor_record.investor = ctx.accounts.investor.key();
        investor_record.campaign = campaign.key();
        investor_record.amount_invested = investor_record.amount_invested
            .checked_add(amount)
            .ok_or(CrowdfundingError::Overflow)?;
        investor_record.tokens_purchased = investor_record.tokens_purchased
            .checked_add(tokens_to_buy)
            .ok_or(CrowdfundingError::Overflow)?;
        investor_record.invested_at = clock.unix_timestamp;
        investor_record.refunded = false;
        investor_record.tokens_claimed = false;
        investor_record.bump = ctx.bumps.investor_record;
        
        // Update campaign
        let campaign = &mut ctx.accounts.campaign;
        campaign.total_raised = campaign.total_raised
            .checked_add(amount)
            .ok_or(CrowdfundingError::Overflow)?;
        campaign.tokens_sold = campaign.tokens_sold
            .checked_add(tokens_to_buy)
            .ok_or(CrowdfundingError::Overflow)?;
        
        if is_new_investor {
            campaign.investor_count = campaign.investor_count
                .checked_add(1)
                .ok_or(CrowdfundingError::Overflow)?;
        }
        
        emit!(InvestmentMade {
            campaign: campaign.key(),
            investor: ctx.accounts.investor.key(),
            amount,
            tokens_purchased: tokens_to_buy,
            total_invested: investor_record.amount_invested,
        });
        
        Ok(())
    }

    /// Finalize a successful campaign (creator only, after deadline or fully funded)
    pub fn finalize_campaign(ctx: Context<FinalizeCampaign>) -> Result<()> {
        let campaign = &ctx.accounts.campaign;
        let clock = Clock::get()?;
        
        require!(campaign.status == CampaignStatus::Active, CrowdfundingError::CampaignNotActive);
        
        // Can finalize if: fully funded OR deadline passed with some funding
        let is_fully_funded = campaign.total_raised >= campaign.funding_goal;
        let deadline_passed = clock.unix_timestamp >= campaign.funding_deadline;
        
        require!(
            is_fully_funded || (deadline_passed && campaign.total_raised > 0),
            CrowdfundingError::CannotFinalizeYet
        );
        
        // Calculate platform share
        let platform_share = (campaign.total_raised as u128)
            .checked_mul(campaign.platform_equity_bps as u128)
            .ok_or(CrowdfundingError::Overflow)?
            .checked_div(10000)
            .ok_or(CrowdfundingError::Overflow)? as u64;
        
        let creator_share = campaign.total_raised
            .checked_sub(platform_share)
            .ok_or(CrowdfundingError::Overflow)?;
        
        // Transfer to platform wallet
        if platform_share > 0 {
            let campaign_key = campaign.key();
            let seeds = &[
                b"escrow",
                campaign_key.as_ref(),
                &[campaign.escrow_bump],
            ];
            let signer_seeds = &[&seeds[..]];
            
            let transfer_to_platform = anchor_lang::system_program::Transfer {
                from: ctx.accounts.escrow_vault.to_account_info(),
                to: ctx.accounts.platform_wallet.to_account_info(),
            };
            anchor_lang::system_program::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.system_program.to_account_info(),
                    transfer_to_platform,
                    signer_seeds,
                ),
                platform_share,
            )?;
        }
        
        // Transfer to creator
        if creator_share > 0 {
            let campaign_key = campaign.key();
            let seeds = &[
                b"escrow",
                campaign_key.as_ref(),
                &[campaign.escrow_bump],
            ];
            let signer_seeds = &[&seeds[..]];
            
            let transfer_to_creator = anchor_lang::system_program::Transfer {
                from: ctx.accounts.escrow_vault.to_account_info(),
                to: ctx.accounts.creator.to_account_info(),
            };
            anchor_lang::system_program::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.system_program.to_account_info(),
                    transfer_to_creator,
                    signer_seeds,
                ),
                creator_share,
            )?;
        }
        
        // Update campaign status
        let campaign = &mut ctx.accounts.campaign;
        campaign.status = CampaignStatus::Funded;
        
        emit!(CampaignFinalized {
            campaign: campaign.key(),
            total_raised: campaign.total_raised,
            platform_share,
            creator_share,
            investors: campaign.investor_count,
        });
        
        Ok(())
    }

    /// Cancel a campaign (creator only, refunds enabled)
    pub fn cancel_campaign(ctx: Context<CancelCampaign>) -> Result<()> {
        let campaign = &mut ctx.accounts.campaign;
        
        require!(campaign.status == CampaignStatus::Active, CrowdfundingError::CampaignNotActive);
        require!(
            ctx.accounts.creator.key() == campaign.creator,
            CrowdfundingError::Unauthorized
        );
        
        campaign.status = CampaignStatus::Cancelled;
        
        emit!(CampaignCancelled {
            campaign: campaign.key(),
            total_raised: campaign.total_raised,
            investors_to_refund: campaign.investor_count,
        });
        
        Ok(())
    }

    /// Claim refund (investor only, when campaign is cancelled)
    pub fn claim_refund(ctx: Context<ClaimRefund>) -> Result<()> {
        let campaign = &ctx.accounts.campaign;
        let investor_record = &ctx.accounts.investor_record;
        
        require!(campaign.status == CampaignStatus::Cancelled, CrowdfundingError::CampaignNotCancelled);
        require!(!investor_record.refunded, CrowdfundingError::AlreadyRefunded);
        require!(investor_record.amount_invested > 0, CrowdfundingError::NothingToRefund);
        
        let refund_amount = investor_record.amount_invested;
        
        // Transfer from escrow to investor
        let campaign_key = campaign.key();
        let seeds = &[
            b"escrow",
            campaign_key.as_ref(),
            &[campaign.escrow_bump],
        ];
        let signer_seeds = &[&seeds[..]];
        
        let transfer_refund = anchor_lang::system_program::Transfer {
            from: ctx.accounts.escrow_vault.to_account_info(),
            to: ctx.accounts.investor.to_account_info(),
        };
        anchor_lang::system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                transfer_refund,
                signer_seeds,
            ),
            refund_amount,
        )?;
        
        // Mark as refunded
        let investor_record = &mut ctx.accounts.investor_record;
        investor_record.refunded = true;
        
        emit!(RefundClaimed {
            campaign: campaign.key(),
            investor: ctx.accounts.investor.key(),
            amount: refund_amount,
        });
        
        Ok(())
    }

    /// Claim property tokens (investor only, when campaign is funded)
    pub fn claim_tokens(ctx: Context<ClaimTokens>) -> Result<()> {
        let campaign = &ctx.accounts.campaign;
        let investor_record = &ctx.accounts.investor_record;
        
        require!(campaign.status == CampaignStatus::Funded, CrowdfundingError::CampaignNotFunded);
        require!(!investor_record.tokens_claimed, CrowdfundingError::TokensAlreadyClaimed);
        require!(investor_record.tokens_purchased > 0, CrowdfundingError::NoTokensToClaim);
        
        let tokens_to_mint = investor_record.tokens_purchased;
        
        // Mint tokens to investor
        let campaign_key = campaign.key();
        let seeds = &[
            b"campaign",
            campaign.property_id.as_bytes(),
            campaign.creator.as_ref(),
            &[campaign.bump],
        ];
        let signer_seeds = &[&seeds[..]];
        
        let cpi_accounts = MintTo {
            mint: ctx.accounts.property_mint.to_account_info(),
            to: ctx.accounts.investor_token_account.to_account_info(),
            authority: ctx.accounts.campaign.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        token::mint_to(
            CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds),
            tokens_to_mint,
        )?;
        
        // Mark tokens as claimed
        let investor_record = &mut ctx.accounts.investor_record;
        investor_record.tokens_claimed = true;
        
        emit!(TokensClaimed {
            campaign: campaign.key(),
            investor: ctx.accounts.investor.key(),
            tokens: tokens_to_mint,
        });
        
        Ok(())
    }

    /// Update platform wallet (admin only)
    pub fn update_platform_wallet(
        ctx: Context<UpdatePlatformConfig>,
        new_wallet: Pubkey,
    ) -> Result<()> {
        let config = &mut ctx.accounts.platform_config;
        let old_wallet = config.platform_wallet;
        config.platform_wallet = new_wallet;
        
        emit!(PlatformWalletUpdated {
            old_wallet,
            new_wallet,
        });
        
        Ok(())
    }
}

// ============================================================================
// Account Structures
// ============================================================================

#[account]
#[derive(Default)]
pub struct PlatformConfig {
    pub admin: Pubkey,
    pub platform_wallet: Pubkey,
    pub total_campaigns: u64,
    pub bump: u8,
}

#[account]
#[derive(Default)]
pub struct WhitelistEntry {
    pub wallet: Pubkey,
    pub whitelisted_by: Pubkey,
    pub whitelisted_at: i64,
    pub is_active: bool,
    pub bump: u8,
}

#[account]
#[derive(Default)]
pub struct Campaign {
    pub creator: Pubkey,
    pub property_mint: Pubkey,
    pub escrow_vault: Pubkey,
    pub property_id: String,
    pub funding_goal: u64,
    pub total_raised: u64,
    pub platform_equity_bps: u16,
    pub funding_deadline: i64,
    pub token_price: u64,
    pub total_tokens: u64,
    pub tokens_sold: u64,
    pub investor_count: u32,
    pub status: CampaignStatus,
    pub created_at: i64,
    pub bump: u8,
    pub escrow_bump: u8,
}

#[account]
#[derive(Default)]
pub struct InvestorRecord {
    pub investor: Pubkey,
    pub campaign: Pubkey,
    pub amount_invested: u64,
    pub tokens_purchased: u64,
    pub invested_at: i64,
    pub refunded: bool,
    pub tokens_claimed: bool,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Default)]
pub enum CampaignStatus {
    #[default]
    Active,
    Funded,
    Cancelled,
}

// ============================================================================
// Contexts
// ============================================================================

#[derive(Accounts)]
pub struct InitializePlatform<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    
    #[account(
        init,
        payer = admin,
        space = 8 + 32 + 32 + 8 + 1 + 32,
        seeds = [b"platform_config"],
        bump
    )]
    pub platform_config: Account<'info, PlatformConfig>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ManageWhitelist<'info> {
    #[account(
        mut,
        constraint = admin.key() == platform_config.admin @ CrowdfundingError::Unauthorized
    )]
    pub admin: Signer<'info>,
    
    #[account(
        seeds = [b"platform_config"],
        bump = platform_config.bump
    )]
    pub platform_config: Account<'info, PlatformConfig>,
    
    /// CHECK: Wallet to be whitelisted
    pub wallet_to_whitelist: AccountInfo<'info>,
    
    #[account(
        init,
        payer = admin,
        space = 8 + 32 + 32 + 8 + 1 + 1 + 32,
        seeds = [b"whitelist", wallet_to_whitelist.key().as_ref()],
        bump
    )]
    pub whitelist_entry: Account<'info, WhitelistEntry>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RemoveFromWhitelist<'info> {
    #[account(
        mut,
        constraint = admin.key() == platform_config.admin @ CrowdfundingError::Unauthorized
    )]
    pub admin: Signer<'info>,
    
    #[account(
        seeds = [b"platform_config"],
        bump = platform_config.bump
    )]
    pub platform_config: Account<'info, PlatformConfig>,
    
    #[account(
        mut,
        seeds = [b"whitelist", whitelist_entry.wallet.as_ref()],
        bump = whitelist_entry.bump
    )]
    pub whitelist_entry: Account<'info, WhitelistEntry>,
}

#[derive(Accounts)]
#[instruction(property_id: String)]
pub struct CreateCampaign<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"platform_config"],
        bump = platform_config.bump
    )]
    pub platform_config: Account<'info, PlatformConfig>,
    
    #[account(
        seeds = [b"whitelist", creator.key().as_ref()],
        bump = whitelist_entry.bump,
        constraint = whitelist_entry.is_active @ CrowdfundingError::NotWhitelisted
    )]
    pub whitelist_entry: Account<'info, WhitelistEntry>,
    
    #[account(
        init,
        payer = creator,
        space = 8 + 32 + 32 + 32 + 4 + 64 + 8 + 8 + 2 + 8 + 8 + 8 + 8 + 4 + 1 + 8 + 1 + 1 + 64,
        seeds = [b"campaign", property_id.as_bytes(), creator.key().as_ref()],
        bump
    )]
    pub campaign: Account<'info, Campaign>,
    
    /// CHECK: PDA escrow vault for holding investor funds
    #[account(
        mut,
        seeds = [b"escrow", campaign.key().as_ref()],
        bump
    )]
    pub escrow_vault: AccountInfo<'info>,
    
    /// The property token mint (campaign has mint authority)
    #[account(mut)]
    pub property_mint: Account<'info, Mint>,
    
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Invest<'info> {
    #[account(mut)]
    pub investor: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"campaign", campaign.property_id.as_bytes(), campaign.creator.as_ref()],
        bump = campaign.bump
    )]
    pub campaign: Account<'info, Campaign>,
    
    /// CHECK: PDA escrow vault
    #[account(
        mut,
        seeds = [b"escrow", campaign.key().as_ref()],
        bump = campaign.escrow_bump
    )]
    pub escrow_vault: AccountInfo<'info>,
    
    #[account(
        init_if_needed,
        payer = investor,
        space = 8 + 32 + 32 + 8 + 8 + 8 + 1 + 1 + 1 + 32,
        seeds = [b"investor", campaign.key().as_ref(), investor.key().as_ref()],
        bump
    )]
    pub investor_record: Account<'info, InvestorRecord>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FinalizeCampaign<'info> {
    #[account(
        mut,
        constraint = creator.key() == campaign.creator @ CrowdfundingError::Unauthorized
    )]
    pub creator: Signer<'info>,
    
    #[account(
        seeds = [b"platform_config"],
        bump = platform_config.bump
    )]
    pub platform_config: Account<'info, PlatformConfig>,
    
    #[account(
        mut,
        seeds = [b"campaign", campaign.property_id.as_bytes(), campaign.creator.as_ref()],
        bump = campaign.bump
    )]
    pub campaign: Account<'info, Campaign>,
    
    /// CHECK: PDA escrow vault
    #[account(
        mut,
        seeds = [b"escrow", campaign.key().as_ref()],
        bump = campaign.escrow_bump
    )]
    pub escrow_vault: AccountInfo<'info>,
    
    /// CHECK: Platform wallet to receive equity share
    #[account(
        mut,
        constraint = platform_wallet.key() == platform_config.platform_wallet @ CrowdfundingError::InvalidPlatformWallet
    )]
    pub platform_wallet: AccountInfo<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CancelCampaign<'info> {
    #[account(
        mut,
        constraint = creator.key() == campaign.creator @ CrowdfundingError::Unauthorized
    )]
    pub creator: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"campaign", campaign.property_id.as_bytes(), campaign.creator.as_ref()],
        bump = campaign.bump
    )]
    pub campaign: Account<'info, Campaign>,
}

#[derive(Accounts)]
pub struct ClaimRefund<'info> {
    #[account(mut)]
    pub investor: Signer<'info>,
    
    #[account(
        seeds = [b"campaign", campaign.property_id.as_bytes(), campaign.creator.as_ref()],
        bump = campaign.bump
    )]
    pub campaign: Account<'info, Campaign>,
    
    /// CHECK: PDA escrow vault
    #[account(
        mut,
        seeds = [b"escrow", campaign.key().as_ref()],
        bump = campaign.escrow_bump
    )]
    pub escrow_vault: AccountInfo<'info>,
    
    #[account(
        mut,
        seeds = [b"investor", campaign.key().as_ref(), investor.key().as_ref()],
        bump = investor_record.bump,
        constraint = investor_record.investor == investor.key() @ CrowdfundingError::Unauthorized
    )]
    pub investor_record: Account<'info, InvestorRecord>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClaimTokens<'info> {
    #[account(mut)]
    pub investor: Signer<'info>,
    
    #[account(
        seeds = [b"campaign", campaign.property_id.as_bytes(), campaign.creator.as_ref()],
        bump = campaign.bump
    )]
    pub campaign: Account<'info, Campaign>,
    
    #[account(
        mut,
        constraint = property_mint.key() == campaign.property_mint @ CrowdfundingError::InvalidMint
    )]
    pub property_mint: Account<'info, Mint>,
    
    #[account(
        mut,
        constraint = investor_token_account.owner == investor.key() @ CrowdfundingError::InvalidTokenOwner,
        constraint = investor_token_account.mint == property_mint.key() @ CrowdfundingError::InvalidMint
    )]
    pub investor_token_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        seeds = [b"investor", campaign.key().as_ref(), investor.key().as_ref()],
        bump = investor_record.bump,
        constraint = investor_record.investor == investor.key() @ CrowdfundingError::Unauthorized
    )]
    pub investor_record: Account<'info, InvestorRecord>,
    
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct UpdatePlatformConfig<'info> {
    #[account(
        mut,
        constraint = admin.key() == platform_config.admin @ CrowdfundingError::Unauthorized
    )]
    pub admin: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"platform_config"],
        bump = platform_config.bump
    )]
    pub platform_config: Account<'info, PlatformConfig>,
}

// ============================================================================
// Events
// ============================================================================

#[event]
pub struct PlatformInitialized {
    pub admin: Pubkey,
    pub platform_wallet: Pubkey,
}

#[event]
pub struct WalletWhitelisted {
    pub wallet: Pubkey,
    pub whitelisted_by: Pubkey,
}

#[event]
pub struct WalletRemovedFromWhitelist {
    pub wallet: Pubkey,
}

#[event]
pub struct CampaignCreated {
    pub campaign: Pubkey,
    pub creator: Pubkey,
    pub property_id: String,
    pub funding_goal: u64,
    pub platform_equity_bps: u16,
    pub platform_tokens: u64,
    pub tokens_available: u64,
    pub deadline: i64,
}

#[event]
pub struct InvestmentMade {
    pub campaign: Pubkey,
    pub investor: Pubkey,
    pub amount: u64,
    pub tokens_purchased: u64,
    pub total_invested: u64,
}

#[event]
pub struct CampaignFinalized {
    pub campaign: Pubkey,
    pub total_raised: u64,
    pub platform_share: u64,
    pub creator_share: u64,
    pub investors: u32,
}

#[event]
pub struct CampaignCancelled {
    pub campaign: Pubkey,
    pub total_raised: u64,
    pub investors_to_refund: u32,
}

#[event]
pub struct RefundClaimed {
    pub campaign: Pubkey,
    pub investor: Pubkey,
    pub amount: u64,
}

#[event]
pub struct TokensClaimed {
    pub campaign: Pubkey,
    pub investor: Pubkey,
    pub tokens: u64,
}

#[event]
pub struct PlatformWalletUpdated {
    pub old_wallet: Pubkey,
    pub new_wallet: Pubkey,
}

// ============================================================================
// Errors
// ============================================================================

#[error_code]
pub enum CrowdfundingError {
    #[msg("You are not authorized to perform this action")]
    Unauthorized,
    #[msg("Wallet is not whitelisted")]
    NotWhitelisted,
    #[msg("Property ID is too long (max 64 characters)")]
    PropertyIdTooLong,
    #[msg("Invalid funding goal")]
    InvalidFundingGoal,
    #[msg("Platform equity too high (max 50%)")]
    PlatformEquityTooHigh,
    #[msg("Invalid deadline")]
    InvalidDeadline,
    #[msg("Invalid token price")]
    InvalidTokenPrice,
    #[msg("Invalid token count")]
    InvalidTokenCount,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Campaign is not active")]
    CampaignNotActive,
    #[msg("Campaign has expired")]
    CampaignExpired,
    #[msg("Invalid investment amount")]
    InvalidAmount,
    #[msg("Amount below minimum (1 token)")]
    AmountBelowMinimum,
    #[msg("Insufficient tokens available")]
    InsufficientTokensAvailable,
    #[msg("Cannot finalize campaign yet")]
    CannotFinalizeYet,
    #[msg("Invalid platform wallet")]
    InvalidPlatformWallet,
    #[msg("Campaign is not cancelled")]
    CampaignNotCancelled,
    #[msg("Already refunded")]
    AlreadyRefunded,
    #[msg("Nothing to refund")]
    NothingToRefund,
    #[msg("Campaign is not funded")]
    CampaignNotFunded,
    #[msg("Tokens already claimed")]
    TokensAlreadyClaimed,
    #[msg("No tokens to claim")]
    NoTokensToClaim,
    #[msg("Invalid token account owner")]
    InvalidTokenOwner,
    #[msg("Invalid token mint")]
    InvalidMint,
}
