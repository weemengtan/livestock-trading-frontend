import type { ValidationIssue } from "./workbench-api";

/** Fired on window after a review decision, so the nav badge re-counts without a page change. */
export const REVIEW_CHANGED_EVENT = "review-queue:changed";

export type ReviewQueue = {
  /** Lines with an open warning still waiting on the Owner's decision. */
  awaitingOwner: number;
  /** Of those, how many already carry an Accountant's recommendation. */
  recommended: number;
  /** Lines the Owner rejected that are waiting to be fixed and recalculated. */
  rejected: number;
};

/** A rejection stands until an Accountant weighs in again after it. */
function isRejectedPendingFix(issue: ValidationIssue): boolean {
  if (!issue.rejection) return false;
  return !issue.recommendation || issue.rejection.at >= issue.recommendation.at;
}

/** Where the review of a snapshot's warnings stands, counted in order lines. */
export function summariseReviewQueue(issues: ValidationIssue[]): ReviewQueue {
  const open = issues.filter(
    (i) => (i.severity === "WARN" || i.severity === "CORRECTION") && !i.acknowledged_at,
  );
  const lineIds = (list: ValidationIssue[]) => new Set(list.map((i) => i.order_line_id));
  const rejectedLines = lineIds(open.filter(isRejectedPendingFix));
  const awaiting = open.filter((i) => !rejectedLines.has(i.order_line_id));
  return {
    awaitingOwner: lineIds(awaiting).size,
    recommended: lineIds(awaiting.filter((i) => i.recommendation)).size,
    rejected: rejectedLines.size,
  };
}
