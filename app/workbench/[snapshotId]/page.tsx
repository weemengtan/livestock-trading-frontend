"use client";

import * as React from "react";
import { use } from "react";
import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { OrderWorkbenchGrid } from "@/components/workbench/order-workbench-grid";
import { PublishPanel } from "@/components/workbench/publish-panel";
import { useAuthStore } from "@/lib/auth-store";
import {
  type CorrectionRequest,
  type OrderLine,
  type OrderWorkings,
  type Snapshot,
  type ValidationIssue,
  workbenchApi,
} from "@/lib/workbench-api";
import { withErrorToast } from "@/lib/with-error-toast";

export default function WorkbenchSnapshotPage({ params }: { params: Promise<{ snapshotId: string }> }) {
  const { snapshotId } = use(params);

  return (
    <AuthGuard requiredRole={["OWNER", "ACCOUNTANT"]}>
      <AppShell title="Order Workbench">
        <WorkbenchContent snapshotId={snapshotId} />
      </AppShell>
    </AuthGuard>
  );
}

function WorkbenchContent({ snapshotId }: { snapshotId: string }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [snapshot, setSnapshot] = React.useState<Snapshot | null>(null);
  const [activeLines, setActiveLines] = React.useState<OrderLine[]>([]);
  const [workingsByLineId, setWorkingsByLineId] = React.useState<Map<string, OrderWorkings>>(new Map());
  const [issuesByLineId, setIssuesByLineId] = React.useState<Map<string, ValidationIssue[]>>(new Map());
  const [openCorrectionColumnsByLineId, setOpenCorrectionColumnsByLineId] = React.useState<Map<string, Set<string>>>(new Map());
  const [activeLineIds, setActiveLineIds] = React.useState<Set<string>>(new Set());
  // Starts true for the first paint; `load` only ever flips it false in its
  // `finally`, never true again synchronously inside the effect below.
  const [loading, setLoading] = React.useState(true);
  const [calculating, setCalculating] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      await withErrorToast(async () => {
        const [snap, activeLineRows, issueRows, correctionRows] = await Promise.all([
          workbenchApi.getSnapshot(snapshotId, accessToken),
          workbenchApi.listLines(snapshotId, accessToken),
          workbenchApi.listIssues(snapshotId, accessToken),
          workbenchApi.listCorrectionRequests(snapshotId, accessToken),
        ]);
        setSnapshot(snap);
        setActiveLines(activeLineRows);
        setActiveLineIds(new Set(activeLineRows.map((l) => l.id)));

        const issueMap = new Map<string, ValidationIssue[]>();
        for (const issue of issueRows) {
          issueMap.set(issue.order_line_id, [...(issueMap.get(issue.order_line_id) ?? []), issue]);
        }
        setIssuesByLineId(issueMap);

        const openMap = new Map<string, Set<string>>();
        for (const request of correctionRows as CorrectionRequest[]) {
          if (request.status !== "OPEN") continue;
          const existing = openMap.get(request.order_line_id) ?? new Set<string>();
          existing.add(request.column_ref);
          openMap.set(request.order_line_id, existing);
        }
        setOpenCorrectionColumnsByLineId(openMap);

        const workingsRows = await workbenchApi.listWorkings(snapshotId, accessToken);
        setWorkingsByLineId(new Map(workingsRows.map((w) => [w.order_line_id, w] as const)));
      });
    } finally {
      setLoading(false);
    }
  }, [snapshotId, accessToken]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const lineById = React.useMemo(() => new Map(activeLines.map((l) => [l.id, l] as const)), [activeLines]);

  async function handleCalculate() {
    setCalculating(true);
    await withErrorToast(async () => {
      await workbenchApi.calculateSnapshot(snapshotId, accessToken);
      await load();
    }, "Could not calculate this snapshot");
    setCalculating(false);
  }

  if (loading && !snapshot) {
    return <p className="text-sm text-fg-tertiary">Loading snapshot…</p>;
  }

  if (!snapshot) {
    return <EmptyState title="Snapshot not found" />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          {/* AppShell already renders the page's <h1> (its title bar) — this is the content area's own heading. */}
          <h2 className="text-xl font-semibold text-fg-primary">{snapshot.source_filename}</h2>
          <p className="mt-1 text-sm text-fg-secondary">
            <Badge variant={snapshot.status === "CALCULATED" ? "pass" : "neutral"}>{snapshot.status}</Badge>
            <span className="ml-2">SHA-256 {snapshot.source_sha256.slice(0, 12)}…</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleCalculate} disabled={calculating}>
            {calculating ? "Calculating…" : "Recalculate"}
          </Button>
        </div>
      </div>

      {snapshot.status === "CALCULATED" || snapshot.status === "PUBLISHED" || snapshot.status === "SUPERSEDED" ? (
        <PublishPanel
          snapshotId={snapshot.id}
          snapshotStatus={snapshot.status}
          activeLineIds={activeLineIds}
          issuesByLineId={issuesByLineId}
          lineById={lineById}
          onIssuesAcknowledged={(issueIds) => {
            const acknowledged = new Set(issueIds);
            setIssuesByLineId((prev) => {
              const next = new Map<string, ValidationIssue[]>();
              for (const [lineId, issues] of prev) {
                next.set(
                  lineId,
                  issues.filter((issue) => !acknowledged.has(issue.id)),
                );
              }
              return next;
            });
          }}
        />
      ) : null}

      {activeLines.length === 0 ? (
        <EmptyState title="No active orders in this snapshot" body="Try recalculating, or upload the file again." />
      ) : (
        <OrderWorkbenchGrid
          lines={activeLines}
          workingsByLineId={workingsByLineId}
          issuesByLineId={issuesByLineId}
          openCorrectionColumnsByLineId={openCorrectionColumnsByLineId}
          onCorrectionRaised={() => void load()}
        />
      )}
    </div>
  );
}
