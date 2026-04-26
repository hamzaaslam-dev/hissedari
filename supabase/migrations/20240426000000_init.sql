-- Supabase Schema for Hissedari Real Estate Tokenization Platform
-- Run this in: Supabase Dashboard → SQL Editor → New Query

-- ============================================================================
-- TABLES
-- ============================================================================

-- Properties table
CREATE TABLE IF NOT EXISTS properties (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  city TEXT NOT NULL,
  description TEXT,
  image TEXT,
  images TEXT[] DEFAULT '{}',
  price INTEGER NOT NULL,
  price_in_pkr BIGINT NOT NULL,
  token_price INTEGER NOT NULL,
  total_tokens INTEGER NOT NULL,
  available_tokens INTEGER NOT NULL,
  annual_yield DECIMAL(5,2) DEFAULT 8.5,
  property_type TEXT NOT NULL CHECK (property_type IN ('residential', 'commercial', 'industrial', 'mixed-use')),
  status TEXT DEFAULT 'funding' CHECK (status IN ('active', 'funding', 'funded')),
  features TEXT[] DEFAULT '{}',
  size INTEGER NOT NULL,
  bedrooms INTEGER,
  bathrooms INTEGER,
  year_built INTEGER,
  rental_income INTEGER DEFAULT 0,
  occupancy_rate INTEGER DEFAULT 90,
  mint_address TEXT UNIQUE NOT NULL,
  token_account TEXT NOT NULL,
  owner_address TEXT NOT NULL,
  transaction_signature TEXT NOT NULL,
  platform_equity_percent INTEGER DEFAULT 5,
  funding_deadline TIMESTAMPTZ,
  campaign_status TEXT DEFAULT 'active' CHECK (campaign_status IN ('active', 'funded', 'cancelled')),
  total_raised BIGINT DEFAULT 0,
  investor_count INTEGER DEFAULT 0,
  campaign_address TEXT,
  certificates TEXT[] DEFAULT '{}',
  uploaded_photos TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Property documents table
CREATE TABLE IF NOT EXISTS property_documents (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL
);

-- Property timeline table
CREATE TABLE IF NOT EXISTS property_timeline (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  event TEXT NOT NULL
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_properties_owner ON properties(owner_address);
CREATE INDEX IF NOT EXISTS idx_properties_mint ON properties(mint_address);
CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(campaign_status);
CREATE INDEX IF NOT EXISTS idx_documents_property ON property_documents(property_id);
CREATE INDEX IF NOT EXISTS idx_timeline_property ON property_timeline(property_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_timeline ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read properties (public data)
CREATE POLICY "Public read properties" ON properties
  FOR SELECT USING (true);

CREATE POLICY "Public read documents" ON property_documents
  FOR SELECT USING (true);

CREATE POLICY "Public read timeline" ON property_timeline
  FOR SELECT USING (true);

-- Allow anyone to insert (we validate ownership on the frontend/API)
CREATE POLICY "Anyone can insert properties" ON properties
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can insert documents" ON property_documents
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can insert timeline" ON property_timeline
  FOR INSERT WITH CHECK (true);

-- Allow updates (API handles authorization)
CREATE POLICY "Anyone can update properties" ON properties
  FOR UPDATE USING (true);

-- ============================================================================
-- STORAGE BUCKET
-- ============================================================================

-- Create storage bucket for property files (photos, certificates)
-- Note: You need to create this in the Supabase Dashboard → Storage
-- 1. Click "New Bucket"
-- 2. Name: property-files
-- 3. Public: YES (for public file URLs)

-- After creating the bucket, run this to allow public access:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('property-files', 'property-files', true);

-- Storage policies (run after bucket creation)
-- CREATE POLICY "Public read files" ON storage.objects
--   FOR SELECT USING (bucket_id = 'property-files');

-- CREATE POLICY "Anyone can upload files" ON storage.objects
--   FOR INSERT WITH CHECK (bucket_id = 'property-files');
