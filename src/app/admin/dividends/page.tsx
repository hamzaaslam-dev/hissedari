"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import Link from "next/link";
import {
  ArrowLeft,
  Coins,
  Send,
  CheckCircle2,
  Loader2,
  Building2,
  Users,
  Wallet,
  AlertCircle,
} from "lucide-react";
import { getRegisteredProperties, getPropertiesByOwner, RegisteredProperty } from "@/lib/propertyStore";
import {
  initializeDividendPool,
  depositDividend,
  startDistribution,
  fetchDividendPool,
  getDividendPoolPDA,
  DividendPool,
} from "@/lib/dividendClient";
import { connection, getSolBalance } from "@/lib/solana";
import { getMint } from "@solana/spl-token";

interface PropertyWithDividend {
  property: RegisteredProperty;
  dividendPool: DividendPool | null;
  tokenSupply: number;
}

export default function AdminDividendsPage() {
  const { publicKey, signTransaction, connected } = useWallet();
  const [properties, setProperties] = useState<PropertyWithDividend[]>([]);
  const [loading, setLoading] = useState(true);
  const [solBalance, setSolBalance] = useState(0);
  const [selectedProperty, setSelectedProperty] = useState<PropertyWithDividend | null>(null);
  const [dividendAmount, setDividendAmount] = useState("");
  const [processing, setProcessing] = useState(false);
  const [step, setStep] = useState<"select" | "deposit" | "distribute" | "success">("select");
  const [txSignature, setTxSignature] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (connected && publicKey) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [connected, publicKey]);

  const loadData = async () => {
    if (!publicKey) return;
    
    setLoading(true);
    try {
      // Get SOL balance
      const balance = await getSolBalance(publicKey);
      setSolBalance(balance);

      // Get properties owned by this wallet
      const ownedProperties = getPropertiesByOwner(publicKey.toBase58());
      
      // Fetch dividend pool info for each property
      const propertiesWithDividends: PropertyWithDividend[] = [];
      
      for (const property of ownedProperties) {
        if (!property.mintAddress) continue;
        
        try {
          const mint = new PublicKey(property.mintAddress);
          const pool = await fetchDividendPool(mint);
          
          // Get token supply
          let tokenSupply = property.totalTokens;
          try {
            const mintInfo = await getMint(connection, mint);
            tokenSupply = Number(mintInfo.supply);
          } catch {
            // Use default
          }
          
          propertiesWithDividends.push({
            property,
            dividendPool: pool,
            tokenSupply,
          });
        } catch (err) {
          propertiesWithDividends.push({
            property,
            dividendPool: null,
            tokenSupply: property.totalTokens,
          });
        }
      }
      
      setProperties(propertiesWithDividends);
    } catch (error) {
      console.error("Error loading data:", error);
    }
    setLoading(false);
  };

  const handleInitializePool = async (prop: PropertyWithDividend) => {
    if (!publicKey || !signTransaction) return;
    
    setProcessing(true);
    setError(null);
    
    try {
      const mint = new PublicKey(prop.property.mintAddress);
      const result = await initializeDividendPool(
        { publicKey, signTransaction },
        mint,
        prop.property.id,
        30 // Monthly distribution
      );
      
      setTxSignature(result.signature);
      await loadData();
      setSelectedProperty(null);
    } catch (err: any) {
      console.error("Initialize error:", err);
      setError(err.message || "Failed to initialize dividend pool");
    }
    setProcessing(false);
  };

  const handleDepositDividend = async () => {
    if (!publicKey || !signTransaction || !selectedProperty) return;
    
    const amount = parseFloat(dividendAmount);
    if (isNaN(amount) || amount <= 0) {
      setError("Please enter a valid amount");
      return;
    }
    
    if (amount > solBalance) {
      setError("Insufficient SOL balance");
      return;
    }
    
    setProcessing(true);
    setError(null);
    
    try {
      const mint = new PublicKey(selectedProperty.property.mintAddress);
      const signature = await depositDividend(
        { publicKey, signTransaction },
        mint,
        amount
      );
      
      setTxSignature(signature);
      setStep("distribute");
      await loadData();
    } catch (err: any) {
      console.error("Deposit error:", err);
      setError(err.message || "Failed to deposit dividend");
    }
    setProcessing(false);
  };

  const handleStartDistribution = async () => {
    if (!publicKey || !signTransaction || !selectedProperty) return;
    
    setProcessing(true);
    setError(null);
    
    try {
      const mint = new PublicKey(selectedProperty.property.mintAddress);
      const pool = await fetchDividendPool(mint);
      
      if (!pool) {
        setError("Dividend pool not found");
        setProcessing(false);
        return;
      }
      
      const signature = await startDistribution(
        { publicKey, signTransaction },
        mint,
        pool.currentEpoch
      );
      
      setTxSignature(signature);
      setStep("success");
      await loadData();
    } catch (err: any) {
      console.error("Distribution error:", err);
      setError(err.message || "Failed to start distribution");
    }
    setProcessing(false);
  };

  const resetFlow = () => {
    setStep("select");
    setSelectedProperty(null);
    setDividendAmount("");
    setError(null);
    setTxSignature("");
  };

  if (!connected) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 py-12 px-4 flex items-center justify-center">
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 max-w-md w-full text-center border border-gray-700">
          <Wallet className="w-16 h-16 text-amber-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-4">Connect Wallet</h2>
          <p className="text-gray-400">
            Connect your whitelisted wallet to distribute dividends to shareholders
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/dashboard"
            className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-white">Distribute Dividends</h1>
            <p className="text-gray-400">Send rental income to all token holders</p>
          </div>
        </div>

        {/* Wallet Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-xl p-6 mb-8"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center">
                <Wallet className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <p className="text-gray-400 text-sm">Connected Wallet</p>
                <p className="text-white font-mono">
                  {publicKey?.toBase58().slice(0, 8)}...{publicKey?.toBase58().slice(-8)}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-gray-400 text-sm">Available Balance</p>
              <p className="text-2xl font-bold text-amber-400">{solBalance.toFixed(4)} SOL</p>
            </div>
          </div>
        </motion.div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-500"></div>
          </div>
        ) : step === "select" ? (
          <>
            {/* Properties List */}
            {properties.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gray-800/50 rounded-xl p-12 text-center border border-gray-700"
              >
                <Building2 className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">No Properties Found</h3>
                <p className="text-gray-400 mb-6">
                  You don't own any registered properties. Register a property to distribute dividends.
                </p>
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-medium px-6 py-3 rounded-lg transition-colors"
                >
                  Register Property
                </Link>
              </motion.div>
            ) : (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-white mb-4">Your Properties</h2>
                
                {properties.map((prop, index) => (
                  <motion.div
                    key={prop.property.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 hover:border-amber-500/50 transition-all"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-lg flex items-center justify-center">
                          {prop.property.image ? (
                            <img
                              src={prop.property.image}
                              alt={prop.property.name}
                              className="w-full h-full object-cover rounded-lg"
                            />
                          ) : (
                            <Building2 className="w-8 h-8 text-amber-400" />
                          )}
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-white">{prop.property.name}</h3>
                          <p className="text-gray-400 text-sm">{prop.property.location}</p>
                          <div className="flex items-center gap-4 mt-2 text-sm">
                            <span className="text-gray-400">
                              <Users className="w-4 h-4 inline mr-1" />
                              {prop.tokenSupply.toLocaleString()} tokens
                            </span>
                            {prop.dividendPool && (
                              <span className="text-emerald-400">
                                <CheckCircle2 className="w-4 h-4 inline mr-1" />
                                Pool Active
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex flex-col gap-2">
                        {prop.dividendPool ? (
                          <>
                            <div className="text-right text-sm mb-2">
                              <p className="text-gray-400">Pending Distribution</p>
                              <p className="text-amber-400 font-bold">
                                {(prop.dividendPool.totalDepositedCurrentEpoch / LAMPORTS_PER_SOL).toFixed(4)} SOL
                              </p>
                            </div>
                            <button
                              onClick={() => {
                                setSelectedProperty(prop);
                                setStep("deposit");
                              }}
                              className="bg-amber-500 hover:bg-amber-600 text-white font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                            >
                              <Send className="w-4 h-4" />
                              Send Dividends
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleInitializePool(prop)}
                            disabled={processing}
                            className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-600 text-white font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                          >
                            {processing ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Coins className="w-4 h-4" />
                            )}
                            Initialize Pool
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </>
        ) : step === "deposit" && selectedProperty ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-800/50 border border-gray-700 rounded-xl p-8"
          >
            <h2 className="text-2xl font-bold text-white mb-6">Deposit Dividend</h2>
            
            <div className="bg-gray-700/30 rounded-lg p-4 mb-6">
              <p className="text-gray-400 text-sm">Property</p>
              <p className="text-white font-semibold">{selectedProperty.property.name}</p>
              <p className="text-gray-400 text-sm mt-2">
                Total Shareholders: {selectedProperty.tokenSupply.toLocaleString()} token holders
              </p>
            </div>
            
            <div className="mb-6">
              <label className="block text-gray-400 text-sm mb-2">
                Dividend Amount (SOL)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.001"
                  min="0.001"
                  value={dividendAmount}
                  onChange={(e) => setDividendAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white text-xl focus:border-amber-500 focus:outline-none"
                />
                <button
                  onClick={() => setDividendAmount(solBalance.toFixed(4))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-400 hover:text-amber-300 text-sm"
                >
                  Max
                </button>
              </div>
              <p className="text-gray-500 text-sm mt-2">
                Available: {solBalance.toFixed(4)} SOL
              </p>
            </div>
            
            {dividendAmount && parseFloat(dividendAmount) > 0 && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-6">
                <p className="text-amber-400 font-medium mb-2">Distribution Preview</p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-400">Per Token</p>
                    <p className="text-white font-medium">
                      {((parseFloat(dividendAmount) * LAMPORTS_PER_SOL) / selectedProperty.tokenSupply).toFixed(6)} lamports
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400">Total Distribution</p>
                    <p className="text-amber-400 font-medium">{dividendAmount} SOL</p>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-400" />
                <p className="text-red-400">{error}</p>
              </div>
            )}
            
            <div className="flex gap-4">
              <button
                onClick={resetFlow}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-medium py-3 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDepositDividend}
                disabled={processing || !dividendAmount || parseFloat(dividendAmount) <= 0}
                className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-600 text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {processing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Depositing...
                  </>
                ) : (
                  <>
                    <Coins className="w-5 h-5" />
                    Deposit {dividendAmount || "0"} SOL
                  </>
                )}
              </button>
            </div>
          </motion.div>
        ) : step === "distribute" && selectedProperty ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-800/50 border border-gray-700 rounded-xl p-8 text-center"
          >
            <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-4">Dividend Deposited!</h2>
            <p className="text-gray-400 mb-6">
              {dividendAmount} SOL has been deposited. Now distribute it to all token holders.
            </p>
            
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6 flex items-center justify-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-400" />
                <p className="text-red-400">{error}</p>
              </div>
            )}
            
            <button
              onClick={handleStartDistribution}
              disabled={processing}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:from-gray-600 disabled:to-gray-600 text-white font-bold py-4 rounded-lg transition-all flex items-center justify-center gap-2"
            >
              {processing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Distributing to Shareholders...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Distribute to All Token Holders
                </>
              )}
            </button>
            <p className="text-gray-500 text-sm mt-4">
              This will make dividends claimable by all {selectedProperty.tokenSupply.toLocaleString()} token holders proportionally.
            </p>
          </motion.div>
        ) : step === "success" ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-800/50 border border-emerald-500/30 rounded-xl p-8 text-center"
          >
            <div className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-12 h-12 text-emerald-400" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-4">Dividends Distributed!</h2>
            <p className="text-gray-400 mb-6">
              {dividendAmount} SOL has been distributed to all token holders of {selectedProperty?.property.name}.
              They can now claim their share from the dashboard.
            </p>
            
            {txSignature && (
              <a
                href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 mb-6"
              >
                View Transaction ↗
              </a>
            )}
            
            <div className="flex gap-4 mt-6">
              <button
                onClick={resetFlow}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-medium py-3 rounded-lg transition-colors"
              >
                Distribute More
              </button>
              <Link
                href="/dashboard"
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-medium py-3 rounded-lg transition-colors text-center"
              >
                Go to Dashboard
              </Link>
            </div>
          </motion.div>
        ) : null}
      </div>
    </div>
  );
}
