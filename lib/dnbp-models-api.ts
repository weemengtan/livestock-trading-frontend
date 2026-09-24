import { apiFetch } from "./api-client";

function auth(accessToken: string | null) {
  return { accessToken };
}

/** Derived by the server from the approved schedule and the clock — never stored, never set by the client. */
export type DnbpModelStatus = "DRAFT" | "SCHEDULED" | "LIVE" | "RETIRED" | "CANCELLED";

export type DnbpModelSpecies = {
  species: string;
  dnbp_factor: string | null;
  standard_weight: string | null;
};

export type DnbpModel = {
  id: string;
  name: string;
  note: string | null;
  model_type: string;
  cif_buffer_per_kg: string;
  species: DnbpModelSpecies[];
  status: DnbpModelStatus;
  /** False once the model has gone live (even if since replaced) or been cancelled. */
  can_still_change: boolean;
  activation_at: string;
  /** The Singapore calendar date, YYYY-MM-DD. */
  activation_date: string;
  /** The switch moment in both zones, "YYYY-MM-DD HH:MM" each. */
  activation_display: { singapore: string; melbourne: string };
  created_by_email: string | null;
  created_at: string;
  impact_previewed_at: string | null;
  approved_by_email: string | null;
  approved_at: string | null;
  cancelled_at: string | null;
};

export type NewDnbpModel = {
  name: string;
  note?: string;
  cif_buffer_per_kg: string;
  species: DnbpModelSpecies[];
  /** YYYY-MM-DD, a Singapore calendar date. */
  activation_date: string;
};

export type ModelImpactLine = {
  order_line_id: string;
  contract_no: string | null;
  species: string;
  old_dnbp: string | null;
  new_dnbp: string | null;
  delta_per_kg: string | null;
  exposure_delta_aud: string | null;
};

export type ModelImpact = {
  /** The model that would be live just before this one switches on. */
  baseline_model: string;
  lines: ModelImpactLine[];
  aggregate_exposure_delta_aud: string;
  lines_affected: number;
  lines_unpriced: number;
};

export const dnbpModelsApi = {
  list: (accessToken: string | null) => apiFetch<DnbpModel[]>("/dnbp-models", auth(accessToken)),
  create: (body: NewDnbpModel, accessToken: string | null) =>
    apiFetch<DnbpModel>("/dnbp-models", { method: "POST", body, ...auth(accessToken) }),
  previewImpact: (id: string, accessToken: string | null) =>
    apiFetch<ModelImpact>(`/dnbp-models/${id}/impact`, { method: "POST", ...auth(accessToken) }),
  approve: (id: string, accessToken: string | null) =>
    apiFetch<DnbpModel>(`/dnbp-models/${id}/approve`, { method: "POST", ...auth(accessToken) }),
  reschedule: (id: string, activationDate: string, accessToken: string | null) =>
    apiFetch<DnbpModel>(`/dnbp-models/${id}/reschedule`, {
      method: "POST",
      body: { activation_date: activationDate },
      ...auth(accessToken),
    }),
  cancel: (id: string, accessToken: string | null) =>
    apiFetch<DnbpModel>(`/dnbp-models/${id}/cancel`, { method: "POST", ...auth(accessToken) }),
};
