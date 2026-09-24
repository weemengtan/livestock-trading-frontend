import { apiFetch } from "./api-client";

export type ValueSource = "FORMULA" | "HAND_SET";
export type BenchmarkMethod = "GAYAN_FIXED_COST" | "FINANCIER_MARGIN" | "UNKNOWN";
export type IssueSeverity = "BLOCK" | "CORRECTION" | "WARN" | "INFO";
export type SnapshotStatus = "PARSED" | "CALCULATED" | "PUBLISHED" | "SUPERSEDED";
export type CorrectionStatus = "OPEN" | "RESOLVED" | "WITHDRAWN";

export type Snapshot = {
  id: string;
  org_id: string;
  uploaded_by: string;
  source_filename: string;
  source_sha256: string;
  detected_layout: Record<string, unknown>;
  parser_version: string;
  status: SnapshotStatus;
  created_at: string;
};

export type IngestionContract = {
  version: string;
  required_sheet_name: string;
};

export type UploadPreview = {
  preview_id: string;
  detected_layout: Record<string, unknown>;
  active_count: number;
  diff: {
    summary: { new_count: number; changed_count: number; removed_count: number };
    new_lines: { contract_no: string | null; species: string | null }[];
    changed_lines: { identity_key: (string | null)[]; changes: { field: string; previous: unknown; current: unknown }[] }[];
  };
  duplicate_of_current: { snapshot_id: string; uploaded_by_email: string; uploaded_at: string } | null;
};

export type CalculateSummary = {
  active_lines_computed: number;
  blocked_issues: number;
  correction_issues: number;
  warnings: number;
  correction_requests_auto_resolved: number;
};

// §5.1 — received A-V, verbatim, plus per-column provenance.
export type OrderLine = {
  id: string;
  snapshot_id: string;
  line_no: number;
  contract_no: string | null;
  customer_name: string | null;
  species: string | null;
  loadout_date: string | null;
  qty_kg: string | null;
  avg_price_aud: string | null;
  amount_aud: string | null;
  product_type: string | null;
  incoterm: string | null;
  nrv_per_kg: string | null;
  expected_livestock_cost_per_kg: string | null;
  pack_cost_ph: string | null;
  offal_return_ph: string | null;
  skin_return_ph: string | null;
  avg_weight_kg: string | null;
  mom_ph: string | null;
  deposit_received: string | null;
  comments: string | null;
  dnbp_benchmark: string | null;
  benchmark_method: BenchmarkMethod | null;
  estimated_heads: string | null;
  total_livestock_cost: string | null;
  value_sources: Record<string, ValueSource>;
};

// §5.3 — computed X-AF.
export type OrderWorkings = {
  order_line_id: string;
  engine_version: string;
  ref_data_version: string;
  computed_at: string;
  adjusted_price_per_kg: string | null;
  pack_cost_per_kg: string | null;
  offal_return_per_kg: string | null;
  skin_return_per_kg: string | null;
  profit_on_peter_costs: string | null;
  bing_dnbp: string | null;
  bing_dnbp_factor_used: string | null;
  bing_dnbp_inputs: Record<string, string | null>;
  profit_on_bing_dnbp: string | null;
  diff_vs_benchmark: string | null;
  diff_vs_peter: string | null;
  supporting_analysis_complete: boolean;
};

export type DnbpProof = {
  order_line_id: string;
  avg_price_aud: string;
  cif_buffer_per_kg: string;
  dnbp_factor: string;
  bing_dnbp: string;
  engine_version: string;
  ref_data_version: string;
  computed_at: string;
  formula: string;
};

/** Which DNBP model a snapshot's workings were computed under versus the one live now. */
export type SnapshotModelStatus = {
  live_model_id: string;
  live_model_name: string;
  calculated_under: { model_id: string | null; name: string; line_count: number }[];
  /** True when any line was computed under a model other than the live one. */
  stale: boolean;
};

export type ValidationIssue = {
  id: string;
  order_line_id: string;
  code: string;
  severity: IssueSeverity;
  message: string;
  column_ref: string | null;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  carried_forward: boolean;
};

export type CorrectionRequest = {
  id: string;
  snapshot_id: string;
  order_line_id: string;
  raised_by: string;
  raised_at: string;
  column_ref: string;
  issue_code: string;
  detail: string | null;
  status: CorrectionStatus;
  resolved_by_snapshot_id: string | null;
  resolved_at: string | null;
};

function auth(accessToken: string | null) {
  return { accessToken };
}

export const workbenchApi = {
  getIngestionContract: (accessToken: string | null) =>
    apiFetch<IngestionContract>("/snapshots/ingestion-contract", auth(accessToken)),
  uploadPreview: (file: File, accessToken: string | null) => {
    const form = new FormData();
    form.append("file", file);
    return apiFetch<UploadPreview>("/snapshots/upload", { method: "POST", body: form, ...auth(accessToken) });
  },
  commitSnapshot: (previewId: string, accessToken: string | null) =>
    apiFetch<Snapshot>("/snapshots", { method: "POST", body: { preview_id: previewId }, ...auth(accessToken) }),
  listSnapshots: (accessToken: string | null) => apiFetch<Snapshot[]>("/snapshots", auth(accessToken)),
  getSnapshot: (id: string, accessToken: string | null) => apiFetch<Snapshot>(`/snapshots/${id}`, auth(accessToken)),
  calculateSnapshot: (id: string, accessToken: string | null) =>
    apiFetch<CalculateSummary>(`/snapshots/${id}/calculate`, { method: "POST", ...auth(accessToken) }),
  listLines: (snapshotId: string, accessToken: string | null) =>
    apiFetch<OrderLine[]>(`/snapshots/${snapshotId}/lines`, auth(accessToken)),
  listIssues: (snapshotId: string, accessToken: string | null) =>
    apiFetch<ValidationIssue[]>(`/snapshots/${snapshotId}/issues`, auth(accessToken)),
  getWorkings: (orderLineId: string, accessToken: string | null) =>
    apiFetch<OrderWorkings>(`/order-lines/${orderLineId}/workings`, auth(accessToken)),
  listWorkings: (snapshotId: string, accessToken: string | null) =>
    apiFetch<OrderWorkings[]>(`/snapshots/${snapshotId}/workings`, auth(accessToken)),
  getModelStatus: (snapshotId: string, accessToken: string | null) =>
    apiFetch<SnapshotModelStatus>(`/snapshots/${snapshotId}/model-status`, auth(accessToken)),
  getDnbpProof: (orderLineId: string, accessToken: string | null) =>
    apiFetch<DnbpProof>(`/order-lines/${orderLineId}/dnbp-proof`, auth(accessToken)),
  raiseCorrectionRequest: (
    orderLineId: string,
    body: { column_ref: string; issue_code: string; detail?: string },
    accessToken: string | null
  ) =>
    apiFetch<CorrectionRequest>(`/order-lines/${orderLineId}/correction-requests`, {
      method: "POST",
      body,
      ...auth(accessToken),
    }),
  listCorrectionRequests: (snapshotId: string, accessToken: string | null) =>
    apiFetch<CorrectionRequest[]>(`/correction-requests?snapshot_id=${snapshotId}`, auth(accessToken)),
  // §11.6 — the Correction Requests screen's queue spans every recent
  // snapshot, not just one, so this omits the snapshot_id filter §9.3
  // already makes optional.
  listAllCorrectionRequests: (accessToken: string | null, status?: CorrectionStatus) =>
    apiFetch<CorrectionRequest[]>(`/correction-requests${status ? `?status=${status}` : ""}`, auth(accessToken)),
  withdrawCorrectionRequest: (requestId: string, accessToken: string | null) =>
    apiFetch<CorrectionRequest>(`/correction-requests/${requestId}/withdraw`, { method: "POST", ...auth(accessToken) }),
};
