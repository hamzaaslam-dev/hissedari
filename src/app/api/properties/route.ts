import { NextRequest, NextResponse } from "next/server";
import { getSupabase, generateId } from "@/lib/supabase";
import { isRegistrationWhitelisted } from "@/lib/registrationWhitelist";

// GET - Fetch all properties or filter by owner
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const { searchParams } = new URL(request.url);
    const owner = searchParams.get("owner");
    const mintAddress = searchParams.get("mint");
    const id = searchParams.get("id");

    let query = supabase.from("properties").select("*");

    if (id) {
      query = query.eq("id", id);
    } else if (mintAddress) {
      query = query.eq("mint_address", mintAddress);
    } else if (owner) {
      query = query.eq("owner_address", owner);
    }

    const { data: properties, error } = await query.order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fetch documents and timeline for each property
    const propertiesWithDetails = await Promise.all(
      (properties || []).map(async (prop) => {
        const { data: documents } = await supabase
          .from("property_documents")
          .select("name, url")
          .eq("property_id", prop.id);

        const { data: timeline } = await supabase
          .from("property_timeline")
          .select("date, event")
          .eq("property_id", prop.id)
          .order("date", { ascending: false });

        return {
          ...prop,
          documents: documents || [],
          timeline: timeline || [],
        };
      })
    );

    return NextResponse.json({ properties: propertiesWithDetails });
  } catch (error) {
    console.error("Error fetching properties:", error);
    return NextResponse.json(
      { error: "Failed to fetch properties" },
      { status: 500 }
    );
  }
}

// POST - Create a new property
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const body = await request.json();
    const id = generateId();

    const {
      name,
      location,
      city,
      description,
      image,
      images,
      price,
      priceInPKR,
      tokenPrice,
      totalTokens,
      availableTokens,
      annualYield,
      propertyType,
      status,
      features,
      size,
      bedrooms,
      bathrooms,
      yearBuilt,
      rentalIncome,
      occupancyRate,
      mintAddress,
      tokenAccount,
      ownerAddress,
      transactionSignature,
      platformEquityPercent,
      fundingDeadline,
      campaignStatus,
      totalRaised,
      investorCount,
      campaignAddress,
      certificates,
      uploadedPhotos,
      documents,
      timeline,
      registrationRequestId,
    } = body;

    let registrationRequestApproved = false;
    if (registrationRequestId) {
      const { data: reqRow, error: reqErr } = await supabase
        .from("property_registration_requests")
        .select("requester_address, status")
        .eq("id", registrationRequestId)
        .single();

      if (reqErr || !reqRow) {
        return NextResponse.json(
          { error: "Referenced registration request not found" },
          { status: 404 }
        );
      }
      if (reqRow.status !== "approved") {
        return NextResponse.json(
          {
            error: `Registration request is ${reqRow.status}; only approved requests may be tokenized.`,
          },
          { status: 403 }
        );
      }
      if (reqRow.requester_address !== ownerAddress) {
        return NextResponse.json(
          {
            error:
              "Owner address does not match the original requester of this approved request.",
          },
          { status: 403 }
        );
      }
      registrationRequestApproved = true;
    }

    if (!registrationRequestApproved) {
      if (!ownerAddress || !isRegistrationWhitelisted(ownerAddress)) {
        return NextResponse.json(
          {
            error:
              "Wallet not authorized to register properties. Submit a registration request and wait for admin approval.",
          },
          { status: 403 }
        );
      }
    }

    // Insert property
    const { error: insertError } = await supabase.from("properties").insert({
      id,
      name,
      location,
      city,
      description: description || "",
      image: image || "",
      images: images || [],
      price,
      price_in_pkr: priceInPKR,
      token_price: tokenPrice,
      total_tokens: totalTokens,
      available_tokens: availableTokens,
      annual_yield: annualYield || 8.5,
      property_type: propertyType,
      status: status || "funding",
      features: features || [],
      size,
      bedrooms: bedrooms || null,
      bathrooms: bathrooms || null,
      year_built: yearBuilt,
      rental_income: rentalIncome || 0,
      occupancy_rate: occupancyRate || 90,
      mint_address: mintAddress,
      token_account: tokenAccount,
      owner_address: ownerAddress,
      transaction_signature: transactionSignature,
      platform_equity_percent: platformEquityPercent || 5,
      funding_deadline: fundingDeadline,
      campaign_status: campaignStatus || "active",
      total_raised: totalRaised || 0,
      investor_count: investorCount || 0,
      campaign_address: campaignAddress || null,
      certificates: certificates || [],
      uploaded_photos: uploadedPhotos || [],
    });

    if (insertError) {
      console.error("Insert error:", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Insert documents
    if (documents && documents.length > 0) {
      const docsToInsert = documents.map((doc: { name: string; url: string }) => ({
        id: `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        property_id: id,
        name: doc.name,
        url: doc.url,
      }));

      await supabase.from("property_documents").insert(docsToInsert);
    }

    // Insert timeline events
    if (timeline && timeline.length > 0) {
      const eventsToInsert = timeline.map((event: { date: string; event: string }) => ({
        id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        property_id: id,
        date: event.date,
        event: event.event,
      }));

      await supabase.from("property_timeline").insert(eventsToInsert);
    }

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error("Error creating property:", error);
    return NextResponse.json(
      { error: "Failed to create property" },
      { status: 500 }
    );
  }
}

// PATCH - Update property (campaign status, etc.)
export async function PATCH(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Property ID is required" },
        { status: 400 }
      );
    }

    // Build update object
    const updateObj: Record<string, unknown> = {};

    if (updates.campaignStatus !== undefined) {
      updateObj.campaign_status = updates.campaignStatus;
    }
    if (updates.totalRaised !== undefined) {
      updateObj.total_raised = updates.totalRaised;
    }
    if (updates.investorCount !== undefined) {
      updateObj.investor_count = updates.investorCount;
    }
    if (updates.status !== undefined) {
      updateObj.status = updates.status;
    }
    if (updates.availableTokens !== undefined) {
      updateObj.available_tokens = updates.availableTokens;
    }

    if (Object.keys(updateObj).length > 0) {
      const { error } = await supabase
        .from("properties")
        .update(updateObj)
        .eq("id", id);

      if (error) {
        console.error("Update error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating property:", error);
    return NextResponse.json(
      { error: "Failed to update property" },
      { status: 500 }
    );
  }
}
