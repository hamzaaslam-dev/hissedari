import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { isRegistrationWhitelisted } from "@/lib/registrationWhitelist";

// GET - Fetch a single registration request.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabase();
    const { id } = await params;

    const { data, error } = await supabase
      .from("property_registration_requests")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Registration request not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ request: data });
  } catch (error) {
    console.error("Error fetching registration request:", error);
    return NextResponse.json(
      { error: "Failed to fetch registration request" },
      { status: 500 }
    );
  }
}

// PATCH - Admin approves/rejects, or requester marks tokenized.
//
// Body shape:
//   { action: "approve" | "reject", adminAddress, adminNotes? }
//   { action: "tokenized", propertyId, requesterAddress }
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabase();
    const { id } = await params;
    const body = await request.json();
    const { action } = body;

    const { data: existing, error: fetchError } = await supabase
      .from("property_registration_requests")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: "Registration request not found" },
        { status: 404 }
      );
    }

    if (action === "approve" || action === "reject") {
      const { adminAddress, adminNotes } = body;
      if (!adminAddress || !isRegistrationWhitelisted(adminAddress)) {
        return NextResponse.json(
          {
            error:
              "Only whitelisted admin wallets can approve or reject registration requests.",
          },
          { status: 403 }
        );
      }

      if (existing.status !== "pending") {
        return NextResponse.json(
          {
            error: `Request is already ${existing.status}; only pending requests can be reviewed.`,
          },
          { status: 400 }
        );
      }

      const newStatus = action === "approve" ? "approved" : "rejected";
      const { error: updateError } = await supabase
        .from("property_registration_requests")
        .update({
          status: newStatus,
          admin_notes: adminNotes || null,
          reviewed_by: adminAddress,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (updateError) {
        console.error("Supabase update error (review request):", updateError);
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, status: newStatus });
    }

    if (action === "tokenized") {
      const { propertyId, requesterAddress } = body;
      if (!propertyId) {
        return NextResponse.json(
          { error: "propertyId is required for tokenized action" },
          { status: 400 }
        );
      }
      if (
        !requesterAddress ||
        existing.requester_address !== requesterAddress
      ) {
        return NextResponse.json(
          {
            error:
              "Only the original requester can mark a request as tokenized.",
          },
          { status: 403 }
        );
      }
      if (existing.status !== "approved") {
        return NextResponse.json(
          { error: "Only approved requests can be marked as tokenized." },
          { status: 400 }
        );
      }

      const { error: updateError } = await supabase
        .from("property_registration_requests")
        .update({
          status: "tokenized",
          property_id: propertyId,
        })
        .eq("id", id);

      if (updateError) {
        console.error("Supabase update error (tokenized):", updateError);
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, status: "tokenized" });
    }

    return NextResponse.json(
      { error: `Unknown action: ${action}` },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error updating registration request:", error);
    return NextResponse.json(
      { error: "Failed to update registration request" },
      { status: 500 }
    );
  }
}

// DELETE - Admin or requester (only if pending) deletes a request.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabase();
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get("wallet");

    if (!wallet) {
      return NextResponse.json(
        { error: "wallet query param is required" },
        { status: 400 }
      );
    }

    const { data: existing, error: fetchError } = await supabase
      .from("property_registration_requests")
      .select("requester_address, status")
      .eq("id", id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    const isAdmin = isRegistrationWhitelisted(wallet);
    const isRequester =
      existing.requester_address === wallet && existing.status === "pending";

    if (!isAdmin && !isRequester) {
      return NextResponse.json(
        { error: "Not authorized to delete this request" },
        { status: 403 }
      );
    }

    const { error: deleteError } = await supabase
      .from("property_registration_requests")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Supabase delete error (request):", deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting registration request:", error);
    return NextResponse.json(
      { error: "Failed to delete registration request" },
      { status: 500 }
    );
  }
}
