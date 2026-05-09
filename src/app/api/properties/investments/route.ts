import { NextRequest, NextResponse } from "next/server";
import { getSupabase, generateId } from "@/lib/supabase";

/** Aggregate primary-market purchases per property for a wallet */
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const wallet = new URL(request.url).searchParams.get("wallet");

    if (!wallet) {
      return NextResponse.json({ error: "wallet query parameter required" }, { status: 400 });
    }

    const { data: rows, error } = await supabase
      .from("property_primary_investments")
      .select("property_id, tokens")
      .eq("buyer_address", wallet);

    if (error) {
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        return NextResponse.json({
          totalsByPropertyId: {} as Record<string, number>,
          warning:
            "Table property_primary_investments missing — run the SQL block for it in supabase-schema.sql",
        });
      }
      console.error("investments GET:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const byProperty: Record<string, number> = {};
    for (const row of rows || []) {
      const pid = row.property_id as string;
      const t = Number(row.tokens) || 0;
      byProperty[pid] = (byProperty[pid] || 0) + t;
    }

    return NextResponse.json({ totalsByPropertyId: byProperty });
  } catch (e) {
    console.error("investments GET:", e);
    return NextResponse.json({ error: "Failed to load investments" }, { status: 500 });
  }
}

/** Record primary-market purchase (SOL paid on property page); merges into dashboard holdings */
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const body = await request.json();
    const { propertyId, buyerAddress, tokens, transactionSignature } = body;

    if (!propertyId || !buyerAddress || typeof tokens !== "number" || !transactionSignature) {
      return NextResponse.json(
        { error: "propertyId, buyerAddress, tokens (number), transactionSignature required" },
        { status: 400 }
      );
    }

    const tokenAmount = Math.floor(tokens);
    if (tokenAmount < 1) {
      return NextResponse.json({ error: "tokens must be at least 1" }, { status: 400 });
    }

    const { data: duplicate } = await supabase
      .from("property_primary_investments")
      .select("id")
      .eq("transaction_signature", transactionSignature)
      .maybeSingle();

    if (duplicate) {
      return NextResponse.json({ success: true, duplicate: true });
    }

    const { data: property, error: propErr } = await supabase
      .from("properties")
      .select("id, available_tokens, investor_count")
      .eq("id", propertyId)
      .maybeSingle();

    if (propErr || !property) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 });
    }

    const available = Number(property.available_tokens);
    const investorCount = Number(property.investor_count) || 0;

    if (tokenAmount > available) {
      return NextResponse.json({ error: "Not enough tokens available" }, { status: 400 });
    }

    const investmentId = generateId();

    const { error: insertErr } = await supabase.from("property_primary_investments").insert({
      id: investmentId,
      property_id: propertyId,
      buyer_address: buyerAddress,
      tokens: tokenAmount,
      transaction_signature: transactionSignature,
    });

    if (insertErr) {
      if (insertErr.code === "23505" || insertErr.message?.includes("duplicate")) {
        return NextResponse.json({ success: true, duplicate: true });
      }
      if (insertErr.code === "42P01" || insertErr.message?.includes("does not exist")) {
        return NextResponse.json(
          {
            error:
              "Database table property_primary_investments not created yet — run supabase-schema.sql section for primary investments",
          },
          { status: 503 }
        );
      }
      console.error("investments INSERT:", insertErr);
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    const { error: updateErr } = await supabase
      .from("properties")
      .update({
        available_tokens: available - tokenAmount,
        investor_count: investorCount + 1,
      })
      .eq("id", propertyId);

    if (updateErr) {
      await supabase.from("property_primary_investments").delete().eq("id", investmentId);
      console.error("investments property update:", updateErr);
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("investments POST:", e);
    return NextResponse.json({ error: "Failed to record investment" }, { status: 500 });
  }
}
