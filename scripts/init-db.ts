/**
 * Supabase Setup Instructions
 * 
 * This script provides instructions for setting up Supabase for the project.
 * 
 * STEPS TO SET UP SUPABASE:
 * 
 * 1. Go to https://supabase.com and create a free account
 * 
 * 2. Create a new project
 *    - Give it a name (e.g., "fyp-hissedari")
 *    - Set a database password (save this!)
 *    - Choose a region close to you
 * 
 * 3. Wait for the project to be created (~2 minutes)
 * 
 * 4. Get your API credentials:
 *    - Go to Project Settings → API
 *    - Copy the "Project URL" → NEXT_PUBLIC_SUPABASE_URL
 *    - Copy the "anon public" key → NEXT_PUBLIC_SUPABASE_ANON_KEY
 * 
 * 5. Add to your .env.local:
 *    NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
 *    NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
 * 
 * 6. Create the database tables:
 *    - Go to SQL Editor in Supabase Dashboard
 *    - Copy the contents of supabase-schema.sql
 *    - Click "Run"
 * 
 * 7. Create the storage bucket:
 *    - Go to Storage in Supabase Dashboard
 *    - Click "New bucket"
 *    - Name: property-files
 *    - Public: YES (toggle on)
 *    - Click "Create bucket"
 * 
 * 8. Set storage policies:
 *    - Click on the bucket → Policies
 *    - Add policy for SELECT (Anyone can view)
 *    - Add policy for INSERT (Anyone can upload)
 * 
 * 9. Add environment variables to Vercel:
 *    - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
 *    - Add NEXT_PUBLIC_SUPABASE_URL
 *    - Add NEXT_PUBLIC_SUPABASE_ANON_KEY
 * 
 * 10. Redeploy your app
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function checkSupabaseConnection() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  console.log("\n🔍 Checking Supabase configuration...\n");

  if (!supabaseUrl || supabaseUrl === "https://your-project.supabase.co") {
    console.log("❌ NEXT_PUBLIC_SUPABASE_URL is not set");
    console.log("\n📋 Follow the setup instructions above to configure Supabase.\n");
    process.exit(1);
  }

  if (!supabaseKey || supabaseKey === "your-anon-key-here") {
    console.log("❌ NEXT_PUBLIC_SUPABASE_ANON_KEY is not set");
    console.log("\n📋 Follow the setup instructions above to configure Supabase.\n");
    process.exit(1);
  }

  console.log("✅ Environment variables found");
  console.log(`   URL: ${supabaseUrl}`);
  console.log(`   Key: ${supabaseKey.substring(0, 20)}...`);

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log("\n🔗 Testing database connection...");

  try {
    const { data, error } = await supabase.from("properties").select("id").limit(1);

    if (error) {
      if (error.code === "42P01") {
        console.log("⚠️  Tables not found. Please run the SQL schema.");
        console.log("\n📋 Copy supabase-schema.sql contents to Supabase SQL Editor and run it.\n");
      } else {
        console.log(`❌ Database error: ${error.message}`);
      }
      process.exit(1);
    }

    console.log("✅ Database connection successful!");
    console.log(`   Properties table exists with ${data?.length || 0} records`);
  } catch (err) {
    console.log(`❌ Connection failed: ${err}`);
    process.exit(1);
  }

  console.log("\n🔗 Testing storage connection...");

  try {
    const { data, error } = await supabase.storage.getBucket("property-files");

    if (error) {
      console.log("⚠️  Storage bucket 'property-files' not found.");
      console.log("\n📋 Create it in Supabase Dashboard → Storage → New bucket");
      console.log("   Name: property-files");
      console.log("   Public: YES\n");
    } else {
      console.log("✅ Storage bucket found!");
      console.log(`   Bucket: ${data.name}`);
      console.log(`   Public: ${data.public}`);
    }
  } catch (err) {
    console.log(`⚠️  Storage check failed: ${err}`);
  }

  console.log("\n🎉 Supabase setup complete!\n");
}

checkSupabaseConnection();
