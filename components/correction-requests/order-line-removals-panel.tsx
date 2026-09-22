"use client";

import * as React from "react";
import { DateTime } from "@/components/ui/date-time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { useAuthStore } from "@/lib/auth-store";
import { orderLineRemovalsApi, type OrderLineRemoval } from "@/lib/order-line-removals-api";

const money = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" });

export function OrderLineRemovalsPanel() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [removals, setRemovals] = React.useState<OrderLineRemoval[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [openReasonFor, setOpenReasonFor] = React.useState<string | null>(null);
  const [reason, setReason] = React.useState("");
  const [acknowledging, setAcknowledging] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      setRemovals(await orderLineRemovalsApi.list(accessToken, true));
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function handleAcknowledge(id: string) {
    setAcknowledging(id);
    try {
      await orderLineRemovalsApi.acknowledge(id, reason.trim() || null, accessToken);
      setOpenReasonFor(null);
      setReason("");
      await load();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Could not acknowledge this removal", variant: "danger" });
    } finally {
      setAcknowledging(null);
    }
  }

  // Nothing unacknowledged — this panel only exists to surface something
  // that needs attention, so it stays out of the way otherwise.
  if (loading || removals.length === 0) return null;

  return (
    <Card>
      <h2 className="text-lg font-semibold text-fg-primary">Orders that disappeared</h2>
      <p className="mt-1 text-sm text-fg-secondary">
        These contracts were active in a previous snapshot and are absent from the latest one — not moved to loaded, just
        gone. Record why so there&apos;s a record of what happened.
      </p>

      <div className="mt-4 flex flex-col gap-2">
        {removals.map((removal) => (
          <div key={removal.id} className="rounded-md border border-status-close-border bg-status-close-bg p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Badge variant="close">Removed</Badge>
                  <span className="font-medium text-fg-primary">{removal.contract_no ?? "(no contract no.)"}</span>
                  <span className="text-fg-tertiary">{removal.species}</span>
                </div>
                <p className="text-fg-secondary">
                  {removal.customer_name ?? "Unknown customer"}
                  {removal.amount_aud ? ` · ${money.format(Number(removal.amount_aud))}` : ""}
                </p>
                <p className="text-xs text-fg-tertiary">Last seen active until {<DateTime value={removal.detected_at} />}</p>
              </div>
              {openReasonFor !== removal.id ? (
                <Button size="sm" variant="secondary" onClick={() => setOpenReasonFor(removal.id)}>
                  Acknowledge
                </Button>
              ) : null}
            </div>

            {openReasonFor === removal.id ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Input
                  autoFocus
                  placeholder="Why did this disappear? (optional)"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="h-9 flex-1"
                />
                <Button size="sm" disabled={acknowledging === removal.id} onClick={() => handleAcknowledge(removal.id)}>
                  {acknowledging === removal.id ? "Saving…" : "Confirm"}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setOpenReasonFor(null);
                    setReason("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </Card>
  );
}
