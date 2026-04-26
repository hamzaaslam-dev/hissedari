import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Lazy-loaded Supabase client
let _supabase: SupabaseClient | null = null;

// Get or create Supabase client (lazy initialization)
export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error(
        "Supabase environment variables not set. Please add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your .env.local file."
      );
    }
    
    _supabase = createClient(supabaseUrl, supabaseKey);
  }
  return _supabase;
}

// Property type matching the existing RegisteredProperty interface
export interface DbProperty {
  id: string;
  name: string;
  location: string;
  city: string;
  description: string;
  image: string;
  images: string[];
  price: number;
  price_in_pkr: number;
  token_price: number;
  total_tokens: number;
  available_tokens: number;
  annual_yield: number;
  property_type: "residential" | "commercial" | "industrial" | "mixed-use";
  status: "active" | "funding" | "funded";
  features: string[];
  size: number;
  bedrooms: number | null;
  bathrooms: number | null;
  year_built: number;
  rental_income: number;
  occupancy_rate: number;
  mint_address: string;
  token_account: string;
  owner_address: string;
  transaction_signature: string;
  platform_equity_percent: number;
  funding_deadline: string;
  campaign_status: "active" | "funded" | "cancelled";
  total_raised: number;
  investor_count: number;
  campaign_address: string | null;
  certificates: string[];
  uploaded_photos: string[];
  created_at: string;
}

// Document type
export interface DbDocument {
  id: string;
  property_id: string;
  name: string;
  url: string;
}

// Timeline event type
export interface DbTimelineEvent {
  id: string;
  property_id: string;
  date: string;
  event: string;
}

// Generate unique ID
export function generateId(): string {
  return `prop-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Upload file to Supabase Storage
export async function uploadFile(
  file: File,
  folder: string = "uploads"
): Promise<{ url: string; path: string }> {
  const supabase = getSupabase();
  
  const fileExt = file.name.split(".").pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
  const filePath = `${folder}/${fileName}`;
  
  const { data, error } = await supabase.storage
    .from("property-files")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
    });
  
  if (error) {
    throw new Error(`Failed to upload file: ${error.message}`);
  }
  
  // Get public URL
  const { data: urlData } = supabase.storage
    .from("property-files")
    .getPublicUrl(filePath);
  
  return {
    url: urlData.publicUrl,
    path: filePath,
  };
}

// Delete file from Supabase Storage
export async function deleteFile(path: string): Promise<void> {
  const supabase = getSupabase();
  
  const { error } = await supabase.storage
    .from("property-files")
    .remove([path]);
  
  if (error) {
    throw new Error(`Failed to delete file: ${error.message}`);
  }
}
