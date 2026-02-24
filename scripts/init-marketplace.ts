import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction, SystemProgram } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";

const MARKETPLACE_PROGRAM_ID = new PublicKey("9wprAAKPfNu9MLzCWMh63F35fJZrmk49G45nsSpfmbEd");

function getMarketplacePDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("marketplace")],
    MARKETPLACE_PROGRAM_ID
  );
}

async function main() {
  const rpcUrl = process.env.RPC_URL || "https://api.devnet.solana.com";
  const connection = new Connection(rpcUrl, "confirmed");
  
  // Load admin wallet
  const keypairPath = path.join(process.env.HOME || "", ".config/solana/id.json");
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const admin = Keypair.fromSecretKey(Uint8Array.from(keypairData));
  
  console.log("Admin wallet:", admin.publicKey.toBase58());
  
  const [marketplacePDA, bump] = getMarketplacePDA();
  console.log("Marketplace PDA:", marketplacePDA.toBase58());
  
  // Check if already initialized
  const marketplaceInfo = await connection.getAccountInfo(marketplacePDA);
  if (marketplaceInfo) {
    console.log("✅ Marketplace already initialized!");
    return;
  }
  
  console.log("Initializing marketplace...");
  
  // initialize_marketplace discriminator
  const discriminator = Buffer.from([0x2f, 0x51, 0x40, 0x00, 0x60, 0x38, 0x69, 0x07]);
  
  // fee_bps (2% = 200 basis points)
  const feeBps = Buffer.alloc(2);
  feeBps.writeUInt16LE(200);
  
  const data = Buffer.concat([discriminator, feeBps]);
  
  const keys = [
    { pubkey: admin.publicKey, isSigner: true, isWritable: true },
    { pubkey: marketplacePDA, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];
  
  const tx = new Transaction().add({
    keys,
    programId: MARKETPLACE_PROGRAM_ID,
    data,
  });
  
  const sig = await sendAndConfirmTransaction(connection, tx, [admin]);
  console.log("✅ Marketplace initialized! Signature:", sig);
}

main().catch(console.error);
