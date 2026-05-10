import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import { connection, SOLANA_NETWORK } from "./solana";
import { u64LE, i64LE } from "./binaryUtils";

// Program ID - Update this after deploying the contract
export const CROWDFUNDING_PROGRAM_ID = new PublicKey(
  "2ghvWvTvMHdACLuGztbjERbvMPwwQcFTag6a6eU7RifY"
);

// ============================================================================
// Types
// ============================================================================

export enum CampaignStatus {
  Active = "active",
  Funded = "funded",
  Cancelled = "cancelled",
}

export interface PlatformConfig {
  admin: PublicKey;
  platformWallet: PublicKey;
  totalCampaigns: number;
}

export interface WhitelistEntry {
  wallet: PublicKey;
  whitelistedBy: PublicKey;
  whitelistedAt: number;
  isActive: boolean;
}

export interface Campaign {
  creator: PublicKey;
  propertyMint: PublicKey;
  escrowVault: PublicKey;
  propertyId: string;
  fundingGoal: number;
  totalRaised: number;
  platformEquityBps: number;
  fundingDeadline: number;
  tokenPrice: number;
  totalTokens: number;
  tokensSold: number;
  investorCount: number;
  status: CampaignStatus;
  createdAt: number;
}

export interface InvestorRecord {
  investor: PublicKey;
  campaign: PublicKey;
  amountInvested: number;
  tokensPurchased: number;
  investedAt: number;
  refunded: boolean;
  tokensClaimed: boolean;
}

export interface WalletAdapter {
  publicKey: PublicKey;
  signTransaction: (tx: Transaction) => Promise<Transaction>;
}

// ============================================================================
// PDA Derivation Functions
// ============================================================================

export function getPlatformConfigPDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("platform_config")],
    CROWDFUNDING_PROGRAM_ID
  );
}

export function getWhitelistEntryPDA(wallet: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("whitelist"), wallet.toBuffer()],
    CROWDFUNDING_PROGRAM_ID
  );
}

export function getCampaignPDA(
  propertyId: string,
  creator: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("campaign"), Buffer.from(propertyId), creator.toBuffer()],
    CROWDFUNDING_PROGRAM_ID
  );
}

export function getEscrowVaultPDA(campaign: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("escrow"), campaign.toBuffer()],
    CROWDFUNDING_PROGRAM_ID
  );
}

export function getInvestorRecordPDA(
  campaign: PublicKey,
  investor: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("investor"), campaign.toBuffer(), investor.toBuffer()],
    CROWDFUNDING_PROGRAM_ID
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

export function calculatePlatformEquity(
  totalTokens: number,
  platformEquityBps: number
): number {
  return Math.floor((totalTokens * platformEquityBps) / 10000);
}

export function calculateAvailableTokens(
  totalTokens: number,
  platformEquityBps: number,
  tokensSold: number
): number {
  const platformTokens = calculatePlatformEquity(totalTokens, platformEquityBps);
  return totalTokens - platformTokens - tokensSold;
}

export function bpsToPercent(bps: number): number {
  return bps / 100;
}

export function percentToBps(percent: number): number {
  return Math.floor(percent * 100);
}

// ============================================================================
// Instruction Builders
// ============================================================================

export async function initializePlatformInstruction(
  admin: PublicKey,
  platformWallet: PublicKey
): Promise<Transaction> {
  const [platformConfig] = getPlatformConfigPDA();

  // initialize_platform: SHA256("global:initialize_platform")[0..8]
  const discriminator = Buffer.from([
    0x77, 0xc9, 0x65, 0x2d, 0x4b, 0x7a, 0x59, 0x03,
  ]);

  const data = Buffer.concat([discriminator, platformWallet.toBuffer()]);

  const keys = [
    { pubkey: admin, isSigner: true, isWritable: true },
    { pubkey: platformConfig, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  return new Transaction().add({
    keys,
    programId: CROWDFUNDING_PROGRAM_ID,
    data,
  });
}

export async function addToWhitelistInstruction(
  admin: PublicKey,
  walletToWhitelist: PublicKey
): Promise<Transaction> {
  const [platformConfig] = getPlatformConfigPDA();
  const [whitelistEntry] = getWhitelistEntryPDA(walletToWhitelist);

  // sha256("global:add_to_whitelist")[0..8]
  const discriminator = Buffer.from([
    0x9d, 0xd3, 0x34, 0x36, 0x90, 0x51, 0x05, 0x37,
  ]);

  const keys = [
    { pubkey: admin, isSigner: true, isWritable: true },
    { pubkey: platformConfig, isSigner: false, isWritable: false },
    { pubkey: walletToWhitelist, isSigner: false, isWritable: false },
    { pubkey: whitelistEntry, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  return new Transaction().add({
    keys,
    programId: CROWDFUNDING_PROGRAM_ID,
    data: discriminator,
  });
}

export async function createCampaignInstruction(
  creator: PublicKey,
  propertyMint: PublicKey,
  propertyId: string,
  fundingGoal: number,
  platformEquityBps: number,
  fundingDeadline: number,
  tokenPrice: number,
  totalTokens: number
): Promise<{ transaction: Transaction; campaign: PublicKey }> {
  const [platformConfig] = getPlatformConfigPDA();
  const [whitelistEntry] = getWhitelistEntryPDA(creator);
  const [campaign] = getCampaignPDA(propertyId, creator);
  const [escrowVault] = getEscrowVaultPDA(campaign);

  // create_campaign: SHA256("global:create_campaign")[0..8]
  const discriminator = Buffer.from([
    0x6f, 0x83, 0xbb, 0x62, 0xa0, 0xc1, 0x72, 0xf4,
  ]);

  const propertyIdBuffer = Buffer.from(propertyId);
  const propertyIdLenBuffer = Buffer.alloc(4);
  propertyIdLenBuffer.writeUInt32LE(propertyIdBuffer.length);

  const fundingGoalBuffer = u64LE(fundingGoal);

  const platformEquityBpsBuffer = Buffer.alloc(2);
  platformEquityBpsBuffer.writeUInt16LE(platformEquityBps);

  const deadlineBuffer = i64LE(fundingDeadline);

  const tokenPriceBuffer = u64LE(tokenPrice);

  const totalTokensBuffer = u64LE(totalTokens);

  const data = Buffer.concat([
    discriminator,
    propertyIdLenBuffer,
    propertyIdBuffer,
    fundingGoalBuffer,
    platformEquityBpsBuffer,
    deadlineBuffer,
    tokenPriceBuffer,
    totalTokensBuffer,
  ]);

  const keys = [
    { pubkey: creator, isSigner: true, isWritable: true },
    { pubkey: platformConfig, isSigner: false, isWritable: true },
    { pubkey: whitelistEntry, isSigner: false, isWritable: false },
    { pubkey: campaign, isSigner: false, isWritable: true },
    { pubkey: escrowVault, isSigner: false, isWritable: true },
    { pubkey: propertyMint, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: new PublicKey("SysvarRent111111111111111111111111111111111"), isSigner: false, isWritable: false },
  ];

  const transaction = new Transaction().add({
    keys,
    programId: CROWDFUNDING_PROGRAM_ID,
    data,
  });

  return { transaction, campaign };
}

export async function investInstruction(
  investor: PublicKey,
  campaign: PublicKey,
  propertyId: string,
  creator: PublicKey,
  amountLamports: number
): Promise<Transaction> {
  const [escrowVault] = getEscrowVaultPDA(campaign);
  const [investorRecord] = getInvestorRecordPDA(campaign, investor);

  // invest: SHA256("global:invest")[0..8]
  const discriminator = Buffer.from([
    0x0d, 0xf5, 0xb4, 0x67, 0xfe, 0xb6, 0x79, 0x04,
  ]);

  const amountBuffer = u64LE(amountLamports);

  const data = Buffer.concat([discriminator, amountBuffer]);

  const keys = [
    { pubkey: investor, isSigner: true, isWritable: true },
    { pubkey: campaign, isSigner: false, isWritable: true },
    { pubkey: escrowVault, isSigner: false, isWritable: true },
    { pubkey: investorRecord, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  return new Transaction().add({
    keys,
    programId: CROWDFUNDING_PROGRAM_ID,
    data,
  });
}

export async function cancelCampaignInstruction(
  creator: PublicKey,
  campaign: PublicKey,
  propertyId: string
): Promise<Transaction> {
  // cancel_campaign: SHA256("global:cancel_campaign")[0..8]
  const discriminator = Buffer.from([
    0x42, 0x0a, 0x20, 0x8a, 0x7a, 0x24, 0x86, 0xca,
  ]);

  const keys = [
    { pubkey: creator, isSigner: true, isWritable: true },
    { pubkey: campaign, isSigner: false, isWritable: true },
  ];

  return new Transaction().add({
    keys,
    programId: CROWDFUNDING_PROGRAM_ID,
    data: discriminator,
  });
}

export async function finalizeCampaignInstruction(
  creator: PublicKey,
  campaign: PublicKey,
  platformWallet: PublicKey
): Promise<Transaction> {
  const [platformConfig] = getPlatformConfigPDA();
  const [escrowVault] = getEscrowVaultPDA(campaign);

  // sha256("global:finalize_campaign")[0..8]
  const discriminator = Buffer.from([
    0xf1, 0x4c, 0xc9, 0xdd, 0x21, 0xde, 0xdc, 0x8a,
  ]);

  const keys = [
    { pubkey: creator, isSigner: true, isWritable: true },
    { pubkey: platformConfig, isSigner: false, isWritable: false },
    { pubkey: campaign, isSigner: false, isWritable: true },
    { pubkey: escrowVault, isSigner: false, isWritable: true },
    { pubkey: platformWallet, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  return new Transaction().add({
    keys,
    programId: CROWDFUNDING_PROGRAM_ID,
    data: discriminator,
  });
}

export async function claimTokensInstruction(
  investor: PublicKey,
  campaign: PublicKey,
  propertyMint: PublicKey,
  investorTokenAccount: PublicKey
): Promise<Transaction> {
  const [investorRecord] = getInvestorRecordPDA(campaign, investor);

  // sha256("global:claim_tokens")[0..8]
  const discriminator = Buffer.from([
    0x6c, 0xd8, 0xd2, 0xe7, 0x00, 0xd4, 0x2a, 0x40,
  ]);

  const keys = [
    { pubkey: investor, isSigner: true, isWritable: true },
    { pubkey: campaign, isSigner: false, isWritable: false },
    { pubkey: propertyMint, isSigner: false, isWritable: true },
    { pubkey: investorTokenAccount, isSigner: false, isWritable: true },
    { pubkey: investorRecord, isSigner: false, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
  ];

  return new Transaction().add({
    keys,
    programId: CROWDFUNDING_PROGRAM_ID,
    data: discriminator,
  });
}

export async function claimRefundInstruction(
  investor: PublicKey,
  campaign: PublicKey,
  propertyId: string,
  creator: PublicKey
): Promise<Transaction> {
  const [escrowVault] = getEscrowVaultPDA(campaign);
  const [investorRecord] = getInvestorRecordPDA(campaign, investor);

  // claim_refund: SHA256("global:claim_refund")[0..8]
  const discriminator = Buffer.from([
    0x0f, 0x10, 0x1e, 0xa1, 0xff, 0xe4, 0x61, 0x3c,
  ]);

  const keys = [
    { pubkey: investor, isSigner: true, isWritable: true },
    { pubkey: campaign, isSigner: false, isWritable: false },
    { pubkey: escrowVault, isSigner: false, isWritable: true },
    { pubkey: investorRecord, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  return new Transaction().add({
    keys,
    programId: CROWDFUNDING_PROGRAM_ID,
    data: discriminator,
  });
}

// ============================================================================
// High-Level Functions
// ============================================================================

export async function initializePlatform(
  wallet: WalletAdapter,
  platformWallet: PublicKey
): Promise<string> {
  const transaction = await initializePlatformInstruction(
    wallet.publicKey,
    platformWallet
  );

  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = wallet.publicKey;

  const signedTx = await wallet.signTransaction(transaction);
  const signature = await connection.sendRawTransaction(signedTx.serialize());
  await connection.confirmTransaction(signature, "confirmed");

  return signature;
}

export async function addToWhitelist(
  wallet: WalletAdapter,
  walletToWhitelist: PublicKey
): Promise<string> {
  const transaction = await addToWhitelistInstruction(
    wallet.publicKey,
    walletToWhitelist
  );

  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = wallet.publicKey;

  const signedTx = await wallet.signTransaction(transaction);
  const signature = await connection.sendRawTransaction(signedTx.serialize());
  await connection.confirmTransaction(signature, "confirmed");

  return signature;
}

export async function createCampaign(
  wallet: WalletAdapter,
  propertyMint: PublicKey,
  propertyId: string,
  fundingGoalSol: number,
  platformEquityPercent: number,
  fundingDeadline: Date,
  tokenPriceLamports: number,
  totalTokens: number
): Promise<{ signature: string; campaign: PublicKey }> {
  const { transaction, campaign } = await createCampaignInstruction(
    wallet.publicKey,
    propertyMint,
    propertyId,
    Math.floor(fundingGoalSol * LAMPORTS_PER_SOL),
    percentToBps(platformEquityPercent),
    Math.floor(fundingDeadline.getTime() / 1000),
    tokenPriceLamports,
    totalTokens
  );

  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = wallet.publicKey;

  const signedTx = await wallet.signTransaction(transaction);
  const signature = await connection.sendRawTransaction(signedTx.serialize());
  await connection.confirmTransaction(signature, "confirmed");

  return { signature, campaign };
}

export async function invest(
  wallet: WalletAdapter,
  propertyId: string,
  creator: PublicKey,
  amountSol: number,
  campaignOverride?: PublicKey,
  /** Exact lamports to transfer; when set, overrides `amountSol` (avoids float floor below on-chain token_price). */
  lamportsOverride?: number
): Promise<string> {
  const campaign = campaignOverride ?? getCampaignPDA(propertyId, creator)[0];
  const amountLamports =
    lamportsOverride !== undefined && lamportsOverride > 0
      ? Math.floor(lamportsOverride)
      : Math.floor(amountSol * LAMPORTS_PER_SOL);
  
  const transaction = await investInstruction(
    wallet.publicKey,
    campaign,
    propertyId,
    creator,
    amountLamports
  );

  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = wallet.publicKey;

  const signedTx = await wallet.signTransaction(transaction);
  const signature = await connection.sendRawTransaction(signedTx.serialize());
  await connection.confirmTransaction(signature, "confirmed");

  return signature;
}

export async function cancelCampaign(
  wallet: WalletAdapter,
  propertyId: string,
  campaignOverride?: PublicKey
): Promise<string> {
  const campaign =
    campaignOverride ?? getCampaignPDA(propertyId, wallet.publicKey)[0];
  
  const transaction = await cancelCampaignInstruction(
    wallet.publicKey,
    campaign,
    propertyId
  );

  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = wallet.publicKey;

  const signedTx = await wallet.signTransaction(transaction);
  const signature = await connection.sendRawTransaction(signedTx.serialize());
  await connection.confirmTransaction(signature, "confirmed");

  return signature;
}

export async function finalizeCampaign(
  wallet: WalletAdapter,
  propertyId: string,
  campaignOverride?: PublicKey
): Promise<string> {
  const campaign =
    campaignOverride ?? getCampaignPDA(propertyId, wallet.publicKey)[0];
  const platformWallet = await fetchPlatformWallet();
  if (!platformWallet) {
    throw new Error("Platform config not initialized");
  }

  const transaction = await finalizeCampaignInstruction(
    wallet.publicKey,
    campaign,
    platformWallet
  );

  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = wallet.publicKey;

  const signedTx = await wallet.signTransaction(transaction);
  const signature = await connection.sendRawTransaction(signedTx.serialize());
  await connection.confirmTransaction(signature, "confirmed");

  return signature;
}

export async function claimTokens(
  wallet: WalletAdapter,
  propertyId: string,
  creator: PublicKey,
  propertyMint: PublicKey,
  campaignOverride?: PublicKey
): Promise<string> {
  const campaign = campaignOverride ?? getCampaignPDA(propertyId, creator)[0];

  const investorTokenAccount = await getAssociatedTokenAddress(
    propertyMint,
    wallet.publicKey
  );

  const transaction = new Transaction();

  // Create the investor's ATA if it doesn't already exist (idempotent setup).
  const ataInfo = await connection.getAccountInfo(investorTokenAccount);
  if (!ataInfo) {
    transaction.add(
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        investorTokenAccount,
        wallet.publicKey,
        propertyMint
      )
    );
  }

  const claimTx = await claimTokensInstruction(
    wallet.publicKey,
    campaign,
    propertyMint,
    investorTokenAccount
  );
  transaction.add(...claimTx.instructions);

  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = wallet.publicKey;

  const signedTx = await wallet.signTransaction(transaction);
  const signature = await connection.sendRawTransaction(signedTx.serialize());
  await connection.confirmTransaction(signature, "confirmed");

  return signature;
}

export async function claimRefund(
  wallet: WalletAdapter,
  propertyId: string,
  creator: PublicKey,
  campaignOverride?: PublicKey
): Promise<string> {
  const campaign = campaignOverride ?? getCampaignPDA(propertyId, creator)[0];
  
  const transaction = await claimRefundInstruction(
    wallet.publicKey,
    campaign,
    propertyId,
    creator
  );

  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = wallet.publicKey;

  const signedTx = await wallet.signTransaction(transaction);
  const signature = await connection.sendRawTransaction(signedTx.serialize());
  await connection.confirmTransaction(signature, "confirmed");

  return signature;
}

// ============================================================================
// Read Functions
// ============================================================================

export async function fetchPlatformWallet(): Promise<PublicKey | null> {
  try {
    const [platformConfig] = getPlatformConfigPDA();
    const accountInfo = await connection.getAccountInfo(platformConfig);
    if (!accountInfo) return null;
    // Layout (after 8-byte discriminator):
    //   admin: Pubkey (32 bytes)
    //   platform_wallet: Pubkey (32 bytes)
    return new PublicKey(accountInfo.data.slice(8 + 32, 8 + 32 + 32));
  } catch {
    return null;
  }
}

export async function isWalletWhitelisted(wallet: PublicKey): Promise<boolean> {
  try {
    const [whitelistEntry] = getWhitelistEntryPDA(wallet);
    const accountInfo = await connection.getAccountInfo(whitelistEntry);
    
    if (!accountInfo) {
      return false;
    }
    
    // Check is_active flag (offset after discriminator + pubkeys + timestamp)
    const isActive = accountInfo.data[8 + 32 + 32 + 8] === 1;
    return isActive;
  } catch {
    return false;
  }
}

/**
 * Decode a `Campaign` account body (bytes after the 8-byte Anchor discriminator).
 * Must follow Anchor's Borsh layout: variable-length `property_id` string means
 * all fields after it are offset by `(100 + len)` — not a fixed `4 + 64` skip.
 * A previous bug assumed a 64-byte string slot and read `status` ~36 bytes too
 * late, so finalized campaigns still appeared Active and claim UI never showed.
 */
export function decodeCampaignAccountData(data: Buffer): Campaign | null {
  try {
    if (data.length < 100) return null;

    const creator = new PublicKey(data.slice(0, 32));
    const propertyMint = new PublicKey(data.slice(32, 64));
    const escrowVault = new PublicKey(data.slice(64, 96));

    const idLen = data.readUInt32LE(96);
    if (idLen > 256 || 100 + idLen > data.length) return null;

    const onChainPropertyId = data.slice(100, 100 + idLen).toString("utf8");

    // Borsh: next field (`funding_goal: u64`) starts immediately after string bytes
    // (no implicit padding to 64 or to 8 in Anchor's account serialization).
    let o = 100 + idLen;

    if (o + 8 + 8 + 2 + 8 + 8 + 8 + 8 + 4 + 1 + 8 + 1 + 1 > data.length) return null;

    const fundingGoal = Number(data.readBigUInt64LE(o));
    o += 8;
    const totalRaised = Number(data.readBigUInt64LE(o));
    o += 8;
    const platformEquityBps = data.readUInt16LE(o);
    o += 2;
    const fundingDeadline = Number(data.readBigInt64LE(o));
    o += 8;
    const tokenPrice = Number(data.readBigUInt64LE(o));
    o += 8;
    const totalTokens = Number(data.readBigUInt64LE(o));
    o += 8;
    const tokensSold = Number(data.readBigUInt64LE(o));
    o += 8;
    const investorCount = data.readUInt32LE(o);
    o += 4;

    const statusByte = data[o];
    o += 1;
    let status: CampaignStatus;
    switch (statusByte) {
      case 0:
        status = CampaignStatus.Active;
        break;
      case 1:
        status = CampaignStatus.Funded;
        break;
      case 2:
        status = CampaignStatus.Cancelled;
        break;
      default:
        status = CampaignStatus.Active;
    }

    const createdAt = Number(data.readBigInt64LE(o));
    o += 8;
    // bump, escrow_bump — not needed for UI; remainder is account padding.

    return {
      creator,
      propertyMint,
      escrowVault,
      propertyId: onChainPropertyId,
      fundingGoal,
      totalRaised,
      platformEquityBps,
      fundingDeadline,
      tokenPrice,
      totalTokens,
      tokensSold,
      investorCount,
      status,
      createdAt,
    };
  } catch {
    return null;
  }
}

export async function fetchCampaign(
  propertyId: string,
  creator: PublicKey,
  campaignOverride?: PublicKey
): Promise<Campaign | null> {
  try {
    const campaign =
      campaignOverride ?? getCampaignPDA(propertyId, creator)[0];
    const accountInfo = await connection.getAccountInfo(campaign);

    if (!accountInfo) {
      return null;
    }

    const data = accountInfo.data.slice(8);
    return decodeCampaignAccountData(data);
  } catch {
    return null;
  }
}

export async function fetchInvestorRecord(
  campaign: PublicKey,
  investor: PublicKey
): Promise<InvestorRecord | null> {
  try {
    const [investorRecord] = getInvestorRecordPDA(campaign, investor);
    const accountInfo = await connection.getAccountInfo(investorRecord);

    if (!accountInfo) {
      return null;
    }

    const data = accountInfo.data.slice(8);

    return {
      investor: new PublicKey(data.slice(0, 32)),
      campaign: new PublicKey(data.slice(32, 64)),
      amountInvested: Number(data.readBigUInt64LE(64)),
      tokensPurchased: Number(data.readBigUInt64LE(72)),
      investedAt: Number(data.readBigInt64LE(80)),
      refunded: data[88] === 1,
      tokensClaimed: data[89] === 1,
    };
  } catch {
    return null;
  }
}

/** Anchor `InvestorRecord` account size (discriminator + fields + padding). */
const INVESTOR_RECORD_ACCOUNT_SIZE = 8 + 32 + 32 + 8 + 8 + 8 + 1 + 1 + 1 + 32;

/** Full account: 8-byte disc + 32-byte investor; `campaign` pubkey starts here. */
const INVESTOR_RECORD_MEMCMP_CAMPAIGN_OFFSET = 40;

/**
 * Whether any investor has called `claim_tokens` for this campaign (on-chain
 * `tokens_claimed` flag). Used before allowing dividend flows for funded sales.
 */
export async function hasAnyInvestorClaimedTokens(
  campaign: PublicKey
): Promise<boolean> {
  try {
    const accounts = await connection.getProgramAccounts(CROWDFUNDING_PROGRAM_ID, {
      filters: [
        { dataSize: INVESTOR_RECORD_ACCOUNT_SIZE },
        {
          memcmp: {
            offset: INVESTOR_RECORD_MEMCMP_CAMPAIGN_OFFSET,
            bytes: campaign.toBase58(),
          },
        },
      ],
      commitment: "confirmed",
    });
    for (const { account } of accounts) {
      const data = account.data.slice(8);
      if (data.length < 90) continue;
      if (data[89] === 1) return true;
    }
    return false;
  } catch (e) {
    console.warn("hasAnyInvestorClaimedTokens failed:", e);
    return false;
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/** Anchor custom error 6009 = 0x1779 for `CrowdfundingError::CampaignNotActive` */
export const ANCHOR_CAMPAIGN_NOT_ACTIVE = 6009;

export function isCampaignNotActiveAnchorError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("campaignnotactive") ||
    m.includes("campaign is not active") ||
    m.includes("6009") ||
    m.includes("0x1779")
  );
}

export function formatDeadline(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getTimeRemaining(deadline: number): {
  days: number;
  hours: number;
  minutes: number;
  expired: boolean;
} {
  const now = Math.floor(Date.now() / 1000);
  const remaining = deadline - now;

  if (remaining <= 0) {
    return { days: 0, hours: 0, minutes: 0, expired: true };
  }

  const days = Math.floor(remaining / 86400);
  const hours = Math.floor((remaining % 86400) / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);

  return { days, hours, minutes, expired: false };
}

export function getExplorerUrl(signature: string): string {
  return `https://explorer.solana.com/tx/${signature}?cluster=${SOLANA_NETWORK}`;
}
