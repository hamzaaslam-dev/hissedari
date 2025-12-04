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

export const properties: Property[] = [
  {
    id: "1",
    name: "Emaar Oceanfront Apartments",
    location: "DHA Phase 8, Karachi",
    city: "Karachi",
    description: "Luxury beachfront apartments in the prestigious DHA Phase 8, offering breathtaking views of the Arabian Sea. This premium development features modern architecture, world-class amenities including swimming pools, fitness center, and 24/7 security with gated community access.",
    image: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&q=80",
    images: [
      "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&q=80",
      "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=80",
    ],
    price: 180000,
    priceInPKR: 50000000,
    tokenPrice: 50,
    totalTokens: 3600,
    availableTokens: 1200,
    annualYield: 9.5,
    propertyType: "residential",
    status: "funding",
    features: ["Sea View", "Swimming Pool", "Gym", "24/7 Security", "Parking", "Generator Backup"],
    size: 2400,
    bedrooms: 3,
    bathrooms: 3,
    yearBuilt: 2023,
    rentalIncome: 1425,
    occupancyRate: 95,
    documents: [
      { name: "Property Deed", url: "#" },
      { name: "NOC Certificate", url: "#" },
      { name: "Financial Projections", url: "#" },
    ],
    timeline: [
      { date: "2024-01-15", event: "Property Listed" },
      { date: "2024-02-01", event: "Token Sale Started" },
      { date: "2024-03-15", event: "67% Funded" },
    ],
  },
  {
    id: "2",
    name: "Centaurus Mall Commercial",
    location: "F-8, Islamabad",
    city: "Islamabad",
    description: "Prime commercial retail space in the iconic Centaurus Mall, Pakistan's premier shopping destination. High footfall location with excellent visibility and access to affluent customers from twin cities.",
    image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&q=80",
    images: [
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&q=80",
      "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80",
      "https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=800&q=80",
    ],
    price: 500000,
    priceInPKR: 140000000,
    tokenPrice: 100,
    totalTokens: 5000,
    availableTokens: 0,
    annualYield: 11.2,
    propertyType: "commercial",
    status: "active",
    features: ["Prime Location", "24/7 Security", "Central AC", "Escalator Access", "Underground Parking"],
    size: 3500,
    yearBuilt: 2012,
    rentalIncome: 4666,
    occupancyRate: 98,
    documents: [
      { name: "Property Deed", url: "#" },
      { name: "Lease Agreements", url: "#" },
      { name: "Annual Report", url: "#" },
    ],
    timeline: [
      { date: "2023-06-01", event: "Property Listed" },
      { date: "2023-07-15", event: "Fully Funded" },
      { date: "2023-09-01", event: "First Dividend Distributed" },
    ],
  },
  {
    id: "3",
    name: "Bahria Town Villas",
    location: "Bahria Town Phase 7, Rawalpindi",
    city: "Rawalpindi",
    description: "Elegant double-storey villas in Bahria Town's most sought-after phase. Featuring modern design, landscaped gardens, and access to Bahria Town's world-class infrastructure including schools, hospitals, and entertainment facilities.",
    image: "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800&q=80",
    images: [
      "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800&q=80",
      "https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=800&q=80",
      "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=800&q=80",
    ],
    price: 250000,
    priceInPKR: 70000000,
    tokenPrice: 75,
    totalTokens: 3333,
    availableTokens: 1000,
    annualYield: 8.5,
    propertyType: "residential",
    status: "funding",
    features: ["Gated Community", "Garden", "Servant Quarter", "Double Car Parking", "Solar Ready"],
    size: 3000,
    bedrooms: 5,
    bathrooms: 6,
    yearBuilt: 2022,
    rentalIncome: 1770,
    occupancyRate: 92,
    documents: [
      { name: "Property Deed", url: "#" },
      { name: "Building Approval", url: "#" },
      { name: "Rental History", url: "#" },
    ],
    timeline: [
      { date: "2024-02-01", event: "Property Listed" },
      { date: "2024-02-15", event: "Token Sale Started" },
      { date: "2024-04-01", event: "70% Funded" },
    ],
  },
  {
    id: "4",
    name: "Lahore IT Tower",
    location: "Johar Town, Lahore",
    city: "Lahore",
    description: "Modern IT and corporate office space in Lahore's technology hub. State-of-the-art facilities designed for tech companies and startups, with high-speed fiber connectivity and modern amenities.",
    image: "https://images.unsplash.com/photo-1449157291145-7efd050a4d0e?w=800&q=80",
    images: [
      "https://images.unsplash.com/photo-1449157291145-7efd050a4d0e?w=800&q=80",
      "https://images.unsplash.com/photo-1497366412874-3415097a27e7?w=800&q=80",
      "https://images.unsplash.com/photo-1564069114553-7215e1ff1890?w=800&q=80",
    ],
    price: 400000,
    priceInPKR: 112000000,
    tokenPrice: 80,
    totalTokens: 5000,
    availableTokens: 1500,
    annualYield: 10.5,
    propertyType: "commercial",
    status: "funding",
    features: ["Fiber Internet", "Conference Rooms", "Cafeteria", "Prayer Room", "Basement Parking"],
    size: 8000,
    yearBuilt: 2021,
    rentalIncome: 3500,
    occupancyRate: 94,
    documents: [
      { name: "Property Deed", url: "#" },
      { name: "Valuation Report", url: "#" },
      { name: "Tenant Agreements", url: "#" },
    ],
    timeline: [
      { date: "2024-01-01", event: "Property Listed" },
      { date: "2024-01-20", event: "Token Sale Started" },
      { date: "2024-03-01", event: "70% Funded" },
    ],
  },
  {
    id: "5",
    name: "Pearl Continental Suites",
    location: "Mall Road, Murree",
    city: "Murree",
    description: "Premium serviced apartments near Mall Road with stunning mountain views. Perfect for short-term rentals targeting tourists, offering hotel-style services and proximity to Murree's main attractions.",
    image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80",
    images: [
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80",
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80",
      "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800&q=80",
    ],
    price: 320000,
    priceInPKR: 90000000,
    tokenPrice: 60,
    totalTokens: 5333,
    availableTokens: 0,
    annualYield: 14.2,
    propertyType: "residential",
    status: "active",
    features: ["Mountain View", "Heating System", "Room Service", "Restaurant", "Tourist Location"],
    size: 4500,
    bedrooms: 12,
    bathrooms: 14,
    yearBuilt: 2020,
    rentalIncome: 3786,
    occupancyRate: 85,
    documents: [
      { name: "Property Deed", url: "#" },
      { name: "Tourism License", url: "#" },
      { name: "Q3 Financial Report", url: "#" },
    ],
    timeline: [
      { date: "2023-03-01", event: "Property Listed" },
      { date: "2023-04-01", event: "Fully Funded" },
      { date: "2023-06-01", event: "Operations Started" },
    ],
  },
  {
    id: "6",
    name: "Gwadar Port View Residency",
    location: "New Town, Gwadar",
    city: "Gwadar",
    description: "Strategic investment in Pakistan's emerging port city. Modern residential complex with views of Gwadar Port and the Arabian Sea. Excellent appreciation potential with CPEC development.",
    image: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80",
    images: [
      "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80",
      "https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=800&q=80",
      "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=800&q=80",
    ],
    price: 150000,
    priceInPKR: 42000000,
    tokenPrice: 40,
    totalTokens: 3750,
    availableTokens: 2000,
    annualYield: 7.8,
    propertyType: "residential",
    status: "funding",
    features: ["Port View", "CPEC Zone", "Modern Design", "Rooftop Access", "Water Storage"],
    size: 1800,
    bedrooms: 3,
    bathrooms: 2,
    yearBuilt: 2024,
    rentalIncome: 975,
    occupancyRate: 78,
    documents: [
      { name: "Property Deed", url: "#" },
      { name: "GDA Approval", url: "#" },
      { name: "Investment Projections", url: "#" },
    ],
    timeline: [
      { date: "2024-03-01", event: "Property Listed" },
      { date: "2024-03-15", event: "Token Sale Started" },
      { date: "2024-05-01", event: "47% Funded" },
    ],
  },
  {
    id: "7",
    name: "DHA Lahore Commercial Plaza",
    location: "DHA Phase 6, Lahore",
    city: "Lahore",
    description: "Premium commercial plaza in DHA Lahore's business district. Multi-story building with retail and office spaces, excellent for rental income with high demand from businesses and brands.",
    image: "https://images.unsplash.com/photo-1554435493-93422e8220c8?w=800&q=80",
    images: [
      "https://images.unsplash.com/photo-1554435493-93422e8220c8?w=800&q=80",
      "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80",
      "https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=800&q=80",
    ],
    price: 750000,
    priceInPKR: 210000000,
    tokenPrice: 150,
    totalTokens: 5000,
    availableTokens: 800,
    annualYield: 12.5,
    propertyType: "commercial",
    status: "funding",
    features: ["Corner Plot", "Brand Tenants", "Elevator", "Standby Generator", "Ample Parking"],
    size: 12000,
    yearBuilt: 2019,
    rentalIncome: 7812,
    occupancyRate: 96,
    documents: [
      { name: "Property Deed", url: "#" },
      { name: "DHA NOC", url: "#" },
      { name: "Lease Portfolio", url: "#" },
    ],
    timeline: [
      { date: "2024-02-15", event: "Property Listed" },
      { date: "2024-03-01", event: "Token Sale Started" },
      { date: "2024-04-15", event: "84% Funded" },
    ],
  },
  {
    id: "8",
    name: "Blue Area Office Tower",
    location: "Blue Area, Islamabad",
    city: "Islamabad",
    description: "Grade-A corporate office space in Islamabad's premier business district. Walking distance from major banks, embassies, and government offices. Ideal for multinational companies and corporate headquarters.",
    image: "https://images.unsplash.com/photo-1486325212027-8081e485255e?w=800&q=80",
    images: [
      "https://images.unsplash.com/photo-1486325212027-8081e485255e?w=800&q=80",
      "https://images.unsplash.com/photo-1497366412874-3415097a27e7?w=800&q=80",
      "https://images.unsplash.com/photo-1564069114553-7215e1ff1890?w=800&q=80",
    ],
    price: 900000,
    priceInPKR: 252000000,
    tokenPrice: 200,
    totalTokens: 4500,
    availableTokens: 0,
    annualYield: 10.8,
    propertyType: "commercial",
    status: "active",
    features: ["Prime Location", "MNC Tenants", "Modern Lobby", "High-Speed Lifts", "CCTV Security"],
    size: 15000,
    yearBuilt: 2018,
    rentalIncome: 8100,
    occupancyRate: 99,
    documents: [
      { name: "Property Deed", url: "#" },
      { name: "CDA Approval", url: "#" },
      { name: "Annual Financials", url: "#" },
    ],
    timeline: [
      { date: "2023-08-01", event: "Property Listed" },
      { date: "2023-09-01", event: "Fully Funded" },
      { date: "2023-10-15", event: "Dividends Started" },
    ],
  },
];

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
