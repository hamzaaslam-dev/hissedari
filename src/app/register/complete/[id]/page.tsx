"use client";

import { useEffect, useState, use } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  CheckCircle2,
  XCircle,
  Building2,
  ExternalLink,
} from "lucide-react";
import {
  getRegistrationRequest,
  markRegistrationTokenized,
  deleteRegistrationRequest,
  RegistrationRequest,
} from "@/lib/registrationRequests";
import { useRouter } from "next/navigation";
import {
  saveRegisteredPropertyAsync,
  createPropertyFromRegistration,
} from "@/lib/propertyStore";
import {
  tokenizeProperty,
  getSolBalance,
  getExplorerUrl,
  formatAddress,
  SOLANA_NETWORK,
} from "@/lib/solana";

function formatPKR(value: number) {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function CompleteRegistrationPage({ params }: PageProps) {
  const { id } = use(params);
  const { publicKey, signTransaction, connected } = useWallet();
  const router = useRouter();
  const walletAddress = publicKey?.toBase58() ?? null;

  const [req, setReq] = useState<RegistrationRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [solBalance, setSolBalance] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    propertyId: string;
    mintAddress: string;
    mintSignature: string;
    tokenSignature: string;
  } | null>(null);

  useEffect(() => {
    void loadRequest();
  }, [id]);

  useEffect(() => {
    if (publicKey) {
      void getSolBalance(publicKey).then(setSolBalance).catch(() => setSolBalance(0));
    }
  }, [publicKey]);

  const loadRequest = async () => {
    setLoading(true);
    const data = await getRegistrationRequest(id);
    setReq(data);
    setLoading(false);
  };

  const handleCancel = async () => {
    if (!req || !walletAddress) return;
    if (req.requester_address !== walletAddress) {
      setError("Only the original requester can cancel this request.");
      return;
    }
    if (req.status !== "pending") {
      setError("Only pending requests can be cancelled.");
      return;
    }
    if (
      !confirm(
        "Cancel this pending registration request? This cannot be undone, but you can submit a new request afterwards."
      )
    ) {
      return;
    }
    setCancelling(true);
    setError(null);
    const ok = await deleteRegistrationRequest(req.id, walletAddress);
    if (!ok) {
      setError("Failed to cancel request.");
      setCancelling(false);
      return;
    }
    router.push("/dashboard");
  };

  const handleComplete = async () => {
    if (!req || !publicKey || !signTransaction) return;
    if (req.requester_address !== walletAddress) {
      setError("Only the original requester can complete this tokenization.");
      return;
    }
    if (req.status !== "approved") {
      setError(`This request is ${req.status}; only approved requests can be tokenized.`);
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const tokenResult = await tokenizeProperty(
        { publicKey, signTransaction },
        req.property_value,
        req.total_tokens
      );

      const property = createPropertyFromRegistration(
        {
          name: req.name,
          location: req.location,
          city: req.city,
          description: req.description || "",
          propertyType: req.property_type,
          size: req.size,
          bedrooms: req.bedrooms ?? undefined,
          bathrooms: req.bathrooms ?? undefined,
          yearBuilt: req.year_built ?? new Date().getFullYear(),
          features: req.features || [],
          propertyValue: req.property_value,
          photos: req.uploaded_photos,
          certificates: req.certificates,
        },
        {
          totalTokens: req.total_tokens,
          pricePerToken: req.price_per_token,
          platformEquityPercent: req.platform_equity_percent,
          fundingDeadlineDays: req.funding_deadline_days,
          estimatedDividendYield: req.estimated_dividend_yield,
        },
        {
          mintAddress: tokenResult.mintAddress,
          tokenAccount: tokenResult.tokenAccount,
          ownerAddress: publicKey.toBase58(),
          transactionSignature: tokenResult.mintSignature,
        }
      );

      const saved = await saveRegisteredPropertyAsync(property, req.id);
      if (!saved) {
        throw new Error(
          "On-chain tokenization succeeded but the property could not be saved to the database."
        );
      }

      const tokenizedRes = await markRegistrationTokenized(req.id, {
        propertyId: property.id,
        requesterAddress: publicKey.toBase58(),
      });
      if (!tokenizedRes.success) {
        console.warn(
          "Property created but request status update failed:",
          tokenizedRes.error
        );
      }

      setResult({
        propertyId: property.id,
        mintAddress: tokenResult.mintAddress,
        mintSignature: tokenResult.mintSignature,
        tokenSignature: tokenResult.tokenSignature,
      });
    } catch (e: unknown) {
      console.error("Complete tokenization error:", e);
      setError(e instanceof Error ? e.message : "Unknown error");
    }

    setProcessing(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-28 pb-20 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-400 mx-auto" />
        </div>
      </div>
    );
  }

  if (!req) {
    return (
      <div className="min-h-screen pt-28 pb-20 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <div className="bg-red-500/10 border border-red-500/30 rounded-3xl p-12">
            <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white mb-2">
              Registration Request Not Found
            </h1>
            <p className="text-gray-400 mb-6">
              This request may have been deleted or never existed.
            </p>
            <Link
              href="/dashboard"
              className="inline-block px-6 py-2 bg-white/5 border border-white/10 text-white rounded-xl hover:bg-white/10"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const notLoggedInAsRequester =
    !connected || (walletAddress && walletAddress !== req.requester_address);

  return (
    <div className="min-h-screen pt-28 pb-20 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center">
              <Building2 className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{req.name}</h1>
              <p className="text-gray-400 text-sm">
                {req.location}, {req.city}
              </p>
            </div>
          </div>

          {/* Status banner */}
          {req.status === "pending" && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <p className="text-amber-300">
                  This request is still pending admin review. Once approved you&apos;ll be able to
                  complete tokenization here.
                </p>
                {connected && walletAddress === req.requester_address && (
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={cancelling}
                    className="shrink-0 text-sm px-4 py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 disabled:opacity-50 transition-colors"
                  >
                    {cancelling ? "Cancelling…" : "Cancel Request"}
                  </button>
                )}
              </div>
            </div>
          )}
          {req.status === "rejected" && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6">
              <p className="text-red-300 mb-1">This request was rejected.</p>
              {req.admin_notes && (
                <p className="text-red-200 text-sm">Reason: {req.admin_notes}</p>
              )}
            </div>
          )}
          {req.status === "tokenized" && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 mb-6 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <p className="text-emerald-300">
                Already tokenized.{" "}
                {req.property_id && (
                  <Link
                    href={`/properties/${req.property_id}`}
                    className="underline"
                  >
                    View live property
                  </Link>
                )}
              </p>
            </div>
          )}

          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="bg-black/30 rounded-lg p-3">
              <p className="text-gray-500 text-xs">Property Value</p>
              <p className="text-white font-medium">{formatPKR(req.property_value)}</p>
            </div>
            <div className="bg-black/30 rounded-lg p-3">
              <p className="text-gray-500 text-xs">Total Tokens</p>
              <p className="text-white font-medium">
                {req.total_tokens.toLocaleString()}
              </p>
            </div>
            <div className="bg-black/30 rounded-lg p-3">
              <p className="text-gray-500 text-xs">Yield</p>
              <p className="text-white font-medium">
                {req.estimated_dividend_yield}% p.a.
              </p>
            </div>
            <div className="bg-black/30 rounded-lg p-3">
              <p className="text-gray-500 text-xs">Funding Window</p>
              <p className="text-white font-medium">
                {req.funding_deadline_days} days
              </p>
            </div>
          </div>

          {/* Action area */}
          {req.status === "approved" && !result && (
            <>
              {!connected ? (
                <div className="text-center bg-black/30 rounded-xl p-6">
                  <p className="text-gray-300 mb-4">
                    Connect the requester wallet to sign the tokenization transactions.
                  </p>
                  <WalletMultiButton className="!bg-gradient-to-r !from-emerald-500 !to-cyan-500 !rounded-xl" />
                </div>
              ) : notLoggedInAsRequester ? (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                  <p className="text-red-300 mb-1">
                    Connected wallet does not match the original requester.
                  </p>
                  <p className="text-red-200 text-xs">
                    Requester:{" "}
                    <code className="font-mono">{req.requester_address}</code>
                  </p>
                </div>
              ) : (
                <>
                  <div className="bg-black/30 rounded-xl p-4 mb-4 flex items-center justify-between">
                    <div>
                      <p className="text-gray-500 text-xs">Connected Wallet (devnet)</p>
                      <p className="text-white font-mono text-sm">
                        {walletAddress && formatAddress(walletAddress)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-gray-500 text-xs">Balance</p>
                      <p className="text-white font-medium">
                        {solBalance.toFixed(4)} SOL
                      </p>
                    </div>
                  </div>

                  {error && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-4 text-red-300 text-sm">
                      {error}
                    </div>
                  )}

                  <button
                    onClick={handleComplete}
                    disabled={processing || solBalance < 0.01}
                    className="w-full px-6 py-3 bg-gradient-to-r from-emerald-500 to-cyan-500 disabled:opacity-50 text-white font-bold rounded-xl flex items-center justify-center gap-2"
                  >
                    {processing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Tokenizing on Solana{" "}
                        {SOLANA_NETWORK}...
                      </>
                    ) : (
                      <>Tokenize &amp; Publish to Marketplace</>
                    )}
                  </button>
                  {solBalance < 0.01 && (
                    <p className="text-amber-300 text-sm mt-2 text-center">
                      You need at least 0.01 SOL to pay for the on-chain transactions.
                    </p>
                  )}
                </>
              )}
            </>
          )}

          {/* Result */}
          {result && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-6 text-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-white mb-2">
                Tokenization Complete
              </h2>
              <p className="text-gray-300 mb-4">
                Your property is now live on the marketplace.
              </p>
              <div className="bg-black/30 rounded-xl p-4 mb-4 space-y-2 text-left">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Token Mint</span>
                  <a
                    href={getExplorerUrl(result.mintAddress, "address")}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-300 font-mono inline-flex items-center gap-1"
                  >
                    {formatAddress(result.mintAddress)}{" "}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Mint TX</span>
                  <a
                    href={getExplorerUrl(result.mintSignature)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-300 font-mono inline-flex items-center gap-1"
                  >
                    {formatAddress(result.mintSignature)}{" "}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  href={`/properties/${result.propertyId}`}
                  className="px-6 py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white rounded-xl"
                >
                  View Property
                </Link>
                <Link
                  href="/dashboard"
                  className="px-6 py-2 bg-white/5 border border-white/10 text-white rounded-xl"
                >
                  Go to Dashboard
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
