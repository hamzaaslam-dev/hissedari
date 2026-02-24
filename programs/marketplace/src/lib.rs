use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use anchor_spl::associated_token::AssociatedToken;

declare_id!("9wprAAKPfNu9MLzCWMh63F35fJZrmk49G45nsSpfmbEd");

#[program]
pub mod marketplace {
    use super::*;

    /// Initialize the marketplace
    pub fn initialize_marketplace(ctx: Context<InitializeMarketplace>, fee_bps: u16) -> Result<()> {
        let marketplace = &mut ctx.accounts.marketplace;
        marketplace.authority = ctx.accounts.authority.key();
        marketplace.fee_bps = fee_bps; // Platform fee in basis points (100 = 1%)
        marketplace.total_volume = 0;
        marketplace.total_listings = 0;
        marketplace.bump = ctx.bumps.marketplace;
        
        emit!(MarketplaceInitialized {
            authority: marketplace.authority,
            fee_bps,
        });
        
        Ok(())
    }

    /// Create a sell listing for property tokens
    pub fn create_listing(
        ctx: Context<CreateListing>,
        amount: u64,
        price_per_token: u64,
    ) -> Result<()> {
        require!(amount > 0, MarketplaceError::InvalidAmount);
        require!(price_per_token > 0, MarketplaceError::InvalidPrice);

        let listing = &mut ctx.accounts.listing;
        listing.seller = ctx.accounts.seller.key();
        listing.token_mint = ctx.accounts.token_mint.key();
        listing.amount = amount;
        listing.price_per_token = price_per_token;
        listing.created_at = Clock::get()?.unix_timestamp;
        listing.is_active = true;
        listing.bump = ctx.bumps.listing;

        // Transfer tokens from seller to escrow
        let transfer_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.seller_token_account.to_account_info(),
                to: ctx.accounts.escrow_token_account.to_account_info(),
                authority: ctx.accounts.seller.to_account_info(),
            },
        );
        token::transfer(transfer_ctx, amount)?;

        // Update marketplace stats
        let marketplace = &mut ctx.accounts.marketplace;
        marketplace.total_listings += 1;

        emit!(ListingCreated {
            listing: listing.key(),
            seller: listing.seller,
            token_mint: listing.token_mint,
            amount,
            price_per_token,
        });

        Ok(())
    }

    /// Buy tokens from a listing
    pub fn buy_tokens(ctx: Context<BuyTokens>, amount: u64) -> Result<()> {
        let listing = &mut ctx.accounts.listing;
        
        require!(listing.is_active, MarketplaceError::ListingNotActive);
        require!(amount > 0 && amount <= listing.amount, MarketplaceError::InvalidAmount);

        let total_price = amount
            .checked_mul(listing.price_per_token)
            .ok_or(MarketplaceError::Overflow)?;

        // Calculate platform fee
        let marketplace = &ctx.accounts.marketplace;
        let fee = total_price
            .checked_mul(marketplace.fee_bps as u64)
            .ok_or(MarketplaceError::Overflow)?
            .checked_div(10000)
            .ok_or(MarketplaceError::Overflow)?;
        
        let seller_amount = total_price.checked_sub(fee).ok_or(MarketplaceError::Overflow)?;

        // Transfer SOL from buyer to seller
        let transfer_to_seller = anchor_lang::system_program::Transfer {
            from: ctx.accounts.buyer.to_account_info(),
            to: ctx.accounts.seller.to_account_info(),
        };
        anchor_lang::system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                transfer_to_seller,
            ),
            seller_amount,
        )?;

        // Transfer fee to platform
        if fee > 0 {
            let transfer_fee = anchor_lang::system_program::Transfer {
                from: ctx.accounts.buyer.to_account_info(),
                to: ctx.accounts.platform_wallet.to_account_info(),
            };
            anchor_lang::system_program::transfer(
                CpiContext::new(
                    ctx.accounts.system_program.to_account_info(),
                    transfer_fee,
                ),
                fee,
            )?;
        }

        // Transfer tokens from escrow to buyer
        let listing_key = listing.key();
        let seeds = &[
            b"listing",
            listing.seller.as_ref(),
            listing.token_mint.as_ref(),
            &[listing.bump],
        ];
        let signer_seeds = &[&seeds[..]];

        let transfer_tokens = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.escrow_token_account.to_account_info(),
                to: ctx.accounts.buyer_token_account.to_account_info(),
                authority: listing.to_account_info(),
            },
            signer_seeds,
        );
        token::transfer(transfer_tokens, amount)?;

        // Update listing
        listing.amount = listing.amount.checked_sub(amount).ok_or(MarketplaceError::Overflow)?;
        if listing.amount == 0 {
            listing.is_active = false;
        }

        // Update marketplace volume
        let marketplace = &mut ctx.accounts.marketplace;
        marketplace.total_volume = marketplace.total_volume
            .checked_add(total_price)
            .ok_or(MarketplaceError::Overflow)?;

        emit!(TokensPurchased {
            listing: listing_key,
            buyer: ctx.accounts.buyer.key(),
            seller: listing.seller,
            amount,
            total_price,
            fee,
        });

        Ok(())
    }

    /// Cancel a listing and return tokens to seller
    pub fn cancel_listing(ctx: Context<CancelListing>) -> Result<()> {
        let listing = &mut ctx.accounts.listing;
        
        require!(listing.is_active, MarketplaceError::ListingNotActive);

        let remaining_amount = listing.amount;

        // Transfer remaining tokens back to seller
        let seeds = &[
            b"listing",
            listing.seller.as_ref(),
            listing.token_mint.as_ref(),
            &[listing.bump],
        ];
        let signer_seeds = &[&seeds[..]];

        let transfer_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.escrow_token_account.to_account_info(),
                to: ctx.accounts.seller_token_account.to_account_info(),
                authority: listing.to_account_info(),
            },
            signer_seeds,
        );
        token::transfer(transfer_ctx, remaining_amount)?;

        listing.is_active = false;
        listing.amount = 0;

        emit!(ListingCancelled {
            listing: listing.key(),
            seller: listing.seller,
            returned_amount: remaining_amount,
        });

        Ok(())
    }

    /// Update listing price
    pub fn update_listing_price(ctx: Context<UpdateListing>, new_price_per_token: u64) -> Result<()> {
        require!(new_price_per_token > 0, MarketplaceError::InvalidPrice);
        
        let listing = &mut ctx.accounts.listing;
        require!(listing.is_active, MarketplaceError::ListingNotActive);

        let old_price = listing.price_per_token;
        listing.price_per_token = new_price_per_token;

        emit!(ListingPriceUpdated {
            listing: listing.key(),
            old_price,
            new_price: new_price_per_token,
        });

        Ok(())
    }

    /// Update marketplace fee (admin only)
    pub fn update_fee(ctx: Context<UpdateMarketplace>, new_fee_bps: u16) -> Result<()> {
        require!(new_fee_bps <= 1000, MarketplaceError::FeeTooHigh); // Max 10%
        
        let marketplace = &mut ctx.accounts.marketplace;
        marketplace.fee_bps = new_fee_bps;

        Ok(())
    }
}

// ============================================================================
// Account Structures
// ============================================================================

#[account]
pub struct Marketplace {
    pub authority: Pubkey,      // Admin who can update settings
    pub fee_bps: u16,           // Platform fee in basis points
    pub total_volume: u64,      // Total trading volume in lamports
    pub total_listings: u64,    // Total number of listings created
    pub bump: u8,
}

#[account]
pub struct Listing {
    pub seller: Pubkey,         // Seller's wallet
    pub token_mint: Pubkey,     // Property token mint
    pub amount: u64,            // Number of tokens for sale
    pub price_per_token: u64,   // Price per token in lamports
    pub created_at: i64,        // Timestamp
    pub is_active: bool,        // Whether listing is active
    pub bump: u8,
}

// ============================================================================
// Contexts
// ============================================================================

#[derive(Accounts)]
pub struct InitializeMarketplace<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 2 + 8 + 8 + 1,
        seeds = [b"marketplace"],
        bump
    )]
    pub marketplace: Account<'info, Marketplace>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateListing<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"marketplace"],
        bump = marketplace.bump
    )]
    pub marketplace: Account<'info, Marketplace>,
    
    /// CHECK: Token mint for the property
    pub token_mint: AccountInfo<'info>,
    
    #[account(
        init,
        payer = seller,
        space = 8 + 32 + 32 + 8 + 8 + 8 + 1 + 1,
        seeds = [b"listing", seller.key().as_ref(), token_mint.key().as_ref()],
        bump
    )]
    pub listing: Account<'info, Listing>,
    
    #[account(
        mut,
        constraint = seller_token_account.owner == seller.key(),
        constraint = seller_token_account.mint == token_mint.key()
    )]
    pub seller_token_account: Account<'info, TokenAccount>,
    
    #[account(
        init_if_needed,
        payer = seller,
        associated_token::mint = token_mint,
        associated_token::authority = listing
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct BuyTokens<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    
    /// CHECK: Seller receives SOL
    #[account(mut)]
    pub seller: AccountInfo<'info>,
    
    /// CHECK: Platform receives fees
    #[account(mut)]
    pub platform_wallet: AccountInfo<'info>,
    
    #[account(
        mut,
        seeds = [b"marketplace"],
        bump = marketplace.bump
    )]
    pub marketplace: Account<'info, Marketplace>,
    
    /// CHECK: Token mint
    pub token_mint: AccountInfo<'info>,
    
    #[account(
        mut,
        seeds = [b"listing", listing.seller.as_ref(), token_mint.key().as_ref()],
        bump = listing.bump,
        constraint = listing.seller == seller.key() @ MarketplaceError::InvalidSeller
    )]
    pub listing: Account<'info, Listing>,
    
    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = listing
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,
    
    #[account(
        init_if_needed,
        payer = buyer,
        associated_token::mint = token_mint,
        associated_token::authority = buyer
    )]
    pub buyer_token_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CancelListing<'info> {
    #[account(
        mut,
        constraint = seller.key() == listing.seller @ MarketplaceError::Unauthorized
    )]
    pub seller: Signer<'info>,
    
    /// CHECK: Token mint
    pub token_mint: AccountInfo<'info>,
    
    #[account(
        mut,
        seeds = [b"listing", listing.seller.as_ref(), token_mint.key().as_ref()],
        bump = listing.bump
    )]
    pub listing: Account<'info, Listing>,
    
    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = listing
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        constraint = seller_token_account.owner == seller.key(),
        constraint = seller_token_account.mint == token_mint.key()
    )]
    pub seller_token_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct UpdateListing<'info> {
    #[account(
        mut,
        constraint = seller.key() == listing.seller @ MarketplaceError::Unauthorized
    )]
    pub seller: Signer<'info>,
    
    /// CHECK: Token mint
    pub token_mint: AccountInfo<'info>,
    
    #[account(
        mut,
        seeds = [b"listing", listing.seller.as_ref(), token_mint.key().as_ref()],
        bump = listing.bump
    )]
    pub listing: Account<'info, Listing>,
}

#[derive(Accounts)]
pub struct UpdateMarketplace<'info> {
    #[account(
        mut,
        constraint = authority.key() == marketplace.authority @ MarketplaceError::Unauthorized
    )]
    pub authority: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"marketplace"],
        bump = marketplace.bump
    )]
    pub marketplace: Account<'info, Marketplace>,
}

// ============================================================================
// Events
// ============================================================================

#[event]
pub struct MarketplaceInitialized {
    pub authority: Pubkey,
    pub fee_bps: u16,
}

#[event]
pub struct ListingCreated {
    pub listing: Pubkey,
    pub seller: Pubkey,
    pub token_mint: Pubkey,
    pub amount: u64,
    pub price_per_token: u64,
}

#[event]
pub struct TokensPurchased {
    pub listing: Pubkey,
    pub buyer: Pubkey,
    pub seller: Pubkey,
    pub amount: u64,
    pub total_price: u64,
    pub fee: u64,
}

#[event]
pub struct ListingCancelled {
    pub listing: Pubkey,
    pub seller: Pubkey,
    pub returned_amount: u64,
}

#[event]
pub struct ListingPriceUpdated {
    pub listing: Pubkey,
    pub old_price: u64,
    pub new_price: u64,
}

// ============================================================================
// Errors
// ============================================================================

#[error_code]
pub enum MarketplaceError {
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Invalid price")]
    InvalidPrice,
    #[msg("Listing is not active")]
    ListingNotActive,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Invalid seller")]
    InvalidSeller,
    #[msg("Fee too high (max 10%)")]
    FeeTooHigh,
}
