import { apiFetch } from "./api-client";

function auth(accessToken: string | null) {
  return { accessToken };
}

export type SaleyardCalendarRow = {
  saleyard: string;
  day: string;
  prepayment_aud: string;
  note: string | null;
};

export type ActiveConfig = {
  ref_data_version: string;
  ref_data_version_id: string | null;
  model_type: string;
  available_model_types: string[];
  cif_buffer_per_kg: string;
  dnbp_factor_by_species: Record<string, string>;
  standard_weight_by_species: Record<string, string>;
  bid_check_close_threshold_pct: string;
  buyer_weight_band_tolerance_pct: string;
  stale_instruction_hours: number;
  saleyard_calendar: SaleyardCalendarRow[];
  owner: string;
};

export type ReferenceDataVersion = {
  id: string;
  effective_from: string;
  created_by: string | null;
  note: string | null;
  model_type: string;
  is_active: boolean;
  activated_at: string | null;
  activated_by: string | null;
  impact_previewed_at: string | null;
  created_at: string;
};

export type ReferenceDataVersionDetail = ReferenceDataVersion & {
  entries: { id: string; table_key: string; key1: string | null; value: string }[];
};

export type ImpactLine = {
  order_line_id: string;
  contract_no: string | null;
  species: string;
  old_dnbp: string | null;
  new_dnbp: string | null;
  delta_per_kg: string | null;
  exposure_delta_aud: string | null;
};

export type ImpactPreview = {
  lines: ImpactLine[];
  aggregate_exposure_delta_aud: string;
  lines_affected: number;
};

export type SpeciesRow = {
  code: string;
  display_name: string;
  is_active: boolean;
  has_dnbp_factor: boolean;
  has_standard_weight: boolean;
};

export type ProductTypeRow = {
  code: string;
  display_name: string;
  is_active: boolean;
};

export type NewEntry = {
  table_key:
    | "cif_buffer_per_kg"
    | "dnbp_factor_by_species"
    | "standard_weight_by_species"
    | "bid_check_close_threshold_pct"
    | "buyer_weight_band_tolerance_pct"
    | "stale_instruction_hours"
    | "saleyard_calendar";
  key1: string | null;
  key2?: string | null;
  value: string;
  text_value?: string | null;
};

export const referenceDataApi = {
  getActive: (accessToken: string | null) => apiFetch<ActiveConfig>("/reference-data/active", auth(accessToken)),
  listVersions: (accessToken: string | null) =>
    apiFetch<ReferenceDataVersion[]>("/reference-data/versions", auth(accessToken)),
  getVersion: (id: string, accessToken: string | null) =>
    apiFetch<ReferenceDataVersionDetail>(`/reference-data/versions/${id}`, auth(accessToken)),
  createVersion: (body: { effective_from: string; note?: string; entries: NewEntry[] }, accessToken: string | null) =>
    apiFetch<ReferenceDataVersion>("/reference-data/versions", { method: "POST", body, ...auth(accessToken) }),
  previewImpact: (id: string, accessToken: string | null) =>
    apiFetch<ImpactPreview>(`/reference-data/versions/${id}/impact`, { method: "POST", ...auth(accessToken) }),
  activateVersion: (id: string, accessToken: string | null) =>
    apiFetch<ReferenceDataVersion>(`/reference-data/versions/${id}/activate`, { method: "POST", ...auth(accessToken) }),
  listSpecies: (accessToken: string | null) => apiFetch<SpeciesRow[]>("/reference-data/species", auth(accessToken)),
  createSpecies: (body: { code: string; display_name: string }, accessToken: string | null) =>
    apiFetch<SpeciesRow>("/reference-data/species", { method: "POST", body, ...auth(accessToken) }),
  listProductTypes: (accessToken: string | null) =>
    apiFetch<ProductTypeRow[]>("/reference-data/product-types", auth(accessToken)),
  createProductType: (body: { code: string; display_name: string }, accessToken: string | null) =>
    apiFetch<ProductTypeRow>("/reference-data/product-types", { method: "POST", body, ...auth(accessToken) }),
};
