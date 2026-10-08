// Mirrors backend/domain/issue_review.py — the server enforces every rule here;
// this only decides what the dialog asks for and when it lets you submit.

export const REASON_CODES: Record<string, string> = {
  COST_CONFIRMED: "Cost confirmed with Peter",
  MARKET_MOVE: "Market move expected",
  CUSTOMER_RELATIONSHIP: "Customer relationship",
  ONE_OFF_DEAL: "One-off / volume deal",
  OTHER: "Other (explain in remark)",
};

// The issues where an approval accepts a direct financial exposure.
const PRICING_ISSUE_CODES = new Set(["MARGIN_BUFFER_ERODED", "NEGATIVE_MARGIN", "DNBP_OUTLIER", "LARGE_BENCHMARK_GAP"]);

export const MIN_REMARK_LENGTH = 3;
export const MAX_REMARK_LENGTH = 1000;

export function isPricingIssue(code: string): boolean {
  return PRICING_ISSUE_CODES.has(code);
}

export function reasonLabel(code: string | null): string | null {
  return code === null ? null : (REASON_CODES[code] ?? code);
}

/** Null when the decision can be submitted, else why not. */
export function reviewInputProblem(args: {
  issueCodes: string[];
  decision: "APPROVE" | "REJECT";
  reasonCode: string | null;
  remark: string;
}): string | null {
  const remark = args.remark.trim();
  if (remark.length < MIN_REMARK_LENGTH) return "Enter a remark.";
  if (remark.length > MAX_REMARK_LENGTH) return `Keep the remark under ${MAX_REMARK_LENGTH} characters.`;
  if (args.decision === "APPROVE" && args.reasonCode === null && args.issueCodes.some(isPricingIssue)) {
    return "Choose a reason for approving a pricing warning.";
  }
  return null;
}
