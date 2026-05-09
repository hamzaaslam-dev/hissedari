import { NextRequest, NextResponse } from "next/server";
import { getSupabase, generateId } from "@/lib/supabase";

// GET - List registration requests, filterable by ?status= and ?requester=
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const requester = searchParams.get("requester");

    let query = supabase
      .from("property_registration_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }
    if (requester) {
      query = query.eq("requester_address", requester);
    }

    const { data, error } = await query;
    if (error) {
      console.error("Supabase error (list registration requests):", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ requests: data || [] });
  } catch (error) {
    console.error("Error fetching registration requests:", error);
    return NextResponse.json(
      { error: "Failed to fetch registration requests" },
      { status: 500 }
    );
  }
}

// POST - Submit a new registration request (any wallet allowed).
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const body = await request.json();

    const {
      requesterAddress,
      name,
      location,
      city,
      description,
      propertyType,
      size,
      bedrooms,
      bathrooms,
      yearBuilt,
      features,
      propertyValue,
      totalTokens,
      pricePerToken,
      platformEquityPercent,
      fundingDeadlineDays,
      estimatedDividendYield,
      uploadedPhotos,
      certificates,
    } = body;

    if (!requesterAddress || typeof requesterAddress !== "string") {
      return NextResponse.json(
        { error: "requesterAddress is required" },
        { status: 400 }
      );
    }
    if (!name || !location || !city || !propertyType || !size) {
      return NextResponse.json(
        { error: "Missing required property fields" },
        { status: 400 }
      );
    }
    if (!totalTokens || totalTokens < 10) {
      return NextResponse.json(
        { error: "totalTokens must be at least 10" },
        { status: 400 }
      );
    }

    const id = generateId();

    const { error } = await supabase
      .from("property_registration_requests")
      .insert({
        id,
        requester_address: requesterAddress,
        name,
        location,
        city,
        description: description || "",
        property_type: propertyType,
        size,
        bedrooms: bedrooms ?? null,
        bathrooms: bathrooms ?? null,
        year_built: yearBuilt ?? null,
        features: features || [],
        property_value: propertyValue,
        total_tokens: totalTokens,
        price_per_token: pricePerToken,
        platform_equity_percent: platformEquityPercent ?? 5,
        funding_deadline_days: fundingDeadlineDays ?? 30,
        estimated_dividend_yield: estimatedDividendYield ?? 8.5,
        uploaded_photos: uploadedPhotos || [],
        certificates: certificates || [],
        status: "pending",
      });

    if (error) {
      console.error("Supabase insert error (registration request):", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error("Error creating registration request:", error);
    return NextResponse.json(
      { error: "Failed to submit registration request" },
      { status: 500 }
    );
  }
}
