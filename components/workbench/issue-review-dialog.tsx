"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { REASON_CODES, MAX_REMARK_LENGTH, reviewInputProblem } from "@/lib/issue-review";
import { strings } from "@/lib/strings";
import type { ValidationIssue } from "@/lib/workbench-api";
import { formatMoney } from "./format";

export type ReviewTarget = {
  lineId: string;
  label: string;
  issues: ValidationIssue[];
  /** The figures the decider is being asked to accept. */
  dnbpPerKg: string | null;
  expectedCostPerKg: string | null;
  marginPerKg: string | null;
};

const fieldClass =
  "w-full rounded-md border border-default bg-surface px-3 py-2 text-sm text-fg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring";

/**
 * One decision applied to the selected lines. An Owner's is final; an
 * Accountant's is a recommendation for the Owner — the server decides which
 * from the caller's role, this only words it accordingly.
 */
export function IssueReviewDialog({
  open,
  onOpenChange,
  isOwner,
  selfUploaded,
  targets,
  submitting,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isOwner: boolean;
  /** The reviewer uploaded this snapshot — approving it is flagged in the audit trail. */
  selfUploaded: boolean;
  targets: ReviewTarget[];
  submitting: boolean;
  onSubmit: (input: { decision: "APPROVE" | "REJECT"; reasonCode: string | null; remark: string }) => void;
}) {
  const t = strings.publication.publish.review;
  const [decision, setDecision] = React.useState<"APPROVE" | "REJECT">("APPROVE");
  const [reasonCode, setReasonCode] = React.useState<string | null>(null);
  const [remark, setRemark] = React.useState("");

  const issueCodes = targets.flatMap((target) => target.issues.map((issue) => issue.code));
  const problem = reviewInputProblem({ issueCodes, decision, reasonCode, remark });
  // Only a decision that differs from an Accountant's recommendation is an override.
  const overrides = isOwner
    ? targets.filter((target) =>
        target.issues.some((issue) => issue.recommendation && issue.recommendation.decision !== decision),
      ).length
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-screen max-w-2xl overflow-y-auto">
        <DialogTitle>{isOwner ? t.dialogTitleOwner : t.dialogTitleAccountant}</DialogTitle>
        <DialogDescription>{isOwner ? t.dialogBodyOwner : t.dialogBodyAccountant}</DialogDescription>

        <p className="mt-4 text-sm font-semibold text-fg-primary">{t.figuresHeading}</p>
        <div className="mt-2 flex flex-col gap-2">
          {targets.map((target) => {
            const recommendation = target.issues.find((issue) => issue.recommendation)?.recommendation;
            return (
              <div key={target.lineId} className="rounded-md border border-subtle px-3 py-2 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <span className="font-semibold text-fg-primary">{target.label}</span>
                  <span data-numeric className="text-fg-secondary">
                    {t.dnbp} ${formatMoney(target.dnbpPerKg)}
                    {t.perKg} · {t.livestockCost} ${formatMoney(target.expectedCostPerKg)}
                    {t.perKg} · {t.margin} ${formatMoney(target.marginPerKg)}
                    {t.perKg}
                  </span>
                </div>
                {isOwner ? (
                  <p className="mt-1 text-xs text-fg-tertiary">
                    {recommendation
                      ? `${t.recommended}: ${recommendation.decision === "APPROVE" ? t.approve : t.reject} ${t.recommendationBy} ${recommendation.by_email ?? "—"} — “${recommendation.remark ?? ""}”`
                      : t.noRecommendation}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>

        <fieldset className="mt-4">
          <legend className="text-sm font-semibold text-fg-primary">{t.decision}</legend>
          <div className="mt-2 flex gap-4 text-sm">
            {(["APPROVE", "REJECT"] as const).map((value) => (
              <label key={value} className="flex items-center gap-2 text-fg-primary">
                <input
                  type="radio"
                  name="review-decision"
                  className="accent-accent-default"
                  checked={decision === value}
                  onChange={() => setDecision(value)}
                />
                {value === "APPROVE" ? t.approve : t.reject}
              </label>
            ))}
          </div>
        </fieldset>

        {decision === "APPROVE" ? (
          <label className="mt-4 block text-sm">
            <span className="font-semibold text-fg-primary">{t.reason}</span>
            <select
              className={`${fieldClass} mt-1 h-9`}
              value={reasonCode ?? ""}
              onChange={(e) => setReasonCode(e.target.value === "" ? null : e.target.value)}
            >
              <option value="">{t.reasonPlaceholder}</option>
              {Object.entries(REASON_CODES).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="mt-4 block text-sm">
          <span className="font-semibold text-fg-primary">{t.remark}</span>
          <textarea
            className={`${fieldClass} mt-1 min-h-20`}
            value={remark}
            maxLength={MAX_REMARK_LENGTH}
            placeholder={t.remarkPlaceholder}
            onChange={(e) => setRemark(e.target.value)}
          />
        </label>

        {overrides > 0 ? (
          <p className="mt-3 text-sm text-status-close-fg">{t.overrideNote.replace("{count}", String(overrides))}</p>
        ) : null}
        {isOwner && selfUploaded && decision === "APPROVE" ? (
          <p className="mt-3 text-sm text-status-close-fg">{t.selfApprovalNote}</p>
        ) : null}

        <div className="mt-5 flex items-center justify-end gap-2">
          <DialogClose asChild>
            <Button variant="secondary" disabled={submitting}>
              {t.cancel}
            </Button>
          </DialogClose>
          <Button
            disabled={submitting || problem !== null}
            title={problem ?? undefined}
            onClick={() => onSubmit({ decision, reasonCode: decision === "APPROVE" ? reasonCode : null, remark: remark.trim() })}
          >
            {submitting ? t.submitting : isOwner ? t.submitOwner : t.submitAccountant}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
