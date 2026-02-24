import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { connection } from "./solana";
import BN from "bn.js";

// Program ID
export const MARKETPLACE_PROGRAM_ID = new PublicKey(
  "9wprAAKPfNu9MLzCWMh63F35fJZrmk49G45nsSpfmbEd"
);

// Discriminators (SHA256 of "global:<instruction_name>")[0..8]
const DISCRIMINATORS = {
  initializeMarketplace: Buffer.from([0x2f, 0x51, 0x40, 0x00, 0x60, 0x38, 0x69, 0x07]),
  createListing: Buffer.from([0x12, 0xa8, 0x2d, 0x18, 0xbf, 0x1f, 0x75, 0x36]),
  buyTokens: Buffer.from([0xbd, 0x15, 0xe6, 0x85, 0xf7, 0x02, 0x6e, 0x2a]),
  cancelListing: Buffer.from([0x29, 0xb7, 0x32, 0xe8, 0xe6, 0xe9, 0x9d, 0x46]),
  updateListingPrice: Buffer.from([0x67, 0x50, 0xb8, 0x50, 0x9f, 0x18, 0x5e, 0x8a]),
};

// PDA Derivations
export function getMarketplacePDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("marketplace")],
    MARKETPLACE_PROGRAM_ID
  );
}

export function getListingPDA(
  seller: PublicKey,
  tokenMint: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("listing"), seller.toBuffer(), tokenMint.toBuffer()],
    MARKETPLACE_PROGRAM_ID
  );
}

// Interfaces
export interface Listing {
  address: PublicKey;
  seller: PublicKey;
  tokenMint: PublicKey;
  amount: number;
  pricePerToken: number;
  totalPrice: number;
  createdAt: Date;
  isActive: boolean;
}

export interface MarketplaceStats {
  authority: PublicKey;
  feeBps: number;
  feePercent: number;
  totalVolume: number;
  totalListings: number;
}

// Wallet adapter interface
interface WalletAdapter {
  publicKey: PublicKey;
  signTransaction: (tx: Transaction) => Promise<Transaction>;
}

// Instruction Builders
export async function createListingInstruction(
  seller: PublicKey,
  tokenMint: PublicKey,
  amount: number,
  pricePerToken: number
): Promise<Transaction> {
  const [marketplace] = getMarketplacePDA();
  const [listing] = getListingPDA(seller, tokenMint);
  const sellerTokenAccount = await getAssociatedTokenAddress(tokenMint, seller);
  const escrowTokenAccount = await getAssociatedTokenAddress(tokenMint, listing, true);

  const amountBuffer = Buffer.alloc(8);
  amountBuffer.writeBigUInt64LE(BigInt(amount));

  const priceBuffer = Buffer.alloc(8);
  priceBuffer.writeBigUInt64LE(BigInt(pricePerToken));

  const data = Buffer.concat([DISCRIMINATORS.createListing, amountBuffer, priceBuffer]);

  const keys = [
    { pubkey: seller, isSigner: true, isWritable: true },
    { pubkey: marketplace, isSigner: false, isWritable: true },
    { pubkey: tokenMint, isSigner: false, isWritable: false },
    { pubkey: listing, isSigner: false, isWritable: true },
    { pubkey: sellerTokenAccount, isSigner: false, isWritable: true },
    { pubkey: escrowTokenAccount, isSigner: false, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  return new Transaction().add({
    keys,
    programId: MARKETPLACE_PROGRAM_ID,
    data,
  });
}

export async function buyTokensInstruction(
  buyer: PublicKey,
  seller: PublicKey,
  tokenMint: PublicKey,
  platformWallet: PublicKey,
  amount: number
): Promise<Transaction> {
  const [marketplace] = getMarketplacePDA();
  const [listing] = getListingPDA(seller, tokenMint);
  const escrowTokenAccount = await getAssociatedTokenAddress(tokenMint, listing, true);
  const buyerTokenAccount = await getAssociatedTokenAddress(tokenMint, buyer);

  const amountBuffer = Buffer.alloc(8);
  amountBuffer.writeBigUInt64LE(BigInt(amount));

  const data = Buffer.concat([DISCRIMINATORS.buyTokens, amountBuffer]);

  const keys = [
    { pubkey: buyer, isSigner: true, isWritable: true },
    { pubkey: seller, isSigner: false, isWritable: true },
    { pubkey: platformWallet, isSigner: false, isWritable: true },
    { pubkey: marketplace, isSigner: false, isWritable: true },
    { pubkey: tokenMint, isSigner: false, isWritable: false },
    { pubkey: listing, isSigner: false, isWritable: true },
    { pubkey: escrowTokenAccount, isSigner: false, isWritable: true },
    { pubkey: buyerTokenAccount, isSigner: false, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  return new Transaction().add({
    keys,
    programId: MARKETPLACE_PROGRAM_ID,
    data,
  });
}

export async function cancelListingInstruction(
  seller: PublicKey,
  tokenMint: PublicKey
): Promise<Transaction> {
  const [listing] = getListingPDA(seller, tokenMint);
  const sellerTokenAccount = await getAssociatedTokenAddress(tokenMint, seller);
  const escrowTokenAccount = await getAssociatedTokenAddress(tokenMint, listing, true);

  const keys = [
    { pubkey: seller, isSigner: true, isWritable: true },
    { pubkey: tokenMint, isSigner: false, isWritable: false },
    { pubkey: listing, isSigner: false, isWritable: true },
    { pubkey: escrowTokenAccount, isSigner: false, isWritable: true },
    { pubkey: sellerTokenAccount, isSigner: false, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
  ];

  return new Transaction().add({
    keys,
    programId: MARKETPLACE_PROGRAM_ID,
    data: DISCRIMINATORS.cancelListing,
  });
}

export async function updateListingPriceInstruction(
  seller: PublicKey,
  tokenMint: PublicKey,
  newPricePerToken: number
): Promise<Transaction> {
  const [listing] = getListingPDA(seller, tokenMint);

  const priceBuffer = Buffer.alloc(8);
  priceBuffer.writeBigUInt64LE(BigInt(newPricePerToken));

  const data = Buffer.concat([DISCRIMINATORS.updateListingPrice, priceBuffer]);

  const keys = [
    { pubkey: seller, isSigner: true, isWritable: true },
    { pubkey: tokenMint, isSigner: false, isWritable: false },
    { pubkey: listing, isSigner: false, isWritable: true },
  ];

  return new Transaction().add({
    keys,
    programId: MARKETPLACE_PROGRAM_ID,
    data,
  });
}

// High-Level Functions
export async function createListing(
  wallet: WalletAdapter,
  tokenMint: PublicKey,
  amount: number,
  pricePerToken: number
): Promise<string> {
  const transaction = await createListingInstruction(
    wallet.publicKey,
    tokenMint,
    amount,
    pricePerToken
  );

  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = wallet.publicKey;

  const signedTx = await wallet.signTransaction(transaction);
  const signature = await connection.sendRawTransaction(signedTx.serialize());
  await connection.confirmTransaction(signature, "confirmed");

  return signature;
}

export async function buyTokens(
  wallet: WalletAdapter,
  seller: PublicKey,
  tokenMint: PublicKey,
  platformWallet: PublicKey,
  amount: number
): Promise<string> {
  const transaction = await buyTokensInstruction(
    wallet.publicKey,
    seller,
    tokenMint,
    platformWallet,
    amount
  );

  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = wallet.publicKey;

  const signedTx = await wallet.signTransaction(transaction);
  const signature = await connection.sendRawTransaction(signedTx.serialize());
  await connection.confirmTransaction(signature, "confirmed");

  return signature;
}

export async function cancelListing(
  wallet: WalletAdapter,
  tokenMint: PublicKey
): Promise<string> {
  const transaction = await cancelListingInstruction(wallet.publicKey, tokenMint);

  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = wallet.publicKey;

  const signedTx = await wallet.signTransaction(transaction);
  const signature = await connection.sendRawTransaction(signedTx.serialize());
  await connection.confirmTransaction(signature, "confirmed");

  return signature;
}

// Read Functions
export async function fetchListing(
  seller: PublicKey,
  tokenMint: PublicKey
): Promise<Listing | null> {
  const [listingPDA] = getListingPDA(seller, tokenMint);

  try {
    const accountInfo = await connection.getAccountInfo(listingPDA);
    if (!accountInfo) return null;

    const data = accountInfo.data;
    
    // Skip 8-byte discriminator
    let offset = 8;

    const sellerPubkey = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;

    const tokenMintPubkey = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;

    const amount = Number(data.readBigUInt64LE(offset));
    offset += 8;

    const pricePerToken = Number(data.readBigUInt64LE(offset));
    offset += 8;

    const createdAt = Number(data.readBigInt64LE(offset));
    offset += 8;

    const isActive = data[offset] === 1;

    return {
      address: listingPDA,
      seller: sellerPubkey,
      tokenMint: tokenMintPubkey,
      amount,
      pricePerToken,
      totalPrice: amount * pricePerToken,
      createdAt: new Date(createdAt * 1000),
      isActive,
    };
  } catch (error) {
    console.error("Error fetching listing:", error);
    return null;
  }
}

export async function fetchAllListings(): Promise<Listing[]> {
  try {
    const accounts = await connection.getProgramAccounts(MARKETPLACE_PROGRAM_ID, {
      filters: [
        { dataSize: 8 + 32 + 32 + 8 + 8 + 8 + 1 + 1 }, // Listing account size
      ],
    });

    const listings: Listing[] = [];

    for (const account of accounts) {
      const data = account.account.data;
      let offset = 8;

      const seller = new PublicKey(data.slice(offset, offset + 32));
      offset += 32;

      const tokenMint = new PublicKey(data.slice(offset, offset + 32));
      offset += 32;

      const amount = Number(data.readBigUInt64LE(offset));
      offset += 8;

      const pricePerToken = Number(data.readBigUInt64LE(offset));
      offset += 8;

      const createdAt = Number(data.readBigInt64LE(offset));
      offset += 8;

      const isActive = data[offset] === 1;

      if (isActive && amount > 0) {
        listings.push({
          address: account.pubkey,
          seller,
          tokenMint,
          amount,
          pricePerToken,
          totalPrice: amount * pricePerToken,
          createdAt: new Date(createdAt * 1000),
          isActive,
        });
      }
    }

    return listings.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } catch (error) {
    console.error("Error fetching listings:", error);
    return [];
  }
}

export async function fetchMarketplaceStats(): Promise<MarketplaceStats | null> {
  const [marketplacePDA] = getMarketplacePDA();

  try {
    const accountInfo = await connection.getAccountInfo(marketplacePDA);
    if (!accountInfo) return null;

    const data = accountInfo.data;
    let offset = 8;

    const authority = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;

    const feeBps = data.readUInt16LE(offset);
    offset += 2;

    const totalVolume = Number(data.readBigUInt64LE(offset));
    offset += 8;

    const totalListings = Number(data.readBigUInt64LE(offset));

    return {
      authority,
      feeBps,
      feePercent: feeBps / 100,
      totalVolume,
      totalListings,
    };
  } catch (error) {
    console.error("Error fetching marketplace stats:", error);
    return null;
  }
}

// Utility Functions
export function formatPrice(lamports: number): string {
  return (lamports / LAMPORTS_PER_SOL).toFixed(4);
}

export function lamportsToSol(lamports: number): number {
  return lamports / LAMPORTS_PER_SOL;
}

export function solToLamports(sol: number): number {
  return Math.floor(sol * LAMPORTS_PER_SOL);
}
