import { apiFetch } from "./api-client";
import { TicketSocket } from "./ws-client";
import { dnbpCurrentSchema, saleyardOptionsSchema, speciesOptionsSchema } from "./buyer-schemas";

export type WeightBand = { min: string; max: string };

export type DnbpSpeciesLine = {
  species: string;
  dnbp_per_kg: string;
  previous_dnbp_per_kg: string | null;
  target_heads: string | null;
  heads_bought: string;
  weight_band: WeightBand | null;
};

export type EntryBounds = {
  max_head_count: number;
  max_price_per_head: string;
  weight_lower_multiple: string;
  weight_upper_multiple: string;
  fallback_weight_min_kg: string;
  fallback_weight_max_kg: string;
};

// The buyer-relevant subset of reference_data's operational constants
// (backend/schemas/buyer.py::BuyerConfigResponse) — rides along on
// DnbpCurrentResponse so it flows through the same cache-first offline
// mechanism (lib/buyer/use-dnbp-current.ts) as the DNBP figures.
export type BuyerConfig = {
  bid_check_close_threshold_pct: string;
  stale_instruction_hours: number;
  entry_bounds: EntryBounds;
};

export type DnbpCurrentResponse = {
  publication_id: string;
  published_at: string;
  effective_from: string;
  engine_version: string;
  species: DnbpSpeciesLine[];
  buyer_config: BuyerConfig;
};

// Matches backend/schemas/buyer.py::SaleyardOption — one weekday -> saleyard
// row of the saleyard calendar; `day` is upper-case English ("TUESDAY").
export type SaleyardOption = {
  saleyard: string;
  day: string;
};

// Matches backend/schemas/buyer.py::SpeciesOption — the open species
// registry, independent of any DNBP publication.
export type SpeciesOption = {
  code: string;
  display_name: string;
};

// Matches backend/schemas/buyer.py::BuyEntryCreateRequest exactly. No
// trade_date: the server derives it from client_created_at (Melbourne date).
export type BuyEntryCreatePayload = {
  saleyard: string;
  species: string;
  agent?: string | null;
  pen?: string | null;
  head_count: number;
  price_per_head: string;
  weight_kg: string;
  description?: string | null;
  eid_ref?: string | null;
  freight_per_head?: string | null;
  other_cost_per_kg?: string | null;
  breach_reason?: string | null;
  client_uuid: string;
  client_created_at: string; // ISO 8601
};

export type BuyEntryResponse = {
  id: string;
  saleyard: string;
  trade_date: string;
  species: string;
  agent: string | null;
  pen: string | null;
  head_count: number;
  price_per_head: string;
  weight_kg: string;
  description: string | null;
  eid_ref: string | null;
  freight_per_head: string | null;
  other_cost_per_kg: string | null;
  implied_price_per_kg: string;
  dnbp_at_entry: string;
  variance_per_kg: string;
  is_breach: boolean;
  breach_reason: string | null;
  client_uuid: string;
  client_created_at: string;
  synced_at: string | null;
  is_possible_duplicate: boolean;
};

// Matches backend/schemas/buyer.py::InstructionLineResponse/InstructionResponse
// exactly — deliberately excludes peters_expectation/expected_livestock_cost
// and every fill/reconciliation field (§2.2, §12.5).
export type InstructionLine = {
  contract_no: string | null;
  species: string;
  schw_kg: string;
  target_heads: string;
  weight_requirement_kg: string;
  dnbp_per_kg: string;
};

export type Instruction = {
  instruction_id: string;
  instruction_no: string;
  trade_date: string;
  status: string;
  saleyard: string | null;
  prepayment_note: string | null;
  lines: InstructionLine[];
};

export type BulkSyncItemResult = {
  client_uuid: string;
  ok: boolean;
  entry_id?: string | null;
  is_possible_duplicate?: boolean | null;
  error_code?: string | null;
  error_message?: string | null;
  retriable?: boolean | null;
  details?: { violations?: string[] } | null;
};

function auth(accessToken: string | null) {
  return { accessToken };
}

export const buyerApi = {
  // Parsed, not just cast: a malformed body throws here, before it can be cached.
  getDnbpCurrent: async (accessToken: string | null): Promise<DnbpCurrentResponse> =>
    dnbpCurrentSchema.parse(await apiFetch<unknown>("/buyer/dnbp/current", auth(accessToken))),

  getSpecies: async (accessToken: string | null): Promise<SpeciesOption[]> =>
    speciesOptionsSchema.parse(await apiFetch<unknown>("/buyer/species", auth(accessToken))),

  getSaleyards: async (accessToken: string | null): Promise<SaleyardOption[]> =>
    saleyardOptionsSchema.parse(await apiFetch<unknown>("/buyer/saleyards", auth(accessToken))),

  ackDnbp: (publicationId: string, accessToken: string | null) =>
    apiFetch<void>("/buyer/dnbp/ack", { method: "POST", body: { publication_id: publicationId }, ...auth(accessToken) }),

  createEntry: (body: BuyEntryCreatePayload, accessToken: string | null) =>
    apiFetch<BuyEntryResponse>("/buyer/entries", { method: "POST", body, ...auth(accessToken) }),

  bulkSyncEntries: (entries: BuyEntryCreatePayload[], accessToken: string | null) =>
    apiFetch<BulkSyncItemResult[]>("/buyer/entries/bulk", { method: "POST", body: { entries }, ...auth(accessToken) }),

  listEntries: (accessToken: string | null, params?: { tradeDate?: string; saleyard?: string }) => {
    const query = new URLSearchParams();
    if (params?.tradeDate) query.set("trade_date", params.tradeDate);
    if (params?.saleyard) query.set("saleyard", params.saleyard);
    const qs = query.toString();
    return apiFetch<BuyEntryResponse[]>(`/buyer/entries${qs ? `?${qs}` : ""}`, auth(accessToken));
  },

  deleteEntry: (id: string, accessToken: string | null) =>
    apiFetch<void>(`/buyer/entries/${id}`, { method: "DELETE", ...auth(accessToken) }),

  getInstructionCurrent: (accessToken: string | null) =>
    apiFetch<Instruction>("/buyer/instruction/current", auth(accessToken)),

  acknowledgeInstruction: (instructionId: string, accessToken: string | null) =>
    apiFetch<void>(`/buyer/instruction/${instructionId}/acknowledge`, { method: "POST", ...auth(accessToken) }),

  subscribePush: (
    body: { endpoint: string; p256dh: string; auth: string; ua?: string | null },
    accessToken: string | null
  ) => apiFetch<void>("/buyer/push-subscriptions", { method: "POST", body, ...auth(accessToken) }),

  getWsTicket: (accessToken: string | null) => apiFetch<{ ticket: string }>("/ws/ticket", { method: "POST", ...auth(accessToken) }),

  getScorecard: (accessToken: string | null, params?: { from?: string; to?: string }) => {
    const query = new URLSearchParams();
    if (params?.from) query.set("from", params.from);
    if (params?.to) query.set("to", params.to);
    const qs = query.toString();
    return apiFetch<ScorecardResponse>(`/buyer/scorecard${qs ? `?${qs}` : ""}`, auth(accessToken));
  },
};

// §12.6, §9.5 — own performance only. Buyer-safe by construction on the
// backend (schemas/buyer.py's ScorecardResponse); no forbidden field ever
// reaches this type.
export type ScorecardResponse = {
  from_: string | null;
  to: string | null;
  heads_bought: number;
  heads_target: string | null;
  avg_paid_per_kg: string | null;
  avg_dnbp_per_kg: string | null;
  headroom_captured_aud: string;
  breach_count: number;
  breach_rate: string;
  spend_by_saleyard: { saleyard: string; spend_aud: string }[];
};

/** §9.9/§10 — the buyer's WS channel; always re-fetches /buyer/dnbp/current on (re)connect. */
export function connectBuyerSocket(
  getAccessToken: () => string | null,
  onEvent: (event: string, data: unknown) => void,
  onReconnect: () => void
): TicketSocket {
  const socket = new TicketSocket(
    "/ws/buyer",
    async () => (await buyerApi.getWsTicket(getAccessToken())).ticket,
    onEvent,
    onReconnect
  );
  void socket.connect();
  return socket;
}
