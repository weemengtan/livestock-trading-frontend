import assert from "node:assert/strict";
import { test } from "node:test";
import { isPricingIssue, reviewInputProblem } from "./issue-review.ts";

test("a remark is always required", () => {
  assert.ok(reviewInputProblem({ issueCodes: ["HAND_SET_VALUE"], decision: "APPROVE", reasonCode: null, remark: " " }));
});

test("approving a pricing warning needs a reason", () => {
  const base = { issueCodes: ["MARGIN_BUFFER_ERODED"], decision: "APPROVE" as const, remark: "checked" };
  assert.ok(reviewInputProblem({ ...base, reasonCode: null }));
  assert.equal(reviewInputProblem({ ...base, reasonCode: "COST_CONFIRMED" }), null);
});

test("rejecting a pricing warning needs only a remark", () => {
  assert.equal(
    reviewInputProblem({ issueCodes: ["NEGATIVE_MARGIN"], decision: "REJECT", reasonCode: null, remark: "recheck" }),
    null,
  );
});

test("data-quality warnings are not pricing", () => {
  assert.equal(isPricingIssue("HAND_SET_VALUE"), false);
  assert.equal(isPricingIssue("DNBP_OUTLIER"), true);
});
