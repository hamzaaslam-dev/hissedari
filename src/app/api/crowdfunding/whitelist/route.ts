import { NextRequest, NextResponse } from "next/server";
import {
  Connection,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
  clusterApiUrl,
} from "@solana/web3.js";
import { isRegistrationWhitelisted } from "@/lib/registrationWhitelist";
import { loadOnChainAdminKeypair } from "@/lib/server/onChainAdmin";
import {
  addToWhitelistInstruction,
  getWhitelistEntryPDA,
  isWalletWhitelisted as checkOnChainWhitelisted,
  CROWDFUNDING_PROGRAM_ID,
} from "@/lib/crowdfundingClient";

export const runtime = "nodejs";

// POST /api/crowdfunding/whitelist
//   body: { walletToWhitelist: string, requesterAddress?: string }
//   - requesterAddress is the wallet calling this endpoint (the browser
//     admin). Must be in REGISTRATION_WHITELIST.
//   - walletToWhitelist is the wallet whose on-chain crowdfunding
//     whitelist_entry PDA we'll initialize.
//
// Idempotent: if the wallet is already whitelisted on-chain we return
// success without sending a tx.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { walletToWhitelist, requesterAddress } = body as {
      walletToWhitelist?: string;
      requesterAddress?: string;
    };

    if (!walletToWhitelist) {
      return NextResponse.json(
        { error: "walletToWhitelist is required" },
        { status: 400 }
      );
    }
    if (!requesterAddress || !isRegistrationWhitelisted(requesterAddress)) {
      return NextResponse.json(
        {
          error:
            "Only browser-admin wallets can request on-chain whitelisting.",
        },
        { status: 403 }
      );
    }

    let walletPk: PublicKey;
    try {
      walletPk = new PublicKey(walletToWhitelist);
    } catch {
      return NextResponse.json(
        { error: "walletToWhitelist is not a valid base58 public key" },
        { status: 400 }
      );
    }

    const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK || "devnet";
    const rpcUrl =
      network === "localhost"
        ? "http://localhost:8899"
        : clusterApiUrl(network as "devnet" | "mainnet-beta");
    const connection = new Connection(rpcUrl, "confirmed");

    const alreadyWhitelisted = await checkOnChainWhitelisted(walletPk);
    if (alreadyWhitelisted) {
      return NextResponse.json({
        success: true,
        alreadyWhitelisted: true,
        wallet: walletToWhitelist,
      });
    }

    // Also short-circuit if the whitelist_entry PDA already exists but is
    // marked inactive — re-running add_to_whitelist would fail because the
    // account is `init` (not `init_if_needed`). Surface a clear error so
    // the admin can re-enable it manually if needed.
    const [whitelistEntry] = getWhitelistEntryPDA(walletPk);
    const existingAccount = await connection.getAccountInfo(whitelistEntry);
    if (existingAccount) {
      return NextResponse.json({
        success: true,
        alreadyWhitelisted: true,
        note:
          "whitelist_entry already exists on-chain (it may be inactive — use the on-chain admin tools to re-enable).",
        wallet: walletToWhitelist,
      });
    }

    let admin;
    try {
      admin = loadOnChainAdminKeypair();
    } catch (e) {
      return NextResponse.json(
        {
          error:
            e instanceof Error
              ? e.message
              : "Failed to load on-chain admin keypair.",
        },
        { status: 500 }
      );
    }

    const tx = await addToWhitelistInstruction(admin.publicKey, walletPk);
    const { blockhash } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = admin.publicKey;

    const signature = await sendAndConfirmTransaction(connection, tx, [admin], {
      commitment: "confirmed",
    });

    return NextResponse.json({
      success: true,
      wallet: walletToWhitelist,
      signature,
      programId: CROWDFUNDING_PROGRAM_ID.toBase58(),
    });
  } catch (e) {
    console.error("on-chain whitelist error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to whitelist on-chain: ${msg}` },
      { status: 500 }
    );
  }
}
