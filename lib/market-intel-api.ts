import { apiFetch } from "./api-client";

// Matches backend/schemas/market_intel.py::MarketObservationCreateRequest
// exactly — the write path a BUYER role uses to log another buyer's
// successful bid. Unlike lib/buyer-api.ts's BuyEntryCreatePayload, there is
// no eid_ref/freight/cost (not our own purchase) and no breach_reason (no
// DNBP scoring applies to someone else's bid).
export type MarketObservationCreatePayload = {
  saleyard: string;
  species: string;
  competitor_name: string;
  agent?: string | null;
  pen?: string | null;
  head_count: number;
  price_per_head: string;
  weight_kg?: string | null;
  description?: string | null;
  is_estimated: boolean;
  client_uuid: string;
  client_created_at: string; // ISO 8601
};

// Matches backend/schemas/market_intel.py::MarketObservationAck — echoes
// back only what the buyer themselves just submitted (§ visibility: a
// BUYER may submit these but never read anyone's observations back, so
// this is deliberately the only "response" shape the buyer role ever sees).
export type MarketObservationAck = {
  id: string;
  saleyard: string;
  trade_date: string;
  species: string;
  competitor_name: string;
  agent: string | null;
  pen: string | null;
  head_count: number;
  price_per_head: string;
  weight_kg: string | null;
  description: string | null;
  implied_price_per_kg: string | null;
  is_estimated: boolean;
  client_uuid: string;
  client_created_at: string;
  synced_at: string | null;
  is_possible_duplicate: boolean;
};

export type BulkObservationSyncItemResult = {
  client_uuid: string;
  ok: boolean;
  observation_id?: string | null;
  is_possible_duplicate?: boolean | null;
  error_code?: string | null;
  error_message?: string | null;
  retriable?: boolean | null;
  details?: { violations?: string[] } | null;
};

// Matches backend/schemas/market_intel.py::MarketObservationResponse /
// MarketIntelSummaryResponse — OWNER/ACCOUNTANT-only trading-console reads.
export type MarketObservationResponse = {
  id: string;
  observer_id: string;
  observer_email: string;
  saleyard: string;
  trade_date: string;
  species: string;
  competitor_name: string;
  agent: string | null;
  pen: string | null;
  head_count: number;
  price_per_head: string;
  weight_kg: string | null;
  description: string | null;
  implied_price_per_kg: string | null;
  is_estimated: boolean;
  client_created_at: string;
};

export type MarketIntelSummaryRow = {
  competitor_name: string;
  species: string;
  entry_count: number;
  heads_observed: number;
  avg_price_per_kg: string | null;
  last_observed_at: string;
};

export type MarketIntelSummaryResponse = {
  from_: string | null;
  to: string | null;
  rows: MarketIntelSummaryRow[];
};

function auth(accessToken: string | null) {
  return { accessToken };
}

function qs(params: Record<string, string | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }
  const s = query.toString();
  return s ? `?${s}` : "";
}

export const marketIntelApi = {
  // Buyer write path
  createObservation: (body: MarketObservationCreatePayload, accessToken: string | null) =>
    apiFetch<MarketObservationAck>("/market-intel/observations", { method: "POST", body, ...auth(accessToken) }),

  bulkSyncObservations: (observations: MarketObservationCreatePayload[], accessToken: string | null) =>
    apiFetch<BulkObservationSyncItemResult[]>("/market-intel/observations/bulk", {
      method: "POST",
      body: { observations },
      ...auth(accessToken),
    }),

  deleteObservation: (id: string, accessToken: string | null) =>
    apiFetch<void>(`/market-intel/observations/${id}`, { method: "DELETE", ...auth(accessToken) }),

  // Trading-console read path (OWNER/ACCOUNTANT only)
  listObservations: (
    accessToken: string | null,
    params?: { from?: string; to?: string; saleyard?: string; species?: string; competitorName?: string }
  ) =>
    apiFetch<MarketObservationResponse[]>(
      `/market-intel/observations${qs({
        from: params?.from,
        to: params?.to,
        saleyard: params?.saleyard,
        species: params?.species,
        competitor_name: params?.competitorName,
      })}`,
      auth(accessToken)
    ),

  getSummary: (
    accessToken: string | null,
    params?: { from?: string; to?: string; saleyard?: string; species?: string }
  ) =>
    apiFetch<MarketIntelSummaryResponse>(
      `/market-intel/summary${qs({ from: params?.from, to: params?.to, saleyard: params?.saleyard, species: params?.species })}`,
      auth(accessToken)
    ),
};
