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
  const rpcUrl = process.env.RPC_URL || "http://localhost:8899";
  const connection = new Connection(rpcUrl, "confirmed");

  const keypairPath =
    process.env.KEYPAIR_PATH ||
    path.join(process.env.HOME || "", ".config/solana/id.json");

  const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const admin = Keypair.fromSecretKey(Uint8Array.from(keypairData));

  console.log("Admin wallet:", admin.publicKey.toBase58());
  console.log("RPC URL:", rpcUrl);
  console.log("Program ID:", CROWDFUNDING_PROGRAM_ID.toBase58());

  const balance = await connection.getBalance(admin.publicKey);
  console.log("Balance:", balance / 1e9, "SOL");

  const [platformConfig] = getPlatformConfigPDA();
  console.log("Platform Config PDA:", platformConfig.toBase58());

  const platformConfigInfo = await connection.getAccountInfo(platformConfig);

  if (platformConfigInfo) {
    console.log("Platform already initialized!");
  } else {
    console.log("Initializing platform...");

    // initialize_platform discriminator: SHA256("global:initialize_platform")[0..8]
    const discriminator = Buffer.from([
      0x77, 0xc9, 0x65, 0x2d, 0x4b, 0x7a, 0x59, 0x03,
    ]);

    const data = Buffer.concat([discriminator, admin.publicKey.toBuffer()]);

    const keys = [
      { pubkey: admin.publicKey, isSigner: true, isWritable: true },
      { pubkey: platformConfig, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ];

    const tx = new Transaction().add({
      keys,
      programId: CROWDFUNDING_PROGRAM_ID,
      data,
    });

    const sig = await sendAndConfirmTransaction(connection, tx, [admin]);
    console.log("Platform initialized! Signature:", sig);
  }

  console.log("\nAdding admin to whitelist...");

  const [whitelistEntry] = getWhitelistEntryPDA(admin.publicKey);
  console.log("Whitelist Entry PDA:", whitelistEntry.toBase58());

  const whitelistInfo = await connection.getAccountInfo(whitelistEntry);

  if (whitelistInfo) {
    console.log("Admin already whitelisted!");
  } else {
    // add_to_whitelist discriminator: SHA256("global:add_to_whitelist")[0..8]
    const discriminator = Buffer.from([
      0x9d, 0xd3, 0x34, 0x36, 0x90, 0x51, 0x05, 0x37,
    ]);

    const keys = [
      { pubkey: admin.publicKey, isSigner: true, isWritable: true },
      { pubkey: platformConfig, isSigner: false, isWritable: false },
      { pubkey: admin.publicKey, isSigner: false, isWritable: false },
      { pubkey: whitelistEntry, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ];

    const tx = new Transaction().add({
      keys,
      programId: CROWDFUNDING_PROGRAM_ID,
      data: discriminator,
    });

    const sig = await sendAndConfirmTransaction(connection, tx, [admin]);
    console.log("Admin whitelisted! Signature:", sig);
  }

  console.log("\n✅ Platform setup complete!");
  console.log("Admin wallet (whitelisted):", admin.publicKey.toBase58());
}

main().catch(console.error);
