"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { MapPin, TrendingUp, Coins, Building } from "lucide-react";
import { Property } from "@/data/properties";

interface PropertyCardProps {
  property: Property;
  index?: number;
}

export const PropertyCard = ({ property, index = 0 }: PropertyCardProps) => {
  const fundingProgress = ((property.totalTokens - property.availableTokens) / property.totalTokens) * 100;

  const statusColors = {
    funding: "bg-accent/20 text-accent",
    funded: "bg-blue-500/20 text-blue-400",
    active: "bg-secondary/20 text-secondary",
  };

  const statusLabels = {
    funding: "Funding",
    funded: "Fully Funded",
    active: "Active",
  };

  const propertyTypeIcons = {
    residential: "🏠",
    commercial: "🏢",
    industrial: "🏭",
    "mixed-use": "🏗️",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      whileHover={{ y: -8 }}
      className="group"
    >
      <Link href={`/properties/${property.id}`}>
        <div className="glass-card overflow-hidden glass-card-hover">
          {/* Image Container */}
          <div className="relative h-56 overflow-hidden">
            <Image
              src={property.image}
              alt={property.name}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-110"
            />
            <div className="property-image-overlay absolute inset-0" />
            
            {/* Status Badge */}
            <div className="absolute top-4 left-4">
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[property.status]}`}>
                {statusLabels[property.status]}
              </span>
            </div>
            
            {/* Property Type */}
            <div className="absolute top-4 right-4">
              <span className="glass-card px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1">
                <span>{propertyTypeIcons[property.propertyType]}</span>
                <span className="capitalize">{property.propertyType}</span>
              </span>
            </div>

            {/* Price on hover */}
            <div className="absolute bottom-4 left-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="glass-card px-4 py-2 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground-muted">Token Price</span>
                  <span className="font-semibold text-accent">${property.tokenPrice}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-lg mb-1 group-hover:text-accent transition-colors">
                  {property.name}
                </h3>
                <div className="flex items-center text-foreground-muted text-sm">
                  <MapPin className="w-4 h-4 mr-1" />
                  <span>{property.location}</span>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-accent" />
                </div>
                <div>
                  <p className="text-xs text-foreground-muted">Annual Yield</p>
                  <p className="font-semibold text-secondary">{property.annualYield}%</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Coins className="w-4 h-4 text-accent" />
                </div>
                <div>
                  <p className="text-xs text-foreground-muted">Min. Investment</p>
                  <p className="font-semibold">${property.tokenPrice}</p>
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            {property.status === "funding" && (
              <div className="mb-4">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-foreground-muted">Funding Progress</span>
                  <span className="font-medium text-accent">{fundingProgress.toFixed(0)}%</span>
                </div>
                <div className="h-2 bg-background rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${fundingProgress}%` }}
                    transition={{ duration: 1, delay: 0.3 }}
                    className="h-full bg-gradient-to-r from-accent to-accent-light rounded-full"
                  />
                </div>
              </div>
            )}

            {/* Total Value */}
            <div className="pt-4 border-t border-glass-border flex items-center justify-between">
              <div>
                <p className="text-xs text-foreground-muted">Property Value</p>
                <p className="font-semibold text-lg">PKR {(property.priceInPKR / 1000000).toFixed(1)}M</p>
              </div>
              <div className="flex items-center gap-1 text-sm text-accent">
                <Building className="w-4 h-4" />
                <span>{property.size.toLocaleString()} sq ft</span>
              </div>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
};

