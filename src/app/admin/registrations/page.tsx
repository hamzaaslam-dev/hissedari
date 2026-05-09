"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  Building2,
  MapPin,
  Coins,
  Loader2,
  ExternalLink,
} from "lucide-react";
import {
  isRegistrationWhitelisted,
  REGISTRATION_WHITELIST,
} from "@/lib/registrationWhitelist";
import {
  listRegistrationRequests,
  reviewRegistrationRequest,
  deleteRegistrationRequest,
  RegistrationRequest,
  RegistrationRequestStatus,
} from "@/lib/registrationRequests";
import { Trash2 } from "lucide-react";

type FilterTab = "pending" | "approved" | "rejected" | "tokenized" | "all";

const STATUS_BADGE: Record<
  RegistrationRequestStatus,
  { label: string; className: string }
> = {
  pending: {
    label: "Pending review",
    className: "bg-amber-500/20 border-amber-500/30 text-amber-300",
  },
  approved: {
    label: "Approved",
    className: "bg-emerald-500/20 border-emerald-500/30 text-emerald-300",
  },
  rejected: {
    label: "Rejected",
    className: "bg-red-500/20 border-red-500/30 text-red-300",
  },
  tokenized: {
    label: "Tokenized",
    className: "bg-cyan-500/20 border-cyan-500/30 text-cyan-300",
  },
};

function formatPKR(value: number) {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatAddr(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString();
}

export default function AdminRegistrationsPage() {
  const { publicKey, connected } = useWallet();
  const walletAddress = publicKey?.toBase58() ?? null;
  const isAdmin = isRegistrationWhitelisted(walletAddress);

  const [requests, setRequests] = useState<RegistrationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>("pending");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionNotes, setRejectionNotes] = useState("");

  // Calls the server-side endpoint that uses the on-chain admin keypair
  // to register `walletToWhitelist` in the crowdfunding contract's
  // whitelist. The browser admin (any wallet in REGISTRATION_WHITELIST)
  // is just authorising the call; the on-chain signature comes from the
  // server's SOLANA_ADMIN_KEYPAIR.
  const whitelistRequesterOnChain = async (
    walletToWhitelist: string
  ): Promise<{ ok: boolean; message: string; signature?: string }> => {
    if (!walletAddress) {
      return { ok: false, message: "No admin wallet connected." };
    }
    try {
      const res = await fetch("/api/crowdfunding/whitelist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletToWhitelist,
          requesterAddress: walletAddress,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        return {
          ok: false,
          message:
            json?.error || `On-chain whitelist failed (HTTP ${res.status}).`,
        };
      }
      if (json?.alreadyWhitelisted) {
        return { ok: true, message: "Requester was already whitelisted on-chain." };
      }
      return {
        ok: true,
        message: "Requester whitelisted on-chain.",
        signature: json?.signature,
      };
    } catch (e) {
      return {
        ok: false,
        message:
          e instanceof Error
            ? e.message
            : "Network error while whitelisting on-chain.",
      };
    }
  };

  useEffect(() => {
    if (connected && isAdmin) {
      void loadRequests();
    } else {
      setLoading(false);
    }
  }, [connected, isAdmin]);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const data = await listRegistrationRequests();
      setRequests(data);
    } catch (e) {
      console.error("Failed to load requests", e);
    }
    setLoading(false);
  };

  const handleApprove = async (id: string) => {
    if (!walletAddress) return;
    const target = requests.find((r) => r.id === id);
    setProcessingId(id);
    setError(null);
    setInfo(null);

    const res = await reviewRegistrationRequest(id, {
      action: "approve",
      adminAddress: walletAddress,
    });
    if (!res.success) {
      setError(res.error || "Failed to approve");
      setProcessingId(null);
      return;
    }

    // The DB is approved — now also whitelist the requester on-chain so
    // that when they hit "Complete Tokenization" their create_campaign
    // call doesn't fail with AccountNotInitialized on whitelist_entry.
    if (target?.requester_address) {
      const wlRes = await whitelistRequesterOnChain(target.requester_address);
      if (!wlRes.ok) {
        setError(
          `Approved in DB, but on-chain whitelist failed: ${wlRes.message}. Use the "Whitelist on-chain" button on the Approved tab to retry.`
        );
      } else {
        setInfo(wlRes.message);
      }
    }

    await loadRequests();
    setProcessingId(null);
  };

  const handleManualWhitelist = async (req: RegistrationRequest) => {
    setProcessingId(req.id);
    setError(null);
    setInfo(null);
    const wlRes = await whitelistRequesterOnChain(req.requester_address);
    if (!wlRes.ok) {
      setError(`On-chain whitelist failed: ${wlRes.message}`);
    } else {
      setInfo(wlRes.message);
    }
    setProcessingId(null);
  };

  const handleAdminDelete = async (id: string) => {
    if (!walletAddress) return;
    if (!confirm("Permanently delete this registration request?")) return;
    setProcessingId(id);
    setError(null);
    const ok = await deleteRegistrationRequest(id, walletAddress);
    if (!ok) {
      setError("Failed to delete request.");
    } else {
      setRequests((prev) => prev.filter((r) => r.id !== id));
    }
    setProcessingId(null);
  };

  const handleReject = async (id: string) => {
    if (!walletAddress) return;
    if (!rejectionNotes.trim()) {
      setError("Please provide a reason for rejection.");
      return;
    }
    setProcessingId(id);
    setError(null);
    const res = await reviewRegistrationRequest(id, {
      action: "reject",
      adminAddress: walletAddress,
      adminNotes: rejectionNotes.trim(),
    });
    if (!res.success) {
      setError(res.error || "Failed to reject");
    } else {
      setRejectingId(null);
      setRejectionNotes("");
      await loadRequests();
    }
    setProcessingId(null);
  };

  const filtered =
    filter === "all" ? requests : requests.filter((r) => r.status === filter);

  if (!connected) {
    return (
      <div className="min-h-screen pt-28 pb-20 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-12">
            <ShieldCheck className="w-12 h-12 text-amber-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white mb-2">
              Admin Sign-In Required
            </h1>
            <p className="text-gray-400 mb-6">
              Connect a whitelisted admin wallet to review property registration
              requests.
            </p>
            <WalletMultiButton className="!bg-gradient-to-r !from-amber-500 !to-orange-500 !rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen pt-28 pb-20 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="bg-red-500/10 border border-red-500/30 rounded-3xl p-12">
            <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white mb-2">
              Not an Admin Wallet
            </h1>
            <p className="text-gray-300 mb-4">
              The wallet{" "}
              <code className="text-amber-300 font-mono text-sm">
                {walletAddress && formatAddr(walletAddress)}
              </code>{" "}
              is not authorized to review registration requests.
            </p>
            <div className="bg-black/30 rounded-lg p-3 text-left">
              <p className="text-gray-400 text-xs mb-1">Authorized Wallet(s)</p>
              {REGISTRATION_WHITELIST.map((addr) => (
                <p key={addr} className="text-emerald-300 font-mono text-sm break-all">
                  {addr}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const counts = {
    pending: requests.filter((r) => r.status === "pending").length,
    approved: requests.filter((r) => r.status === "approved").length,
    rejected: requests.filter((r) => r.status === "rejected").length,
    tokenized: requests.filter((r) => r.status === "tokenized").length,
  };

  return (
    <div className="min-h-screen pt-28 pb-20 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>

        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
              Property Registration Requests
            </h1>
            <p className="text-gray-400">
              Review and approve property submissions before they appear on the
              marketplace.
            </p>
          </div>
          <button
            onClick={() => void loadRequests()}
            className="px-4 py-2 bg-white/5 border border-white/10 text-white rounded-xl hover:bg-white/10 transition-colors text-sm"
          >
            Refresh
          </button>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {(
            [
              { key: "pending", label: `Pending (${counts.pending})` },
              { key: "approved", label: `Approved (${counts.approved})` },
              { key: "tokenized", label: `Tokenized (${counts.tokenized})` },
              { key: "rejected", label: `Rejected (${counts.rejected})` },
              { key: "all", label: `All (${requests.length})` },
            ] as { key: FilterTab; label: string }[]
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                filter === tab.key
                  ? "bg-emerald-500/30 border border-emerald-500/50 text-white"
                  : "bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-4 mb-6 flex justify-between gap-3">
            <span className="text-red-300">{error}</span>
            <button onClick={() => setError(null)} className="text-red-400">
              ✕
            </button>
          </div>
        )}

        {info && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 mb-6 flex justify-between gap-3">
            <span className="text-emerald-300">{info}</span>
            <button onClick={() => setInfo(null)} className="text-emerald-400">
              ✕
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-12 text-center">
            <Building2 className="w-12 h-12 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-300">
              No requests match the current filter.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {filtered.map((req) => (
                <motion.div
                  key={req.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6"
                >
                  <div className="flex flex-col md:flex-row gap-6">
                    {/* Image */}
                    <div className="md:w-48 flex-shrink-0">
                      {req.uploaded_photos?.[0] ? (
                        <div className="relative w-full h-32 md:h-32 rounded-xl overflow-hidden bg-black/40">
                          <Image
                            src={req.uploaded_photos[0]}
                            alt={req.name}
                            fill
                            sizes="200px"
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-full h-32 rounded-xl bg-black/40 flex items-center justify-center">
                          <Building2 className="w-10 h-10 text-gray-500" />
                        </div>
                      )}
                    </div>

                    {/* Body */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                        <h2 className="text-xl font-bold text-white truncate">
                          {req.name}
                        </h2>
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border ${STATUS_BADGE[req.status].className}`}
                        >
                          {req.status === "pending" && <Clock className="w-3 h-3" />}
                          {req.status === "approved" && <CheckCircle2 className="w-3 h-3" />}
                          {req.status === "rejected" && <XCircle className="w-3 h-3" />}
                          {req.status === "tokenized" && <Coins className="w-3 h-3" />}
                          {STATUS_BADGE[req.status].label}
                        </span>
                      </div>

                      <p className="flex items-center gap-1 text-gray-400 text-sm mb-3">
                        <MapPin className="w-3.5 h-3.5" />
                        {req.location}, {req.city}
                      </p>

                      {req.description && (
                        <p className="text-gray-300 text-sm mb-3 line-clamp-2">
                          {req.description}
                        </p>
                      )}

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mb-4">
                        <div>
                          <p className="text-gray-500 text-xs">Property Value</p>
                          <p className="text-white font-medium">
                            {formatPKR(req.property_value)}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs">Total Tokens</p>
                          <p className="text-white font-medium">
                            {req.total_tokens.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs">Yield</p>
                          <p className="text-white font-medium">
                            {req.estimated_dividend_yield}% p.a.
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs">Funding Window</p>
                          <p className="text-white font-medium">
                            {req.funding_deadline_days} days
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs mb-4">
                        <div className="bg-black/30 rounded-lg px-3 py-2">
                          <p className="text-gray-500">Requester</p>
                          <p className="text-emerald-300 font-mono break-all">
                            {req.requester_address}
                          </p>
                        </div>
                        <div className="bg-black/30 rounded-lg px-3 py-2">
                          <p className="text-gray-500">Submitted</p>
                          <p className="text-white">{formatDate(req.created_at)}</p>
                        </div>
                      </div>

                      {/* Photos & certificates */}
                      <div className="flex flex-wrap gap-3 mb-4">
                        <span className="text-gray-400 text-xs">
                          {req.uploaded_photos.length} photo
                          {req.uploaded_photos.length === 1 ? "" : "s"} ·{" "}
                          {req.certificates.length} certificate
                          {req.certificates.length === 1 ? "" : "s"}
                        </span>
                        {req.certificates.map((url, i) => (
                          <a
                            key={url}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-cyan-300 hover:bg-white/10"
                          >
                            Cert {i + 1} <ExternalLink className="w-3 h-3" />
                          </a>
                        ))}
                      </div>

                      {req.admin_notes && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4">
                          <p className="text-red-300 text-xs uppercase mb-1">
                            Admin notes
                          </p>
                          <p className="text-red-200 text-sm">{req.admin_notes}</p>
                        </div>
                      )}

                      {req.status === "pending" && (
                        <div>
                          {rejectingId === req.id ? (
                            <div className="space-y-2">
                              <textarea
                                value={rejectionNotes}
                                onChange={(e) => setRejectionNotes(e.target.value)}
                                placeholder="Reason for rejection (visible to requester)"
                                rows={2}
                                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500/40"
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleReject(req.id)}
                                  disabled={processingId === req.id}
                                  className="px-4 py-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium flex items-center gap-2"
                                >
                                  {processingId === req.id && (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  )}
                                  Confirm Reject
                                </button>
                                <button
                                  onClick={() => {
                                    setRejectingId(null);
                                    setRejectionNotes("");
                                    setError(null);
                                  }}
                                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg text-sm border border-white/10"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={() => handleApprove(req.id)}
                                disabled={processingId === req.id}
                                className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium flex items-center gap-2"
                              >
                                {processingId === req.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="w-4 h-4" />
                                )}
                                Approve
                              </button>
                              <button
                                onClick={() => {
                                  setRejectingId(req.id);
                                  setRejectionNotes("");
                                  setError(null);
                                }}
                                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg text-sm border border-white/10 flex items-center gap-2"
                              >
                                <XCircle className="w-4 h-4" />
                                Reject
                              </button>
                              <button
                                onClick={() => handleAdminDelete(req.id)}
                                disabled={processingId === req.id}
                                title="Permanently delete this request"
                                className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-300 rounded-lg text-sm border border-red-500/30 flex items-center gap-2"
                              >
                                <Trash2 className="w-4 h-4" />
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {req.status === "approved" && (
                        <div className="space-y-2">
                          <p className="text-emerald-300 text-sm">
                            Approved on {req.reviewed_at ? formatDate(req.reviewed_at) : "—"}.
                            Waiting for the requester to complete on-chain tokenization.
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleManualWhitelist(req)}
                              disabled={processingId === req.id}
                              title="Re-run the on-chain whitelist (in case it failed during approval)"
                              className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-200 rounded-lg text-xs border border-amber-500/30 inline-flex items-center gap-2 disabled:opacity-50"
                            >
                              {processingId === req.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <ShieldCheck className="w-3.5 h-3.5" />
                              )}
                              Whitelist on-chain
                            </button>
                          </div>
                        </div>
                      )}

                      {req.status === "tokenized" && req.property_id && (
                        <Link
                          href={`/properties/${req.property_id}`}
                          className="inline-flex items-center gap-1 text-cyan-300 hover:text-cyan-200 text-sm"
                        >
                          View live property listing <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      )}

                      {req.status !== "pending" && req.status !== "tokenized" && (
                        <div className="mt-3">
                          <button
                            onClick={() => handleAdminDelete(req.id)}
                            disabled={processingId === req.id}
                            className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-300 rounded-lg text-xs border border-red-500/30 inline-flex items-center gap-2"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Remove from list
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
