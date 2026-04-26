#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://hqxtewpnnkkjxsgxkwek.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxeHRld3BubmtranhzZ3hrd2VrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzIxMDY5MywiZXhwIjoyMDkyNzg2NjkzfQ.yzJf1x4Ctk2Ys5SoILin1YRBatfowMPuzOhTfCd5KXA';

const SQL_STATEMENTS = [
  // Properties table
  `CREATE TABLE IF NOT EXISTS properties (
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
    property_type TEXT NOT NULL,
    status TEXT DEFAULT 'funding',
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
    campaign_status TEXT DEFAULT 'active',
    total_raised BIGINT DEFAULT 0,
    investor_count INTEGER DEFAULT 0,
    campaign_address TEXT,
    certificates TEXT[] DEFAULT '{}',
    uploaded_photos TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  
  // Property documents table
  `CREATE TABLE IF NOT EXISTS property_documents (
    id TEXT PRIMARY KEY,
    property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    url TEXT NOT NULL
  )`,
  
  // Property timeline table
  `CREATE TABLE IF NOT EXISTS property_timeline (
    id TEXT PRIMARY KEY,
    property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    event TEXT NOT NULL
  )`,
  
  // Enable RLS
  `ALTER TABLE properties ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE property_documents ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE property_timeline ENABLE ROW LEVEL SECURITY`,
  
  // Policies - using DO blocks to handle "already exists" errors
  `DO $$ BEGIN CREATE POLICY "Public read properties" ON properties FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN CREATE POLICY "Public read documents" ON property_documents FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN CREATE POLICY "Public read timeline" ON property_timeline FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN CREATE POLICY "Anyone can insert properties" ON properties FOR INSERT WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN CREATE POLICY "Anyone can insert documents" ON property_documents FOR INSERT WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN CREATE POLICY "Anyone can insert timeline" ON property_timeline FOR INSERT WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN CREATE POLICY "Anyone can update properties" ON properties FOR UPDATE USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
];

async function runSQL() {
  console.log('🚀 Setting up Supabase database...\n');
  
  for (let i = 0; i < SQL_STATEMENTS.length; i++) {
    const sql = SQL_STATEMENTS[i];
    const shortDesc = sql.substring(0, 50).replace(/\n/g, ' ') + '...';
    
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
        method: 'POST',
        headers: {
          'apikey': SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ query: sql })
      });
      
      if (response.ok) {
        console.log(`✅ ${i + 1}/${SQL_STATEMENTS.length}: Success`);
      } else {
        const error = await response.text();
        if (error.includes('already exists') || error.includes('duplicate')) {
          console.log(`○ ${i + 1}/${SQL_STATEMENTS.length}: Already exists`);
        } else {
          console.log(`⚠️ ${i + 1}/${SQL_STATEMENTS.length}: ${error.substring(0, 100)}`);
        }
      }
    } catch (err) {
      console.log(`❌ ${i + 1}/${SQL_STATEMENTS.length}: ${err.message}`);
    }
  }
  
  console.log('\n🔍 Verifying tables...');
  
  // Check if tables exist by trying to select from them
  const tables = ['properties', 'property_documents', 'property_timeline'];
  for (const table of tables) {
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=id&limit=1`, {
        headers: {
          'apikey': SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        }
      });
      
      if (response.ok) {
        console.log(`✅ ${table} - exists`);
      } else {
        const error = await response.json();
        console.log(`❌ ${table} - ${error.message || 'not found'}`);
      }
    } catch (err) {
      console.log(`❌ ${table} - ${err.message}`);
    }
  }
  
  console.log('\n✨ Done!');
}

runSQL();
