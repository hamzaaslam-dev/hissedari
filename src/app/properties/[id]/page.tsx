"use client";

import { useState, use, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import {
  ArrowLeft,
  MapPin,
  Building2,
  Calendar,
  Maximize,
  Bed,
  Bath,
  TrendingUp,
  Coins,
  Users,
  Shield,
  FileText,
  Plus,
  Minus,
  Wallet,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  Droplets,
} from "lucide-react";
import { getPropertyById, Property } from "@/data/properties";
import { getRegisteredPropertyById, RegisteredProperty } from "@/lib/propertyStore";
import { getSolBalance, getExplorerUrl, SOLANA_NETWORK, connection } from "@/lib/solana";
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";

interface PropertyPageProps {
  params: Promise<{ id: string }>;
}

// SOL price in USD (approximate - in production you'd fetch this from an API)
const SOL_PRICE_USD = 150;

export default function PropertyDetailPage({ params }: PropertyPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { connected, publicKey, signTransaction } = useWallet();
  const { setVisible } = useWalletModal();
  
  const [selectedImage, setSelectedImage] = useState(0);
  const [tokenAmount, setTokenAmount] = useState(1);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [solBalance, setSolBalance] = useState<number>(0);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);

  // Try to get property from both sources
  const defaultProperty = getPropertyById(id);
  const registeredProperty = getRegisteredPropertyById(id);
  const property: (Property & { mintAddress?: string; ownerAddress?: string }) | undefined = 
    registeredProperty || defaultProperty;
  
  // Check if this is a user-registered property (has blockchain data)
  const isBlockchainProperty = !!(registeredProperty?.mintAddress);

  // Fetch SOL balance
  useEffect(() => {
    async function fetchBalance() {
      if (publicKey) {
        try {
          const balance = await getSolBalance(publicKey);
          setSolBalance(balance);
        } catch (e) {
          console.error("Error fetching balance:", e);
        }
      }
    }
    fetchBalance();
  }, [publicKey]);

  if (!property) {
    return (
      <div className="min-h-screen pt-28 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Property Not Found</h1>
          <Link href="/properties" className="btn-primary">
            Browse Properties
          </Link>
        </div>
      </div>
    );
  }

  const fundingProgress = ((property.totalTokens - property.availableTokens) / property.totalTokens) * 100;
  const totalInvestmentUSD = tokenAmount * property.tokenPrice;
  const totalInvestmentSOL = totalInvestmentUSD / SOL_PRICE_USD;
  const estimatedYearlyReturn = (totalInvestmentUSD * property.annualYield) / 100;
  const ownershipPercentage = (tokenAmount / property.totalTokens) * 100;

  // Handle purchase with SOL
  const handlePurchaseWithSOL = async () => {
    if (!publicKey || !signTransaction || !property) return;
    
    setIsPurchasing(true);
    setPurchaseError(null);
    
    try {
      // Get the owner's public key (for user-registered properties)
      // For demo properties, we'll use a demo wallet address
      const ownerAddress = (property as RegisteredProperty).ownerAddress || 
        "DemoWa11etAddressForTestingPurposesOnly1111111";
      
      let ownerPubkey: PublicKey;
      try {
        ownerPubkey = new PublicKey(ownerAddress);
      } catch {
        // If invalid address, use a demo address
        ownerPubkey = publicKey; // Send to self for demo
      }

      // Create transaction to send SOL
      const lamports = Math.floor(totalInvestmentSOL * LAMPORTS_PER_SOL);
      
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: ownerPubkey,
          lamports,
        })
      );

      // Get recent blockhash
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      // Sign transaction
      const signedTx = await signTransaction(transaction);
      
      // Send transaction
      const signature = await connection.sendRawTransaction(signedTx.serialize());
      await connection.confirmTransaction(signature, "confirmed");
      
      setTxSignature(signature);
      setPurchaseSuccess(true);
      
      // Update SOL balance
      const newBalance = await getSolBalance(publicKey);
      setSolBalance(newBalance);
      
    } catch (e: unknown) {
      console.error("Purchase error:", e);
      const errorMessage = e instanceof Error ? e.message : "Transaction failed";
      setPurchaseError(errorMessage);
    }
    
    setIsPurchasing(false);
  };

  const statusColors = {
    funding: "bg-accent/20 text-accent",
    funded: "bg-blue-500/20 text-blue-400",
    active: "bg-secondary/20 text-secondary",
  };

  const statusLabels = {
    funding: "Open for Investment",
    funded: "Fully Funded",
    active: "Generating Returns",
  };

  const handlePurchase = () => {
    if (!connected) {
      setVisible(true);
      return;
    }
    setShowPurchaseModal(true);
  };

  return (
    <div className="min-h-screen pt-28 pb-20">
      {/* Background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-background" />
        <div className="absolute inset-0 grid-pattern opacity-30" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back Button */}
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={() => router.back()}
          className="flex items-center gap-2 text-foreground-muted hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Properties
        </motion.button>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Image Gallery */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="relative aspect-video rounded-2xl overflow-hidden glass-card">
                <Image
                  src={property.images[selectedImage]}
                  alt={property.name}
                  fill
                  className="object-cover"
                  priority
                />
                <div className="absolute top-4 left-4">
                  <span className={`px-4 py-2 rounded-full text-sm font-semibold ${statusColors[property.status]}`}>
                    {statusLabels[property.status]}
                  </span>
                </div>
                <div className="absolute bottom-4 right-4">
                  <span className="solana-badge">Solana</span>
                </div>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-2">
                {property.images.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImage(index)}
                    className={`relative w-24 h-16 rounded-lg overflow-hidden flex-shrink-0 transition-all ${
                      selectedImage === index
                        ? "ring-2 ring-accent"
                        : "opacity-60 hover:opacity-100"
                    }`}
                  >
                    <Image src={image} alt="" fill className="object-cover" />
                  </button>
                ))}
              </div>
            </motion.div>

            {/* Property Info */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass-card p-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
                <div>
                  <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                    {property.name}
                  </h1>
                  <div className="flex items-center text-foreground-muted">
                    <MapPin className="w-5 h-5 mr-2" />
                    {property.location}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-foreground-muted">Property Value</p>
                  <p className="text-2xl font-bold text-gradient-gold">
                    PKR {(property.priceInPKR / 1000000).toFixed(1)}M
                  </p>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="glass-card p-4 text-center">
                  <Building2 className="w-5 h-5 text-accent mx-auto mb-2" />
                  <p className="text-sm text-foreground-muted">Type</p>
                  <p className="font-semibold capitalize">{property.propertyType}</p>
                </div>
                <div className="glass-card p-4 text-center">
                  <Maximize className="w-5 h-5 text-accent mx-auto mb-2" />
                  <p className="text-sm text-foreground-muted">Size</p>
                  <p className="font-semibold">{property.size.toLocaleString()} sq ft</p>
                </div>
                {property.bedrooms && (
                  <div className="glass-card p-4 text-center">
                    <Bed className="w-5 h-5 text-accent mx-auto mb-2" />
                    <p className="text-sm text-foreground-muted">Bedrooms</p>
                    <p className="font-semibold">{property.bedrooms}</p>
                  </div>
                )}
                {property.bathrooms && (
                  <div className="glass-card p-4 text-center">
                    <Bath className="w-5 h-5 text-accent mx-auto mb-2" />
                    <p className="text-sm text-foreground-muted">Bathrooms</p>
                    <p className="font-semibold">{property.bathrooms}</p>
                  </div>
                )}
                <div className="glass-card p-4 text-center">
                  <Calendar className="w-5 h-5 text-accent mx-auto mb-2" />
                  <p className="text-sm text-foreground-muted">Year Built</p>
                  <p className="font-semibold">{property.yearBuilt}</p>
                </div>
              </div>

              {/* Description */}
              <div>
                <h3 className="text-lg font-semibold mb-3">About This Property</h3>
                <p className="text-foreground-muted leading-relaxed">{property.description}</p>
              </div>
            </motion.div>

            {/* Features */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="glass-card p-6"
            >
              <h3 className="text-lg font-semibold mb-4">Property Features</h3>
              <div className="flex flex-wrap gap-3">
                {property.features.map((feature) => (
                  <span
                    key={feature}
                    className="px-4 py-2 rounded-full bg-accent/10 text-accent text-sm font-medium"
                  >
                    {feature}
                  </span>
                ))}
              </div>
            </motion.div>

            {/* Financial Details */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="glass-card p-6"
            >
              <h3 className="text-lg font-semibold mb-4">Financial Overview</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-lg bg-background-secondary">
                    <div className="flex items-center gap-3">
                      <TrendingUp className="w-5 h-5 text-secondary" />
                      <span className="text-foreground-muted">Annual Yield</span>
                    </div>
                    <span className="text-xl font-bold text-secondary">{property.annualYield}%</span>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-lg bg-background-secondary">
                    <div className="flex items-center gap-3">
                      <Coins className="w-5 h-5 text-accent" />
                      <span className="text-foreground-muted">Monthly Rental Income</span>
                    </div>
                    <span className="font-bold">${property.rentalIncome.toLocaleString()}</span>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-lg bg-background-secondary">
                    <div className="flex items-center gap-3">
                      <Users className="w-5 h-5 text-accent" />
                      <span className="text-foreground-muted">Occupancy Rate</span>
                    </div>
                    <span className="font-bold">{property.occupancyRate}%</span>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-lg bg-background-secondary">
                    <div className="flex items-center gap-3">
                      <Shield className="w-5 h-5 text-accent" />
                      <span className="text-foreground-muted">Property Insurance</span>
                    </div>
                    <span className="font-bold text-secondary">Active</span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Documents */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="glass-card p-6"
            >
              <h3 className="text-lg font-semibold mb-4">Documents & Reports</h3>
              <div className="space-y-3">
                {property.documents.map((doc) => (
                  <a
                    key={doc.name}
                    href={doc.url}
                    className="flex items-center justify-between p-4 rounded-lg bg-background-secondary hover:bg-accent/10 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-accent" />
                      <span>{doc.name}</span>
                    </div>
                    <ExternalLink className="w-4 h-4 text-foreground-muted group-hover:text-accent transition-colors" />
                  </a>
                ))}
              </div>
            </motion.div>

            {/* Timeline */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="glass-card p-6"
            >
              <h3 className="text-lg font-semibold mb-4">Investment Timeline</h3>
              <div className="space-y-4">
                {property.timeline.map((item, index) => (
                  <div key={index} className="flex items-start gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-3 h-3 rounded-full bg-accent" />
                      {index < property.timeline.length - 1 && (
                        <div className="w-px h-12 bg-glass-border" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm text-foreground-muted">{item.date}</p>
                      <p className="font-medium">{item.event}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Investment Card */}
          <div className="lg:col-span-1">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="glass-card p-6 sticky top-28"
            >
              <h3 className="text-xl font-semibold mb-6">Invest in This Property</h3>

              {/* Funding Progress */}
              {property.status === "funding" && (
                <div className="mb-6">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-foreground-muted">Funding Progress</span>
                    <span className="font-medium text-accent">{fundingProgress.toFixed(0)}%</span>
                  </div>
                  <div className="h-3 bg-background rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${fundingProgress}%` }}
                      transition={{ duration: 1 }}
                      className="h-full bg-gradient-to-r from-accent to-accent-light rounded-full"
                    />
                  </div>
                  <div className="flex items-center justify-between text-sm mt-2">
                    <span className="text-foreground-muted">
                      {(property.totalTokens - property.availableTokens).toLocaleString()} tokens sold
                    </span>
                    <span className="text-foreground-muted">
                      {property.availableTokens.toLocaleString()} available
                    </span>
                  </div>
                </div>
              )}

              {/* Token Price */}
              <div className="p-4 rounded-lg bg-background-secondary mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-foreground-muted">Token Price</span>
                  <span className="text-2xl font-bold text-accent">${property.tokenPrice}</span>
                </div>
                <p className="text-xs text-foreground-muted">
                  Each token represents {(100 / property.totalTokens).toFixed(4)}% ownership
                </p>
              </div>

              {/* Platform Equity Notice */}
              {(registeredProperty?.platformEquityPercent ?? 0) > 0 && (
                <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-amber-400 text-sm font-medium">📊 Token Distribution</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-foreground-muted text-xs">Platform Equity</p>
                      <p className="font-semibold text-amber-400">
                        {registeredProperty?.platformEquityPercent}%
                      </p>
                    </div>
                    <div>
                      <p className="text-foreground-muted text-xs">Available for Investors</p>
                      <p className="font-semibold text-secondary">
                        {100 - (registeredProperty?.platformEquityPercent ?? 0)}%
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-foreground-muted mt-2">
                    Platform retains {registeredProperty?.platformEquityPercent}% equity without investment
                  </p>
                </div>
              )}

              {/* Funding Deadline */}
              {registeredProperty?.fundingDeadline && property.status === "funding" && (
                <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20 mb-6">
                  <div className="flex items-center justify-between">
                    <span className="text-foreground-muted text-sm">Funding Deadline</span>
                    <span className="font-medium text-purple-400">
                      {new Date(registeredProperty.fundingDeadline).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  <p className="text-xs text-foreground-muted mt-1">
                    Full refund available if goal not met by deadline
                  </p>
                </div>
              )}

              {/* Token Amount Selector */}
              {property.status === "funding" && (
                <>
                  <div className="mb-6">
                    <label className="block text-sm text-foreground-muted mb-2">
                      Number of Tokens
                    </label>
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => setTokenAmount(Math.max(1, tokenAmount - 1))}
                        className="w-10 h-10 rounded-lg glass-card flex items-center justify-center hover:border-accent/40 transition-colors"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <input
                        type="number"
                        value={tokenAmount}
                        onChange={(e) => setTokenAmount(Math.max(1, Math.min(property.availableTokens, parseInt(e.target.value) || 1)))}
                        className="input-glass flex-1 text-center text-xl font-bold"
                      />
                      <button
                        onClick={() => setTokenAmount(Math.min(property.availableTokens, tokenAmount + 1))}
                        className="w-10 h-10 rounded-lg glass-card flex items-center justify-center hover:border-accent/40 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Quick Select */}
                  <div className="flex gap-2 mb-6">
                    {[10, 50, 100, 500].map((amount) => (
                      <button
                        key={amount}
                        onClick={() => setTokenAmount(Math.min(property.availableTokens, amount))}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                          tokenAmount === amount
                            ? "bg-accent text-background"
                            : "glass-card hover:border-accent/40"
                        }`}
                      >
                        {amount}
                      </button>
                    ))}
                  </div>

                  {/* Investment Summary */}
                  <div className="space-y-3 mb-6 p-4 rounded-lg bg-background-secondary">
                    <div className="flex items-center justify-between">
                      <span className="text-foreground-muted">Total (USD)</span>
                      <span className="font-bold">${totalInvestmentUSD.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-foreground-muted">Total (SOL)</span>
                      <span className="font-bold text-lg text-accent">{totalInvestmentSOL.toFixed(4)} SOL</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-foreground-muted">Ownership</span>
                      <span className="font-medium">{ownershipPercentage.toFixed(4)}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-foreground-muted">Est. Yearly Return</span>
                      <span className="font-bold text-secondary">${estimatedYearlyReturn.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Purchase Button */}
                  <button
                    onClick={handlePurchase}
                    className="btn-primary w-full flex items-center justify-center gap-2 text-lg glow-gold"
                  >
                    {connected ? (
                      <>
                        <Coins className="w-5 h-5" />
                        Purchase Tokens
                      </>
                    ) : (
                      <>
                        <Wallet className="w-5 h-5" />
                        Connect Wallet to Invest
                      </>
                    )}
                  </button>
                </>
              )}

              {property.status === "active" && (
                <div className="text-center p-4 rounded-lg bg-secondary/10">
                  <CheckCircle2 className="w-8 h-8 text-secondary mx-auto mb-2" />
                  <p className="font-semibold text-secondary">Fully Funded & Active</p>
                  <p className="text-sm text-foreground-muted mt-1">
                    This property is generating returns for investors
                  </p>
                </div>
              )}

              {/* Cancel Button - Only for property owner */}
              {connected && 
               registeredProperty?.ownerAddress === publicKey?.toBase58() && 
               registeredProperty?.campaignStatus === "active" && (
                <div className="mt-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xl">⚠️</span>
                    <span className="font-medium text-red-300">Property Owner Controls</span>
                  </div>
                  <p className="text-sm text-foreground-muted mb-3">
                    As the property owner, you can cancel the funding campaign. 
                    All investors will be able to claim full refunds.
                  </p>
                  <button
                    onClick={() => {
                      if (confirm("Are you sure you want to cancel this campaign? All investors will be able to claim refunds.")) {
                        alert("Cancel functionality would execute Solana transaction here");
                      }
                    }}
                    className="w-full px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors"
                  >
                    Cancel Funding Campaign
                  </button>
                </div>
              )}

              {/* Cancelled Campaign - Refund Available */}
              {registeredProperty?.campaignStatus === "cancelled" && (
                <div className="mt-6 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xl">💰</span>
                    <span className="font-medium text-amber-300">Campaign Cancelled</span>
                  </div>
                  <p className="text-sm text-foreground-muted mb-3">
                    This campaign has been cancelled. If you invested, you can claim a full refund.
                  </p>
                  {connected && (
                    <button
                      onClick={() => {
                        alert("Claim refund functionality would execute Solana transaction here");
                      }}
                      className="w-full px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium transition-colors"
                    >
                      Claim Refund
                    </button>
                  )}
                </div>
              )}

              {/* Get Devnet SOL */}
              {connected && solBalance < 1 && (
                <div className="mt-6 p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
                  <div className="flex items-center gap-3 mb-2">
                    <Droplets className="w-5 h-5 text-purple-400" />
                    <span className="font-medium text-purple-300">Need Test SOL?</span>
                  </div>
                  <p className="text-sm text-foreground-muted mb-3">
                    Get free Devnet SOL from the Solana Faucet to make purchases.
                  </p>
                  <a
                    href="https://faucet.solana.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium transition-colors"
                  >
                    <Droplets className="w-4 h-4" />
                    Get Devnet SOL
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}

              {/* Trust Badges */}
              <div className="mt-6 pt-6 border-t border-glass-border">
                <div className="flex items-center gap-2 text-sm text-foreground-muted mb-3">
                  <Shield className="w-4 h-4 text-secondary" />
                  <span>Secure blockchain transaction</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-foreground-muted mb-3">
                  <Clock className="w-4 h-4 text-accent" />
                  <span>Instant token delivery</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-cyan-400">
                  <span className="text-xs px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-500/30">
                    {SOLANA_NETWORK}
                  </span>
                  <span className="text-foreground-muted">Test network (no real money)</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Purchase Modal */}
      <AnimatePresence>
        {showPurchaseModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => !isPurchasing && setShowPurchaseModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-card p-8 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              {!purchaseSuccess ? (
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
                    <Coins className="w-8 h-8 text-accent" />
                  </div>
                  <h3 className="text-2xl font-bold mb-2">Buy Property Tokens</h3>
                  <p className="text-foreground-muted mb-6">
                    Purchase {tokenAmount} tokens of {property.name} with Devnet SOL
                  </p>

                  {/* Wallet Balance */}
                  <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20 mb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-foreground-muted">Your Balance</span>
                      <span className="font-bold text-purple-400">{solBalance.toFixed(4)} SOL</span>
                    </div>
                    {solBalance < totalInvestmentSOL && (
                      <div className="mt-2 text-sm text-amber-400">
                        ⚠️ Insufficient balance. 
                        <a 
                          href="https://faucet.solana.com/" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="underline ml-1"
                        >
                          Get Devnet SOL →
                        </a>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 p-4 rounded-lg bg-background-secondary mb-6 text-left">
                    <div className="flex items-center justify-between">
                      <span className="text-foreground-muted">Tokens</span>
                      <span className="font-medium">{tokenAmount}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-foreground-muted">Price per Token</span>
                      <span className="font-medium">${property.tokenPrice}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-foreground-muted">Total (USD)</span>
                      <span className="font-medium">${totalInvestmentUSD.toLocaleString()}</span>
                    </div>
                    <div className="border-t border-glass-border pt-3 flex items-center justify-between">
                      <span className="font-semibold">Pay with SOL</span>
                      <span className="text-xl font-bold text-accent">{totalInvestmentSOL.toFixed(4)} SOL</span>
                    </div>
                  </div>

                  {purchaseError && (
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 mb-4 text-left">
                      <p className="text-red-400 text-sm">{purchaseError}</p>
                    </div>
                  )}

                  <div className="text-xs text-foreground-muted mb-4">
                    Network: <span className="text-cyan-400">{SOLANA_NETWORK}</span> (Test tokens, no real money)
                  </div>

                  <div className="flex gap-4">
                    <button
                      onClick={() => {
                        setShowPurchaseModal(false);
                        setPurchaseError(null);
                      }}
                      disabled={isPurchasing}
                      className="btn-secondary flex-1 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handlePurchaseWithSOL}
                      disabled={isPurchasing || solBalance < totalInvestmentSOL}
                      className="btn-primary flex-1 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isPurchasing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Coins className="w-4 h-4" />
                          Pay {totalInvestmentSOL.toFixed(4)} SOL
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", bounce: 0.5 }}
                    className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-400 flex items-center justify-center mx-auto mb-6"
                  >
                    <CheckCircle2 className="w-10 h-10 text-white" />
                  </motion.div>
                  <h3 className="text-2xl font-bold mb-2">Purchase Complete!</h3>
                  <p className="text-foreground-muted mb-6">
                    You have successfully purchased {tokenAmount} tokens
                  </p>

                  <div className="space-y-3 p-4 rounded-lg bg-background-secondary mb-6 text-left">
                    <div className="flex items-center justify-between">
                      <span className="text-foreground-muted">Property</span>
                      <span className="font-medium">{property.name}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-foreground-muted">Tokens Purchased</span>
                      <span className="font-medium">{tokenAmount}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-foreground-muted">Amount Paid</span>
                      <span className="font-bold text-accent">{totalInvestmentSOL.toFixed(4)} SOL</span>
                    </div>
                  </div>

                  {txSignature && (
                    <a
                      href={getExplorerUrl(txSignature)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-colors mb-6"
                    >
                      <ExternalLink className="w-4 h-4" />
                      View Transaction on Solana Explorer
                    </a>
                  )}

                  <div className="flex gap-4">
                    <button
                      onClick={() => {
                        setShowPurchaseModal(false);
                        setPurchaseSuccess(false);
                        setTxSignature(null);
                      }}
                      className="btn-secondary flex-1"
                    >
                      Close
                    </button>
                    <Link href="/dashboard" className="btn-primary flex-1 text-center">
                      View Dashboard
                    </Link>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

