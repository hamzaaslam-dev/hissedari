import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

// POST - Initialize database tables (run SQL via Supabase)
export async function POST() {
  try {
    const supabase = getSupabase();
    
    // Note: In Supabase, you typically create tables via the Dashboard or migrations
    // This endpoint just verifies the connection and checks if tables exist
    
    const { data, error } = await supabase
      .from("properties")
      .select("id")
      .limit(1);
    
    if (error && error.code === "42P01") {
      // Table doesn't exist - return instructions
      return NextResponse.json({
        success: false,
        message: "Tables not found. Please create them in Supabase Dashboard.",
        instructions: "Go to Supabase Dashboard → SQL Editor and run the schema SQL.",
      });
    }
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ 
      success: true, 
      message: "Database connection successful and tables exist" 
    });
  } catch (error) {
    console.error("Error checking database:", error);
    return NextResponse.json(
      { error: "Failed to check database", details: String(error) },
      { status: 500 }
    );
  }
}

// GET - Check if database is initialized
export async function GET() {
  try {
    const supabase = getSupabase();
    
    const { error } = await supabase
      .from("properties")
      .select("id")
      .limit(1);
    
    if (error) {
      return NextResponse.json({ initialized: false, error: error.message });
    }
    
    return NextResponse.json({ initialized: true });
  } catch (error) {
    return NextResponse.json({ initialized: false, error: String(error) });
  }
}
