import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ModelGuard } from "@/lib/snapshot-model-rules";
import { strings } from "@/lib/strings";

const copy = strings.workbench.modelGuard;

const fill = (template: string, stale: string, live: string) => template.replaceAll("{stale}", stale).replaceAll("{live}", live);

/**
 * Tells the user this snapshot's prices came from a different DNBP model
 * than the one live now, and what to do about it. Renders nothing when the
 * prices are current. What it may offer is decided by `evaluateModelGuard`
 * (lib/snapshot-model-rules.ts), not here.
 */
export function ModelGuardBanner({
  guard,
  liveModelName,
  onRecalculate,
  recalculating,
}: {
  guard: ModelGuard;
  liveModelName: string;
  onRecalculate: () => void;
  recalculating: boolean;
}) {
  if (guard.banner === "none") return null;

  const stale = guard.staleModelNames.join(", ");
  const recalc = guard.banner === "recalculate-before-publishing";

  return (
    <Card role="status" className="border-status-close-fg bg-status-close-bg">
      <p className="text-sm font-semibold text-status-close-fg">{recalc ? copy.recalculateTitle : copy.uploadAgainTitle}</p>
      <p className="mt-1 text-sm text-fg-primary">
        {fill(recalc ? copy.recalculateBody : copy.uploadAgainBody, stale, liveModelName)}
      </p>
      {recalc ? (
        <Button className="mt-3" size="sm" onClick={onRecalculate} disabled={recalculating}>
          {recalculating ? "Calculating…" : copy.recalculate}
        </Button>
      ) : null}
    </Card>
  );
}
