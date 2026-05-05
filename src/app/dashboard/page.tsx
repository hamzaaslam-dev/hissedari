"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  Wallet,
  TrendingUp,
  Coins,
  Building2,
  ArrowUpRight,
  Clock,
  ExternalLink,
  Copy,
  CheckCircle2,
  BarChart3,
  DollarSign,
  Banknote,
  Gift,
  Sparkles,
} from "lucide-react";
import { getRegisteredPropertiesAsync, getPropertiesByOwnerAsync, RegisteredProperty } from "@/lib/propertyStore";
import { connection, getSolBalance } from "@/lib/solana";

interface TokenHolding {
  property: RegisteredProperty;
  balance: number;
  value: number;
}

function buildUnknownPropertyFromMint(mint: string): RegisteredProperty {
  const now = new Date().toISOString();
  return {
    id: `mint-${mint}`,
    name: "Property Token",
    location: "Unknown location",
    city: "Unknown",
    description: "Token purchased from marketplace. Property metadata is not available yet.",
    image: "",
    images: [],
    mintAddress: mint,
    tokenAccount: "",
    ownerAddress: "",
    createdAt: now,
    transactionSignature: "",
    rentalIncome: 0,
    occupancyRate: 0,
    documents: [],
    timeline: [],
    platformEquityPercent: 0,
    fundingDeadline: now,
    campaignStatus: "active",
    totalRaised: 0,
    investorCount: 0,
    certificates: [],
    uploadedPhotos: [],
    price: 0,
    priceInPKR: 0,
    tokenPrice: 0,
    totalTokens: 1,
    availableTokens: 0,
    annualYield: 0,
    propertyType: "mixed-use",
    status: "active",
    features: [],
    size: 0,
    yearBuilt: new Date().getFullYear(),
  };
}

export default function DashboardPage() {
  const { connected, publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const [activeTab, setActiveTab] = useState<"portfolio" | "income">("portfolio");
  const [copied, setCopied] = useState(false);
  const [holdings, setHoldings] = useState<TokenHolding[]>([]);
  const [loading, setLoading] = useState(true);
  const [solBalance, setSolBalance] = useState(0);
  const [ownedProperties, setOwnedProperties] = useState<RegisteredProperty[]>([]);

  useEffect(() => {
    if (connected && publicKey) {
      loadPortfolio();
      loadSolBalance();
    } else {
      setLoading(false);
    }
  }, [connected, publicKey]);

  const loadSolBalance = async () => {
    if (!publicKey) return;
    try {
      const balance = await getSolBalance(publicKey);
      setSolBalance(balance);
    } catch (e) {
      console.error("Error loading SOL balance:", e);
    }
  };

  const loadPortfolio = async () => {
    if (!publicKey) return;
    
    setLoading(true);
    try {
      const [properties, owned, tokenAccountsResp] = await Promise.all([
        getRegisteredPropertiesAsync(),
        getPropertiesByOwnerAsync(publicKey.toBase58()),
        connection.getParsedTokenAccountsByOwner(publicKey, {
          programId: TOKEN_PROGRAM_ID,
        }),
      ]);
      
      setOwnedProperties(owned);
      const tokenHoldings: TokenHolding[] = [];
      const propertiesByMint = new Map<string, RegisteredProperty>();
      for (const property of properties) {
        if (property.mintAddress) {
          propertiesByMint.set(property.mintAddress, property);
        }
      }

      // Aggregate balances across all token accounts per mint (ATA or non-ATA).
      const balancesByMint = new Map<string, number>();
      for (const { account } of tokenAccountsResp.value) {
        const parsedInfo = account.data.parsed.info;
        const mint = parsedInfo.mint as string;
        const amount = Number(parsedInfo.tokenAmount?.amount || 0);
        if (amount <= 0) continue;
        balancesByMint.set(mint, (balancesByMint.get(mint) || 0) + amount);
      }

      for (const [mint, balance] of balancesByMint.entries()) {
        const property = propertiesByMint.get(mint) || buildUnknownPropertyFromMint(mint);
        tokenHoldings.push({
          property,
          balance,
          value: balance * property.tokenPrice,
        });
      }

      setHoldings(tokenHoldings);
    } catch (error) {
      console.error("Error loading portfolio:", error);
    }
    setLoading(false);
  };

  const copyAddress = () => {
    if (publicKey) {
      navigator.clipboard.writeText(publicKey.toBase58());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-6)}`;
  };

  const totalValue = holdings.reduce((acc, h) => acc + h.value, 0);
  const totalTokens = holdings.reduce((acc, h) => acc + h.balance, 0);

  // Not connected state
  if (!connected) {
    return (
      <div className="min-h-screen pt-28 pb-20">
        <div className="fixed inset-0 -z-10">
          <div className="absolute inset-0 bg-background" />
          <div className="absolute inset-0 grid-pattern opacity-30" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-lg mx-auto text-center"
          >
            <div className="glass-card p-12">
              <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-6 animate-pulse-glow">
                <Wallet className="w-10 h-10 text-accent" />
              </div>
              <h1 className="text-3xl font-bold mb-4" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                Connect Your Wallet
              </h1>
              <p className="text-foreground-muted mb-8">
                Connect your Solana wallet to view your portfolio, track investments, 
                and manage your property tokens.
              </p>
              <button
                onClick={() => setVisible(true)}
                className="btn-primary flex items-center justify-center gap-2 w-full text-lg"
              >
                <Wallet className="w-5 h-5" />
                Connect Wallet
              </button>
              <p className="text-sm text-foreground-muted mt-6">
                Supports Phantom, Solflare, and other Solana wallets
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-28 pb-20">
      {/* Background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-background" />
        <div className="absolute inset-0 grid-pattern opacity-30" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-accent/5 rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8"
        >
          <div>
            <h1 className="text-4xl font-bold mb-2" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
              My <span className="text-gradient-gold">Portfolio</span>
            </h1>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 glass-card px-3 py-1.5 rounded-lg">
                <div className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
                <span className="text-sm font-medium">
                  {formatAddress(publicKey?.toBase58() || "")}
                </span>
                <button onClick={copyAddress} className="text-foreground-muted hover:text-accent transition-colors">
                  {copied ? <CheckCircle2 className="w-4 h-4 text-secondary" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <span className="solana-badge">Solana Devnet</span>
            </div>
          </div>
          <div className="flex gap-3 flex-wrap">
            {ownedProperties.length > 0 && (
              <Link href="/admin/dividends" className="btn-primary flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600">
                <Banknote className="w-4 h-4" />
                Distribute Dividends
              </Link>
            )}
            <Link href="/marketplace" className="btn-secondary flex items-center gap-2">
              <Coins className="w-4 h-4" />
              Marketplace
            </Link>
            <Link href="/properties" className="btn-primary flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Browse Properties
            </Link>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid md:grid-cols-4 gap-6 mb-8"
        >
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-accent" />
              </div>
              <span className="text-xs text-foreground-muted">SOL Balance</span>
            </div>
            <p className="text-3xl font-bold">{solBalance.toFixed(4)} SOL</p>
            <p className="text-sm text-foreground-muted mt-1">Devnet</p>
          </div>

          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                <Coins className="w-5 h-5 text-accent" />
              </div>
              <span className="text-xs text-foreground-muted">Total Tokens</span>
            </div>
            <p className="text-3xl font-bold text-gradient-gold">{totalTokens.toLocaleString()}</p>
            <p className="text-sm text-foreground-muted mt-1">Across {holdings.length} properties</p>
          </div>

          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-secondary" />
              </div>
              <span className="text-xs text-foreground-muted">Portfolio Value</span>
            </div>
            <p className="text-3xl font-bold text-secondary">${totalValue.toLocaleString()}</p>
            <p className="text-sm text-foreground-muted mt-1">Estimated USD</p>
          </div>

          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-accent" />
              </div>
              <span className="text-xs text-foreground-muted">Properties</span>
            </div>
            <p className="text-3xl font-bold">{holdings.length}</p>
            <p className="text-sm text-foreground-muted mt-1">Invested in</p>
          </div>
        </motion.div>

        {/* Tab Navigation */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex gap-2 mb-6"
        >
          <button
            onClick={() => setActiveTab("portfolio")}
            className={`px-6 py-3 rounded-lg font-medium transition-all ${
              activeTab === "portfolio"
                ? "bg-accent text-background"
                : "glass-card hover:border-accent/40"
            }`}
          >
            <span className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              My Holdings
            </span>
          </button>
          <button
            onClick={() => setActiveTab("income")}
            className={`px-6 py-3 rounded-lg font-medium transition-all ${
              activeTab === "income"
                ? "bg-accent text-background"
                : "glass-card hover:border-accent/40"
            }`}
          >
            <span className="flex items-center gap-2">
              <Banknote className="w-4 h-4" />
              Income & Dividends
            </span>
          </button>
        </motion.div>

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent"></div>
          </div>
        )}

        {/* Portfolio Tab */}
        {!loading && activeTab === "portfolio" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            {holdings.map((holding, index) => (
              <motion.div
                key={holding.property.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="glass-card glass-card-hover p-6"
              >
                <div className="flex flex-col lg:flex-row gap-6">
                  {/* Property Image */}
                  <div className="relative w-full lg:w-48 h-32 rounded-xl overflow-hidden flex-shrink-0">
                    {holding.property.image ? (
                      <Image
                        src={holding.property.image}
                        alt={holding.property.name}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-accent/20 to-secondary/20 flex items-center justify-center">
                        <Building2 className="w-12 h-12 text-accent/50" />
                      </div>
                    )}
                  </div>

                  {/* Property Info */}
                  <div className="flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                      <div>
                        <Link
                          href={`/properties/${holding.property.id}`}
                          className="text-xl font-semibold hover:text-accent transition-colors flex items-center gap-2"
                        >
                          {holding.property.name}
                          <ExternalLink className="w-4 h-4" />
                        </Link>
                        <p className="text-foreground-muted">{holding.property.location}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold">${holding.value.toLocaleString()}</p>
                        <p className="text-sm text-foreground-muted">
                          {holding.balance.toLocaleString()} tokens
                        </p>
                      </div>
                    </div>

                    {/* Token Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-3 rounded-lg bg-background-secondary">
                        <p className="text-xs text-foreground-muted mb-1">Tokens Owned</p>
                        <p className="font-semibold">{holding.balance.toLocaleString()}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-background-secondary">
                        <p className="text-xs text-foreground-muted mb-1">Token Price</p>
                        <p className="font-semibold">${holding.property.tokenPrice}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-background-secondary">
                        <p className="text-xs text-foreground-muted mb-1">Annual Yield</p>
                        <p className="font-semibold text-secondary">{holding.property.annualYield}%</p>
                      </div>
                      <div className="p-3 rounded-lg bg-background-secondary">
                        <p className="text-xs text-foreground-muted mb-1">Ownership</p>
                        <p className="font-semibold">
                          {((holding.balance / holding.property.totalTokens) * 100).toFixed(2)}%
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}

            {/* Empty State */}
            {holdings.length === 0 && (
              <div className="glass-card p-12 text-center">
                <Building2 className="w-12 h-12 text-accent mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">No Property Tokens Yet</h3>
                <p className="text-foreground-muted mb-6">
                  Start building your real estate portfolio by investing in tokenized properties
                </p>
                <div className="flex justify-center gap-4">
                  <Link href="/properties" className="btn-primary">
                    Browse Properties
                  </Link>
                  <Link href="/marketplace" className="btn-secondary">
                    Token Marketplace
                  </Link>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Income Tab */}
        {!loading && activeTab === "income" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            {holdings.length > 0 ? (
              <>
                {/* Income Overview */}
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="glass-card p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center">
                        <TrendingUp className="w-6 h-6 text-secondary" />
                      </div>
                      <div>
                        <p className="text-sm text-foreground-muted">Estimated Monthly</p>
                        <p className="text-2xl font-bold text-secondary">
                          ${holdings.reduce((acc, h) => acc + (h.value * (h.property.annualYield / 100) / 12), 0).toFixed(2)}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-foreground-muted">
                      Based on annual yields
                    </p>
                  </div>

                  <div className="glass-card p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                        <Clock className="w-6 h-6 text-accent" />
                      </div>
                      <div>
                        <p className="text-sm text-foreground-muted">Estimated Annual</p>
                        <p className="text-2xl font-bold">
                          ${holdings.reduce((acc, h) => acc + (h.value * (h.property.annualYield / 100)), 0).toFixed(2)}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-foreground-muted">
                      From {holdings.length} properties
                    </p>
                  </div>

                  <div className="glass-card p-6 border-accent/30">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center">
                        <Gift className="w-6 h-6 text-accent" />
                      </div>
                      <div>
                        <p className="text-sm text-foreground-muted">Avg. Yield</p>
                        <p className="text-2xl font-bold text-accent">
                          {holdings.length > 0 
                            ? (holdings.reduce((acc, h) => acc + h.property.annualYield, 0) / holdings.length).toFixed(1)
                            : 0}%
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-foreground-muted">
                      Across your portfolio
                    </p>
                  </div>
                </div>

                {/* Income by Property */}
                <div className="glass-card p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Banknote className="w-5 h-5 text-accent" />
                    Income by Property
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-glass-border text-left text-sm text-foreground-muted">
                          <th className="pb-3 font-medium">Property</th>
                          <th className="pb-3 font-medium text-center">Tokens</th>
                          <th className="pb-3 font-medium text-center">Yield</th>
                          <th className="pb-3 font-medium text-right">Monthly Est.</th>
                          <th className="pb-3 font-medium text-right">Annual Est.</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-glass-border">
                        {holdings.map((holding) => {
                          const monthlyIncome = (holding.value * (holding.property.annualYield / 100)) / 12;
                          const annualIncome = holding.value * (holding.property.annualYield / 100);
                          
                          return (
                            <tr key={holding.property.id} className="hover:bg-white/5 transition-colors">
                              <td className="py-4">
                                <Link 
                                  href={`/properties/${holding.property.id}`}
                                  className="font-medium hover:text-accent transition-colors"
                                >
                                  {holding.property.name}
                                </Link>
                              </td>
                              <td className="py-4 text-center">{holding.balance.toLocaleString()}</td>
                              <td className="py-4 text-center">
                                <span className="text-secondary font-medium">{holding.property.annualYield}%</span>
                              </td>
                              <td className="py-4 text-right font-medium">${monthlyIncome.toFixed(2)}</td>
                              <td className="py-4 text-right text-secondary font-medium">${annualIncome.toFixed(2)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* How Dividends Work */}
                <div className="glass-card p-6 border-accent/20">
                  <h3 className="text-lg font-semibold mb-4">💡 How Dividends Work</h3>
                  <div className="grid md:grid-cols-3 gap-6">
                    <div>
                      <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center mb-3">
                        <span className="text-accent font-bold">1</span>
                      </div>
                      <h4 className="font-medium mb-1">Rental Income Collection</h4>
                      <p className="text-sm text-foreground-muted">Properties generate rental income from tenants, collected monthly by property managers.</p>
                    </div>
                    <div>
                      <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center mb-3">
                        <span className="text-accent font-bold">2</span>
                      </div>
                      <h4 className="font-medium mb-1">Proportional Distribution</h4>
                      <p className="text-sm text-foreground-muted">Income is distributed proportionally based on your token holdings in each property.</p>
                    </div>
                    <div>
                      <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center mb-3">
                        <span className="text-accent font-bold">3</span>
                      </div>
                      <h4 className="font-medium mb-1">Claim on Blockchain</h4>
                      <p className="text-sm text-foreground-muted">Claim your dividends directly to your wallet through our smart contract system.</p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="glass-card p-12 text-center">
                <Banknote className="w-12 h-12 text-accent mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">No Income Yet</h3>
                <p className="text-foreground-muted mb-6">
                  Invest in tokenized properties to start earning rental income dividends
                </p>
                <Link href="/properties" className="btn-primary">
                  Start Investing
                </Link>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
