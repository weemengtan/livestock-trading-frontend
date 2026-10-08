import { apiFetch } from "./api-client";
import { TicketSocket } from "./ws-client";
import type { ValidationIssue } from "./workbench-api";

export type ReviewIssuesBody = {
  issue_ids: string[];
  decision: "APPROVE" | "REJECT";
  reason_code?: string | null;
  remark: string;
};

/** One row of a snapshot's review trail, straight from the append-only audit log. */
export type ReviewAuditEntry = {
  id: string;
  action: "issue_review.recommended" | "issue_review.approved" | "issue_review.rejected";
  at: string;
  actor_email: string | null;
  after: {
    issue_id: string;
    line_no: number | null;
    contract_no: string | null;
    issue_code: string;
    tier: "RECOMMENDATION" | "FINAL";
    decision: "APPROVE" | "REJECT";
    reason_code: string | null;
    remark: string;
    actor_role: string;
    self_approved: boolean;
    overrides_recommendation: boolean;
    figures: Record<string, string | null>;
  } | null;
};

export type PublicationLine = {
  id: string;
  publication_id: string;
  species: string;
  dnbp_per_kg: string;
  previous_dnbp_per_kg: string | null;
  target_heads: string | null;
  target_weight_kg_min: string | null;
  target_weight_kg_max: string | null;
  contributing_line_ids: string[];
};

export type DeliveryState = {
  buyer_id: string;
  buyer_email: string;
  delivered_at: string | null;
  acknowledged_at: string | null;
  channel: string | null;
  is_overdue: boolean;
  escalated_at: string | null;
};

export type Publication = {
  id: string;
  org_id: string;
  snapshot_id: string;
  published_by: string;
  published_at: string;
  effective_from: string;
  engine_version: string;
  notes: string | null;
  superseded_by: string | null;
  superseded_at: string | null;
  buyer_notified: boolean;
  lines: PublicationLine[];
};

export type PublicationDetail = Publication & { deliveries: DeliveryState[] };

// Matches backend/schemas/publications.py::SpeciesProgressResponse. Same
// underlying compute_species_progress as the buyer's own
// GET /buyer/dnbp/current — see services/buying_progress_service.py.
export type SpeciesProgressLine = {
  species: string;
  target_heads: string | null;
  heads_bought: number;
};

export type SpeciesProgress = {
  publication_id: string;
  species: SpeciesProgressLine[];
};

function auth(accessToken: string | null) {
  return { accessToken };
}

export const publicationsApi = {
  publish: (snapshotId: string, notes: string | undefined, accessToken: string | null) =>
    apiFetch<PublicationDetail>("/publications", {
      method: "POST",
      body: { snapshot_id: snapshotId, notes },
      ...auth(accessToken),
    }),

  list: (accessToken: string | null) => apiFetch<Publication[]>("/publications", auth(accessToken)),

  getCurrent: (accessToken: string | null) => apiFetch<PublicationDetail>("/publications/current", auth(accessToken)),

  get: (id: string, accessToken: string | null) => apiFetch<PublicationDetail>(`/publications/${id}`, auth(accessToken)),

  getCurrentProgress: (accessToken: string | null) =>
    apiFetch<SpeciesProgress>("/publications/current/progress", auth(accessToken)),

  // One request for the whole selection — a snapshot can carry hundreds of
  // issues, and one call each would blow past the backend's general rate limit.
  // The caller's role decides the tier server-side: an OWNER's decision is final,
  // an ACCOUNTANT's is a recommendation.
  reviewIssues: (snapshotId: string, body: ReviewIssuesBody, accessToken: string | null) =>
    apiFetch<ValidationIssue[]>(`/snapshots/${snapshotId}/issues/review`, {
      method: "POST",
      body,
      ...auth(accessToken),
    }),

  listReviewAudit: (snapshotId: string, accessToken: string | null) =>
    apiFetch<ReviewAuditEntry[]>(`/snapshots/${snapshotId}/review-audit`, auth(accessToken)),

  getWsTicket: (accessToken: string | null) => apiFetch<{ ticket: string }>("/ws/ticket", { method: "POST", ...auth(accessToken) }),
};

/** §9.9/§10/§11.5 — the console's live delivery tracker. */
export function connectConsoleSocket(
  getAccessToken: () => string | null,
  onEvent: (event: string, data: unknown) => void,
  onReconnect: () => void
): TicketSocket {
  const socket = new TicketSocket(
    "/ws/console",
    async () => (await publicationsApi.getWsTicket(getAccessToken())).ticket,
    onEvent,
    onReconnect
  );
  void socket.connect();
  return socket;
}
