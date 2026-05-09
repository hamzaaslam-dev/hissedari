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
import {
  listRegistrationRequests,
  deleteRegistrationRequest,
  RegistrationRequest,
} from "@/lib/registrationRequests";
import { isRegistrationWhitelisted } from "@/lib/registrationWhitelist";
import {
  fetchCampaign,
  fetchInvestorRecord,
  getCampaignPDA,
  finalizeCampaign,
  claimTokens,
  Campaign,
  InvestorRecord,
  CampaignStatus,
} from "@/lib/crowdfundingClient";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";

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

type MyCampaignEntry = {
  property: RegisteredProperty;
  campaign: Campaign;
  campaignPda: PublicKey;
};

type MyInvestmentEntry = {
  property: RegisteredProperty;
  campaign: Campaign;
  campaignPda: PublicKey;
  record: InvestorRecord;
};

export default function DashboardPage() {
  const { connected, publicKey, signTransaction } = useWallet();
  const { setVisible } = useWalletModal();
  const [activeTab, setActiveTab] = useState<"portfolio" | "income">("portfolio");
  const [copied, setCopied] = useState(false);
  const [holdings, setHoldings] = useState<TokenHolding[]>([]);
  const [loading, setLoading] = useState(true);
  const [solBalance, setSolBalance] = useState(0);
  const [ownedProperties, setOwnedProperties] = useState<RegisteredProperty[]>([]);
  const [myRegistrationRequests, setMyRegistrationRequests] = useState<RegistrationRequest[]>([]);
  const [cancellingRequestId, setCancellingRequestId] = useState<string | null>(null);
  const [myCampaigns, setMyCampaigns] = useState<MyCampaignEntry[]>([]);
  const [myInvestments, setMyInvestments] = useState<MyInvestmentEntry[]>([]);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const isAdmin = isRegistrationWhitelisted(publicKey?.toBase58() ?? null);

  useEffect(() => {
    if (connected && publicKey) {
      loadPortfolio();
      loadSolBalance();
      loadMyRegistrationRequests();
    } else {
      setLoading(false);
    }
  }, [connected, publicKey]);

  const loadMyRegistrationRequests = async () => {
    if (!publicKey) return;
    try {
      const reqs = await listRegistrationRequests({
        requester: publicKey.toBase58(),
      });
      setMyRegistrationRequests(reqs);
    } catch (e) {
      console.error("Failed to load my registration requests:", e);
    }
  };

  const handleCancelRegistrationRequest = async (id: string) => {
    if (!publicKey) return;
    if (
      !confirm(
        "Cancel this pending registration request? This cannot be undone, but you can submit a new request afterwards."
      )
    ) {
      return;
    }
    setCancellingRequestId(id);
    const ok = await deleteRegistrationRequest(id, publicKey.toBase58());
    if (!ok) {
      alert("Failed to cancel request. Make sure it is still pending.");
    } else {
      setMyRegistrationRequests((prev) => prev.filter((r) => r.id !== id));
    }
    setCancellingRequestId(null);
  };

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
      const [properties, owned, tokenAccountsResp, invRes] = await Promise.all([
        getRegisteredPropertiesAsync(),
        getPropertiesByOwnerAsync(publicKey.toBase58()),
        connection.getParsedTokenAccountsByOwner(publicKey, {
          programId: TOKEN_PROGRAM_ID,
        }),
        fetch(`/api/properties/investments?wallet=${encodeURIComponent(publicKey.toBase58())}`, {
          cache: "no-store",
        }),
      ]);

      let primaryTotals: Record<string, number> = {};
      try {
        const invJson = await invRes.json();
        primaryTotals = invJson.totalsByPropertyId || {};
      } catch {
        primaryTotals = {};
      }

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

      // Track which property IDs we've covered via on-chain SPL holdings so we
      // don't double count primary-market investments below.
      const handledPropertyIds = new Set<string>();

      for (const [mint, splBalance] of balancesByMint.entries()) {
        const property = propertiesByMint.get(mint) || buildUnknownPropertyFromMint(mint);
        const recordedPrimary = primaryTotals[property.id] ?? 0;
        const balance = splBalance + recordedPrimary;
        handledPropertyIds.add(property.id);

        tokenHoldings.push({
          property,
          balance,
          value: balance * property.tokenPrice,
        });
      }

      // Surface primary-market purchases for properties where the buyer holds
      // no on-chain SPL balance yet (e.g. SOL-paid funding, tokens not minted).
      for (const property of properties) {
        if (handledPropertyIds.has(property.id)) continue;
        const recordedPrimary = primaryTotals[property.id] ?? 0;
        if (recordedPrimary <= 0) continue;
        tokenHoldings.push({
          property,
          balance: recordedPrimary,
          value: recordedPrimary * property.tokenPrice,
        });
      }

      setHoldings(tokenHoldings);

      // Fetch crowdfunding campaign data for every known property in parallel,
      // then partition into "campaigns I created" and "campaigns I invested in".
      const myWallet = publicKey;
      const campaignFetches = properties
        .filter((p) => !!p.ownerAddress)
        .map(async (property) => {
          try {
            const creator = new PublicKey(property.ownerAddress);
            // Prefer the on-chain campaign PDA stored in the DB (the
            // authoritative one). For very old rows where it's missing
            // we fall back to PDA derivation, which only works when the
            // DB id matches the seed used during create_campaign.
            const campaignPda = property.campaignAddress
              ? new PublicKey(property.campaignAddress)
              : getCampaignPDA(property.id, creator)[0];
            const campaign = await fetchCampaign(property.id, creator, campaignPda);
            if (!campaign) return null;
            const isCreator = campaign.creator.equals(myWallet);
            const record = await fetchInvestorRecord(campaignPda, myWallet);
            return { property, campaign, campaignPda, isCreator, record };
          } catch {
            return null;
          }
        });
      const campaignResults = await Promise.all(campaignFetches);

      const newMyCampaigns: MyCampaignEntry[] = [];
      const newMyInvestments: MyInvestmentEntry[] = [];
      for (const r of campaignResults) {
        if (!r) continue;
        if (r.isCreator) {
          newMyCampaigns.push({
            property: r.property,
            campaign: r.campaign,
            campaignPda: r.campaignPda,
          });
        }
        if (r.record && r.record.amountInvested > 0) {
          newMyInvestments.push({
            property: r.property,
            campaign: r.campaign,
            campaignPda: r.campaignPda,
            record: r.record,
          });
        }
      }
      setMyCampaigns(newMyCampaigns);
      setMyInvestments(newMyInvestments);
    } catch (error) {
      console.error("Error loading portfolio:", error);
    }
    setLoading(false);
  };

  const handleFinalizeCampaign = async (entry: MyCampaignEntry) => {
    if (!publicKey || !signTransaction) return;
    if (
      !confirm(
        `Complete the crowdfunding campaign for "${entry.property.name}"? This releases the raised SOL to you and the platform, and lets investors claim their tokens. This cannot be undone.`
      )
    ) {
      return;
    }
    setActioningId(entry.property.id);
    setActionError(null);
    setActionSuccess(null);
    try {
      const sig = await finalizeCampaign(
        { publicKey, signTransaction },
        entry.property.id,
        entry.campaignPda
      );
      setActionSuccess(`Campaign completed. Tx: ${sig.slice(0, 12)}…`);
      await loadPortfolio();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to finalize campaign";
      setActionError(msg);
    } finally {
      setActioningId(null);
    }
  };

  const handleClaimTokens = async (entry: MyInvestmentEntry) => {
    if (!publicKey || !signTransaction) return;
    setActioningId(entry.property.id);
    setActionError(null);
    setActionSuccess(null);
    try {
      const mint = new PublicKey(entry.property.mintAddress);
      const sig = await claimTokens(
        { publicKey, signTransaction },
        entry.property.id,
        entry.campaign.creator,
        mint,
        entry.campaignPda
      );
      setActionSuccess(`Tokens claimed. Tx: ${sig.slice(0, 12)}…`);
      await loadPortfolio();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to claim tokens";
      setActionError(msg);
    } finally {
      setActioningId(null);
    }
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
            {isAdmin && (
              <Link
                href="/admin/registrations"
                className="btn-primary flex items-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
              >
                <CheckCircle2 className="w-4 h-4" />
                Review Requests
              </Link>
            )}
            {ownedProperties.length > 0 && (
              <Link href="/admin/dividends" className="btn-primary flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600">
                <Banknote className="w-4 h-4" />
                Distribute Dividends
              </Link>
            )}
            <button
              type="button"
              onClick={() => {
                loadPortfolio();
                loadMyRegistrationRequests();
              }}
              className="btn-secondary flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Refresh Portfolio
            </button>
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

        {/* My Registration Requests */}
        {myRegistrationRequests.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="glass-card p-6 mb-8"
          >
            <div className="flex items-center justify-between mb-4">
              <h2
                className="text-2xl font-bold"
                style={{ fontFamily: "'Cormorant Garamond', serif" }}
              >
                My Property <span className="text-gradient-gold">Registrations</span>
              </h2>
              <Link
                href="/register"
                className="text-sm text-accent hover:underline"
              >
                + Submit another
              </Link>
            </div>
            <div className="space-y-3">
              {myRegistrationRequests.map((req) => {
                const statusStyles: Record<string, string> = {
                  pending: "bg-amber-500/10 border-amber-500/30 text-amber-300",
                  approved: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
                  rejected: "bg-red-500/10 border-red-500/30 text-red-300",
                  tokenized: "bg-cyan-500/10 border-cyan-500/30 text-cyan-300",
                };
                return (
                  <div
                    key={req.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-background/30 border border-white/5 rounded-xl"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <p className="font-semibold truncate">{req.name}</p>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full border ${statusStyles[req.status]}`}
                        >
                          {req.status === "pending" && "Pending review"}
                          {req.status === "approved" && "Approved"}
                          {req.status === "rejected" && "Rejected"}
                          {req.status === "tokenized" && "Tokenized"}
                        </span>
                      </div>
                      <p className="text-sm text-foreground-muted truncate">
                        {req.location}, {req.city} ·{" "}
                        {req.total_tokens.toLocaleString()} tokens
                      </p>
                      {req.status === "rejected" && req.admin_notes && (
                        <p className="text-xs text-red-300 mt-1">
                          Reason: {req.admin_notes}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0">
                      {req.status === "approved" && (
                        <Link
                          href={`/register/complete/${req.id}`}
                          className="btn-primary text-sm px-4 py-2 flex items-center gap-1"
                        >
                          Complete Tokenization
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </Link>
                      )}
                      {req.status === "tokenized" && req.property_id && (
                        <Link
                          href={`/properties/${req.property_id}`}
                          className="btn-secondary text-sm px-4 py-2 flex items-center gap-1"
                        >
                          View Listing
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      )}
                      {(req.status === "pending" || req.status === "rejected") && (
                        <Link
                          href={`/register/complete/${req.id}`}
                          className="btn-secondary text-sm px-4 py-2"
                        >
                          Details
                        </Link>
                      )}
                      {req.status === "pending" && (
                        <button
                          type="button"
                          onClick={() => handleCancelRegistrationRequest(req.id)}
                          disabled={cancellingRequestId === req.id}
                          className="text-sm px-4 py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 disabled:opacity-50 transition-colors"
                        >
                          {cancellingRequestId === req.id ? "Cancelling…" : "Cancel"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Action feedback banner */}
        {(actionError || actionSuccess) && (
          <div
            className={`mb-6 p-4 rounded-xl border text-sm ${
              actionError
                ? "bg-red-500/10 border-red-500/30 text-red-300"
                : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <span className="break-all">{actionError || actionSuccess}</span>
              <button
                onClick={() => {
                  setActionError(null);
                  setActionSuccess(null);
                }}
                className="text-foreground-muted hover:text-foreground"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* My Crowdfunding Campaigns (as creator) */}
        {myCampaigns.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
            className="glass-card p-6 mb-8"
          >
            <h2
              className="text-2xl font-bold mb-4"
              style={{ fontFamily: "'Cormorant Garamond', serif" }}
            >
              My <span className="text-gradient-gold">Crowdfunding Campaigns</span>
            </h2>
            <div className="space-y-3">
              {myCampaigns.map((entry) => {
                const raisedSol = entry.campaign.totalRaised / LAMPORTS_PER_SOL;
                const goalSol = entry.campaign.fundingGoal / LAMPORTS_PER_SOL;
                const progress = Math.min(100, (raisedSol / Math.max(goalSol, 0.0000001)) * 100);
                const isActive = entry.campaign.status === CampaignStatus.Active;
                const isFunded = entry.campaign.status === CampaignStatus.Funded;
                const canFinalize = isActive && entry.campaign.totalRaised > 0;
                return (
                  <div
                    key={entry.property.id}
                    className="p-4 bg-background/30 border border-white/5 rounded-xl"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <Link
                            href={`/properties/${entry.property.id}`}
                            className="font-semibold hover:text-accent transition-colors"
                          >
                            {entry.property.name}
                          </Link>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full border ${
                              isActive
                                ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                                : isFunded
                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                                : "bg-red-500/10 border-red-500/30 text-red-300"
                            }`}
                          >
                            {isActive
                              ? "Active"
                              : isFunded
                              ? "Funded"
                              : "Cancelled"}
                          </span>
                        </div>
                        <div className="text-sm text-foreground-muted mb-2">
                          {entry.campaign.investorCount} investor
                          {entry.campaign.investorCount === 1 ? "" : "s"} ·{" "}
                          {entry.campaign.tokensSold.toLocaleString()} /{" "}
                          {entry.campaign.totalTokens.toLocaleString()} tokens sold
                        </div>
                        <div className="h-2 bg-background rounded-full overflow-hidden mb-1">
                          <div
                            className="h-full bg-gradient-to-r from-accent to-secondary"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-xs text-foreground-muted">
                          <span>{raisedSol.toFixed(4)} SOL raised</span>
                          <span>Goal {goalSol.toFixed(4)} SOL</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 shrink-0">
                        {canFinalize && (
                          <button
                            type="button"
                            onClick={() => handleFinalizeCampaign(entry)}
                            disabled={actioningId === entry.property.id}
                            className="btn-primary text-sm px-4 py-2 disabled:opacity-50"
                          >
                            {actioningId === entry.property.id
                              ? "Completing…"
                              : "Complete Crowdfunding"}
                          </button>
                        )}
                        {isActive && entry.campaign.totalRaised === 0 && (
                          <span className="text-xs text-foreground-muted px-3 py-2">
                            Waiting for first investor
                          </span>
                        )}
                        {isFunded && (
                          <span className="text-xs px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
                            Investors can now claim tokens
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* My Investments (as investor) — shows pending claims and claim history */}
        {myInvestments.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.19 }}
            className="glass-card p-6 mb-8"
          >
            <h2
              className="text-2xl font-bold mb-4"
              style={{ fontFamily: "'Cormorant Garamond', serif" }}
            >
              My <span className="text-gradient-gold">Crowdfunding Investments</span>
            </h2>
            <div className="space-y-3">
              {myInvestments.map((entry) => {
                const investedSol = entry.record.amountInvested / LAMPORTS_PER_SOL;
                const tokens = entry.record.tokensPurchased;
                const isFunded = entry.campaign.status === CampaignStatus.Funded;
                const isCancelled = entry.campaign.status === CampaignStatus.Cancelled;
                const claimed = entry.record.tokensClaimed;
                const refunded = entry.record.refunded;
                return (
                  <div
                    key={entry.property.id}
                    className="p-4 bg-background/30 border border-white/5 rounded-xl"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <Link
                            href={`/properties/${entry.property.id}`}
                            className="font-semibold hover:text-accent transition-colors"
                          >
                            {entry.property.name}
                          </Link>
                          {claimed && (
                            <span className="text-xs px-2 py-0.5 rounded-full border bg-cyan-500/10 border-cyan-500/30 text-cyan-300">
                              Claimed
                            </span>
                          )}
                          {refunded && (
                            <span className="text-xs px-2 py-0.5 rounded-full border bg-red-500/10 border-red-500/30 text-red-300">
                              Refunded
                            </span>
                          )}
                          {!claimed && !refunded && isFunded && (
                            <span className="text-xs px-2 py-0.5 rounded-full border bg-emerald-500/10 border-emerald-500/30 text-emerald-300">
                              Ready to claim
                            </span>
                          )}
                          {!claimed && !refunded && !isFunded && !isCancelled && (
                            <span className="text-xs px-2 py-0.5 rounded-full border bg-amber-500/10 border-amber-500/30 text-amber-300">
                              Pending campaign completion
                            </span>
                          )}
                          {isCancelled && (
                            <span className="text-xs px-2 py-0.5 rounded-full border bg-red-500/10 border-red-500/30 text-red-300">
                              Campaign cancelled
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-foreground-muted">
                          You committed {investedSol.toFixed(4)} SOL for{" "}
                          <span className="text-foreground font-medium">
                            {tokens.toLocaleString()} tokens
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 shrink-0">
                        {!claimed && !refunded && isFunded && (
                          <button
                            type="button"
                            onClick={() => handleClaimTokens(entry)}
                            disabled={actioningId === entry.property.id}
                            className="btn-primary text-sm px-4 py-2 disabled:opacity-50"
                          >
                            {actioningId === entry.property.id
                              ? "Claiming…"
                              : "Claim My Tokens"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

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
