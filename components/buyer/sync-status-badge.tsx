import { Badge } from "@/components/ui/badge";
import { InfoTooltipWrap } from "@/components/ui/info-tooltip";
import { strings } from "@/lib/strings";
import type { SyncStatus } from "@/lib/buyer/db";

const DOT: Record<SyncStatus, string> = { queued: "⏳", syncing: "↻", synced: "✓", failed: "⚠" };
const VARIANT: Record<SyncStatus, "neutral" | "pass" | "breach"> = {
  queued: "neutral",
  syncing: "neutral",
  synced: "pass",
  failed: "breach",
};

export function SyncStatusBadge({ status }: { status: SyncStatus }) {
  const { what, how } = strings.buyer.sync.tooltip;
  return (
    <InfoTooltipWrap what={what} how={how}>
      <Badge variant={VARIANT[status]} tabIndex={0}>
        {DOT[status]} {strings.buyer.sync[status]}
      </Badge>
    </InfoTooltipWrap>
  );
}
