"use client";

import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { Search, SlidersHorizontal, X, MapPin, Building2, TrendingUp } from "lucide-react";
import { PropertyCard } from "@/components/PropertyCard";
import { properties as defaultProperties, Property } from "@/data/properties";
import { getRegisteredProperties, RegisteredProperty } from "@/lib/propertyStore";

type PropertyType = Property["propertyType"] | "all";
type PropertyStatus = Property["status"] | "all";
type SortOption = "price-asc" | "price-desc" | "yield-desc" | "newest";

export default function PropertiesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [propertyType, setPropertyType] = useState<PropertyType>("all");
  const [status, setStatus] = useState<PropertyStatus>("all");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [showFilters, setShowFilters] = useState(false);
  const [userProperties, setUserProperties] = useState<RegisteredProperty[]>([]);

  // Load user-registered properties from localStorage
  useEffect(() => {
    setUserProperties(getRegisteredProperties());
  }, []);

  // Combine default and user properties
  const allProperties: Property[] = useMemo(() => {
    return [...userProperties, ...defaultProperties];
  }, [userProperties]);

  const filteredProperties = useMemo(() => {
    let result = [...allProperties];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.location.toLowerCase().includes(query) ||
          p.city.toLowerCase().includes(query)
      );
    }

    // Type filter
    if (propertyType !== "all") {
      result = result.filter((p) => p.propertyType === propertyType);
    }

    // Status filter
    if (status !== "all") {
      result = result.filter((p) => p.status === status);
    }

    // Sort
    switch (sortBy) {
      case "price-asc":
        result.sort((a, b) => a.tokenPrice - b.tokenPrice);
        break;
      case "price-desc":
        result.sort((a, b) => b.tokenPrice - a.tokenPrice);
        break;
      case "yield-desc":
        result.sort((a, b) => b.annualYield - a.annualYield);
        break;
      case "newest":
      default:
        // Keep original order (newest first)
        break;
    }

    return result;
  }, [searchQuery, propertyType, status, sortBy, allProperties]);

  const clearFilters = () => {
    setSearchQuery("");
    setPropertyType("all");
    setStatus("all");
    setSortBy("newest");
  };

  const hasActiveFilters = searchQuery || propertyType !== "all" || status !== "all" || sortBy !== "newest";

  return (
    <div className="min-h-screen pt-28 pb-20">
      {/* Background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-background" />
        <div className="absolute inset-0 grid-pattern opacity-30" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-accent/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-secondary/5 rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-bold mb-4" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            Explore <span className="text-gradient-gold">Properties</span>
          </h1>
          <p className="text-foreground-muted text-lg max-w-2xl">
            Discover premium real estate investment opportunities from around the world.
            Filter by type, status, and more to find your perfect investment.
          </p>
        </motion.div>

        {/* Search and Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-4 mb-8"
        >
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground-muted" />
              <input
                type="text"
                placeholder="Search by name, location, or city..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-glass w-full pl-12 pr-4"
              />
            </div>

            {/* Filter Toggle (Mobile) */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="lg:hidden btn-secondary flex items-center justify-center gap-2"
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filters
            </button>

            {/* Desktop Filters */}
            <div className="hidden lg:flex items-center gap-4">
              {/* Property Type */}
              <select
                value={propertyType}
                onChange={(e) => setPropertyType(e.target.value as PropertyType)}
                className="input-glass pr-10 cursor-pointer"
              >
                <option value="all">All Types</option>
                <option value="residential">Residential</option>
                <option value="commercial">Commercial</option>
                <option value="industrial">Industrial</option>
                <option value="mixed-use">Mixed Use</option>
              </select>

              {/* Status */}
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as PropertyStatus)}
                className="input-glass pr-10 cursor-pointer"
              >
                <option value="all">All Status</option>
                <option value="funding">Funding</option>
                <option value="funded">Fully Funded</option>
                <option value="active">Active</option>
              </select>

              {/* Sort */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="input-glass pr-10 cursor-pointer"
              >
                <option value="newest">Newest First</option>
                <option value="yield-desc">Highest Yield</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
              </select>

              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1 text-sm text-foreground-muted hover:text-accent transition-colors"
                >
                  <X className="w-4 h-4" />
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Mobile Filters */}
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="lg:hidden mt-4 pt-4 border-t border-glass-border grid grid-cols-1 sm:grid-cols-3 gap-4"
            >
              <select
                value={propertyType}
                onChange={(e) => setPropertyType(e.target.value as PropertyType)}
                className="input-glass cursor-pointer"
              >
                <option value="all">All Types</option>
                <option value="residential">Residential</option>
                <option value="commercial">Commercial</option>
                <option value="industrial">Industrial</option>
                <option value="mixed-use">Mixed Use</option>
              </select>

              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as PropertyStatus)}
                className="input-glass cursor-pointer"
              >
                <option value="all">All Status</option>
                <option value="funding">Funding</option>
                <option value="funded">Fully Funded</option>
                <option value="active">Active</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="input-glass cursor-pointer"
              >
                <option value="newest">Newest First</option>
                <option value="yield-desc">Highest Yield</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
              </select>

              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="sm:col-span-3 btn-secondary flex items-center justify-center gap-2"
                >
                  <X className="w-4 h-4" />
                  Clear All Filters
                </button>
              )}
            </motion.div>
          )}
        </motion.div>

        {/* Results Count */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex items-center justify-between mb-6"
        >
          <p className="text-foreground-muted">
            Showing <span className="text-foreground font-medium">{filteredProperties.length}</span> properties
          </p>
          <div className="flex items-center gap-4 text-sm text-foreground-muted">
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-accent" />
              Funding
            </span>
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-secondary" />
              Active
            </span>
          </div>
        </motion.div>

        {/* Properties Grid */}
        {filteredProperties.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredProperties.map((property, index) => (
              <PropertyCard key={property.id} property={property} index={index} />
            ))}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass-card p-12 text-center"
          >
            <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-8 h-8 text-accent" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No Properties Found</h3>
            <p className="text-foreground-muted mb-6">
              Try adjusting your filters or search query to find what you&apos;re looking for.
            </p>
            <button onClick={clearFilters} className="btn-primary">
              Clear All Filters
            </button>
          </motion.div>
        )}

        {/* Stats Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-16 glass-card p-8"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 text-foreground-muted mb-2">
                <Building2 className="w-4 h-4" />
                <span className="text-sm">Total Properties</span>
              </div>
              <p className="text-2xl font-bold text-gradient-gold">{allProperties.length}</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 text-foreground-muted mb-2">
                <MapPin className="w-4 h-4" />
                <span className="text-sm">Cities</span>
              </div>
              <p className="text-2xl font-bold text-gradient-gold">
                {new Set(allProperties.map((p) => p.city)).size}
              </p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 text-foreground-muted mb-2">
                <TrendingUp className="w-4 h-4" />
                <span className="text-sm">Avg. Yield</span>
              </div>
              <p className="text-2xl font-bold text-secondary">
                {allProperties.length > 0 ? (allProperties.reduce((acc, p) => acc + p.annualYield, 0) / allProperties.length).toFixed(1) : 0}%
              </p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 text-foreground-muted mb-2">
                <span className="text-sm">💰</span>
                <span className="text-sm">Total Value</span>
              </div>
              <p className="text-2xl font-bold text-gradient-gold">
                PKR {(allProperties.reduce((acc, p) => acc + p.priceInPKR, 0) / 1000000000).toFixed(2)}B
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

