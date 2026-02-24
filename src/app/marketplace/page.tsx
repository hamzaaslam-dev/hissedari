"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  Listing,
  fetchAllListings,
  fetchMarketplaceStats,
  buyTokens,
  cancelListing,
  MarketplaceStats,
  lamportsToSol,
  solToLamports,
} from "@/lib/marketplaceClient";
import { getRegisteredProperties, RegisteredProperty } from "@/lib/propertyStore";

export default function MarketplacePage() {
  const { publicKey, signTransaction, connected } = useWallet();
  const [listings, setListings] = useState<Listing[]>([]);
  const [properties, setProperties] = useState<Record<string, RegisteredProperty>>({});
  const [stats, setStats] = useState<MarketplaceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [buyAmount, setBuyAmount] = useState<Record<string, number>>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [listingsData, statsData] = await Promise.all([
        fetchAllListings(),
        fetchMarketplaceStats(),
      ]);
      setListings(listingsData);
      setStats(statsData);

      // Load property info from local storage
      const props = getRegisteredProperties();
      const propsMap: Record<string, RegisteredProperty> = {};
      props.forEach((p) => {
        if (p.mintAddress) {
          propsMap[p.mintAddress] = p;
        }
      });
      setProperties(propsMap);
    } catch (error) {
      console.error("Error loading marketplace data:", error);
    }
    setLoading(false);
  };

  const handleBuy = async (listing: Listing) => {
    if (!publicKey || !signTransaction) return;

    const amount = buyAmount[listing.address.toString()] || 1;
    if (amount <= 0 || amount > listing.amount) {
      alert("Invalid amount");
      return;
    }

    setPurchasing(listing.address.toString());
    try {
      const platformWallet = stats?.authority || publicKey;
      const signature = await buyTokens(
        { publicKey, signTransaction },
        listing.seller,
        listing.tokenMint,
        platformWallet,
        amount
      );
      alert(`Purchase successful! Signature: ${signature.slice(0, 20)}...`);
      loadData();
    } catch (error: any) {
      console.error("Purchase error:", error);
      alert(`Purchase failed: ${error.message}`);
    }
    setPurchasing(null);
  };

  const handleCancel = async (listing: Listing) => {
    if (!publicKey || !signTransaction) return;

    if (!confirm("Are you sure you want to cancel this listing?")) return;

    setPurchasing(listing.address.toString());
    try {
      const signature = await cancelListing(
        { publicKey, signTransaction },
        listing.tokenMint
      );
      alert(`Listing cancelled! Signature: ${signature.slice(0, 20)}...`);
      loadData();
    } catch (error: any) {
      console.error("Cancel error:", error);
      alert(`Cancel failed: ${error.message}`);
    }
    setPurchasing(null);
  };

  const getPropertyInfo = (mintAddress: string) => {
    return properties[mintAddress];
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Token Marketplace
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto mb-6">
            Buy and sell property tokens on the secondary market
          </p>
          {connected && (
            <a
              href="/sell"
              className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-medium px-6 py-3 rounded-lg transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Sell Your Tokens
            </a>
          )}
        </motion.div>

        {/* Stats */}
        {stats && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12"
          >
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
              <p className="text-gray-400 text-sm">Total Volume</p>
              <p className="text-2xl font-bold text-white">
                {lamportsToSol(stats.totalVolume).toFixed(2)} SOL
              </p>
            </div>
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
              <p className="text-gray-400 text-sm">Active Listings</p>
              <p className="text-2xl font-bold text-white">{listings.length}</p>
            </div>
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
              <p className="text-gray-400 text-sm">Platform Fee</p>
              <p className="text-2xl font-bold text-white">{stats.feePercent}%</p>
            </div>
          </motion.div>
        )}

        {/* Connection Warning */}
        {!connected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-yellow-500/10 border border-yellow-500/50 rounded-xl p-6 mb-8 text-center"
          >
            <p className="text-yellow-400">
              Connect your wallet to buy tokens or view your listings
            </p>
          </motion.div>
        )}

        {/* Listings */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
          </div>
        ) : listings.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <div className="text-6xl mb-4">🏪</div>
            <h3 className="text-2xl font-bold text-white mb-2">No Active Listings</h3>
            <p className="text-gray-400">
              Be the first to list your property tokens for sale!
            </p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {listings.map((listing, index) => {
              const property = getPropertyInfo(listing.tokenMint.toString());
              const isOwner = publicKey?.equals(listing.seller);
              const totalCost = lamportsToSol(listing.pricePerToken) * (buyAmount[listing.address.toString()] || 1);

              return (
                <motion.div
                  key={listing.address.toString()}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-gray-800/50 backdrop-blur-sm rounded-xl overflow-hidden border border-gray-700 hover:border-emerald-500/50 transition-all duration-300"
                >
                  {/* Property Image */}
                  <div className="relative h-48 bg-gradient-to-br from-emerald-500/20 to-blue-500/20">
                    {property?.image ? (
                      <img
                        src={property.image}
                        alt={property.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-6xl">🏠</span>
                      </div>
                    )}
                    <div className="absolute top-3 right-3 bg-emerald-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                      For Sale
                    </div>
                  </div>

                  {/* Details */}
                  <div className="p-6">
                    <h3 className="text-xl font-bold text-white mb-2">
                      {property?.name || "Property Token"}
                    </h3>
                    <p className="text-gray-400 text-sm mb-4 truncate">
                      Mint: {listing.tokenMint.toString().slice(0, 20)}...
                    </p>

                    <div className="space-y-3 mb-6">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Available</span>
                        <span className="text-white font-medium">
                          {listing.amount.toLocaleString()} tokens
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Price per Token</span>
                        <span className="text-emerald-400 font-medium">
                          {lamportsToSol(listing.pricePerToken).toFixed(4)} SOL
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Seller</span>
                        <span className="text-white font-medium">
                          {listing.seller.toString().slice(0, 8)}...
                          {isOwner && <span className="text-emerald-400 ml-1">(You)</span>}
                        </span>
                      </div>
                    </div>

                    {/* Buy Controls */}
                    {connected && !isOwner && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            max={listing.amount}
                            value={buyAmount[listing.address.toString()] || 1}
                            onChange={(e) =>
                              setBuyAmount({
                                ...buyAmount,
                                [listing.address.toString()]: parseInt(e.target.value) || 1,
                              })
                            }
                            className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                            placeholder="Amount"
                          />
                          <span className="text-gray-400">tokens</span>
                        </div>
                        <div className="text-center text-sm text-gray-400">
                          Total: <span className="text-emerald-400 font-medium">{totalCost.toFixed(4)} SOL</span>
                        </div>
                        <button
                          onClick={() => handleBuy(listing)}
                          disabled={purchasing === listing.address.toString()}
                          className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-600 text-white font-medium py-3 rounded-lg transition-colors"
                        >
                          {purchasing === listing.address.toString() ? (
                            <span className="flex items-center justify-center gap-2">
                              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white"></div>
                              Processing...
                            </span>
                          ) : (
                            "Buy Tokens"
                          )}
                        </button>
                      </div>
                    )}

                    {/* Owner Controls */}
                    {connected && isOwner && (
                      <button
                        onClick={() => handleCancel(listing)}
                        disabled={purchasing === listing.address.toString()}
                        className="w-full bg-red-500 hover:bg-red-600 disabled:bg-gray-600 text-white font-medium py-3 rounded-lg transition-colors"
                      >
                        {purchasing === listing.address.toString() ? (
                          <span className="flex items-center justify-center gap-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white"></div>
                            Cancelling...
                          </span>
                        ) : (
                          "Cancel Listing"
                        )}
                      </button>
                    )}

                    {!connected && (
                      <button
                        disabled
                        className="w-full bg-gray-600 text-gray-400 font-medium py-3 rounded-lg cursor-not-allowed"
                      >
                        Connect Wallet to Buy
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
