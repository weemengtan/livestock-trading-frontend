import assert from "node:assert/strict";
import { test } from "node:test";
import { summariseReviewQueue } from "./review-queue.ts";
import type { ValidationIssue } from "./workbench-api.ts";

function issue(over: Partial<ValidationIssue> & { order_line_id: string }): ValidationIssue {
  return {
    id: `${over.order_line_id}-issue`,
    code: "MARGIN_BUFFER_ERODED",
    severity: "WARN",
    message: "",
    column_ref: null,
    acknowledged_by: null,
    acknowledged_by_email: null,
    acknowledged_at: null,
    carried_forward: false,
    approval_reason_code: null,
    approval_remark: null,
    approval_expires_at: null,
    recommendation: null,
    rejection: null,
    ...over,
  };
}

const rec = (at: string) => ({ decision: "APPROVE" as const, reason_code: null, remark: "ok", by: "u", by_email: null, at });
const rej = (at: string) => ({ remark: "no", by: "o", by_email: null, at });

test("counts open lines, recommendations and rejections separately", () => {
  const queue = summariseReviewQueue([
    issue({ order_line_id: "a" }),
    issue({ order_line_id: "b", recommendation: rec("2026-10-08T01:00:00Z") }),
    issue({ order_line_id: "c", rejection: rej("2026-10-08T02:00:00Z") }),
    issue({ order_line_id: "d", acknowledged_at: "2026-10-08T03:00:00Z" }),
    issue({ order_line_id: "e", severity: "BLOCK" }),
  ]);
  assert.deepEqual(queue, { awaitingOwner: 2, recommended: 1, rejected: 1 });
});

test("a new recommendation after a rejection puts the line back in the Owner's queue", () => {
  const queue = summariseReviewQueue([
    issue({
      order_line_id: "a",
      rejection: rej("2026-10-08T02:00:00Z"),
      recommendation: rec("2026-10-08T04:00:00Z"),
    }),
  ]);
  assert.deepEqual(queue, { awaitingOwner: 1, recommended: 1, rejected: 0 });
});
