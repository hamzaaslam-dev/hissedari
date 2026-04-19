export interface Property {
  id: string;
  name: string;
  location: string;
  city: string;
  description: string;
  image: string;
  images: string[];
  price: number;
  priceInPKR: number;
  tokenPrice: number;
  totalTokens: number;
  availableTokens: number;
  annualYield: number;
  propertyType: "residential" | "commercial" | "industrial" | "mixed-use";
  status: "funding" | "funded" | "active";
  features: string[];
  size: number;
  bedrooms?: number;
  bathrooms?: number;
  yearBuilt: number;
  rentalIncome: number;
  occupancyRate: number;
  documents: { name: string; url: string }[];
  timeline: { date: string; event: string }[];
}

export const properties: Property[] = [];

export const getPropertyById = (id: string): Property | undefined => {
  return properties.find((p) => p.id === id);
};

export const getPropertiesByStatus = (status: Property["status"]): Property[] => {
  return properties.filter((p) => p.status === status);
};

export const getPropertiesByType = (type: Property["propertyType"]): Property[] => {
  return properties.filter((p) => p.propertyType === type);
};

export const getPropertiesByCity = (city: string): Property[] => {
  return properties.filter((p) => p.city === city);
};
