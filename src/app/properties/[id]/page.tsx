import { getSupabase } from "@/lib/supabase";
import { RegisteredProperty } from "@/lib/propertyStore";
import PropertyDetailClient from "./PropertyDetailClient";
import Link from "next/link";

interface PropertyPageProps {
  params: Promise<{ id: string }>;
}

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
    annualYield: parseFloat(String(dbProp.annual_yield)) || 8.5,
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
    campaignStatus: dbProp.campaign_status as "active" | "funded" | "cancelled",
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

// Server-side data fetching
async function getProperty(id: string): Promise<RegisteredProperty | null> {
  try {
    const supabase = getSupabase();
    
    const { data: properties, error } = await supabase
      .from("properties")
      .select("*")
      .eq("id", id);
    
    if (error || !properties || properties.length === 0) {
      return null;
    }
    
    const prop = properties[0];
    
    // Fetch documents and timeline
    const { data: documents } = await supabase
      .from("property_documents")
      .select("name, url")
      .eq("property_id", prop.id);
    
    const { data: timeline } = await supabase
      .from("property_timeline")
      .select("date, event")
      .eq("property_id", prop.id)
      .order("date", { ascending: false });
    
    return dbToRegisteredProperty({
      ...prop,
      documents: documents || [],
      timeline: timeline || [],
    });
  } catch (error) {
    console.error("Error fetching property:", error);
    return null;
  }
}

export default async function PropertyDetailPage({ params }: PropertyPageProps) {
  const { id } = await params;
  const property = await getProperty(id);
  
  if (!property) {
    return (
      <div className="min-h-screen pt-28 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Property Not Found</h1>
          <Link href="/properties" className="btn-primary">
            Browse Properties
          </Link>
        </div>
      </div>
    );
  }
  
  return <PropertyDetailClient property={property} />;
}
