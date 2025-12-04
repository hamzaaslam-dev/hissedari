"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import {
  Wallet,
  TrendingUp,
  Coins,
  Building2,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  ExternalLink,
  Copy,
  CheckCircle2,
  BarChart3,
  Calendar,
  Download,
  DollarSign,
  Banknote,
  Gift,
  Timer,
  Sparkles,
} from "lucide-react";
import { properties } from "@/data/properties";

// Mock user portfolio data
const mockPortfolio = {
  totalValue: 45600,
  totalReturn: 3840,
  returnPercentage: 8.4,
  tokens: [
    {
      propertyId: "1",
      tokenCount: 150,
      purchasePrice: 50,
      currentPrice: 52,
      purchaseDate: "2024-02-15",
    },
    {
      propertyId: "2",
      tokenCount: 80,
      purchasePrice: 100,
      currentPrice: 108,
      purchaseDate: "2024-01-20",
    },
    {
      propertyId: "5",
      tokenCount: 50,
      purchasePrice: 60,
      currentPrice: 65,
      purchaseDate: "2024-03-01",
    },
  ],
  transactions: [
    {
      id: "tx1",
      type: "purchase",
      propertyName: "Emaar Oceanfront Apartments",
      tokenCount: 50,
      amount: 2500,
      date: "2024-03-15",
      txHash: "5Fk2...8xYp",
    },
    {
      id: "tx2",
      type: "dividend",
      propertyName: "Centaurus Mall Commercial",
      tokenCount: 0,
      amount: 420,
      date: "2024-03-01",
      txHash: "3Jm9...2kLp",
    },
    {
      id: "tx3",
      type: "purchase",
      propertyName: "Pearl Continental Suites",
      tokenCount: 50,
      amount: 3000,
      date: "2024-03-01",
      txHash: "8Hp4...9mNq",
    },
    {
      id: "tx4",
      type: "dividend",
      propertyName: "Emaar Oceanfront Apartments",
      tokenCount: 0,
      amount: 320,
      date: "2024-02-28",
      txHash: "2Xw7...5bRt",
    },
    {
      id: "tx5",
      type: "dividend",
      propertyName: "Pearl Continental Suites",
      tokenCount: 0,
      amount: 580,
      date: "2024-02-15",
      txHash: "7Yz3...4nKp",
    },
  ],
  pendingDividends: 1240,
  // Income/Dividends data
  income: {
    totalEarned: 4850,
    thisMonth: 1320,
    lastMonth: 1180,
    pending: 1240,
    nextPayoutDate: "2024-04-15",
    payoutFrequency: "Monthly",
    propertyIncome: [
      {
        propertyId: "1",
        propertyName: "Emaar Oceanfront Apartments",
        tokensOwned: 150,
        monthlyIncome: 118.75,
        totalEarned: 712.50,
        nextPayout: 118.75,
        yield: 9.5,
      },
      {
        propertyId: "2",
        propertyName: "Centaurus Mall Commercial",
        tokensOwned: 80,
        monthlyIncome: 74.66,
        totalEarned: 447.96,
        nextPayout: 74.66,
        yield: 11.2,
      },
      {
        propertyId: "5",
        propertyName: "Pearl Continental Suites",
        tokensOwned: 50,
        monthlyIncome: 59.17,
        totalEarned: 177.51,
        nextPayout: 59.17,
        yield: 14.2,
      },
    ],
    history: [
      { month: "Mar 2024", amount: 1320, properties: 3 },
      { month: "Feb 2024", amount: 1180, properties: 3 },
      { month: "Jan 2024", amount: 1150, properties: 2 },
      { month: "Dec 2023", amount: 1200, properties: 2 },
    ],
  },
};

export default function DashboardPage() {
  const { connected, publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const [activeTab, setActiveTab] = useState<"portfolio" | "income" | "transactions">("portfolio");
  const [copied, setCopied] = useState(false);
  const [showClaimModal, setShowClaimModal] = useState(false);

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

  const getPropertyById = (id: string) => properties.find((p) => p.id === id);

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
                and claim your rental income dividends.
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
          <Link href="/properties" className="btn-primary flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Browse Properties
          </Link>
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
                <Coins className="w-5 h-5 text-accent" />
              </div>
              <span className="text-xs text-foreground-muted">Total Value</span>
            </div>
            <p className="text-3xl font-bold text-gradient-gold">${mockPortfolio.totalValue.toLocaleString()}</p>
            <p className="text-sm text-foreground-muted mt-1">Across {mockPortfolio.tokens.length} properties</p>
          </div>

          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-secondary" />
              </div>
              <span className="text-xs text-foreground-muted">Total Returns</span>
            </div>
            <p className="text-3xl font-bold text-secondary">+${mockPortfolio.totalReturn.toLocaleString()}</p>
            <div className="flex items-center gap-1 mt-1">
              <ArrowUpRight className="w-4 h-4 text-secondary" />
              <span className="text-sm text-secondary">+{mockPortfolio.returnPercentage}%</span>
            </div>
          </div>

          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                <Banknote className="w-5 h-5 text-accent" />
              </div>
              <span className="text-xs text-foreground-muted">Total Income Earned</span>
            </div>
            <p className="text-3xl font-bold">${mockPortfolio.income.totalEarned.toLocaleString()}</p>
            <p className="text-sm text-foreground-muted mt-1">
              +${mockPortfolio.income.thisMonth} this month
            </p>
          </div>

          <div className="glass-card p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-accent/10 rounded-full blur-2xl" />
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center animate-pulse">
                  <Gift className="w-5 h-5 text-accent" />
                </div>
                <span className="text-xs text-foreground-muted">Pending Dividends</span>
              </div>
              <p className="text-3xl font-bold text-accent">${mockPortfolio.pendingDividends.toLocaleString()}</p>
              <button 
                onClick={() => setShowClaimModal(true)}
                className="mt-3 w-full btn-primary text-sm py-2 flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Claim Now
              </button>
            </div>
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
              <DollarSign className="w-4 h-4" />
              Income & Dividends
            </span>
          </button>
          <button
            onClick={() => setActiveTab("transactions")}
            className={`px-6 py-3 rounded-lg font-medium transition-all ${
              activeTab === "transactions"
                ? "bg-accent text-background"
                : "glass-card hover:border-accent/40"
            }`}
          >
            <span className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Transactions
            </span>
          </button>
        </motion.div>

        {/* Portfolio Tab */}
        {activeTab === "portfolio" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            {mockPortfolio.tokens.map((token, index) => {
              const property = getPropertyById(token.propertyId);
              if (!property) return null;

              const currentValue = token.tokenCount * token.currentPrice;
              const purchaseValue = token.tokenCount * token.purchasePrice;
              const profit = currentValue - purchaseValue;
              const profitPercentage = ((profit / purchaseValue) * 100).toFixed(1);

              return (
                <motion.div
                  key={token.propertyId}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="glass-card glass-card-hover p-6"
                >
                  <div className="flex flex-col lg:flex-row gap-6">
                    {/* Property Image */}
                    <div className="relative w-full lg:w-48 h-32 rounded-xl overflow-hidden flex-shrink-0">
                      <Image
                        src={property.image}
                        alt={property.name}
                        fill
                        className="object-cover"
                      />
                    </div>

                    {/* Property Info */}
                    <div className="flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                        <div>
                          <Link
                            href={`/properties/${property.id}`}
                            className="text-xl font-semibold hover:text-accent transition-colors flex items-center gap-2"
                          >
                            {property.name}
                            <ExternalLink className="w-4 h-4" />
                          </Link>
                          <p className="text-foreground-muted">{property.location}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold">${currentValue.toLocaleString()}</p>
                          <div className="flex items-center justify-end gap-1">
                            {profit >= 0 ? (
                              <>
                                <ArrowUpRight className="w-4 h-4 text-secondary" />
                                <span className="text-secondary">+${profit.toLocaleString()} ({profitPercentage}%)</span>
                              </>
                            ) : (
                              <>
                                <ArrowDownRight className="w-4 h-4 text-red-400" />
                                <span className="text-red-400">${profit.toLocaleString()} ({profitPercentage}%)</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Token Stats */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-3 rounded-lg bg-background-secondary">
                          <p className="text-xs text-foreground-muted mb-1">Tokens Owned</p>
                          <p className="font-semibold">{token.tokenCount}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-background-secondary">
                          <p className="text-xs text-foreground-muted mb-1">Token Price</p>
                          <p className="font-semibold">${token.currentPrice}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-background-secondary">
                          <p className="text-xs text-foreground-muted mb-1">Annual Yield</p>
                          <p className="font-semibold text-secondary">{property.annualYield}%</p>
                        </div>
                        <div className="p-3 rounded-lg bg-background-secondary">
                          <p className="text-xs text-foreground-muted mb-1">Purchased</p>
                          <p className="font-semibold">{token.purchaseDate}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}

            {/* Empty State */}
            {mockPortfolio.tokens.length === 0 && (
              <div className="glass-card p-12 text-center">
                <Building2 className="w-12 h-12 text-accent mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">No Properties Yet</h3>
                <p className="text-foreground-muted mb-6">
                  Start building your real estate portfolio today
                </p>
                <Link href="/properties" className="btn-primary">
                  Browse Properties
                </Link>
              </div>
            )}
          </motion.div>
        )}

        {/* Income & Dividends Tab */}
        {activeTab === "income" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            {/* Income Overview Cards */}
            <div className="grid md:grid-cols-3 gap-6">
              <div className="glass-card p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center">
                    <DollarSign className="w-6 h-6 text-secondary" />
                  </div>
                  <div>
                    <p className="text-sm text-foreground-muted">This Month&apos;s Income</p>
                    <p className="text-2xl font-bold text-secondary">${mockPortfolio.income.thisMonth}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-foreground-muted">
                  <ArrowUpRight className="w-4 h-4 text-secondary" />
                  <span>+{((mockPortfolio.income.thisMonth - mockPortfolio.income.lastMonth) / mockPortfolio.income.lastMonth * 100).toFixed(1)}% vs last month</span>
                </div>
              </div>

              <div className="glass-card p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                    <Timer className="w-6 h-6 text-accent" />
                  </div>
                  <div>
                    <p className="text-sm text-foreground-muted">Next Payout</p>
                    <p className="text-2xl font-bold">{mockPortfolio.income.nextPayoutDate}</p>
                  </div>
                </div>
                <p className="text-sm text-foreground-muted">
                  Payouts distributed {mockPortfolio.income.payoutFrequency.toLowerCase()}
                </p>
              </div>

              <div className="glass-card p-6 border-accent/30">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center animate-pulse">
                    <Gift className="w-6 h-6 text-accent" />
                  </div>
                  <div>
                    <p className="text-sm text-foreground-muted">Ready to Claim</p>
                    <p className="text-2xl font-bold text-accent">${mockPortfolio.income.pending}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowClaimModal(true)}
                  className="btn-primary w-full text-sm py-2 flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  Claim Dividends
                </button>
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
                      <th className="pb-3 font-medium text-right">Monthly Income</th>
                      <th className="pb-3 font-medium text-right">Total Earned</th>
                      <th className="pb-3 font-medium text-right">Next Payout</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-glass-border">
                    {mockPortfolio.income.propertyIncome.map((income) => (
                      <tr key={income.propertyId} className="hover:bg-white/5 transition-colors">
                        <td className="py-4">
                          <Link 
                            href={`/properties/${income.propertyId}`}
                            className="font-medium hover:text-accent transition-colors"
                          >
                            {income.propertyName}
                          </Link>
                        </td>
                        <td className="py-4 text-center">{income.tokensOwned}</td>
                        <td className="py-4 text-center">
                          <span className="text-secondary font-medium">{income.yield}%</span>
                        </td>
                        <td className="py-4 text-right font-medium">${income.monthlyIncome.toFixed(2)}</td>
                        <td className="py-4 text-right text-secondary font-medium">${income.totalEarned.toFixed(2)}</td>
                        <td className="py-4 text-right text-accent font-medium">${income.nextPayout.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-glass-border font-semibold">
                      <td className="pt-4">Total</td>
                      <td className="pt-4 text-center">{mockPortfolio.income.propertyIncome.reduce((acc, p) => acc + p.tokensOwned, 0)}</td>
                      <td className="pt-4 text-center">-</td>
                      <td className="pt-4 text-right">${mockPortfolio.income.propertyIncome.reduce((acc, p) => acc + p.monthlyIncome, 0).toFixed(2)}</td>
                      <td className="pt-4 text-right text-secondary">${mockPortfolio.income.propertyIncome.reduce((acc, p) => acc + p.totalEarned, 0).toFixed(2)}</td>
                      <td className="pt-4 text-right text-accent">${mockPortfolio.income.propertyIncome.reduce((acc, p) => acc + p.nextPayout, 0).toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Income History */}
            <div className="glass-card p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-accent" />
                Income History
              </h3>
              <div className="space-y-3">
                {mockPortfolio.income.history.map((month, index) => (
                  <div 
                    key={month.month}
                    className="flex items-center justify-between p-4 rounded-lg bg-background-secondary"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-accent" />
                      </div>
                      <div>
                        <p className="font-medium">{month.month}</p>
                        <p className="text-sm text-foreground-muted">{month.properties} properties</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-secondary">${month.amount.toLocaleString()}</p>
                      {index > 0 && (
                        <p className={`text-sm ${month.amount > mockPortfolio.income.history[index - 1]?.amount ? 'text-secondary' : 'text-red-400'}`}>
                          {month.amount > mockPortfolio.income.history[index - 1]?.amount ? '+' : ''}
                          {((month.amount - mockPortfolio.income.history[index - 1]?.amount) / mockPortfolio.income.history[index - 1]?.amount * 100).toFixed(1)}%
                        </p>
                      )}
                    </div>
                  </div>
                ))}
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
                  <h4 className="font-medium mb-1">Claim in Crypto</h4>
                  <p className="text-sm text-foreground-muted">Claim your dividends in USDC or SOL directly to your connected wallet anytime.</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Transactions Tab */}
        {activeTab === "transactions" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass-card overflow-hidden"
          >
            {/* Table Header */}
            <div className="hidden md:grid md:grid-cols-5 gap-4 p-4 bg-background-secondary text-sm text-foreground-muted font-medium">
              <span>Type</span>
              <span>Property</span>
              <span className="text-right">Amount</span>
              <span className="text-center">Date</span>
              <span className="text-right">Transaction</span>
            </div>

            {/* Transactions */}
            <div className="divide-y divide-glass-border">
              {mockPortfolio.transactions.map((tx, index) => (
                <motion.div
                  key={tx.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="p-4 hover:bg-white/5 transition-colors"
                >
                  <div className="grid md:grid-cols-5 gap-4 items-center">
                    {/* Type */}
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        tx.type === "purchase" ? "bg-accent/10" : "bg-secondary/10"
                      }`}>
                        {tx.type === "purchase" ? (
                          <Coins className="w-5 h-5 text-accent" />
                        ) : (
                          <Banknote className="w-5 h-5 text-secondary" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium capitalize">{tx.type === "dividend" ? "Dividend Income" : tx.type}</p>
                        {tx.tokenCount > 0 && (
                          <p className="text-xs text-foreground-muted">{tx.tokenCount} tokens</p>
                        )}
                      </div>
                    </div>

                    {/* Property */}
                    <div className="md:col-span-1">
                      <p className="font-medium truncate">{tx.propertyName}</p>
                    </div>

                    {/* Amount */}
                    <div className="text-right">
                      <p className={`font-bold ${tx.type === "dividend" ? "text-secondary" : ""}`}>
                        {tx.type === "dividend" ? "+" : "-"}${tx.amount.toLocaleString()}
                      </p>
                    </div>

                    {/* Date */}
                    <div className="text-center flex items-center justify-center gap-2 text-foreground-muted">
                      <Calendar className="w-4 h-4" />
                      <span>{tx.date}</span>
                    </div>

                    {/* Transaction Hash */}
                    <div className="text-right">
                      <a
                        href="#"
                        className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
                      >
                        {tx.txHash}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Export Button */}
            <div className="p-4 border-t border-glass-border">
              <button className="btn-secondary flex items-center gap-2 ml-auto">
                <Download className="w-4 h-4" />
                Export Transactions
              </button>
            </div>
          </motion.div>
        )}

        {/* Performance Chart Placeholder */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-card p-6 mt-8"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold">Portfolio Performance</h3>
            <div className="flex gap-2">
              {["1W", "1M", "3M", "1Y", "All"].map((period) => (
                <button
                  key={period}
                  className="px-3 py-1 rounded-lg text-sm hover:bg-accent/10 transition-colors"
                >
                  {period}
                </button>
              ))}
            </div>
          </div>
          
          {/* Placeholder Chart */}
          <div className="h-64 flex items-center justify-center border border-dashed border-glass-border rounded-xl">
            <div className="text-center text-foreground-muted">
              <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Performance chart would render here</p>
              <p className="text-sm">Showing portfolio value and income over time</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Claim Dividends Modal */}
      <AnimatePresence>
        {showClaimModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowClaimModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-card p-8 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4 animate-pulse-glow">
                  <Gift className="w-8 h-8 text-accent" />
                </div>
                <h3 className="text-2xl font-bold mb-2">Claim Your Dividends</h3>
                <p className="text-foreground-muted mb-6">
                  You have ${mockPortfolio.pendingDividends.toLocaleString()} in pending dividends ready to claim
                </p>

                <div className="space-y-3 p-4 rounded-lg bg-background-secondary mb-6 text-left">
                  <div className="flex items-center justify-between">
                    <span className="text-foreground-muted">Amount</span>
                    <span className="font-bold text-accent">${mockPortfolio.pendingDividends.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-foreground-muted">From Properties</span>
                    <span className="font-medium">{mockPortfolio.tokens.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-foreground-muted">Receive As</span>
                    <select className="bg-transparent border border-glass-border rounded px-2 py-1 text-sm">
                      <option value="usdc">USDC</option>
                      <option value="sol">SOL</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={() => setShowClaimModal(false)}
                    className="btn-secondary flex-1"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      alert("Dividends claimed! (Demo - would execute Solana transaction)");
                      setShowClaimModal(false);
                    }}
                    className="btn-primary flex-1 flex items-center justify-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    Claim ${mockPortfolio.pendingDividends}
                  </button>
                </div>

                <p className="text-xs text-foreground-muted mt-4">
                  Dividends will be sent to your connected wallet
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
