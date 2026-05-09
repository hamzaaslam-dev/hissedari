// Server-side helpers for using the on-chain crowdfunding admin keypair.
//
// The on-chain crowdfunding program has its own admin authority — the wallet
// that ran `scripts/init-platform.ts`. Only that wallet can call
// `add_to_whitelist`, so when our browser admin approves a registration
// request we need to sign that whitelist transaction server-side using the
// same keypair.
//
// Resolution order:
//   1. SOLANA_ADMIN_KEYPAIR env var (preferred for Vercel/serverless).
//      Accepts either:
//        - a JSON array of 64 bytes, e.g. "[123,45,...]"
//        - a base58-encoded secret key string
//   2. ~/.config/solana/id.json (local dev fallback)
//
// This file MUST only be imported from server-only code (API routes,
// server actions). It deliberately uses Node `fs` so it'll fail at build
// time if accidentally pulled into a client bundle.

import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import fs from "fs";
import os from "os";
import path from "path";

let cached: Keypair | null = null;

export function loadOnChainAdminKeypair(): Keypair {
  if (cached) return cached;

  const envValue = process.env.SOLANA_ADMIN_KEYPAIR;
  if (envValue && envValue.trim().length > 0) {
    cached = parseKeypair(envValue.trim());
    return cached;
  }

  const fallbackPath = path.join(os.homedir(), ".config", "solana", "id.json");
  if (fs.existsSync(fallbackPath)) {
    try {
      const raw = fs.readFileSync(fallbackPath, "utf-8");
      cached = parseKeypair(raw);
      return cached;
    } catch (e) {
      throw new Error(
        `Failed to read on-chain admin keypair from ${fallbackPath}: ${
          e instanceof Error ? e.message : String(e)
        }`
      );
    }
  }

  throw new Error(
    "On-chain admin keypair is not configured. Set the SOLANA_ADMIN_KEYPAIR env var (JSON array or base58) or place the keypair at ~/.config/solana/id.json."
  );
}

function parseKeypair(value: string): Keypair {
  const trimmed = value.trim();
  // JSON array of bytes
  if (trimmed.startsWith("[")) {
    const arr = JSON.parse(trimmed);
    if (!Array.isArray(arr) || arr.length !== 64) {
      throw new Error("Keypair JSON must be an array of 64 bytes");
    }
    return Keypair.fromSecretKey(Uint8Array.from(arr));
  }
  // base58 secret key
  const decoded = bs58.decode(trimmed);
  if (decoded.length !== 64) {
    throw new Error(
      `Decoded base58 keypair has ${decoded.length} bytes, expected 64`
    );
  }
  return Keypair.fromSecretKey(decoded);
}
