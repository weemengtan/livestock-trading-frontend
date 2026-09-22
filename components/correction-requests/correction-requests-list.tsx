"use client";

import * as React from "react";
import { DateTime } from "@/components/ui/date-time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { useAuthStore } from "@/lib/auth-store";
import { strings } from "@/lib/strings";
import { workbenchApi, type CorrectionRequest } from "@/lib/workbench-api";

function statusVariant(status: CorrectionRequest["status"]) {
  if (status === "OPEN") return "close" as const;
  if (status === "RESOLVED") return "pass" as const;
  return "neutral" as const;
}

export function CorrectionRequestsList() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [requests, setRequests] = React.useState<CorrectionRequest[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [withdrawing, setWithdrawing] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      setRequests(await workbenchApi.listAllCorrectionRequests(accessToken));
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function handleWithdraw(id: string) {
    setWithdrawing(id);
    try {
      await workbenchApi.withdrawCorrectionRequest(id, accessToken);
      await load();
    } finally {
      setWithdrawing(null);
    }
  }

  if (loading) return <p className="text-sm text-fg-tertiary">Loading…</p>;
  if (requests.length === 0) return <EmptyState title={strings.correctionRequests.empty} />;

  const bySnapshot = new Map<string, CorrectionRequest[]>();
  for (const request of requests) {
    bySnapshot.set(request.snapshot_id, [...(bySnapshot.get(request.snapshot_id) ?? []), request]);
  }

  return (
    <div className="flex flex-col gap-4">
      {Array.from(bySnapshot.entries()).map(([snapshotId, rows]) => (
        <Card key={snapshotId}>
          <p className="text-xs font-medium uppercase tracking-wide text-fg-tertiary">Snapshot {snapshotId.slice(0, 8)}…</p>
          <div className="mt-3 flex flex-col gap-2">
            {rows.map((request) => (
              <div
                key={request.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-subtle px-3 py-2 text-sm"
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={statusVariant(request.status)}>{request.status}</Badge>
                    <span className="font-medium">{request.column_ref}</span>
                    <span className="text-fg-tertiary">{request.issue_code}</span>
                  </div>
                  {request.detail ? <p className="text-fg-secondary">{request.detail}</p> : null}
                  <p className="text-xs text-fg-tertiary">
                    Raised {<DateTime value={request.raised_at} />}
                    {request.resolved_by_snapshot_id ? ` — ${strings.correctionRequests.autoResolved}` : ""}
                  </p>
                </div>
                {request.status === "OPEN" ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={withdrawing === request.id}
                    onClick={() => handleWithdraw(request.id)}
                  >
                    {strings.correctionRequests.withdraw}
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
