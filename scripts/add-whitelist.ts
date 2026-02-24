import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
  SystemProgram,
} from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";

const CROWDFUNDING_PROGRAM_ID = new PublicKey(
  "2ghvWvTvMHdACLuGztbjERbvMPwwQcFTag6a6eU7RifY"
);

function getPlatformConfigPDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("platform_config")],
    CROWDFUNDING_PROGRAM_ID
  );
}

function getWhitelistEntryPDA(wallet: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("whitelist"), wallet.toBuffer()],
    CROWDFUNDING_PROGRAM_ID
  );
}

async function main() {
  const walletToWhitelist = new PublicKey(process.argv[2] || "2DyPEBfRtipfap7jzATXxsCLm6oLq3r6kXVLyyVjmxLB");
  
  const rpcUrl = process.env.RPC_URL || "https://api.devnet.solana.com";
  const connection = new Connection(rpcUrl, "confirmed");

  const keypairPath = path.join(process.env.HOME || "", ".config/solana/id.json");
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const admin = Keypair.fromSecretKey(Uint8Array.from(keypairData));

  console.log("Admin wallet:", admin.publicKey.toBase58());
  console.log("Wallet to whitelist:", walletToWhitelist.toBase58());

  const [platformConfig] = getPlatformConfigPDA();
  const [whitelistEntry] = getWhitelistEntryPDA(walletToWhitelist);

  const whitelistInfo = await connection.getAccountInfo(whitelistEntry);

  if (whitelistInfo) {
    console.log("✅ Wallet already whitelisted!");
    return;
  }

  console.log("Adding to whitelist...");

  const discriminator = Buffer.from([
    0x9d, 0xd3, 0x34, 0x36, 0x90, 0x51, 0x05, 0x37,
  ]);

  const keys = [
    { pubkey: admin.publicKey, isSigner: true, isWritable: true },
    { pubkey: platformConfig, isSigner: false, isWritable: false },
    { pubkey: walletToWhitelist, isSigner: false, isWritable: false },
    { pubkey: whitelistEntry, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  const tx = new Transaction().add({
    keys,
    programId: CROWDFUNDING_PROGRAM_ID,
    data: discriminator,
  });

  const sig = await sendAndConfirmTransaction(connection, tx, [admin]);
  console.log("✅ Wallet whitelisted! Signature:", sig);
}

main().catch(console.error);
