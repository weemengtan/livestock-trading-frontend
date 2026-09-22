"use client";

import * as React from "react";
import { DateTime } from "@/components/ui/date-time";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useAuthStore } from "@/lib/auth-store";
import { type DnbpProof, workbenchApi } from "@/lib/workbench-api";

/**
 * §9.3 GET /order-lines/{id}/dnbp-proof, §11.3's DNBP proof panel — "the
 * artefact to screenshot when anyone questions a price." The isolated AC
 * derivation, nothing else consulted.
 */
export function DnbpProofPanel({
  orderLineId,
  open,
  onOpenChange,
}: {
  orderLineId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const accessToken = useAuthStore((s) => s.accessToken);
  // No local "loading" flag: the parent remounts this component with a
  // fresh `key={orderLineId}` (see order-workbench-grid.tsx), so `proof`
  // starting at null on every new line selection already means "loading" —
  // no synchronous setState-in-effect needed to express that.
  const [proof, setProof] = React.useState<DnbpProof | null>(null);

  React.useEffect(() => {
    if (!open || !orderLineId) return;
    let cancelled = false;
    workbenchApi
      .getDnbpProof(orderLineId, accessToken)
      .then((result) => {
        if (!cancelled) setProof(result);
      })
      .catch(() => {
        if (!cancelled) setProof(null);
      });
    return () => {
      cancelled = true;
    };
  }, [open, orderLineId, accessToken]);

  const loading = open && proof === null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogTitle>DNBP proof — Bing Do Not Buy Price</DialogTitle>
        <DialogDescription>
          The single source of truth, isolated. Three inputs only — nothing else in the submission or the workings
          block was consulted.
        </DialogDescription>

        {loading ? <p className="mt-4 text-sm text-fg-tertiary">Loading…</p> : null}

        {!loading && proof ? (
          <div className="mt-4 flex flex-col gap-4">
            <div className="rounded-md border border-strong bg-accent-subtle p-4">
              <p className="tabular-nums text-lg font-bold text-accent-default">{proof.formula}</p>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-fg-secondary">Sell price (G)</dt>
              <dd className="tabular-nums text-fg-primary">{proof.avg_price_aud}</dd>
              <dt className="text-fg-secondary">CIF buffer</dt>
              <dd className="tabular-nums text-fg-primary">{proof.cif_buffer_per_kg}</dd>
              <dt className="text-fg-secondary">DNBP factor</dt>
              <dd className="tabular-nums text-fg-primary">{proof.dnbp_factor}</dd>
              <dt className="text-fg-secondary">Engine version</dt>
              <dd className="text-fg-primary">{proof.engine_version}</dd>
              <dt className="text-fg-secondary">Reference data version</dt>
              <dd className="text-fg-primary">{proof.ref_data_version}</dd>
              <dt className="text-fg-secondary">Computed at</dt>
              <dd className="text-fg-primary">{<DateTime value={proof.computed_at} />}</dd>
            </dl>
          </div>
        ) : null}

        {!loading && !proof ? <p className="mt-4 text-sm text-fg-tertiary">No proof available for this line yet.</p> : null}

        <div className="mt-6 flex justify-end">
          <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
