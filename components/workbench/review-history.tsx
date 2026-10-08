"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { DateTime } from "@/components/ui/date-time";
import { ApiError } from "@/lib/api-client";
import { reasonLabel } from "@/lib/issue-review";
import { publicationsApi, type ReviewAuditEntry } from "@/lib/publications-api";
import { strings } from "@/lib/strings";

const ACTION_LABEL: Record<ReviewAuditEntry["action"], string> = {
  "issue_review.recommended": strings.publication.publish.review.recommendedAction,
  "issue_review.approved": strings.publication.publish.review.approvedAction,
  "issue_review.rejected": strings.publication.publish.review.rejectedAction,
};

/**
 * The snapshot's review trail, read from the append-only audit log: who
 * recommended, approved or rejected which warning, when, why, and the figures
 * they were looking at. Fetched on first expand and again after each decision
 * (`refreshKey`).
 */
export function ReviewHistory({
  snapshotId,
  accessToken,
  refreshKey,
}: {
  snapshotId: string;
  accessToken: string | null;
  refreshKey: number;
}) {
  const t = strings.publication.publish.review;
  const [expanded, setExpanded] = React.useState(false);
  const [entries, setEntries] = React.useState<ReviewAuditEntry[] | null>(null);
  const [failed, setFailed] = React.useState<string | null>(null);

  // Fetched up front, not on expand, so the header can say whether there is
  // anything to open before anyone clicks.
  React.useEffect(() => {
    let cancelled = false;
    publicationsApi
      .listReviewAudit(snapshotId, accessToken)
      .then((rows) => {
        if (cancelled) return;
        setEntries(rows);
        setFailed(null);
      })
      .catch((err) => {
        if (!cancelled) setFailed(err instanceof ApiError ? err.message : t.historyFailed);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch on mount / after a decision, not on token identity changes
  }, [snapshotId, refreshKey]);

  const count = entries?.length ?? 0;
  const latest = entries?.[0];
  const canOpen = count > 0;

  return (
    <div className="mt-4 border-t border-subtle pt-3">
      <button
        type="button"
        onClick={() => canOpen && setExpanded((v) => !v)}
        aria-expanded={canOpen ? expanded : undefined}
        aria-controls="publish-review-history"
        disabled={!canOpen}
        className="flex w-full items-center justify-between gap-3 rounded-md border border-subtle bg-sunken px-3 py-2.5 text-left enabled:hover:border-default disabled:cursor-default"
      >
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold text-fg-primary">
            {t.historyTitle}
            {entries !== null ? (
              <Badge variant={canOpen ? "accent" : "neutral"}>
                {canOpen ? t.historyCount.replace("{count}", String(count)) : t.historyNone}
              </Badge>
            ) : null}
          </p>
          {latest && !expanded ? (
            <p className="mt-0.5 truncate text-xs text-fg-tertiary">
              {t.historyLatest}: {ACTION_LABEL[latest.action]}
              {latest.after?.decision && latest.action === "issue_review.recommended"
                ? ` ${latest.after.decision === "APPROVE" ? t.approve : t.reject}`
                : ""}{" "}
              · {latest.actor_email ?? "—"} · <DateTime value={latest.at} />
            </p>
          ) : null}
        </div>
        {canOpen ? (
          <span className="shrink-0 whitespace-nowrap text-xs font-medium text-accent-default">
            {expanded ? t.hideDetails : t.showDetails}
          </span>
        ) : null}
      </button>
      {failed ? <p className="mt-2 text-sm text-status-breach-fg">{failed}</p> : null}
      {expanded && canOpen ? (
        <div id="publish-review-history" className="mt-2 flex flex-col gap-2">
          {entries?.map((entry) => {
              const a = entry.after;
              const reason = reasonLabel(a?.reason_code ?? null);
              return (
                <div key={entry.id} className="rounded-md border border-subtle px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Badge variant={entry.action === "issue_review.rejected" ? "breach" : entry.action === "issue_review.approved" ? "pass" : "neutral"}>
                      {ACTION_LABEL[entry.action]}
                    </Badge>
                    {a?.decision && entry.action === "issue_review.recommended" ? (
                      <Badge variant="neutral">{a.decision === "APPROVE" ? t.approve : t.reject}</Badge>
                    ) : null}
                    <span className="font-semibold text-fg-primary">
                      Line {a?.line_no ?? "—"}
                      {a?.contract_no ? ` · ${a.contract_no}` : ""}
                    </span>
                    {a?.self_approved && entry.action === "issue_review.approved" ? (
                      <Badge variant="close">{t.selfApproved}</Badge>
                    ) : null}
                    {a?.overrides_recommendation ? <Badge variant="close">{t.overrode}</Badge> : null}
                  </div>
                  {reason ? <p className="mt-1 text-fg-secondary">{reason}</p> : null}
                  {a?.remark ? <p className="mt-1 text-fg-secondary">“{a.remark}”</p> : null}
                  <p className="mt-1 text-xs text-fg-tertiary">
                    {entry.actor_email ?? "—"} ({a?.actor_role ?? "—"}) · <DateTime value={entry.at} />
                    {a?.figures?.dnbp_per_kg
                      ? ` · DNBP $${Number(a.figures.dnbp_per_kg).toFixed(2)}/kg`
                      : ""}
                  </p>
                </div>
              );
            })}
        </div>
      ) : null}
    </div>
  );
}
