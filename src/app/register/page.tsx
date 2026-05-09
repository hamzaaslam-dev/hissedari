"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import Link from "next/link";
import {
  tokenizePropertyForCrowdfunding,
  getSolBalance,
  getExplorerUrl,
  formatAddress,
  SOLANA_NETWORK,
} from "@/lib/solana";
import {
  saveRegisteredPropertyAsync,
  createPropertyFromRegistration,
  generatePropertyId,
} from "@/lib/propertyStore";
import { FileUpload } from "@/components/FileUpload";
import {
  isRegistrationWhitelisted,
  REGISTRATION_WHITELIST,
} from "@/lib/registrationWhitelist";
import { submitRegistrationRequest } from "@/lib/registrationRequests";

type Step = "details" | "tokenization" | "confirm" | "processing" | "success";

interface PropertyFormData {
  name: string;
  location: string;
  city: string;
  description: string;
  propertyType: "residential" | "commercial" | "industrial" | "mixed-use";
  size: number;
  bedrooms?: number;
  bathrooms?: number;
  yearBuilt: number;
  features: string[];
  image: string;
  propertyValue: number;
  photos: string[];
  certificates: string[];
}

interface TokenizationData {
  totalTokens: number;
  pricePerToken: number;
  method: "tokens" | "price";
  platformEquityPercent: number;
  fundingDeadlineDays: number;
  estimatedDividendYield: number;
}

const propertyTypes = [
  { value: "residential", label: "Residential", icon: "🏠" },
  { value: "commercial", label: "Commercial", icon: "🏢" },
  { value: "industrial", label: "Industrial", icon: "🏭" },
  { value: "mixed-use", label: "Mixed Use", icon: "🏗️" },
];

const pakistanCities = [
  "Karachi",
  "Lahore",
  "Islamabad",
  "Rawalpindi",
  "Faisalabad",
  "Multan",
  "Peshawar",
  "Quetta",
  "Gwadar",
  "Murree",
  "Hyderabad",
  "Sialkot",
];

const commonFeatures = [
  "Parking",
  "Garden",
  "Swimming Pool",
  "Gym",
  "24/7 Security",
  "Generator Backup",
  "Elevator",
  "Central AC",
  "Servant Quarter",
  "Rooftop Access",
  "Solar Panels",
  "Water Storage",
];

export default function RegisterPropertyPage() {
  const { publicKey, connected, signTransaction } = useWallet();
  const [currentStep, setCurrentStep] = useState<Step>("details");
  const [solBalance, setSolBalance] = useState<number>(0);

  const walletAddress = publicKey?.toBase58() ?? null;
  const isAuthorized = isRegistrationWhitelisted(walletAddress);

  const [propertyData, setPropertyData] = useState<PropertyFormData>({
    name: "",
    location: "",
    city: "",
    description: "",
    propertyType: "residential",
    size: 0,
    bedrooms: undefined,
    bathrooms: undefined,
    yearBuilt: new Date().getFullYear(),
    features: [],
    image: "",
    propertyValue: 0,
    photos: [],
    certificates: [],
  });

  const [tokenData, setTokenData] = useState<TokenizationData>({
    totalTokens: 1000,
    pricePerToken: 0,
    method: "tokens",
    platformEquityPercent: 5,
    fundingDeadlineDays: 30,
    estimatedDividendYield: 8.5,
  });

  const [result, setResult] = useState<{
    mintAddress: string;
    mintSignature: string;
    campaign: string;
    campaignSignature: string;
  } | null>(null);

  const [requestResult, setRequestResult] = useState<{ requestId: string } | null>(null);

  const [error, setError] = useState<string | null>(null);

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
    const interval = setInterval(fetchBalance, 10000);
    return () => clearInterval(interval);
  }, [publicKey]);

  // Calculate token price when values change
  useEffect(() => {
    if (tokenData.method === "tokens" && propertyData.propertyValue > 0 && tokenData.totalTokens > 0) {
      setTokenData((prev) => ({
        ...prev,
        pricePerToken: propertyData.propertyValue / prev.totalTokens,
      }));
    }
  }, [propertyData.propertyValue, tokenData.totalTokens, tokenData.method]);

  // Calculate total tokens when price changes
  useEffect(() => {
    if (tokenData.method === "price" && propertyData.propertyValue > 0 && tokenData.pricePerToken > 0) {
      setTokenData((prev) => ({
        ...prev,
        totalTokens: Math.floor(propertyData.propertyValue / prev.pricePerToken),
      }));
    }
  }, [propertyData.propertyValue, tokenData.pricePerToken, tokenData.method]);

  const handleFeatureToggle = (feature: string) => {
    setPropertyData((prev) => ({
      ...prev,
      features: prev.features.includes(feature)
        ? prev.features.filter((f) => f !== feature)
        : [...prev.features, feature],
    }));
  };

  const handleSubmitRequest = async () => {
    if (!publicKey) {
      setError("Please connect your wallet first");
      return;
    }

    setCurrentStep("processing");
    setError(null);

    try {
      const res = await submitRegistrationRequest({
        requesterAddress: publicKey.toBase58(),
        name: propertyData.name,
        location: propertyData.location,
        city: propertyData.city,
        description: propertyData.description,
        propertyType: propertyData.propertyType,
        size: propertyData.size,
        bedrooms: propertyData.bedrooms,
        bathrooms: propertyData.bathrooms,
        yearBuilt: propertyData.yearBuilt,
        features: propertyData.features,
        propertyValue: propertyData.propertyValue,
        totalTokens: tokenData.totalTokens,
        pricePerToken: tokenData.pricePerToken,
        platformEquityPercent: tokenData.platformEquityPercent,
        fundingDeadlineDays: tokenData.fundingDeadlineDays,
        estimatedDividendYield: tokenData.estimatedDividendYield,
        uploadedPhotos: propertyData.photos,
        certificates: propertyData.certificates,
      });

      if (!res.success) {
        throw new Error(res.error || "Failed to submit request");
      }

      setRequestResult({ requestId: res.id! });
      setCurrentStep("success");
    } catch (e: unknown) {
      console.error("Submit request error:", e);
      const errorMessage = e instanceof Error ? e.message : "Unknown error occurred";
      setError(`Could not submit registration request: ${errorMessage}`);
      setCurrentStep("confirm");
    }
  };

  const handleTokenize = async () => {
    if (!publicKey || !signTransaction) {
      setError("Please connect your wallet first");
      return;
    }

    if (!isRegistrationWhitelisted(publicKey.toBase58())) {
      setError(
        "This wallet is not authorized to tokenize directly. Submit a registration request and wait for admin approval."
      );
      return;
    }

    setCurrentStep("processing");
    setError(null);

    try {
      // Convert PKR property value -> USD for the on-chain price calculation.
      // (1 USD ~ 278 PKR, matching the rest of the app.)
      const propertyValueUsd = propertyData.propertyValue / 278;

      const fundingDeadline = new Date();
      fundingDeadline.setDate(
        fundingDeadline.getDate() + tokenData.fundingDeadlineDays
      );

      // Generate the property ID up-front so the same ID is used both as
      // the on-chain `propertyId` seed for the campaign PDA and as the row
      // ID in the database — that way we can look the campaign up later.
      const propertyId = generatePropertyId();

      const tokenResult = await tokenizePropertyForCrowdfunding(
        { publicKey, signTransaction },
        {
          propertyId,
          propertyValueUsd,
          totalTokens: tokenData.totalTokens,
          fundingDeadline,
          platformEquityPercent: tokenData.platformEquityPercent,
          distributionFrequencyDays: 30,
        }
      );

      setResult({
        mintAddress: tokenResult.mintAddress,
        mintSignature: tokenResult.mintSignature,
        campaign: tokenResult.campaign,
        campaignSignature: tokenResult.campaignSignature,
      });

      const registeredProperty = createPropertyFromRegistration(
        propertyData,
        tokenData,
        {
          mintAddress: tokenResult.mintAddress,
          tokenAccount: "", // No owner ATA in crowdfunding flow; tokens minted to investors via claim_tokens
          ownerAddress: publicKey.toBase58(),
          transactionSignature: tokenResult.campaignSignature,
          campaignAddress: tokenResult.campaign,
          propertyId,
        }
      );

      const saved = await saveRegisteredPropertyAsync(registeredProperty);
      if (!saved) {
        console.warn("Failed to save property to database, but tokenization succeeded");
      }

      setCurrentStep("success");
    } catch (e: unknown) {
      console.error("Tokenization error:", e);
      const errorMessage = e instanceof Error ? e.message : "Unknown error occurred";
      setError(`Tokenization failed: ${errorMessage}`);
      setCurrentStep("confirm");
    }
  };

  const formatPKR = (value: number) => {
    return new Intl.NumberFormat("en-PK", {
      style: "currency",
      currency: "PKR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const isPropertyValid = () => {
    return (
      propertyData.name.length > 0 &&
      propertyData.location.length > 0 &&
      propertyData.city.length > 0 &&
      propertyData.propertyValue > 0 &&
      propertyData.size > 0 &&
      propertyData.photos.length > 0 &&
      propertyData.certificates.length > 0
    );
  };

  const isTokenValid = () => {
    return tokenData.totalTokens >= 10 && tokenData.totalTokens <= 1000000;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-emerald-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <Link href="/" className="inline-block mb-6">
            <span className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              Hissedari
            </span>
          </Link>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Register Your Property
          </h1>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto">
            Tokenize your real estate on Solana {SOLANA_NETWORK} and enable fractional ownership
          </p>
        </motion.div>

        {/* Progress Steps */}
        <div className="flex justify-center mb-12">
          <div className="flex items-center gap-4">
            {[
              { key: "details", label: "Property Details" },
              { key: "tokenization", label: "Tokenization" },
              { key: "confirm", label: "Confirm" },
            ].map((step, index) => (
              <div key={step.key} className="flex items-center">
                <motion.div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm
                    ${
                      currentStep === step.key ||
                      (currentStep === "processing" && step.key === "confirm") ||
                      (currentStep === "success" && step.key === "confirm")
                        ? "bg-gradient-to-r from-emerald-500 to-cyan-500 text-white"
                        : ["tokenization", "confirm"].indexOf(step.key) <
                          ["details", "tokenization", "confirm"].indexOf(currentStep)
                        ? "bg-emerald-600 text-white"
                        : "bg-gray-700 text-gray-400"
                    }`}
                >
                  {index + 1}
                </motion.div>
                {index < 2 && (
                  <div className="w-16 md:w-24 h-1 mx-2 bg-gray-700 rounded">
                    <motion.div
                      className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded"
                      initial={{ width: "0%" }}
                      animate={{
                        width:
                          ["tokenization", "confirm", "processing", "success"].indexOf(currentStep) > index
                            ? "100%"
                            : "0%",
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Wallet Connection Banner */}
        {!connected && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-2xl p-6 mb-8"
          >
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">🔗</span>
                <div>
                  <h3 className="text-white font-semibold">Connect Your Wallet</h3>
                  <p className="text-gray-300 text-sm">
                    You need to connect a Solana wallet to tokenize your property
                  </p>
                </div>
              </div>
              <WalletMultiButton className="!bg-gradient-to-r !from-amber-500 !to-orange-500 !rounded-xl" />
            </div>
          </motion.div>
        )}

        {/* Pending Approval Banner */}
        {connected && publicKey && !isAuthorized && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/40 rounded-2xl p-6 mb-8"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-2xl">📝</span>
              </div>
              <div className="flex-1">
                <h3 className="text-white font-semibold text-lg mb-1">
                  Registration Requires Admin Approval
                </h3>
                <p className="text-gray-300 text-sm mb-3">
                  Anyone can submit a property for tokenization, but it must be reviewed and
                  approved by the platform admin before it appears on the marketplace. Once your
                  request is approved you&apos;ll be able to complete the on-chain tokenization
                  yourself from your dashboard.
                </p>
                <div className="bg-black/30 rounded-lg p-3 space-y-2">
                  <div>
                    <p className="text-gray-400 text-xs">Your Wallet (requester)</p>
                    <p className="text-white font-mono text-sm break-all">
                      {publicKey.toBase58()}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs">Reviewer (admin) Wallet</p>
                    {REGISTRATION_WHITELIST.map((addr) => (
                      <p key={addr} className="text-emerald-300 font-mono text-sm break-all">
                        {addr}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Wallet Info Banner */}
        {connected && publicKey && isAuthorized && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 rounded-2xl p-6 mb-8"
          >
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center">
                  <span className="text-2xl">💳</span>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Connected Wallet</p>
                  <p className="text-white font-mono">{formatAddress(publicKey.toBase58())}</p>
                  <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-emerald-500/20 border border-emerald-500/30 rounded-full text-emerald-300 text-xs font-medium">
                    <span>✓</span> Authorized to register
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-gray-400 text-sm">Balance (Devnet)</p>
                  <p className="text-white font-bold">{solBalance.toFixed(4)} SOL</p>
                </div>
                {solBalance < 0.1 && (
                  <a
                    href="https://faucet.solana.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium flex items-center gap-2"
                  >
                    <span>🚰</span> Get Test SOL
                  </a>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Error Alert */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-red-500/20 border border-red-500/30 rounded-xl p-4 mb-8"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">⚠️</span>
                <p className="text-red-300">{error}</p>
                <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-300">
                  ✕
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Step Content */}
        <AnimatePresence mode="wait">
          {/* Step 1: Property Details */}
          {currentStep === "details" && (
            <motion.div
              key="details"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8"
            >
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                <span className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center text-xl">
                  🏠
                </span>
                Property Details
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Property Name */}
                <div className="md:col-span-2">
                  <label className="block text-gray-300 mb-2 font-medium">Property Name *</label>
                  <input
                    type="text"
                    value={propertyData.name}
                    onChange={(e) => setPropertyData({ ...propertyData, name: e.target.value })}
                    placeholder="e.g., Luxury Apartments DHA Phase 6"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>

                {/* Property Value */}
                <div className="md:col-span-2">
                  <label className="block text-gray-300 mb-2 font-medium">Property Value (PKR) *</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">PKR</span>
                    <input
                      type="number"
                      value={propertyData.propertyValue || ""}
                      onChange={(e) =>
                        setPropertyData({ ...propertyData, propertyValue: Number(e.target.value) })
                      }
                      placeholder="50,000,000"
                      className="w-full pl-14 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    />
                  </div>
                  {propertyData.propertyValue > 0 && (
                    <p className="text-emerald-400 mt-2 text-sm">
                      ≈ ${(propertyData.propertyValue / 278).toLocaleString()} USD
                    </p>
                  )}
                </div>

                {/* Location */}
                <div>
                  <label className="block text-gray-300 mb-2 font-medium">Address/Location *</label>
                  <input
                    type="text"
                    value={propertyData.location}
                    onChange={(e) => setPropertyData({ ...propertyData, location: e.target.value })}
                    placeholder="e.g., Block A, DHA Phase 6"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>

                {/* City */}
                <div>
                  <label className="block text-gray-300 mb-2 font-medium">City *</label>
                  <select
                    value={propertyData.city}
                    onChange={(e) => setPropertyData({ ...propertyData, city: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  >
                    <option value="" className="bg-gray-800">
                      Select City
                    </option>
                    {pakistanCities.map((city) => (
                      <option key={city} value={city} className="bg-gray-800">
                        {city}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Property Type */}
                <div className="md:col-span-2">
                  <label className="block text-gray-300 mb-2 font-medium">Property Type *</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {propertyTypes.map((type) => (
                      <button
                        key={type.value}
                        onClick={() =>
                          setPropertyData({
                            ...propertyData,
                            propertyType: type.value as PropertyFormData["propertyType"],
                          })
                        }
                        className={`p-4 rounded-xl border text-center transition-all ${
                          propertyData.propertyType === type.value
                            ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                            : "bg-white/5 border-white/10 text-gray-300 hover:border-white/30"
                        }`}
                      >
                        <span className="text-2xl block mb-1">{type.icon}</span>
                        <span className="text-sm font-medium">{type.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Size */}
                <div>
                  <label className="block text-gray-300 mb-2 font-medium">Size (sq ft) *</label>
                  <input
                    type="number"
                    value={propertyData.size || ""}
                    onChange={(e) => setPropertyData({ ...propertyData, size: Number(e.target.value) })}
                    placeholder="2500"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>

                {/* Year Built */}
                <div>
                  <label className="block text-gray-300 mb-2 font-medium">Year Built</label>
                  <input
                    type="number"
                    value={propertyData.yearBuilt || ""}
                    onChange={(e) => setPropertyData({ ...propertyData, yearBuilt: Number(e.target.value) })}
                    placeholder="2023"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>

                {/* Bedrooms & Bathrooms (for residential) */}
                {(propertyData.propertyType === "residential" || propertyData.propertyType === "mixed-use") && (
                  <>
                    <div>
                      <label className="block text-gray-300 mb-2 font-medium">Bedrooms</label>
                      <input
                        type="number"
                        value={propertyData.bedrooms || ""}
                        onChange={(e) =>
                          setPropertyData({ ...propertyData, bedrooms: Number(e.target.value) })
                        }
                        placeholder="4"
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-300 mb-2 font-medium">Bathrooms</label>
                      <input
                        type="number"
                        value={propertyData.bathrooms || ""}
                        onChange={(e) =>
                          setPropertyData({ ...propertyData, bathrooms: Number(e.target.value) })
                        }
                        placeholder="3"
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                      />
                    </div>
                  </>
                )}

                {/* Description */}
                <div className="md:col-span-2">
                  <label className="block text-gray-300 mb-2 font-medium">Description</label>
                  <textarea
                    value={propertyData.description}
                    onChange={(e) => setPropertyData({ ...propertyData, description: e.target.value })}
                    placeholder="Describe your property..."
                    rows={4}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none"
                  />
                </div>

                {/* Features */}
                <div className="md:col-span-2">
                  <label className="block text-gray-300 mb-2 font-medium">Features</label>
                  <div className="flex flex-wrap gap-2">
                    {commonFeatures.map((feature) => (
                      <button
                        key={feature}
                        onClick={() => handleFeatureToggle(feature)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          propertyData.features.includes(feature)
                            ? "bg-emerald-500/20 border border-emerald-500 text-emerald-400"
                            : "bg-white/5 border border-white/10 text-gray-300 hover:border-white/30"
                        }`}
                      >
                        {feature}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Property Photos */}
                <div className="md:col-span-2">
                  <FileUpload
                    label="Property Photos *"
                    description="Upload photos of your property (exterior, interior, etc.)"
                    multiple={true}
                    maxFiles={10}
                    accept="image/*"
                    folder="property-photos"
                    existingFiles={propertyData.photos}
                    onUpload={(urls) => {
                      setPropertyData({ ...propertyData, photos: urls, image: urls[0] || "" });
                    }}
                  />
                </div>

                {/* Property Certificates */}
                <div className="md:col-span-2">
                  <FileUpload
                    label="Property Certificates *"
                    description="Upload ownership documents, title deeds, or registration certificates"
                    multiple={true}
                    maxFiles={5}
                    accept="image/*,application/pdf"
                    folder="property-certificates"
                    existingFiles={propertyData.certificates}
                    onUpload={(urls) => {
                      setPropertyData({ ...propertyData, certificates: urls });
                    }}
                  />
                </div>
              </div>

              {/* Navigation */}
              <div className="flex justify-end mt-8">
                <button
                  onClick={() => setCurrentStep("tokenization")}
                  disabled={!isPropertyValid()}
                  className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-emerald-500/25 transition-all"
                >
                  Continue to Tokenization →
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 2: Tokenization */}
          {currentStep === "tokenization" && (
            <motion.div
              key="tokenization"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8"
            >
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                <span className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center text-xl">
                  🪙
                </span>
                Tokenization Settings
              </h2>

              {/* Property Summary */}
              <div className="bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20 rounded-2xl p-6 mb-8">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm">Property</p>
                    <p className="text-white text-xl font-bold">{propertyData.name}</p>
                    <p className="text-gray-300 text-sm">
                      {propertyData.location}, {propertyData.city}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-400 text-sm">Total Value</p>
                    <p className="text-emerald-400 text-2xl font-bold">
                      {formatPKR(propertyData.propertyValue)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Tokenization Method */}
              <div className="mb-8">
                <label className="block text-gray-300 mb-4 font-medium">Choose Your Method</label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setTokenData({ ...tokenData, method: "tokens" })}
                    className={`p-6 rounded-2xl border text-left transition-all ${
                      tokenData.method === "tokens"
                        ? "bg-purple-500/20 border-purple-500"
                        : "bg-white/5 border-white/10 hover:border-white/30"
                    }`}
                  >
                    <span className="text-3xl block mb-2">🔢</span>
                    <h3 className="text-white font-bold mb-1">Set Total Tokens</h3>
                    <p className="text-gray-400 text-sm">Define how many tokens to create</p>
                  </button>
                  <button
                    onClick={() => setTokenData({ ...tokenData, method: "price" })}
                    className={`p-6 rounded-2xl border text-left transition-all ${
                      tokenData.method === "price"
                        ? "bg-purple-500/20 border-purple-500"
                        : "bg-white/5 border-white/10 hover:border-white/30"
                    }`}
                  >
                    <span className="text-3xl block mb-2">💰</span>
                    <h3 className="text-white font-bold mb-1">Set Token Price</h3>
                    <p className="text-gray-400 text-sm">Define the price per token</p>
                  </button>
                </div>
              </div>

              {/* Token Configuration */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {tokenData.method === "tokens" ? (
                  <div>
                    <label className="block text-gray-300 mb-2 font-medium">Number of Tokens *</label>
                    <input
                      type="number"
                      value={tokenData.totalTokens}
                      onChange={(e) => setTokenData({ ...tokenData, totalTokens: Number(e.target.value) })}
                      min={10}
                      max={1000000}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    />
                    <p className="text-gray-400 text-sm mt-2">Min: 10, Max: 1,000,000</p>
                  </div>
                ) : (
                  <div>
                    <label className="block text-gray-300 mb-2 font-medium">Price per Token (PKR) *</label>
                    <input
                      type="number"
                      value={tokenData.pricePerToken}
                      onChange={(e) =>
                        setTokenData({ ...tokenData, pricePerToken: Number(e.target.value) })
                      }
                      min={1}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    />
                  </div>
                )}

                {/* Calculated Value */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-gray-400">Total Tokens</span>
                    <span className="text-white font-bold">{tokenData.totalTokens.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-gray-400">Price per Token</span>
                    <span className="text-emerald-400 font-bold">
                      {formatPKR(tokenData.pricePerToken)}
                    </span>
                  </div>
                  <div className="border-t border-white/10 pt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Total Value</span>
                      <span className="text-purple-400 font-bold">
                        {formatPKR(tokenData.totalTokens * tokenData.pricePerToken)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Platform Equity, Deadline, Dividend Yield */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div>
                  <label className="block text-gray-300 mb-2 font-medium">
                    Platform Equity (%) *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={tokenData.platformEquityPercent}
                      onChange={(e) =>
                        setTokenData({
                          ...tokenData,
                          platformEquityPercent: Math.min(50, Math.max(0, Number(e.target.value))),
                        })
                      }
                      min={0}
                      max={50}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">%</span>
                  </div>
                  <p className="text-amber-400 text-sm mt-2">
                    Platform keeps {tokenData.platformEquityPercent}% ({Math.floor((tokenData.totalTokens * tokenData.platformEquityPercent) / 100).toLocaleString()} tokens) without investing
                  </p>
                </div>

                <div>
                  <label className="block text-gray-300 mb-2 font-medium">
                    Funding Deadline (Days) *
                  </label>
                  <select
                    value={tokenData.fundingDeadlineDays}
                    onChange={(e) =>
                      setTokenData({
                        ...tokenData,
                        fundingDeadlineDays: Number(e.target.value),
                      })
                    }
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  >
                    <option value={7} className="bg-gray-800">7 days</option>
                    <option value={14} className="bg-gray-800">14 days</option>
                    <option value={30} className="bg-gray-800">30 days</option>
                    <option value={60} className="bg-gray-800">60 days</option>
                    <option value={90} className="bg-gray-800">90 days</option>
                  </select>
                  <p className="text-gray-400 text-sm mt-2">
                    Investors can claim refund if goal not met by deadline
                  </p>
                </div>

                <div>
                  <label className="block text-gray-300 mb-2 font-medium">
                    Estimated Dividend Yield (% p.a.) *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={tokenData.estimatedDividendYield}
                      onChange={(e) =>
                        setTokenData({
                          ...tokenData,
                          estimatedDividendYield: Math.min(30, Math.max(0, Number(e.target.value))),
                        })
                      }
                      min={0}
                      max={30}
                      step={0.1}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">%</span>
                  </div>
                  <p className="text-emerald-400 text-sm mt-2">
                    Estimated annual payout to token holders
                  </p>
                </div>
              </div>

              {/* Token Distribution Preview */}
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-8">
                <h3 className="text-amber-300 font-medium mb-3 flex items-center gap-2">
                  <span>📊</span> Token Distribution
                </h3>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="p-3 bg-white/5 rounded-lg">
                    <p className="text-gray-400 text-xs">Platform Tokens</p>
                    <p className="text-amber-400 font-bold text-lg">
                      {Math.floor((tokenData.totalTokens * tokenData.platformEquityPercent) / 100).toLocaleString()}
                    </p>
                    <p className="text-gray-500 text-xs">{tokenData.platformEquityPercent}%</p>
                  </div>
                  <div className="p-3 bg-white/5 rounded-lg">
                    <p className="text-gray-400 text-xs">Available for Investors</p>
                    <p className="text-emerald-400 font-bold text-lg">
                      {(tokenData.totalTokens - Math.floor((tokenData.totalTokens * tokenData.platformEquityPercent) / 100)).toLocaleString()}
                    </p>
                    <p className="text-gray-500 text-xs">{100 - tokenData.platformEquityPercent}%</p>
                  </div>
                  <div className="p-3 bg-white/5 rounded-lg">
                    <p className="text-gray-400 text-xs">Total Tokens</p>
                    <p className="text-white font-bold text-lg">
                      {tokenData.totalTokens.toLocaleString()}
                    </p>
                    <p className="text-gray-500 text-xs">100%</p>
                  </div>
                </div>
              </div>

              {/* Token Preview */}
              <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-2xl p-6 mb-8">
                <h3 className="text-white font-bold mb-4">Token Preview</h3>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-cyan-400 rounded-xl flex items-center justify-center text-2xl font-bold text-white shadow-lg">
                    🏠
                  </div>
                  <div>
                    <p className="text-white font-bold">{propertyData.name} Token</p>
                    <p className="text-gray-400 text-sm">
                      {tokenData.totalTokens.toLocaleString()} total tokens @ {formatPKR(tokenData.pricePerToken)}{" "}
                      each
                    </p>
                    <p className="text-amber-400 text-xs mt-1">
                      {tokenData.platformEquityPercent}% platform equity • {tokenData.fundingDeadlineDays} day funding period
                    </p>
                    <p className="text-emerald-400 text-xs mt-1">
                      Estimated dividend yield: {tokenData.estimatedDividendYield}% per year
                    </p>
                    <p className="text-purple-400 text-xs mt-1">
                      Will be created on Solana {SOLANA_NETWORK}
                    </p>
                  </div>
                </div>
              </div>

              {/* Navigation */}
              <div className="flex justify-between mt-8">
                <button
                  onClick={() => setCurrentStep("details")}
                  className="px-8 py-3 bg-white/5 border border-white/10 text-white font-bold rounded-xl hover:bg-white/10 transition-all"
                >
                  ← Back
                </button>
                <button
                  onClick={() => setCurrentStep("confirm")}
                  disabled={!isTokenValid()}
                  className="px-8 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-purple-500/25 transition-all"
                >
                  Review & Confirm →
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 3: Confirmation */}
          {currentStep === "confirm" && (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8"
            >
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                <span className="w-10 h-10 bg-cyan-500/20 rounded-xl flex items-center justify-center text-xl">
                  ✅
                </span>
                Confirm & Tokenize
              </h2>

              {/* Summary Card */}
              <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-white/10 rounded-2xl p-6 mb-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-gray-400 text-sm mb-4 uppercase tracking-wider">Property Details</h3>
                    <div className="space-y-3">
                      <div>
                        <p className="text-gray-400 text-xs">Name</p>
                        <p className="text-white font-medium">{propertyData.name}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-xs">Location</p>
                        <p className="text-white font-medium">
                          {propertyData.location}, {propertyData.city}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-xs">Type</p>
                        <p className="text-white font-medium capitalize">{propertyData.propertyType}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-xs">Size</p>
                        <p className="text-white font-medium">{propertyData.size.toLocaleString()} sq ft</p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-gray-400 text-sm mb-4 uppercase tracking-wider">
                      Token Configuration
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <p className="text-gray-400 text-xs">Property Value</p>
                        <p className="text-emerald-400 font-bold text-xl">
                          {formatPKR(propertyData.propertyValue)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-xs">Total Tokens</p>
                        <p className="text-white font-medium">{tokenData.totalTokens.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-xs">Price per Token</p>
                        <p className="text-purple-400 font-medium">{formatPKR(tokenData.pricePerToken)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-xs">Network</p>
                        <p className="text-cyan-400 font-medium">Solana {SOLANA_NETWORK}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-xs">Est. Dividend Yield</p>
                        <p className="text-emerald-400 font-medium">{tokenData.estimatedDividendYield}% p.a.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Uploaded Files Preview */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8">
                <h3 className="text-gray-400 text-sm mb-4 uppercase tracking-wider">Uploaded Files</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-gray-400 text-xs mb-2">Photos ({propertyData.photos.length})</p>
                    <div className="flex gap-2 flex-wrap">
                      {propertyData.photos.slice(0, 4).map((url, i) => (
                        <img
                          key={i}
                          src={url}
                          alt={`Photo ${i + 1}`}
                          className="w-16 h-16 object-cover rounded-lg"
                        />
                      ))}
                      {propertyData.photos.length > 4 && (
                        <div className="w-16 h-16 bg-white/10 rounded-lg flex items-center justify-center text-gray-400 text-sm">
                          +{propertyData.photos.length - 4}
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs mb-2">Certificates ({propertyData.certificates.length})</p>
                    <div className="flex gap-2 flex-wrap">
                      {propertyData.certificates.map((url, i) => (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-16 h-16 bg-emerald-500/10 rounded-lg flex flex-col items-center justify-center text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                        >
                          <span className="text-xl">📄</span>
                          <span className="text-xs">Doc {i + 1}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Warning */}
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-8">
                <div className="flex items-start gap-3">
                  <span className="text-xl">⚠️</span>
                  <div>
                    <p className="text-amber-300 font-medium">Before you proceed</p>
                    <ul className="text-amber-200/80 text-sm mt-2 space-y-1 list-disc list-inside">
                      <li>
                        This creates a new SPL Token on Solana {SOLANA_NETWORK} and an on-chain
                        crowdfunding campaign for it.
                      </li>
                      <li>
                        Tokens are <strong>not</strong> minted up front — they are minted to
                        investors when they claim, after you complete the campaign.
                      </li>
                      <li>
                        You can complete the campaign at any time from your dashboard once it has
                        received at least one investment.
                      </li>
                      <li>
                        You&apos;ll sign 4 transactions: create mint, init dividend pool, create
                        campaign, transfer mint authority to the campaign PDA.
                      </li>
                      <li>This is devnet — no real money involved.</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Navigation */}
              <div className="flex justify-between mt-8">
                <button
                  onClick={() => setCurrentStep("tokenization")}
                  className="px-8 py-3 bg-white/5 border border-white/10 text-white font-bold rounded-xl hover:bg-white/10 transition-all"
                >
                  ← Back
                </button>
                <button
                  onClick={isAuthorized ? handleTokenize : handleSubmitRequest}
                  disabled={
                    !connected || (isAuthorized && solBalance < 0.01)
                  }
                  title={
                    !connected
                      ? "Connect your wallet first"
                      : isAuthorized && solBalance < 0.01
                      ? "Insufficient SOL balance to tokenize"
                      : isAuthorized
                      ? "Tokenize this property"
                      : "Submit this property for admin approval"
                  }
                  className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-emerald-500/25 transition-all flex items-center gap-2"
                >
                  <span>{isAuthorized ? "🚀" : "📨"}</span>
                  {isAuthorized ? "Tokenize Property" : "Submit for Approval"}
                </button>
              </div>
            </motion.div>
          )}

          {/* Processing */}
          {currentStep === "processing" && (
            <motion.div
              key="processing"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-12 text-center"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="w-20 h-20 mx-auto mb-6 rounded-full border-4 border-emerald-500/30 border-t-emerald-500"
              />
              <h2 className="text-2xl font-bold text-white mb-4">Creating Your Property Token</h2>
              <p className="text-gray-400 mb-8">
                Please confirm each transaction in your wallet...
              </p>
              <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-400">
                <div className="flex items-center gap-2">
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                    className="w-2 h-2 bg-emerald-500 rounded-full"
                  />
                  Mint
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-gray-500 rounded-full" />
                  Dividend Pool
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-gray-500 rounded-full" />
                  Campaign
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-gray-500 rounded-full" />
                  Transfer Authority
                </div>
              </div>
            </motion.div>
          )}

          {/* Success - registration request submitted (non-admin flow) */}
          {currentStep === "success" && requestResult && !result && (
            <motion.div
              key="success-request"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8"
            >
              <div className="text-center mb-8">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", bounce: 0.5 }}
                  className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-amber-400 to-orange-400 rounded-full flex items-center justify-center text-4xl"
                >
                  📨
                </motion.div>
                <h2 className="text-3xl font-bold text-white mb-2">Submitted for Approval</h2>
                <p className="text-gray-400 max-w-xl mx-auto">
                  Your registration request has been submitted. The platform admin will review
                  your property details, photos, and certificates. Once approved, you can complete
                  the on-chain tokenization from your dashboard.
                </p>
              </div>

              <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-2xl p-6 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Request ID</p>
                    <code className="text-amber-400 font-mono text-sm break-all">
                      {requestResult.requestId}
                    </code>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Status</p>
                    <span className="inline-block px-3 py-1 bg-amber-500/20 border border-amber-500/30 rounded-full text-amber-300 text-sm font-medium">
                      Pending admin review
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-8">
                <h3 className="text-white font-medium mb-3">What happens next?</h3>
                <ol className="space-y-2 text-gray-300 text-sm list-decimal list-inside">
                  <li>The admin reviews your submission and either approves or rejects it.</li>
                  <li>
                    If approved, your dashboard will show a &ldquo;Complete Tokenization&rdquo;
                    button for this property.
                  </li>
                  <li>
                    You sign the on-chain mint transactions yourself, so you remain the owner of
                    all minted tokens.
                  </li>
                  <li>
                    Your property then becomes visible to every wallet on the marketplace.
                  </li>
                </ol>
              </div>

              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <Link
                  href="/dashboard"
                  className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 transition-all text-center"
                >
                  Go to Dashboard
                </Link>
                <Link
                  href="/properties"
                  className="px-8 py-3 bg-white/5 border border-white/10 text-white font-bold rounded-xl hover:bg-white/10 transition-all text-center"
                >
                  Browse Marketplace
                </Link>
              </div>
            </motion.div>
          )}

          {/* Success - tokenized (admin flow) */}
          {currentStep === "success" && result && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8"
            >
              <div className="text-center mb-8">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", bounce: 0.5 }}
                  className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-emerald-400 to-cyan-400 rounded-full flex items-center justify-center text-4xl"
                >
                  ✓
                </motion.div>
                <h2 className="text-3xl font-bold text-white mb-2">Property Tokenized!</h2>
                <p className="text-gray-400">
                  Your property has been successfully tokenized on Solana {SOLANA_NETWORK}
                </p>
              </div>

              {/* Token Details */}
              <div className="bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20 rounded-2xl p-6 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Token Mint Address</p>
                    <div className="flex items-center gap-2">
                      <code className="text-emerald-400 font-mono text-sm break-all">
                        {result.mintAddress}
                      </code>
                      <a
                        href={getExplorerUrl(result.mintAddress, "address")}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cyan-400 hover:text-cyan-300"
                      >
                        ↗
                      </a>
                    </div>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Crowdfunding Campaign</p>
                    <div className="flex items-center gap-2">
                      <code className="text-purple-400 font-mono text-sm break-all">
                        {result.campaign}
                      </code>
                      <a
                        href={getExplorerUrl(result.campaign, "address")}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cyan-400 hover:text-cyan-300"
                      >
                        ↗
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              {/* Transaction Links */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-8">
                <h3 className="text-white font-medium mb-3">Transaction Details</h3>
                <div className="space-y-2">
                  <a
                    href={getExplorerUrl(result.mintSignature)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
                  >
                    <span className="text-gray-400">Mint Creation TX</span>
                    <span className="text-cyan-400 font-mono text-sm">
                      {formatAddress(result.mintSignature)} ↗
                    </span>
                  </a>
                  <a
                    href={getExplorerUrl(result.campaignSignature)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
                  >
                    <span className="text-gray-400">Campaign Creation TX</span>
                    <span className="text-cyan-400 font-mono text-sm">
                      {formatAddress(result.campaignSignature)} ↗
                    </span>
                  </a>
                </div>
              </div>

              {/* Summary */}
              <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="bg-white/5 rounded-xl p-4 text-center">
                  <p className="text-gray-400 text-sm">Tokens Created</p>
                  <p className="text-white text-2xl font-bold">{tokenData.totalTokens.toLocaleString()}</p>
                </div>
                <div className="bg-white/5 rounded-xl p-4 text-center">
                  <p className="text-gray-400 text-sm">Price per Token</p>
                  <p className="text-emerald-400 text-xl font-bold">
                    {formatPKR(tokenData.pricePerToken)}
                  </p>
                </div>
                <div className="bg-white/5 rounded-xl p-4 text-center">
                  <p className="text-gray-400 text-sm">Total Value</p>
                  <p className="text-purple-400 text-xl font-bold">
                    {formatPKR(propertyData.propertyValue)}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <Link
                  href="/properties"
                  className="px-8 py-3 bg-white/5 border border-white/10 text-white font-bold rounded-xl hover:bg-white/10 transition-all text-center"
                >
                  View All Properties
                </Link>
                <Link
                  href="/dashboard"
                  className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 transition-all text-center"
                >
                  Go to Dashboard
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

