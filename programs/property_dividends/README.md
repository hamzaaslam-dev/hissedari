# Property Dividends Smart Contract

A Solana smart contract (Anchor program) for distributing rental income dividends to property token holders.

## Features

- **Dividend Pool Initialization**: Create a dividend pool for each tokenized property
- **Deposit Dividends**: Property managers deposit rental income into the pool
- **Distribution Epochs**: Snapshot token holdings and calculate per-token dividends
- **Claim Mechanism**: Token holders claim their proportional share of dividends
- **On-chain Tracking**: All distributions and claims are recorded on-chain

## Prerequisites

1. **Rust & Cargo**: Install from [rustup.rs](https://rustup.rs/)
2. **Solana CLI**: Install from [Solana docs](https://docs.solana.com/cli/install-solana-cli-tools)
3. **Anchor CLI**: Install with `cargo install --git https://github.com/coral-xyz/anchor anchor-cli`

## Setup

```bash
# Configure Solana for devnet
solana config set --url devnet

# Generate a keypair if you don't have one
solana-keygen new -o ~/.config/solana/id.json

# Get devnet SOL for deployment
solana airdrop 2

# Build the program
anchor build

# Get the program ID
solana address -k target/deploy/property_dividends-keypair.json
```

## Deployment

1. Update the program ID in `lib.rs` and `Anchor.toml`:

```bash
# Get your program's address
solana address -k target/deploy/property_dividends-keypair.json

# Update declare_id!() in lib.rs and [programs.devnet] in Anchor.toml
```

2. Deploy to devnet:

```bash
anchor deploy --provider.cluster devnet
```

## Program Instructions

### 1. Initialize Pool

Creates a dividend pool for a tokenized property.

```typescript
import { initializeDividendPool } from '@/lib/dividendClient';

const { signature, dividendPool } = await initializeDividendPool(
  wallet,
  propertyMintAddress,
  "property-123",
  30 // distribution frequency in days
);
```

### 2. Deposit Dividend

Property manager deposits rental income.

```typescript
import { depositDividend } from '@/lib/dividendClient';

const signature = await depositDividend(
  wallet,
  propertyMintAddress,
  1.5 // SOL amount
);
```

### 3. Start Distribution

Snapshot token holdings and start a new distribution epoch.

```typescript
import { startDistribution } from '@/lib/dividendClient';

const signature = await startDistribution(
  wallet,
  propertyMintAddress,
  currentEpoch
);
```

### 4. Claim Dividend

Token holders claim their share.

```typescript
import { claimDividend } from '@/lib/dividendClient';

const signature = await claimDividend(
  wallet,
  propertyMintAddress,
  epoch
);
```

## Account Structure

### DividendPool
- Stores pool configuration and state
- One per tokenized property
- PDA: `["dividend_pool", property_mint]`

### DistributionRecord
- Records each distribution epoch
- Stores amount per token
- PDA: `["distribution", pool, epoch]`

### ClaimRecord
- Tracks user claims
- Prevents double claiming
- PDA: `["claim", distribution, user]`

## Testing

```bash
anchor test
```

## Security Considerations

- Only the pool authority can deposit dividends
- Claims are tracked to prevent double-claiming
- All arithmetic uses checked operations to prevent overflow
- PDAs ensure account authenticity
