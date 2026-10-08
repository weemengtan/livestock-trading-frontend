"use client";

import * as React from "react";
import { DateTime } from "@/components/ui/date-time";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { IssueReviewDialog, type ReviewTarget } from "@/components/workbench/issue-review-dialog";
import { ReviewHistory } from "@/components/workbench/review-history";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { reasonLabel } from "@/lib/issue-review";
import { REVIEW_CHANGED_EVENT } from "@/lib/review-queue";
import { isOwnerLevel } from "@/lib/roles";
import { ApiError } from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";
import { strings } from "@/lib/strings";
import { buyInstructionsApi } from "@/lib/buy-instructions-api";
import type { OrderLine, OrderWorkings, SnapshotStatus, ValidationIssue } from "@/lib/workbench-api";
import {
  connectConsoleSocket,
  publicationsApi,
  type PublicationDetail,
  type PublicationLine,
} from "@/lib/publications-api";

function lineLabel(line: OrderLine | undefined): string {
  if (!line) return "Line —";
  const ref = line.contract_no ?? line.customer_name;
  return ref ? `Line ${line.line_no} · ${ref}` : `Line ${line.line_no}`;
}

// §11.5's own "Summary of DNBP per species with change vs the previous
// publication (▲▼ and %)" — the console's version of the same figure
// app/buyer/page.tsx's priceDelta shows, plus the percentage Bing needs to
// judge whether a move is material. Null when there's nothing to compare
// (first-ever publish for the species) or the price didn't move.
function priceChange(line: PublicationLine): { delta: number; pct: number } | null {
  if (line.previous_dnbp_per_kg === null) return null;
  const previous = Number(line.previous_dnbp_per_kg);
  const delta = Number(line.dnbp_per_kg) - previous;
  if (delta === 0 || previous === 0) return null;
  return { delta, pct: (delta / previous) * 100 };
}

/** Plain-English grouping for the Publish screen's warning chips — one label
 * per business concern rather than the raw §5.7 issue code. */
function issueCategory(code: string): string {
  switch (code) {
    case "MARGIN_BUFFER_ERODED":
    case "NEGATIVE_MARGIN":
    case "DNBP_OUTLIER":
    case "LARGE_BENCHMARK_GAP":
      return "Pricing";
    case "HAND_SET_VALUE":
      return "Hand-set";
    case "RECEIVED_VALUE_MISMATCH":
    case "RECEIVED_BENCHMARK_ABSENT":
    case "MISSING_LIVESTOCK_COST":
    case "MISSING_AVG_WEIGHT":
      return "Missing/mismatched data";
    default:
      return code
        .toLowerCase()
        .split("_")
        .map((word) => word[0].toUpperCase() + word.slice(1))
        .join(" ");
  }
}

type LineIssueGroup = {
  lineId: string;
  line: OrderLine | undefined;
  issues: ValidationIssue[];
};

function groupByLine(
  issues: ValidationIssue[],
  lineById: Map<string, OrderLine>,
): LineIssueGroup[] {
  const byLine = new Map<string, ValidationIssue[]>();
  for (const issue of issues) {
    byLine.set(issue.order_line_id, [
      ...(byLine.get(issue.order_line_id) ?? []),
      issue,
    ]);
  }
  return Array.from(byLine.entries())
    .map(([lineId, lineIssues]) => ({
      lineId,
      line: lineById.get(lineId),
      issues: lineIssues,
    }))
    .sort((a, b) => (a.line?.line_no ?? 0) - (b.line?.line_no ?? 0));
}

/**
 * §11.5's Publish screen, built functionally rather than as a pixel-perfect
 * recreation of every visual embellishment in the PRD's prose (same scope
 * discipline Phase 2 used for the Workbench itself): per-species summary,
 * per-warning acknowledgement, a confirm step, then a live delivery
 * tracker fed by /ws/console.
 */
export function PublishPanel({
  snapshotId,
  snapshotStatus,
  snapshotUploadedBy,
  activeLineIds,
  generateHeldBack = false,
  canRecalculate = true,
  issuesByLineId,
  lineById,
  workingsByLineId,
  onIssuesUpdated,
}: {
  snapshotId: string;
  /** Who uploaded the snapshot — approving your own upload is allowed but flagged. */
  snapshotUploadedBy: string;
  /** Drives the locked "Published"/"Superseded" button state below —
   * publishing is a one-way action per snapshot (the confirm dialog says
   * so), so once the snapshot itself reports PUBLISHED or SUPERSEDED, the
   * trigger button must stay disabled rather than silently re-openable.
   * Only a Recalculate (which resets the snapshot to CALCULATED) unlocks it. */
  snapshotStatus: SnapshotStatus;
  activeLineIds: Set<string>;
  /** True while the snapshot's prices come from an older DNBP model than the live one:
   * a Buy Instruction built now would carry prices the live model no longer produces,
   * so generating one waits for a recalculation (see lib/snapshot-model-rules.ts). */
  generateHeldBack?: boolean;
  /** False for a published snapshot that can no longer be recalculated (its prices came from
   * an older DNBP model) — the "recalculate to publish again" hint would then be wrong. */
  canRecalculate?: boolean;
  issuesByLineId: Map<string, ValidationIssue[]>;
  lineById: Map<string, OrderLine>;
  /** The figures an approver is being asked to accept, per line. */
  workingsByLineId: Map<string, OrderWorkings>;
  /** A review only ever rewrites these issues — nothing else on the page
   * depends on them — so the parent patches its local state with the server's
   * copies instead of a full reload. */
  onIssuesUpdated: (issues: ValidationIssue[]) => void;
}) {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [selectedLineIds, setSelectedLineIds] = React.useState<Set<string>>(new Set());
  const user = useAuthStore((s) => s.user);
  const isOwner = isOwnerLevel(user?.role);
  const [reviewing, setReviewing] = React.useState(false);
  const [reviewOpen, setReviewOpen] = React.useState(false);
  const [historyKey, setHistoryKey] = React.useState(0);
  // null = not touched yet: open by default for an Owner with recommendations waiting.
  const [warningsOverride, setWarningsOverride] = React.useState<boolean | null>(null);
  const [approvedExpanded, setApprovedExpanded] = React.useState(false);
  const [creatingInstruction, setCreatingInstruction] = React.useState(false);
  const [published, setPublished] = React.useState<PublicationDetail | null>(
    null,
  );
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const alreadyPublished = snapshotStatus === "PUBLISHED" || snapshotStatus === "SUPERSEDED";

  // Hydrates `published` from the server on load/reload — without this, a
  // snapshot that was published in an earlier visit (or before a page
  // refresh) would show no record of it at all, since `published` is
  // otherwise only ever set locally by a fresh click in this same session.
  React.useEffect(() => {
    if (!alreadyPublished) return;
    let cancelled = false;
    (async () => {
      try {
        const all = await publicationsApi.list(accessToken);
        const match = all.find((p) => p.snapshot_id === snapshotId); // list is published_at desc — first match is the latest
        if (!match || cancelled) return;
        const detail = await publicationsApi.get(match.id, accessToken);
        if (!cancelled) setPublished(detail);
      } catch {
        // Best-effort — the locked button state alone still correctly
        // blocks a repeat publish even if this detail fetch fails.
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-fetch only when the snapshot's own published-ness changes, not on every accessToken identity change
  }, [alreadyPublished, snapshotId]);

  const activeIssues = React.useMemo(() => {
    const all: ValidationIssue[] = [];
    for (const [lineId, issues] of issuesByLineId) {
      if (activeLineIds.has(lineId)) all.push(...issues);
    }
    return all;
  }, [issuesByLineId, activeLineIds]);

  const blocked = activeIssues.filter((i) => i.severity === "BLOCK");
  const unacknowledged = activeIssues.filter(
    (i) =>
      (i.severity === "WARN" || i.severity === "CORRECTION") &&
      !i.acknowledged_at,
  );

  // Approved by an Owner — either just now, or carried forward automatically
  // (services/issue_acknowledgment_service.py reused a prior approval because
  // this exact concern, on this exact order, is unchanged and the approval
  // hasn't lapsed). Never in `unacknowledged`, so shown separately rather than
  // silently disappearing, for trust in the decision and the automation.
  const approved = activeIssues.filter(
    (i) =>
      (i.severity === "WARN" || i.severity === "CORRECTION") &&
      i.acknowledged_at,
  );
  const rejected = unacknowledged.filter((i) => i.rejection);
  const recommendedLineCount = new Set(
    unacknowledged.filter((i) => i.recommendation).map((i) => i.order_line_id),
  ).size;
  const warningsExpanded = warningsOverride ?? (isOwner && recommendedLineCount > 0);

  const lineGroups = React.useMemo<LineIssueGroup[]>(
    () => groupByLine(unacknowledged, lineById),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unacknowledged is derived fresh from activeIssues every render; keying off it directly would memo nothing
    [issuesByLineId, activeLineIds, lineById],
  );

  const approvedGroups = React.useMemo<LineIssueGroup[]>(
    () => groupByLine(approved, lineById),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- same reasoning as lineGroups above
    [issuesByLineId, activeLineIds, lineById],
  );

  const categoryCounts = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const issue of unacknowledged) {
      const category = issueCategory(issue.code);
      counts.set(category, (counts.get(category) ?? 0) + 1);
    }
    return counts;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see lineGroups
  }, [issuesByLineId, activeLineIds]);

  React.useEffect(() => {
    if (!published) return undefined;
    const socket = connectConsoleSocket(
      () => useAuthStore.getState().accessToken,
      (event, data) => {
        if (
          event === "delivery.updated" &&
          (data as { publication_id: string }).publication_id === published.id
        ) {
          publicationsApi
            .get(published.id, accessToken)
            .then(setPublished)
            .catch(() => {});
        }
      },
      () => {
        publicationsApi
          .get(published.id, accessToken)
          .then(setPublished)
          .catch(() => {});
      },
    );
    return () => socket.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-subscribe when the published id itself changes
  }, [published?.id]);

  const selectAllRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate =
        selectedLineIds.size > 0 && selectedLineIds.size < lineGroups.length;
    }
  }, [selectedLineIds, lineGroups.length]);

  function toggleLine(lineId: string) {
    setSelectedLineIds((prev) => {
      const next = new Set(prev);
      if (next.has(lineId)) next.delete(lineId);
      else next.add(lineId);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedLineIds((prev) =>
      prev.size === lineGroups.length ? new Set() : new Set(lineGroups.map((g) => g.lineId)),
    );
  }

  const reviewTargets = React.useMemo<ReviewTarget[]>(
    () =>
      lineGroups
        .filter((g) => selectedLineIds.has(g.lineId))
        .map((g) => {
          const workings = workingsByLineId.get(g.lineId);
          return {
            lineId: g.lineId,
            label: lineLabel(g.line),
            issues: g.issues,
            dnbpPerKg: workings?.bing_dnbp ?? null,
            expectedCostPerKg: g.line?.expected_livestock_cost_per_kg ?? null,
            marginPerKg: workings?.profit_on_bing_dnbp ?? null,
          };
        }),
    [lineGroups, selectedLineIds, workingsByLineId],
  );

  async function handleReview(input: {
    decision: "APPROVE" | "REJECT";
    reasonCode: string | null;
    remark: string;
  }) {
    const issueIds = reviewTargets.flatMap((target) => target.issues.map((issue) => issue.id));
    if (issueIds.length === 0) return;
    setReviewing(true);
    try {
      const updated = await publicationsApi.reviewIssues(
        snapshotId,
        {
          issue_ids: issueIds,
          decision: input.decision,
          reason_code: input.reasonCode,
          remark: input.remark,
        },
        accessToken,
      );
      onIssuesUpdated(updated);
      setSelectedLineIds(new Set());
      setReviewOpen(false);
      setHistoryKey((k) => k + 1);
      window.dispatchEvent(new Event(REVIEW_CHANGED_EVENT));
      const r = strings.publication.publish.review;
      toast({
        title: !isOwner ? r.recommendedToast : input.decision === "APPROVE" ? r.approvedToast : r.rejectedToast,
      });
    } catch (err) {
      toast({
        title: strings.publication.publish.review.couldNotReview,
        description: err instanceof ApiError ? err.message : undefined,
        variant: "danger",
      });
    } finally {
      setReviewing(false);
    }
  }

  // This used to publish the DNBP straight to every buyer. It no longer
  // does — a DnbpPublication must never exist without an already-approved
  // Buy Instruction behind it, so this only stages that instruction (the
  // BLOCK/WARN gate above still fully applies here, same as it did for the
  // old direct publish) and hands off to its approval workflow. The actual
  // publish-to-buyer action now lives on the instruction's own page, gated
  // on approval — see buy_instruction_service.publish on the backend.
  async function handleCreateInstruction() {
    setCreatingInstruction(true);
    try {
      const instruction = await buyInstructionsApi.generate({ snapshot_id: snapshotId }, accessToken);
      setDialogOpen(false);
      toast({ title: `${instruction.instruction_no} created` });
      router.push(`/buy-instructions/${instruction.id}`);
    } catch {
      toast({ title: "Could not create Buy Instruction", variant: "danger" });
    } finally {
      setCreatingInstruction(false);
    }
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold text-fg-primary">
        {strings.publication.publish.title}
      </h2>

      {approvedGroups.length > 0 ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setApprovedExpanded((v) => !v)}
            aria-expanded={approvedExpanded}
            aria-controls="publish-approved-detail"
            className="flex w-full items-center justify-between gap-3 rounded-md border-l-4 border-status-pass-border bg-status-pass-bg px-3 py-2.5 text-left"
          >
            <div className="flex items-start gap-2">
              <span
                aria-hidden="true"
                className="mt-0.5 text-base leading-none text-status-pass-fg"
              >
                ✓
              </span>
              <div>
                <p className="text-sm font-semibold text-status-pass-fg">
                  {strings.publication.publish.carriedForwardTitle}
                </p>
                <p className="mt-0.5 text-sm text-fg-secondary">
                  <span className="font-semibold text-fg-primary">
                    {approvedGroups.length}
                  </span>{" "}
                  line
                  {approvedGroups.length === 1 ? "" : "s"} approved
                </p>
              </div>
            </div>
            <span className="shrink-0 whitespace-nowrap text-xs font-medium text-accent-default">
              {approvedExpanded ? "Hide details ▾" : "Show details ▸"}
            </span>
          </button>
          {approvedExpanded ? (
            <div id="publish-approved-detail" className="mt-2 flex flex-col gap-2">
              {approvedGroups.map((group) => {
                const label = lineLabel(group.line);
                return (
                  <div
                    key={group.lineId}
                    className="flex items-start gap-3 rounded-md border border-subtle px-3 py-2.5 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-semibold text-fg-primary">
                          {label}
                        </span>
                        {group.line?.species ? (
                          <Badge variant="neutral">{group.line.species}</Badge>
                        ) : null}
                        <Badge variant="pass">
                          {group.issues[0]?.carried_forward
                            ? strings.publication.publish.carriedForwardBadge
                            : strings.publication.publish.review.approvedBadge}
                        </Badge>
                      </div>
                      <p className="mt-1.5 text-fg-secondary">
                        {group.issues.map((issue) => issue.message).join(" · ")}
                      </p>
                      {group.issues[0]?.acknowledged_at ? (
                        <p className="mt-1 text-xs text-fg-tertiary">
                          {strings.publication.publish.review.approvedBy}{" "}
                          {group.issues[0].acknowledged_by_email ?? "—"} ·{" "}
                          <DateTime value={group.issues[0].acknowledged_at} dateOnly />
                          {reasonLabel(group.issues[0].approval_reason_code)
                            ? ` · ${reasonLabel(group.issues[0].approval_reason_code)}`
                            : ""}
                          {group.issues[0].approval_remark ? ` — “${group.issues[0].approval_remark}”` : ""}
                          {group.issues[0].approval_expires_at ? (
                            <>
                              {" "}
                              · {strings.publication.publish.review.validUntil}{" "}
                              <DateTime value={group.issues[0].approval_expires_at} dateOnly />
                            </>
                          ) : null}
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      {alreadyPublished ? (
        <div className="mt-3 flex flex-col gap-2">
          <Button variant="secondary" disabled className="w-fit">
            {snapshotStatus === "SUPERSEDED"
              ? strings.publication.publish.supersededButton
              : strings.publication.publish.alreadyPublishedButton}
          </Button>
          {published ? (
            <p className="text-sm text-fg-tertiary">
              {strings.publication.publish.alreadyPublishedAt}{" "}
              {<DateTime value={published.published_at} />}
            </p>
          ) : null}
          <p className="text-sm text-fg-tertiary">
            {snapshotStatus === "SUPERSEDED"
              ? strings.publication.publish.supersededNote
              : canRecalculate
                ? strings.publication.publish.recalculateToRepublish
                : strings.publication.publish.uploadAgainToReprice}
          </p>
        </div>
      ) : blocked.length > 0 ? (
        <p className="mt-2 text-sm font-medium text-status-breach-fg">
          {strings.publication.publish.blocked}
        </p>
      ) : unacknowledged.length > 0 ? (
        <div className="mt-3 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setWarningsOverride(!warningsExpanded)}
            aria-expanded={warningsExpanded}
            aria-controls="publish-warnings-detail"
            className="flex w-full items-center justify-between gap-3 rounded-md border-l-4 border-status-close-border bg-status-close-bg px-3 py-2.5 text-left"
          >
            <div className="flex items-start gap-2">
              <span
                aria-hidden="true"
                className="mt-0.5 text-base leading-none text-status-close-fg"
              >
                ▲
              </span>
              <div>
                <p className="text-sm font-semibold text-status-close-fg">
                  {isOwner ? strings.publication.publish.review.titleOwner : strings.publication.publish.review.titleAccountant}
                </p>
                <p className="mt-0.5 text-sm text-fg-secondary">
                  <span className="font-semibold text-fg-primary">
                    {lineGroups.length}
                  </span>{" "}
                  line
                  {lineGroups.length === 1 ? "" : "s"} need attention —{" "}
                  {Array.from(categoryCounts.entries())
                    .map(
                      ([category, count]) =>
                        `${count} ${category.toLowerCase()}`,
                    )
                    .join(" · ")}
                  {recommendedLineCount > 0
                    ? ` · ${strings.publication.publish.review.recommendedCount.replace("{count}", String(recommendedLineCount))}`
                    : ""}
                  {rejected.length > 0
                    ? ` · ${new Set(rejected.map((i) => i.order_line_id)).size} ${strings.publication.publish.review.rejectedCount}`
                    : ""}
                </p>
              </div>
            </div>
            <span className="shrink-0 whitespace-nowrap text-xs font-medium text-accent-default">
              {warningsExpanded
                ? strings.publication.publish.review.hideDetails
                : isOwner
                  ? strings.publication.publish.review.reviewNow
                  : strings.publication.publish.review.showDetails}
            </span>
          </button>
          {warningsExpanded ? (
            <div id="publish-warnings-detail" className="flex flex-col gap-2">
              {!isOwner ? (
                <p className="text-sm text-fg-secondary">{strings.publication.publish.review.ownerOnlyNote}</p>
              ) : null}
              <div className="flex items-center justify-between gap-3 border-b border-subtle pb-2">
                <label className="flex items-center gap-2 text-sm text-fg-secondary">
                  <Checkbox
                    ref={selectAllRef}
                    checked={lineGroups.length > 0 && selectedLineIds.size === lineGroups.length}
                    onChange={toggleSelectAll}
                    aria-label={strings.publication.publish.selectAll}
                  />
                  {strings.publication.publish.selectAll}
                </label>
                <Button size="sm" onClick={() => setReviewOpen(true)} disabled={selectedLineIds.size === 0 || reviewing}>
                  {`${isOwner ? strings.publication.publish.review.selectedOwner : strings.publication.publish.review.selectedAccountant} (${selectedLineIds.size})`}
                </Button>
              </div>
              {lineGroups.map((group) => {
                const label = lineLabel(group.line);
                const chips = new Map<string, "close" | "neutral">();
                for (const issue of group.issues) {
                  const category = issueCategory(issue.code);
                  if (!chips.has(category))
                    chips.set(
                      category,
                      issue.severity === "WARN" ? "close" : "neutral",
                    );
                }
                return (
                  <div
                    key={group.lineId}
                    className="flex items-start gap-3 rounded-md border border-subtle px-3 py-2.5 text-sm"
                  >
                    <Checkbox
                      checked={selectedLineIds.has(group.lineId)}
                      onChange={() => toggleLine(group.lineId)}
                      disabled={reviewing}
                      aria-label={`${isOwner ? strings.publication.publish.review.selectedOwner : strings.publication.publish.review.selectedAccountant}: ${label}`}
                      className="mt-0.5"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-semibold text-fg-primary">
                          {label}
                        </span>
                        {group.line?.species ? (
                          <Badge variant="neutral">{group.line.species}</Badge>
                        ) : null}
                        {Array.from(chips.entries()).map(
                          ([category, variant]) => (
                            <Badge key={category} variant={variant}>
                              {category}
                            </Badge>
                          ),
                        )}
                      </div>
                      <p className="mt-1.5 text-fg-secondary">
                        {group.issues.map((issue) => issue.message).join(" · ")}
                      </p>
                      {(() => {
                        const rec = group.issues.find((i) => i.recommendation)?.recommendation;
                        if (!rec) return null;
                        const r = strings.publication.publish.review;
                        return (
                          <p className="mt-1.5 text-xs text-fg-tertiary">
                            {r.recommended}: {rec.decision === "APPROVE" ? r.approve : r.reject} {r.recommendationBy}{" "}
                            {rec.by_email ?? "—"} — “{rec.remark ?? ""}”
                          </p>
                        );
                      })()}
                      {group.issues.some((i) => i.rejection) ? (
                        <p className="mt-1.5 text-xs font-medium text-status-breach-fg">
                          {strings.publication.publish.review.rejectedBy}{" "}
                          {group.issues.find((i) => i.rejection)!.rejection!.by_email ?? "—"} — “
                          {group.issues.find((i) => i.rejection)!.rejection!.remark ?? ""}”.{" "}
                          {strings.publication.publish.review.rejectedHint}
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="mt-3" disabled={activeLineIds.size === 0 || generateHeldBack}>
              {strings.buyInstructions.generate}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>{strings.buyInstructions.generate}</DialogTitle>
            <DialogDescription>
              This creates a Buy Instruction from the current calculation for
              review and approval. The Do Not Buy Price is not sent to buyers
              yet — that only happens once an OWNER approves the instruction
              and publishes it from its own page.
            </DialogDescription>
            <div className="mt-4 flex justify-end gap-2">
              <DialogClose asChild>
                <Button variant="secondary">Cancel</Button>
              </DialogClose>
              <Button onClick={handleCreateInstruction} disabled={creatingInstruction}>
                {creatingInstruction ? strings.buyInstructions.generating : strings.buyInstructions.generate}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {published ? (
        <div className="mt-6 border-t border-subtle pt-4">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-fg-primary">
            {strings.publication.publish.summaryTitle}
            <InfoTooltip
              label="About the price change shown per species"
              what={strings.publication.publish.tooltips.priceChange.what}
              how={strings.publication.publish.tooltips.priceChange.how}
            />
          </p>
          <Badge variant={published.buyer_notified ? "pass" : "neutral"} className="mt-2">
            {published.buyer_notified
              ? strings.publication.publish.buyerNotified
              : strings.publication.publish.buyerNotNotified}
          </Badge>
          <div className="mt-2 flex flex-col gap-1">
            {published.lines.map((line) => {
              const change = priceChange(line);
              return (
                <div
                  key={line.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="font-medium">{line.species}</span>
                  <span className="flex items-baseline gap-2">
                    <span data-numeric>
                      ${Number(line.dnbp_per_kg).toFixed(2)}/kg
                    </span>
                    {change ? (
                      <span data-numeric className="text-xs text-fg-tertiary">
                        {change.delta > 0 ? "▲" : "▼"} {change.delta > 0 ? "+" : "−"}
                        {Math.abs(change.delta).toFixed(2)} ({change.pct > 0 ? "+" : "−"}
                        {Math.abs(change.pct).toFixed(1)}%)
                      </span>
                    ) : null}
                  </span>
                </div>
              );
            })}
          </div>

          <p className="mt-4 text-sm font-semibold text-fg-primary">
            {strings.publication.publish.deliveryTitle}
          </p>
          <div className="mt-2 flex flex-col gap-1">
            {published.deliveries.length === 0 ? (
              <p className="text-sm text-fg-tertiary">No active buyers yet.</p>
            ) : (
              published.deliveries.map((delivery) => (
                <div
                  key={delivery.buyer_id}
                  className="flex items-center justify-between text-sm"
                >
                  <span>{delivery.buyer_email}</span>
                  <Badge
                    variant={
                      delivery.acknowledged_at
                        ? "pass"
                        : delivery.is_overdue
                          ? "breach"
                          : "neutral"
                    }
                  >
                    {delivery.acknowledged_at ? (
                      <>
                        {strings.publication.publish.delivered} ✓ <DateTime value={delivery.acknowledged_at} />
                      </>
                    ) : (
                      strings.publication.publish.notYetSeen
                    )}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}

      <IssueReviewDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        isOwner={isOwner}
        selfUploaded={user?.id === snapshotUploadedBy}
        targets={reviewTargets}
        submitting={reviewing}
        onSubmit={handleReview}
      />
      <ReviewHistory snapshotId={snapshotId} accessToken={accessToken} refreshKey={historyKey} />
    </Card>
  );
}
