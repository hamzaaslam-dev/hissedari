export type RegistrationRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "tokenized";

export interface RegistrationRequest {
  id: string;
  requester_address: string;
  name: string;
  location: string;
  city: string;
  description: string | null;
  property_type: "residential" | "commercial" | "industrial" | "mixed-use";
  size: number;
  bedrooms: number | null;
  bathrooms: number | null;
  year_built: number | null;
  features: string[];
  property_value: number;
  total_tokens: number;
  price_per_token: number;
  platform_equity_percent: number;
  funding_deadline_days: number;
  estimated_dividend_yield: number;
  uploaded_photos: string[];
  certificates: string[];
  status: RegistrationRequestStatus;
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  property_id: string | null;
  created_at: string;
}

export interface SubmitRegistrationRequestInput {
  requesterAddress: string;
  name: string;
  location: string;
  city: string;
  description?: string;
  propertyType: "residential" | "commercial" | "industrial" | "mixed-use";
  size: number;
  bedrooms?: number;
  bathrooms?: number;
  yearBuilt?: number;
  features?: string[];
  propertyValue: number;
  totalTokens: number;
  pricePerToken: number;
  platformEquityPercent?: number;
  fundingDeadlineDays?: number;
  estimatedDividendYield?: number;
  uploadedPhotos?: string[];
  certificates?: string[];
}

const API_BASE = "/api/registration-requests";

export async function submitRegistrationRequest(
  input: SubmitRegistrationRequestInput
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const res = await fetch(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || `HTTP ${res.status}` };
    }
    return { success: true, id: data.id };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function listRegistrationRequests(filters?: {
  status?: RegistrationRequestStatus;
  requester?: string;
}): Promise<RegistrationRequest[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.set("status", filters.status);
  if (filters?.requester) params.set("requester", filters.requester);
  const url = params.toString() ? `${API_BASE}?${params}` : API_BASE;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.requests as RegistrationRequest[]) || [];
}

export async function getRegistrationRequest(
  id: string
): Promise<RegistrationRequest | null> {
  const res = await fetch(`${API_BASE}/${id}`, { cache: "no-store" });
  if (!res.ok) return null;
  const data = await res.json();
  return (data.request as RegistrationRequest) || null;
}

export async function reviewRegistrationRequest(
  id: string,
  input: { action: "approve" | "reject"; adminAddress: string; adminNotes?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || `HTTP ${res.status}` };
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function markRegistrationTokenized(
  id: string,
  input: { propertyId: string; requesterAddress: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "tokenized", ...input }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || `HTTP ${res.status}` };
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function deleteRegistrationRequest(
  id: string,
  wallet: string
): Promise<boolean> {
  const res = await fetch(`${API_BASE}/${id}?wallet=${encodeURIComponent(wallet)}`, {
    method: "DELETE",
  });
  return res.ok;
}
