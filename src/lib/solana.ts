import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  Keypair,
  clusterApiUrl,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
  MINT_SIZE,
  getMinimumBalanceForRentExemptMint,
  createInitializeMintInstruction,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import {
  initializeDividendPool,
  depositDividend,
  startDistribution,
  claimDividend,
  fetchDividendPool,
  fetchDistributionRecord,
  getClaimableAmount,
  hasClaimedDividend,
  getDividendPoolPDA,
} from "./dividendClient";

// Use localhost for local testing, devnet for production
export const SOLANA_NETWORK = process.env.NEXT_PUBLIC_SOLANA_NETWORK || "localhost";
export const SOLANA_RPC_URL = SOLANA_NETWORK === "localhost" 
  ? "http://localhost:8899" 
  : clusterApiUrl(SOLANA_NETWORK as "devnet" | "mainnet-beta");
export const connection = new Connection(SOLANA_RPC_URL, "confirmed");

// Re-export dividend functions for convenience
export {
  initializeDividendPool,
  depositDividend,
  startDistribution,
  claimDividend,
  fetchDividendPool,
  fetchDistributionRecord,
  getClaimableAmount,
  hasClaimedDividend,
  getDividendPoolPDA,
};

export interface TokenizedProperty {
  propertyId: string;
  mintAddress: string;
  totalTokens: number;
  pricePerToken: number;
  propertyValue: number;
  ownerAddress: string;
  createdAt: string;
  transactionSignature: string;
  dividendPoolAddress?: string;
}

export interface DividendInfo {
  poolAddress: string;
  currentEpoch: number;
  totalDistributed: number;
  pendingDividends: number;
  lastDistributionDate: string | null;
}

// Get SOL balance
export async function getSolBalance(publicKey: PublicKey): Promise<number> {
  const balance = await connection.getBalance(publicKey);
  return balance / LAMPORTS_PER_SOL;
}

// Request airdrop for testing (devnet only)
export async function requestAirdrop(publicKey: PublicKey, amount: number = 2): Promise<string> {
  const signature = await connection.requestAirdrop(
    publicKey,
    amount * LAMPORTS_PER_SOL
  );
  await connection.confirmTransaction(signature, "confirmed");
  return signature;
}

// Create a new token mint for the property
export async function createPropertyTokenMint(
  wallet: {
    publicKey: PublicKey;
    signTransaction: (tx: Transaction) => Promise<Transaction>;
  },
  decimals: number = 0 // No decimals for property tokens (whole tokens only)
): Promise<{ mintAddress: PublicKey; signature: string }> {
  // Generate a new keypair for the mint
  const mintKeypair = Keypair.generate();
  
  // Get minimum lamports for rent exemption
  const lamports = await getMinimumBalanceForRentExemptMint(connection);
  
  // Create transaction
  const transaction = new Transaction().add(
    // Create account for mint
    SystemProgram.createAccount({
      fromPubkey: wallet.publicKey,
      newAccountPubkey: mintKeypair.publicKey,
      space: MINT_SIZE,
      lamports,
      programId: TOKEN_PROGRAM_ID,
    }),
    // Initialize mint
    createInitializeMintInstruction(
      mintKeypair.publicKey,
      decimals,
      wallet.publicKey, // Mint authority
      wallet.publicKey  // Freeze authority
    )
  );
  
  // Get recent blockhash
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = wallet.publicKey;
  
  // Partially sign with mint keypair
  transaction.partialSign(mintKeypair);
  
  // Sign with wallet
  const signedTx = await wallet.signTransaction(transaction);
  
  // Send transaction
  const signature = await connection.sendRawTransaction(signedTx.serialize());
  await connection.confirmTransaction(signature, "confirmed");
  
  return {
    mintAddress: mintKeypair.publicKey,
    signature,
  };
}

// Mint property tokens to the owner
export async function mintPropertyTokens(
  wallet: {
    publicKey: PublicKey;
    signTransaction: (tx: Transaction) => Promise<Transaction>;
  },
  mintAddress: PublicKey,
  amount: number
): Promise<{ tokenAccount: PublicKey; signature: string }> {
  // Get the associated token account address
  const associatedTokenAddress = await getAssociatedTokenAddress(
    mintAddress,
    wallet.publicKey
  );
  
  // Create transaction
  const transaction = new Transaction();
  
  // Check if token account exists, if not create it
  const tokenAccountInfo = await connection.getAccountInfo(associatedTokenAddress);
  if (!tokenAccountInfo) {
    transaction.add(
      createAssociatedTokenAccountInstruction(
        wallet.publicKey, // payer
        associatedTokenAddress, // associated token account
        wallet.publicKey, // owner
        mintAddress // mint
      )
    );
  }
  
  // Add mint instruction
  transaction.add(
    createMintToInstruction(
      mintAddress,
      associatedTokenAddress,
      wallet.publicKey, // mint authority
      amount
    )
  );
  
  // Get recent blockhash
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = wallet.publicKey;
  
  // Sign with wallet
  const signedTx = await wallet.signTransaction(transaction);
  
  // Send transaction
  const signature = await connection.sendRawTransaction(signedTx.serialize());
  await connection.confirmTransaction(signature, "confirmed");
  
  return {
    tokenAccount: associatedTokenAddress,
    signature,
  };
}

// Full flow: Create mint and mint tokens
export async function tokenizeProperty(
  wallet: {
    publicKey: PublicKey;
    signTransaction: (tx: Transaction) => Promise<Transaction>;
  },
  propertyValue: number,
  totalTokens: number
): Promise<{
  mintAddress: string;
  tokenAccount: string;
  mintSignature: string;
  tokenSignature: string;
  pricePerToken: number;
}> {
  // Create the token mint
  const { mintAddress, signature: mintSignature } = await createPropertyTokenMint(wallet);
  
  // Mint tokens to owner
  const { tokenAccount, signature: tokenSignature } = await mintPropertyTokens(
    wallet,
    mintAddress,
    totalTokens
  );
  
  const pricePerToken = propertyValue / totalTokens;
  
  return {
    mintAddress: mintAddress.toBase58(),
    tokenAccount: tokenAccount.toBase58(),
    mintSignature,
    tokenSignature,
    pricePerToken,
  };
}

// Tokenize property with dividend pool initialization
export async function tokenizePropertyWithDividends(
  wallet: {
    publicKey: PublicKey;
    signTransaction: (tx: Transaction) => Promise<Transaction>;
  },
  propertyId: string,
  propertyValue: number,
  totalTokens: number,
  distributionFrequencyDays: number = 30
): Promise<{
  mintAddress: string;
  tokenAccount: string;
  mintSignature: string;
  tokenSignature: string;
  pricePerToken: number;
  dividendPool: string;
  dividendPoolSignature: string;
}> {
  // First tokenize the property
  const tokenResult = await tokenizeProperty(wallet, propertyValue, totalTokens);
  
  // Then initialize the dividend pool
  const mintPublicKey = new PublicKey(tokenResult.mintAddress);
  const { signature: dividendPoolSignature, dividendPool } = await initializeDividendPool(
    wallet,
    mintPublicKey,
    propertyId,
    distributionFrequencyDays
  );
  
  return {
    ...tokenResult,
    dividendPool: dividendPool.toBase58(),
    dividendPoolSignature,
  };
}

// Get dividend information for a property
export async function getDividendInfo(
  mintAddress: string
): Promise<DividendInfo | null> {
  try {
    const mintPublicKey = new PublicKey(mintAddress);
    const pool = await fetchDividendPool(mintPublicKey);
    
    if (!pool) {
      return null;
    }
    
    const [dividendPoolPDA] = getDividendPoolPDA(mintPublicKey);
    
    return {
      poolAddress: dividendPoolPDA.toBase58(),
      currentEpoch: pool.currentEpoch,
      totalDistributed: pool.totalDistributed / LAMPORTS_PER_SOL,
      pendingDividends: pool.totalDepositedCurrentEpoch / LAMPORTS_PER_SOL,
      lastDistributionDate: pool.lastDistributionTime > 0
        ? new Date(pool.lastDistributionTime * 1000).toISOString()
        : null,
    };
  } catch {
    return null;
  }
}

// Format address for display
export function formatAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Get explorer URL
export function getExplorerUrl(signature: string, type: "tx" | "address" = "tx"): string {
  return `https://explorer.solana.com/${type}/${signature}?cluster=${SOLANA_NETWORK}`;
}

