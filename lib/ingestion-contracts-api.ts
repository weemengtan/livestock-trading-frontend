import { apiFetch } from "./api-client";

function auth(accessToken: string | null) {
  return { accessToken };
}

export type IngestionContractRecord = {
  id: string;
  version: string;
  required_sheet_name: string;
  active_title_tokens: string[];
  section_end_tokens: string[];
  title_scan_rows: number;
  required_columns: Record<string, string>;
  header_synonyms: Record<string, string[]>;
  header_scan_rows: number;
  min_header_matches: number;
  note: string | null;
  is_active: boolean;
  created_by: string | null;
  activated_by: string | null;
  activated_at: string | null;
  created_at: string;
};

export type NewIngestionContract = Omit<
  IngestionContractRecord,
  "id" | "is_active" | "created_by" | "activated_by" | "activated_at" | "created_at" | "note"
> & { note?: string };

export const ingestionContractsApi = {
  list: (accessToken: string | null) => apiFetch<IngestionContractRecord[]>("/ingestion-contracts", auth(accessToken)),
  fields: (accessToken: string | null) =>
    apiFetch<{ fields: string[] }>("/ingestion-contracts/fields", auth(accessToken)),
  create: (body: NewIngestionContract, accessToken: string | null) =>
    apiFetch<IngestionContractRecord>("/ingestion-contracts", { method: "POST", body, ...auth(accessToken) }),
  activate: (id: string, accessToken: string | null) =>
    apiFetch<IngestionContractRecord>(`/ingestion-contracts/${id}/activate`, { method: "POST", ...auth(accessToken) }),
};
