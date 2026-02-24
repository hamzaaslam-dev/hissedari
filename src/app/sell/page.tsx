"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getAssociatedTokenAddress, getAccount } from "@solana/spl-token";
import { ArrowLeft, Coins, Tag, Loader2, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getRegisteredProperties, RegisteredProperty } from "@/lib/propertyStore";
import { createListing, solToLamports, fetchListing } from "@/lib/marketplaceClient";
import { connection } from "@/lib/solana";

interface TokenHolding {
  property: RegisteredProperty;
  balance: number;
  mint: PublicKey;
}

export default function SellPage() {
  const router = useRouter();
  const { publicKey, signTransaction, connected } = useWallet();
  const [holdings, setHoldings] = useState<TokenHolding[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProperty, setSelectedProperty] = useState<TokenHolding | null>(null);
  const [sellAmount, setSellAmount] = useState(1);
  const [pricePerToken, setPricePerToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (connected && publicKey) {
      loadHoldings();
    } else {
      setLoading(false);
    }
  }, [connected, publicKey]);

  const loadHoldings = async () => {
    if (!publicKey) return;
    
    setLoading(true);
    try {
      const properties = getRegisteredProperties();
      const tokenHoldings: TokenHolding[] = [];

      for (const property of properties) {
        if (!property.mintAddress) continue;

        try {
          const mint = new PublicKey(property.mintAddress);
          const tokenAccount = await getAssociatedTokenAddress(mint, publicKey);
          
          const account = await getAccount(connection, tokenAccount);
          const balance = Number(account.amount);

          if (balance > 0) {
            tokenHoldings.push({
              property,
              balance,
              mint,
            });
          }
        } catch {
          // Token account doesn't exist or no balance
        }
      }

      setHoldings(tokenHoldings);
    } catch (error) {
      console.error("Error loading holdings:", error);
    }
    setLoading(false);
  };

  const handleCreateListing = async () => {
    if (!publicKey || !signTransaction || !selectedProperty) return;

    const price = parseFloat(pricePerToken);
    if (isNaN(price) || price <= 0) {
      setError("Please enter a valid price");
      return;
    }

    if (sellAmount <= 0 || sellAmount > selectedProperty.balance) {
      setError("Invalid amount");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Check if listing already exists
      const existingListing = await fetchListing(publicKey, selectedProperty.mint);
      if (existingListing && existingListing.isActive) {
        setError("You already have an active listing for this token. Cancel it first to create a new one.");
        setSubmitting(false);
        return;
      }

      const priceInLamports = solToLamports(price);
      const signature = await createListing(
        { publicKey, signTransaction },
        selectedProperty.mint,
        sellAmount,
        priceInLamports
      );

      console.log("Listing created:", signature);
      setSuccess(true);
    } catch (err: any) {
      console.error("Listing error:", err);
      setError(err.message || "Failed to create listing");
    }

    setSubmitting(false);
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 py-12 px-4 flex items-center justify-center">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 max-w-md w-full text-center border border-gray-700"
        >
          <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-4">Listing Created!</h2>
          <p className="text-gray-400 mb-6">
            Your {sellAmount} tokens are now listed for sale at {pricePerToken} SOL each
          </p>
          <div className="flex gap-4">
            <Link
              href="/marketplace"
              className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-medium py-3 rounded-lg transition-colors"
            >
              View Marketplace
            </Link>
            <button
              onClick={() => {
                setSuccess(false);
                setSelectedProperty(null);
                setSellAmount(1);
                setPricePerToken("");
                loadHoldings();
              }}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-medium py-3 rounded-lg transition-colors"
            >
              Create Another
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-white">Sell Tokens</h1>
            <p className="text-gray-400">List your property tokens on the marketplace</p>
          </div>
        </div>

        {!connected ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-yellow-500/10 border border-yellow-500/50 rounded-xl p-8 text-center"
          >
            <p className="text-yellow-400 text-lg mb-4">
              Connect your wallet to view and sell your tokens
            </p>
          </motion.div>
        ) : loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
          </div>
        ) : holdings.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-800/50 rounded-xl p-12 text-center border border-gray-700"
          >
            <div className="text-6xl mb-4">📦</div>
            <h3 className="text-2xl font-bold text-white mb-2">No Tokens Found</h3>
            <p className="text-gray-400 mb-6">
              You don't have any property tokens to sell. Invest in properties to get tokens.
            </p>
            <Link
              href="/properties"
              className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-medium px-6 py-3 rounded-lg transition-colors"
            >
              Browse Properties
            </Link>
          </motion.div>
        ) : (
          <div className="grid md:grid-cols-2 gap-8">
            {/* Token Selection */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-4"
            >
              <h2 className="text-xl font-semibold text-white mb-4">Select Token to Sell</h2>
              
              {holdings.map((holding) => (
                <button
                  key={holding.property.id}
                  onClick={() => {
                    setSelectedProperty(holding);
                    setSellAmount(1);
                    setError(null);
                  }}
                  className={`w-full p-4 rounded-xl border transition-all text-left ${
                    selectedProperty?.property.id === holding.property.id
                      ? "bg-emerald-500/10 border-emerald-500"
                      : "bg-gray-800/50 border-gray-700 hover:border-gray-600"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-emerald-500/20 to-blue-500/20 rounded-lg flex items-center justify-center">
                      <span className="text-2xl">🏠</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-white">{holding.property.name}</h3>
                      <p className="text-gray-400 text-sm">{holding.property.location}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Coins className="w-4 h-4 text-emerald-400" />
                        <span className="text-emerald-400 font-medium">
                          {holding.balance.toLocaleString()} tokens
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </motion.div>

            {/* Listing Form */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700 h-fit"
            >
              <h2 className="text-xl font-semibold text-white mb-6">Listing Details</h2>

              {selectedProperty ? (
                <div className="space-y-6">
                  {/* Selected Property Info */}
                  <div className="p-4 bg-gray-700/30 rounded-lg">
                    <p className="text-gray-400 text-sm">Selected Property</p>
                    <p className="text-white font-medium">{selectedProperty.property.name}</p>
                    <p className="text-emerald-400 text-sm">
                      Available: {selectedProperty.balance.toLocaleString()} tokens
                    </p>
                  </div>

                  {/* Amount */}
                  <div>
                    <label className="block text-gray-400 text-sm mb-2">
                      Amount to Sell
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        max={selectedProperty.balance}
                        value={sellAmount}
                        onChange={(e) => setSellAmount(parseInt(e.target.value) || 1)}
                        className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-emerald-500 focus:outline-none"
                      />
                      <button
                        onClick={() => setSellAmount(selectedProperty.balance)}
                        className="px-4 py-3 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors"
                      >
                        Max
                      </button>
                    </div>
                  </div>

                  {/* Price */}
                  <div>
                    <label className="block text-gray-400 text-sm mb-2">
                      Price per Token (SOL)
                    </label>
                    <div className="relative">
                      <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="number"
                        step="0.001"
                        min="0.001"
                        value={pricePerToken}
                        onChange={(e) => setPricePerToken(e.target.value)}
                        placeholder="0.01"
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg pl-10 pr-4 py-3 text-white focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Summary */}
                  {pricePerToken && (
                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                      <div className="flex justify-between text-gray-400 text-sm mb-2">
                        <span>Tokens</span>
                        <span>{sellAmount}</span>
                      </div>
                      <div className="flex justify-between text-gray-400 text-sm mb-2">
                        <span>Price per Token</span>
                        <span>{pricePerToken} SOL</span>
                      </div>
                      <div className="flex justify-between text-white font-medium pt-2 border-t border-emerald-500/30">
                        <span>Total Value</span>
                        <span className="text-emerald-400">
                          {(sellAmount * parseFloat(pricePerToken || "0")).toFixed(4)} SOL
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Error */}
                  {error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                      <p className="text-red-400 text-sm">{error}</p>
                    </div>
                  )}

                  {/* Submit */}
                  <button
                    onClick={handleCreateListing}
                    disabled={submitting || !pricePerToken}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Creating Listing...
                      </>
                    ) : (
                      <>
                        <Tag className="w-5 h-5" />
                        Create Listing
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-400">
                  <Coins className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Select a token from the left to create a listing</p>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
