import { Property } from "@/data/properties";

const STORAGE_KEY = "hissedari_registered_properties";

export type CampaignStatus = "active" | "funded" | "cancelled";

export interface RegisteredProperty extends Omit<Property, "id" | "image" | "images" | "rentalIncome" | "occupancyRate" | "documents" | "timeline"> {
  id: string;
  image: string;
  images: string[];
  mintAddress: string;
  tokenAccount: string;
  ownerAddress: string;
  createdAt: string;
  transactionSignature: string;
  rentalIncome: number;
  occupancyRate: number;
  documents: { name: string; url: string }[];
  timeline: { date: string; event: string }[];
  // Crowdfunding fields
  platformEquityPercent: number;
  fundingDeadline: string;
  campaignStatus: CampaignStatus;
  totalRaised: number;
  investorCount: number;
  campaignAddress?: string;
  // Uploaded files
  certificates: string[];
  uploadedPhotos: string[];
}

// Get all registered properties from localStorage
export function getRegisteredProperties(): RegisteredProperty[] {
  if (typeof window === "undefined") return [];
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

// Save a new registered property
export function saveRegisteredProperty(property: RegisteredProperty): void {
  if (typeof window === "undefined") return;
  
  const existing = getRegisteredProperties();
  existing.push(property);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
}

// Get a property by ID
export function getRegisteredPropertyById(id: string): RegisteredProperty | undefined {
  const properties = getRegisteredProperties();
  return properties.find((p) => p.id === id);
}

// Get properties by owner address
export function getPropertiesByOwner(ownerAddress: string): RegisteredProperty[] {
  const properties = getRegisteredProperties();
  return properties.filter((p) => p.ownerAddress === ownerAddress);
}

// Generate a unique ID
export function generatePropertyId(): string {
  return `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Default property images (placeholders)
export const defaultPropertyImages = [
  "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80",
  "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=80",
  "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80",
];

// Create a Property object from registration data
export function createPropertyFromRegistration(
  formData: {
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
    propertyValue: number;
    photos?: string[];
    certificates?: string[];
  },
  tokenData: {
    totalTokens: number;
    pricePerToken: number;
    platformEquityPercent?: number;
    fundingDeadlineDays?: number;
  },
  blockchainData: {
    mintAddress: string;
    tokenAccount: string;
    ownerAddress: string;
    transactionSignature: string;
    campaignAddress?: string;
  }
): RegisteredProperty {
  const id = generatePropertyId();
  const priceUSD = Math.round(formData.propertyValue / 278); // PKR to USD
  const platformEquityPercent = tokenData.platformEquityPercent ?? 5; // Default 5%
  const fundingDeadlineDays = tokenData.fundingDeadlineDays ?? 30; // Default 30 days
  
  // Calculate available tokens after platform equity
  const platformTokens = Math.floor((tokenData.totalTokens * platformEquityPercent) / 100);
  const availableTokens = tokenData.totalTokens - platformTokens;
  
  // Calculate funding deadline
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + fundingDeadlineDays);
  
  // Use uploaded photos or fallback to defaults
  const photos = formData.photos && formData.photos.length > 0 ? formData.photos : defaultPropertyImages;
  const certificates = formData.certificates || [];
  
  return {
    id,
    name: formData.name,
    location: `${formData.location}, ${formData.city}`,
    city: formData.city,
    description: formData.description || `Tokenized property in ${formData.city}`,
    image: photos[0],
    images: photos,
    price: priceUSD,
    priceInPKR: formData.propertyValue,
    tokenPrice: Math.round(tokenData.pricePerToken / 278), // PKR to USD
    totalTokens: tokenData.totalTokens,
    availableTokens: availableTokens,
    annualYield: 8.5, // Default yield estimate
    propertyType: formData.propertyType,
    status: "funding",
    features: formData.features,
    size: formData.size,
    bedrooms: formData.bedrooms,
    bathrooms: formData.bathrooms,
    yearBuilt: formData.yearBuilt,
    rentalIncome: Math.round(priceUSD * 0.005), // Estimate ~0.5% monthly
    occupancyRate: 90, // Default estimate
    documents: [
      ...certificates.map((cert, i) => ({
        name: `Certificate ${i + 1}`,
        url: cert,
      })),
      { name: "Token Details", url: `https://explorer.solana.com/address/${blockchainData.mintAddress}?cluster=devnet` },
    ],
    timeline: [
      { date: new Date().toISOString().split("T")[0], event: "Property Tokenized" },
      { date: new Date().toISOString().split("T")[0], event: "Token Sale Started" },
    ],
    mintAddress: blockchainData.mintAddress,
    tokenAccount: blockchainData.tokenAccount,
    ownerAddress: blockchainData.ownerAddress,
    createdAt: new Date().toISOString(),
    transactionSignature: blockchainData.transactionSignature,
    // Crowdfunding fields
    platformEquityPercent,
    fundingDeadline: deadline.toISOString(),
    campaignStatus: "active",
    totalRaised: 0,
    investorCount: 0,
    campaignAddress: blockchainData.campaignAddress,
    certificates,
    uploadedPhotos: photos,
  };
}

// Update campaign status
export function updatePropertyCampaignStatus(
  propertyId: string,
  status: CampaignStatus,
  totalRaised?: number,
  investorCount?: number
): void {
  if (typeof window === "undefined") return;
  
  const properties = getRegisteredProperties();
  const index = properties.findIndex((p) => p.id === propertyId);
  
  if (index !== -1) {
    properties[index].campaignStatus = status;
    if (totalRaised !== undefined) {
      properties[index].totalRaised = totalRaised;
    }
    if (investorCount !== undefined) {
      properties[index].investorCount = investorCount;
    }
    if (status === "funded") {
      properties[index].status = "active";
    } else if (status === "cancelled") {
      properties[index].status = "funding"; // Keep as funding but marked cancelled
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(properties));
  }
}

