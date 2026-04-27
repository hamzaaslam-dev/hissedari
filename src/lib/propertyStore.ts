import { Property } from "@/data/properties";

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
  platformEquityPercent: number;
  fundingDeadline: string;
  campaignStatus: CampaignStatus;
  totalRaised: number;
  investorCount: number;
  campaignAddress?: string;
  certificates: string[];
  uploadedPhotos: string[];
}

// API base URL - use relative URL for client-side requests
const getApiBase = () => {
  if (typeof window !== "undefined") {
    return "/api/properties";
  }
  // For server-side, construct full URL
  const baseUrl = process.env.NEXT_PUBLIC_VERCEL_URL 
    ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
    : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${baseUrl}/api/properties`;
};

// Convert database property to RegisteredProperty format
function dbToRegisteredProperty(dbProp: Record<string, unknown>): RegisteredProperty {
  return {
    id: dbProp.id as string,
    name: dbProp.name as string,
    location: dbProp.location as string,
    city: dbProp.city as string,
    description: dbProp.description as string,
    image: dbProp.image as string,
    images: (dbProp.images as string[]) || [],
    price: dbProp.price as number,
    priceInPKR: dbProp.price_in_pkr as number,
    tokenPrice: dbProp.token_price as number,
    totalTokens: dbProp.total_tokens as number,
    availableTokens: dbProp.available_tokens as number,
    annualYield: parseFloat(dbProp.annual_yield as string) || 8.5,
    propertyType: dbProp.property_type as "residential" | "commercial" | "industrial" | "mixed-use",
    status: dbProp.status as "active" | "funding" | "funded",
    features: (dbProp.features as string[]) || [],
    size: dbProp.size as number,
    bedrooms: dbProp.bedrooms as number | undefined,
    bathrooms: dbProp.bathrooms as number | undefined,
    yearBuilt: dbProp.year_built as number,
    rentalIncome: dbProp.rental_income as number,
    occupancyRate: dbProp.occupancy_rate as number,
    mintAddress: dbProp.mint_address as string,
    tokenAccount: dbProp.token_account as string,
    ownerAddress: dbProp.owner_address as string,
    transactionSignature: dbProp.transaction_signature as string,
    platformEquityPercent: dbProp.platform_equity_percent as number,
    fundingDeadline: dbProp.funding_deadline as string,
    campaignStatus: dbProp.campaign_status as CampaignStatus,
    totalRaised: dbProp.total_raised as number,
    investorCount: dbProp.investor_count as number,
    campaignAddress: dbProp.campaign_address as string | undefined,
    certificates: (dbProp.certificates as string[]) || [],
    uploadedPhotos: (dbProp.uploaded_photos as string[]) || [],
    documents: (dbProp.documents as { name: string; url: string }[]) || [],
    timeline: (dbProp.timeline as { date: string; event: string }[]) || [],
    createdAt: dbProp.created_at as string,
  };
}

// Convert RegisteredProperty to database format
function registeredPropertyToDb(prop: RegisteredProperty): Record<string, unknown> {
  return {
    id: prop.id,
    name: prop.name,
    location: prop.location,
    city: prop.city,
    description: prop.description,
    image: prop.image,
    images: prop.images,
    price: prop.price,
    priceInPKR: prop.priceInPKR,
    tokenPrice: prop.tokenPrice,
    totalTokens: prop.totalTokens,
    availableTokens: prop.availableTokens,
    annualYield: prop.annualYield,
    propertyType: prop.propertyType,
    status: prop.status,
    features: prop.features,
    size: prop.size,
    bedrooms: prop.bedrooms,
    bathrooms: prop.bathrooms,
    yearBuilt: prop.yearBuilt,
    rentalIncome: prop.rentalIncome,
    occupancyRate: prop.occupancyRate,
    mintAddress: prop.mintAddress,
    tokenAccount: prop.tokenAccount,
    ownerAddress: prop.ownerAddress,
    transactionSignature: prop.transactionSignature,
    platformEquityPercent: prop.platformEquityPercent,
    fundingDeadline: prop.fundingDeadline,
    campaignStatus: prop.campaignStatus,
    totalRaised: prop.totalRaised,
    investorCount: prop.investorCount,
    campaignAddress: prop.campaignAddress,
    certificates: prop.certificates,
    uploadedPhotos: prop.uploadedPhotos,
    documents: prop.documents,
    timeline: prop.timeline,
  };
}

// Get all registered properties from database
export async function getRegisteredPropertiesAsync(): Promise<RegisteredProperty[]> {
  try {
    const apiUrl = getApiBase();
    const response = await fetch(apiUrl, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Failed to fetch properties: ${response.status}`);
    }
    const data = await response.json();
    return (data.properties || []).map(dbToRegisteredProperty);
  } catch (error) {
    console.error("Error fetching properties from database:", error);
    return [];
  }
}

// Synchronous version that returns empty array (for backward compatibility during transition)
// Use getRegisteredPropertiesAsync() for actual data fetching
export function getRegisteredProperties(): RegisteredProperty[] {
  console.warn("getRegisteredProperties() is deprecated. Use getRegisteredPropertiesAsync() instead.");
  return [];
}

// Save a new registered property to database
export async function saveRegisteredPropertyAsync(property: RegisteredProperty): Promise<boolean> {
  try {
    const apiUrl = getApiBase();
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(registeredPropertyToDb(property)),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to save property: ${response.status}`);
    }
    
    return true;
  } catch (error) {
    console.error("Error saving property to database:", error);
    return false;
  }
}

// Legacy sync version - does nothing now, use saveRegisteredPropertyAsync
export function saveRegisteredProperty(property: RegisteredProperty): void {
  console.warn("saveRegisteredProperty() is deprecated. Use saveRegisteredPropertyAsync() instead.");
  saveRegisteredPropertyAsync(property);
}

// Get a property by ID
export async function getRegisteredPropertyByIdAsync(id: string): Promise<RegisteredProperty | undefined> {
  try {
    const apiUrl = getApiBase();
    const response = await fetch(`${apiUrl}?id=${encodeURIComponent(id)}`, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Failed to fetch property: ${response.status}`);
    }
    const data = await response.json();
    const properties = (data.properties || []).map(dbToRegisteredProperty);
    return properties[0];
  } catch (error) {
    console.error("Error fetching property by ID:", error);
    return undefined;
  }
}

// Legacy sync version
export function getRegisteredPropertyById(id: string): RegisteredProperty | undefined {
  console.warn("getRegisteredPropertyById() is deprecated. Use getRegisteredPropertyByIdAsync() instead.");
  return undefined;
}

// Get property by mint address
export async function getPropertyByMintAddress(mintAddress: string): Promise<RegisteredProperty | undefined> {
  try {
    const apiUrl = getApiBase();
    const response = await fetch(`${apiUrl}?mint=${encodeURIComponent(mintAddress)}`, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Failed to fetch property: ${response.status}`);
    }
    const data = await response.json();
    const properties = (data.properties || []).map(dbToRegisteredProperty);
    return properties[0];
  } catch (error) {
    console.error("Error fetching property by mint:", error);
    return undefined;
  }
}

// Get properties by owner address
export async function getPropertiesByOwnerAsync(ownerAddress: string): Promise<RegisteredProperty[]> {
  try {
    const apiUrl = getApiBase();
    const response = await fetch(`${apiUrl}?owner=${encodeURIComponent(ownerAddress)}`, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Failed to fetch properties: ${response.status}`);
    }
    const data = await response.json();
    return (data.properties || []).map(dbToRegisteredProperty);
  } catch (error) {
    console.error("Error fetching properties by owner:", error);
    return [];
  }
}

// Legacy sync version
export function getPropertiesByOwner(ownerAddress: string): RegisteredProperty[] {
  console.warn("getPropertiesByOwner() is deprecated. Use getPropertiesByOwnerAsync() instead.");
  return [];
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
  const priceUSD = Math.round(formData.propertyValue / 278);
  const platformEquityPercent = tokenData.platformEquityPercent ?? 5;
  const fundingDeadlineDays = tokenData.fundingDeadlineDays ?? 30;
  
  const platformTokens = Math.floor((tokenData.totalTokens * platformEquityPercent) / 100);
  const availableTokens = tokenData.totalTokens - platformTokens;
  
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + fundingDeadlineDays);
  
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
    tokenPrice: Math.round(tokenData.pricePerToken / 278),
    totalTokens: tokenData.totalTokens,
    availableTokens: availableTokens,
    annualYield: 8.5,
    propertyType: formData.propertyType,
    status: "funding",
    features: formData.features,
    size: formData.size,
    bedrooms: formData.bedrooms,
    bathrooms: formData.bathrooms,
    yearBuilt: formData.yearBuilt,
    rentalIncome: Math.round(priceUSD * 0.005),
    occupancyRate: 90,
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
export async function updatePropertyCampaignStatusAsync(
  propertyId: string,
  status: CampaignStatus,
  totalRaised?: number,
  investorCount?: number
): Promise<boolean> {
  try {
    const apiUrl = getApiBase();
    const updates: Record<string, unknown> = {
      id: propertyId,
      campaignStatus: status,
    };
    
    if (totalRaised !== undefined) {
      updates.totalRaised = totalRaised;
    }
    if (investorCount !== undefined) {
      updates.investorCount = investorCount;
    }
    if (status === "funded") {
      updates.status = "active";
    }
    
    const response = await fetch(apiUrl, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updates),
    });
    
    return response.ok;
  } catch (error) {
    console.error("Error updating campaign status:", error);
    return false;
  }
}

// Legacy sync version
export function updatePropertyCampaignStatus(
  propertyId: string,
  status: CampaignStatus,
  totalRaised?: number,
  investorCount?: number
): void {
  console.warn("updatePropertyCampaignStatus() is deprecated. Use updatePropertyCampaignStatusAsync() instead.");
  updatePropertyCampaignStatusAsync(propertyId, status, totalRaised, investorCount);
}
