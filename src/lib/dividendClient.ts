import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";
import { connection, SOLANA_NETWORK } from "./solana";
import BN from "bn.js";

// Program ID - Update this after deploying the contract
export const DIVIDEND_PROGRAM_ID = new PublicKey(
  "78JohfdVhYCV6EPfC3baRkNoWUA5yDmw5HXkroeiSpCP"
);

// ============================================================================
// Types
// ============================================================================

export interface DividendPool {
  authority: PublicKey;
  propertyMint: PublicKey;
  dividendVault: PublicKey;
  propertyId: string;
  totalDistributed: number;
  currentEpoch: number;
  distributionFrequencyDays: number;
  lastDistributionTime: number;
  totalDepositedCurrentEpoch: number;
}

export interface DistributionRecord {
  pool: PublicKey;
  epoch: number;
  totalAmount: number;
  totalTokenSupply: number;
  amountPerToken: number;
  distributedAt: number;
  totalClaimed: number;
}

export interface ClaimRecord {
  user: PublicKey;
  distribution: PublicKey;
  epoch: number;
  amountClaimed: number;
  claimedAt: number;
  claimed: boolean;
}

export interface WalletAdapter {
  publicKey: PublicKey;
  signTransaction: (tx: Transaction) => Promise<Transaction>;
}

// ============================================================================
// PDA Derivation Functions
// ============================================================================

export function getDividendPoolPDA(propertyMint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("dividend_pool"), propertyMint.toBuffer()],
    DIVIDEND_PROGRAM_ID
  );
}

export function getDividendVaultPDA(dividendPool: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("dividend_vault"), dividendPool.toBuffer()],
    DIVIDEND_PROGRAM_ID
  );
}

export function getDistributionRecordPDA(
  dividendPool: PublicKey,
  epoch: number
): [PublicKey, number] {
  const epochBuffer = Buffer.alloc(8);
  epochBuffer.writeBigUInt64LE(BigInt(epoch));
  return PublicKey.findProgramAddressSync(
    [Buffer.from("distribution"), dividendPool.toBuffer(), epochBuffer],
    DIVIDEND_PROGRAM_ID
  );
}

export function getClaimRecordPDA(
  distributionRecord: PublicKey,
  user: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("claim"), distributionRecord.toBuffer(), user.toBuffer()],
    DIVIDEND_PROGRAM_ID
  );
}

// ============================================================================
// Instruction Builders
// ============================================================================

export async function initializePoolInstruction(
  authority: PublicKey,
  propertyMint: PublicKey,
  propertyId: string,
  distributionFrequencyDays: number
): Promise<{ instruction: Transaction; dividendPool: PublicKey }> {
  const [dividendPool] = getDividendPoolPDA(propertyMint);
  const [dividendVault] = getDividendVaultPDA(dividendPool);

  // Anchor instruction discriminator for "initialize_pool"
  // initialize_pool: SHA256("global:initialize_pool")[0..8]
  const discriminator = Buffer.from([
    0x5f, 0xb4, 0x0a, 0xac, 0x54, 0xae, 0xe8, 0x28,
  ]);

  const propertyIdBuffer = Buffer.from(propertyId);
  const propertyIdLenBuffer = Buffer.alloc(4);
  propertyIdLenBuffer.writeUInt32LE(propertyIdBuffer.length);

  const frequencyBuffer = Buffer.alloc(8);
  frequencyBuffer.writeBigUInt64LE(BigInt(distributionFrequencyDays));

  const data = Buffer.concat([
    discriminator,
    propertyIdLenBuffer,
    propertyIdBuffer,
    frequencyBuffer,
  ]);

  const keys = [
    { pubkey: authority, isSigner: true, isWritable: true },
    { pubkey: propertyMint, isSigner: false, isWritable: false },
    { pubkey: dividendPool, isSigner: false, isWritable: true },
    { pubkey: dividendVault, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: new PublicKey("SysvarRent111111111111111111111111111111111"), isSigner: false, isWritable: false },
  ];

  const transaction = new Transaction().add({
    keys,
    programId: DIVIDEND_PROGRAM_ID,
    data,
  });

  return { instruction: transaction, dividendPool };
}

export async function depositDividendInstruction(
  authority: PublicKey,
  propertyMint: PublicKey,
  amountLamports: number
): Promise<Transaction> {
  const [dividendPool] = getDividendPoolPDA(propertyMint);
  const [dividendVault] = getDividendVaultPDA(dividendPool);

  // Anchor instruction discriminator for "deposit_dividend"
  // deposit_dividend: SHA256("global:deposit_dividend")[0..8]
  const discriminator = Buffer.from([
    0xcb, 0x0a, 0x26, 0xd2, 0x78, 0x56, 0x92, 0x57,
  ]);

  const amountBuffer = Buffer.alloc(8);
  amountBuffer.writeBigUInt64LE(BigInt(amountLamports));

  const data = Buffer.concat([discriminator, amountBuffer]);

  const keys = [
    { pubkey: authority, isSigner: true, isWritable: true },
    { pubkey: dividendPool, isSigner: false, isWritable: true },
    { pubkey: dividendVault, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  return new Transaction().add({
    keys,
    programId: DIVIDEND_PROGRAM_ID,
    data,
  });
}

export async function startDistributionInstruction(
  authority: PublicKey,
  propertyMint: PublicKey,
  currentEpoch: number
): Promise<Transaction> {
  const [dividendPool] = getDividendPoolPDA(propertyMint);
  const [distributionRecord] = getDistributionRecordPDA(dividendPool, currentEpoch);

  // Anchor instruction discriminator for "start_distribution"
  // start_distribution: SHA256("global:start_distribution")[0..8]
  const discriminator = Buffer.from([
    0x76, 0xe6, 0xd7, 0x4b, 0x53, 0x02, 0xa3, 0x23,
  ]);

  const keys = [
    { pubkey: authority, isSigner: true, isWritable: true },
    { pubkey: dividendPool, isSigner: false, isWritable: true },
    { pubkey: propertyMint, isSigner: false, isWritable: false },
    { pubkey: distributionRecord, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  return new Transaction().add({
    keys,
    programId: DIVIDEND_PROGRAM_ID,
    data: discriminator,
  });
}

export async function claimDividendInstruction(
  user: PublicKey,
  propertyMint: PublicKey,
  epoch: number
): Promise<Transaction> {
  const [dividendPool] = getDividendPoolPDA(propertyMint);
  const [dividendVault] = getDividendVaultPDA(dividendPool);
  const [distributionRecord] = getDistributionRecordPDA(dividendPool, epoch);
  const [claimRecord] = getClaimRecordPDA(distributionRecord, user);
  const userTokenAccount = await getAssociatedTokenAddress(propertyMint, user);

  // Anchor instruction discriminator for "claim_dividend"
  // claim_dividend: SHA256("global:claim_dividend")[0..8]
  const discriminator = Buffer.from([
    0x0f, 0x1d, 0xcf, 0x78, 0x99, 0xb2, 0xa4, 0x5b,
  ]);

  const epochBuffer = Buffer.alloc(8);
  epochBuffer.writeBigUInt64LE(BigInt(epoch));

  const data = Buffer.concat([discriminator, epochBuffer]);

  const keys = [
    { pubkey: user, isSigner: true, isWritable: true },
    { pubkey: dividendPool, isSigner: false, isWritable: false },
    { pubkey: distributionRecord, isSigner: false, isWritable: false },
    { pubkey: dividendVault, isSigner: false, isWritable: true },
    { pubkey: userTokenAccount, isSigner: false, isWritable: false },
    { pubkey: claimRecord, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  return new Transaction().add({
    keys,
    programId: DIVIDEND_PROGRAM_ID,
    data,
  });
}

// ============================================================================
// High-Level Functions
// ============================================================================

export async function initializeDividendPool(
  wallet: WalletAdapter,
  propertyMint: PublicKey,
  propertyId: string,
  distributionFrequencyDays: number = 30
): Promise<{ signature: string; dividendPool: PublicKey }> {
  const { instruction, dividendPool } = await initializePoolInstruction(
    wallet.publicKey,
    propertyMint,
    propertyId,
    distributionFrequencyDays
  );

  const { blockhash } = await connection.getLatestBlockhash();
  instruction.recentBlockhash = blockhash;
  instruction.feePayer = wallet.publicKey;

  const signedTx = await wallet.signTransaction(instruction);
  const signature = await connection.sendRawTransaction(signedTx.serialize());
  await connection.confirmTransaction(signature, "confirmed");

  return { signature, dividendPool };
}

export async function depositDividend(
  wallet: WalletAdapter,
  propertyMint: PublicKey,
  amountSol: number
): Promise<string> {
  const amountLamports = Math.floor(amountSol * LAMPORTS_PER_SOL);
  const transaction = await depositDividendInstruction(
    wallet.publicKey,
    propertyMint,
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

export async function startDistribution(
  wallet: WalletAdapter,
  propertyMint: PublicKey,
  currentEpoch: number
): Promise<string> {
  const transaction = await startDistributionInstruction(
    wallet.publicKey,
    propertyMint,
    currentEpoch
  );

  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = wallet.publicKey;

  const signedTx = await wallet.signTransaction(transaction);
  const signature = await connection.sendRawTransaction(signedTx.serialize());
  await connection.confirmTransaction(signature, "confirmed");

  return signature;
}

export async function claimDividend(
  wallet: WalletAdapter,
  propertyMint: PublicKey,
  epoch: number
): Promise<string> {
  const transaction = await claimDividendInstruction(
    wallet.publicKey,
    propertyMint,
    epoch
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
// Read Functions (Fetch Account Data)
// ============================================================================

export async function fetchDividendPool(
  propertyMint: PublicKey
): Promise<DividendPool | null> {
  const [dividendPool] = getDividendPoolPDA(propertyMint);
  const accountInfo = await connection.getAccountInfo(dividendPool);

  if (!accountInfo) {
    return null;
  }

  // Skip 8-byte discriminator
  const data = accountInfo.data.slice(8);
  
  return {
    authority: new PublicKey(data.slice(0, 32)),
    propertyMint: new PublicKey(data.slice(32, 64)),
    dividendVault: new PublicKey(data.slice(64, 96)),
    propertyId: data.slice(100, 100 + data.readUInt32LE(96)).toString(),
    totalDistributed: Number(data.readBigUInt64LE(164)),
    currentEpoch: Number(data.readBigUInt64LE(172)),
    distributionFrequencyDays: Number(data.readBigUInt64LE(180)),
    lastDistributionTime: Number(data.readBigInt64LE(188)),
    totalDepositedCurrentEpoch: Number(data.readBigUInt64LE(196)),
  };
}

export async function fetchDistributionRecord(
  propertyMint: PublicKey,
  epoch: number
): Promise<DistributionRecord | null> {
  const [dividendPool] = getDividendPoolPDA(propertyMint);
  const [distributionRecord] = getDistributionRecordPDA(dividendPool, epoch);
  const accountInfo = await connection.getAccountInfo(distributionRecord);

  if (!accountInfo) {
    return null;
  }

  // Skip 8-byte discriminator
  const data = accountInfo.data.slice(8);

  return {
    pool: new PublicKey(data.slice(0, 32)),
    epoch: Number(data.readBigUInt64LE(32)),
    totalAmount: Number(data.readBigUInt64LE(40)),
    totalTokenSupply: Number(data.readBigUInt64LE(48)),
    amountPerToken: Number(data.readBigUInt64LE(56)),
    distributedAt: Number(data.readBigInt64LE(64)),
    totalClaimed: Number(data.readBigUInt64LE(72)),
  };
}

export async function getClaimableAmount(
  user: PublicKey,
  propertyMint: PublicKey,
  epoch: number
): Promise<number> {
  const distribution = await fetchDistributionRecord(propertyMint, epoch);
  if (!distribution) {
    return 0;
  }

  const userTokenAccount = await getAssociatedTokenAddress(propertyMint, user);
  const tokenAccountInfo = await connection.getAccountInfo(userTokenAccount);
  
  if (!tokenAccountInfo) {
    return 0;
  }

  // Parse token account to get balance (offset 64 for amount in SPL token account)
  const tokenBalance = Number(tokenAccountInfo.data.readBigUInt64LE(64));
  
  return (tokenBalance * distribution.amountPerToken) / LAMPORTS_PER_SOL;
}

export async function hasClaimedDividend(
  user: PublicKey,
  propertyMint: PublicKey,
  epoch: number
): Promise<boolean> {
  const [dividendPool] = getDividendPoolPDA(propertyMint);
  const [distributionRecord] = getDistributionRecordPDA(dividendPool, epoch);
  const [claimRecord] = getClaimRecordPDA(distributionRecord, user);
  
  const accountInfo = await connection.getAccountInfo(claimRecord);
  return accountInfo !== null;
}

// ============================================================================
// Utility Functions
// ============================================================================

export function formatDividendAmount(lamports: number): string {
  return (lamports / LAMPORTS_PER_SOL).toFixed(4);
}

export function getExplorerUrl(signature: string): string {
  return `https://explorer.solana.com/tx/${signature}?cluster=${SOLANA_NETWORK}`;
}
