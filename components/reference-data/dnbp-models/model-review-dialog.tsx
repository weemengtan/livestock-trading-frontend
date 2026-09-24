"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { ImpactSummary } from "@/components/reference-data/impact-summary";
import { useAuthStore } from "@/lib/auth-store";
import { dnbpModelsApi, type DnbpModel, type ModelImpact } from "@/lib/dnbp-models-api";
import { strings } from "@/lib/strings";
import { withErrorToast } from "@/lib/with-error-toast";
import { formatActivation } from "./model-status";

const copy = strings.referenceData.dnbpModels;

/**
 * Impact review, then approval. Opening the dialog fetches the impact
 * preview, which is also what records that the model was reviewed — the
 * server refuses approval until it has been (§6.5, §19). Mount it only while
 * open (`{target ? <ModelReviewDialog … /> : null}`) so each opening reviews
 * afresh, the same way the settings flow does.
 */
export function ModelReviewDialog({
  model,
  onClose,
  onApproved,
}: {
  model: DnbpModel;
  onClose: () => void;
  onApproved: () => void;
}) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const currentEmail = useAuthStore((s) => s.user?.email);
  const [impact, setImpact] = React.useState<ModelImpact | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [approving, setApproving] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await withErrorToast(() => dnbpModelsApi.previewImpact(model.id, accessToken), "Could not compute impact");
      if (cancelled) return;
      setImpact(result ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [model.id, accessToken]);

  async function handleApprove() {
    setApproving(true);
    const approved = await withErrorToast(() => dnbpModelsApi.approve(model.id, accessToken), "Could not approve");
    setApproving(false);
    if (!approved) return;
    toast({ title: copy.review.approvedToast });
    onApproved();
  }

  const createdByMe = currentEmail !== undefined && currentEmail === model.created_by_email;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogTitle>
          {copy.review.title} — {model.name}
        </DialogTitle>
        <DialogDescription>
          {copy.review.description} {copy.when.DRAFT.toLowerCase()} {formatActivation(model)}.
        </DialogDescription>

        <div className="mt-4">
          {loading ? <p className="text-sm text-fg-tertiary">{copy.review.computing}</p> : null}
          {impact ? (
            <>
              <p className="mb-2 text-sm text-fg-secondary">
                {copy.review.comparedWith}: <strong className="text-fg-primary">{impact.baseline_model}</strong>
              </p>
              <ImpactSummary impact={impact} />
            </>
          ) : null}
        </div>

        {impact ? <p className="mt-4 text-sm text-fg-secondary">{copy.review.confirmNote}</p> : null}
        {createdByMe ? <p className="mt-2 text-sm font-medium text-status-close-fg">{copy.review.secondPerson}</p> : null}

        <div className="mt-4 flex justify-end gap-2">
          <DialogClose asChild>
            <Button variant="secondary">Close</Button>
          </DialogClose>
          <Button onClick={handleApprove} disabled={!impact || approving}>
            {approving ? copy.review.approving : copy.review.approve}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
