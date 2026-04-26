#!/usr/bin/env node

/**
 * Supabase Setup Script
 * 
 * This script helps you set up Supabase tables and storage.
 * 
 * Usage:
 *   node scripts/setup-supabase.js
 * 
 * Prerequisites:
 *   - NEXT_PUBLIC_SUPABASE_URL set in .env.local
 *   - NEXT_PUBLIC_SUPABASE_ANON_KEY set in .env.local
 *   - SUPABASE_SERVICE_ROLE_KEY set in .env.local (get from Dashboard → Settings → API → service_role)
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL not set in .env.local');
  process.exit(1);
}

if (!serviceRoleKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not set in .env.local');
  console.log('\n📋 To get your service role key:');
  console.log('   1. Go to Supabase Dashboard');
  console.log('   2. Project Settings → API');
  console.log('   3. Copy "service_role" key (NOT the anon key)');
  console.log('   4. Add to .env.local: SUPABASE_SERVICE_ROLE_KEY=your_key\n');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createTables() {
  console.log('📦 Creating tables...\n');

  // Check if properties table exists
  const { data, error } = await supabase.from('properties').select('id').limit(1);
  
  if (!error) {
    console.log('✅ Tables already exist!');
    return true;
  }

  if (error.code !== '42P01') {
    console.error('❌ Error checking tables:', error.message);
    return false;
  }

  console.log('⚠️  Tables do not exist.');
  console.log('\n📋 Please run the SQL schema manually:');
  console.log('   1. Go to Supabase Dashboard → SQL Editor');
  console.log('   2. Copy the contents of: supabase-schema.sql');
  console.log('   3. Paste and click "Run"\n');
  
  return false;
}

async function createStorageBucket() {
  console.log('📁 Checking storage bucket...\n');

  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  
  if (listError) {
    console.error('❌ Error listing buckets:', listError.message);
    return false;
  }

  const bucketExists = buckets.some(b => b.name === 'property-files');
  
  if (bucketExists) {
    console.log('✅ Storage bucket "property-files" already exists!');
    return true;
  }

  console.log('Creating storage bucket...');
  
  const { data, error } = await supabase.storage.createBucket('property-files', {
    public: true,
    fileSizeLimit: 10485760, // 10MB
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
  });

  if (error) {
    console.error('❌ Error creating bucket:', error.message);
    return false;
  }

  console.log('✅ Storage bucket "property-files" created!');
  return true;
}

async function main() {
  console.log('\n🚀 Supabase Setup Script\n');
  console.log('Project:', supabaseUrl);
  console.log('');

  const tablesOk = await createTables();
  console.log('');
  const storageOk = await createStorageBucket();
  
  console.log('\n' + '='.repeat(50));
  
  if (tablesOk && storageOk) {
    console.log('\n🎉 Setup complete! Your Supabase is ready.\n');
  } else {
    console.log('\n⚠️  Some steps need manual action. See above.\n');
  }
}

main().catch(console.error);
