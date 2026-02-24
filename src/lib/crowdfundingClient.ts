import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";
import { connection, SOLANA_NETWORK } from "./solana";

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

  const discriminator = Buffer.from([
    0x1a, 0x2b, 0x3c, 0x4d, 0x5e, 0x6f, 0x7a, 0x8b,
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

  const fundingGoalBuffer = Buffer.alloc(8);
  fundingGoalBuffer.writeBigUInt64LE(BigInt(fundingGoal));

  const platformEquityBpsBuffer = Buffer.alloc(2);
  platformEquityBpsBuffer.writeUInt16LE(platformEquityBps);

  const deadlineBuffer = Buffer.alloc(8);
  deadlineBuffer.writeBigInt64LE(BigInt(fundingDeadline));

  const tokenPriceBuffer = Buffer.alloc(8);
  tokenPriceBuffer.writeBigUInt64LE(BigInt(tokenPrice));

  const totalTokensBuffer = Buffer.alloc(8);
  totalTokensBuffer.writeBigUInt64LE(BigInt(totalTokens));

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

  const amountBuffer = Buffer.alloc(8);
  amountBuffer.writeBigUInt64LE(BigInt(amountLamports));

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
  amountSol: number
): Promise<string> {
  const [campaign] = getCampaignPDA(propertyId, creator);
  const amountLamports = Math.floor(amountSol * LAMPORTS_PER_SOL);
  
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
  propertyId: string
): Promise<string> {
  const [campaign] = getCampaignPDA(propertyId, wallet.publicKey);
  
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

export async function claimRefund(
  wallet: WalletAdapter,
  propertyId: string,
  creator: PublicKey
): Promise<string> {
  const [campaign] = getCampaignPDA(propertyId, creator);
  
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

export async function fetchCampaign(
  propertyId: string,
  creator: PublicKey
): Promise<Campaign | null> {
  try {
    const [campaign] = getCampaignPDA(propertyId, creator);
    const accountInfo = await connection.getAccountInfo(campaign);

    if (!accountInfo) {
      return null;
    }

    const data = accountInfo.data.slice(8);
    
    const statusByte = data[32 + 32 + 32 + 4 + 64 + 8 + 8 + 2 + 8 + 8 + 8 + 8 + 4];
    let status: CampaignStatus;
    switch (statusByte) {
      case 0: status = CampaignStatus.Active; break;
      case 1: status = CampaignStatus.Funded; break;
      case 2: status = CampaignStatus.Cancelled; break;
      default: status = CampaignStatus.Active;
    }

    return {
      creator: new PublicKey(data.slice(0, 32)),
      propertyMint: new PublicKey(data.slice(32, 64)),
      escrowVault: new PublicKey(data.slice(64, 96)),
      propertyId: data.slice(100, 100 + data.readUInt32LE(96)).toString(),
      fundingGoal: Number(data.readBigUInt64LE(164)),
      totalRaised: Number(data.readBigUInt64LE(172)),
      platformEquityBps: data.readUInt16LE(180),
      fundingDeadline: Number(data.readBigInt64LE(182)),
      tokenPrice: Number(data.readBigUInt64LE(190)),
      totalTokens: Number(data.readBigUInt64LE(198)),
      tokensSold: Number(data.readBigUInt64LE(206)),
      investorCount: data.readUInt32LE(214),
      status,
      createdAt: Number(data.readBigInt64LE(219)),
    };
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

// ============================================================================
// Utility Functions
// ============================================================================

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
