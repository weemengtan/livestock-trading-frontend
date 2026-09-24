import { Badge, type BadgeProps } from "@/components/ui/badge";
import type { DnbpModel, DnbpModelStatus } from "@/lib/dnbp-models-api";
import { strings } from "@/lib/strings";

const STATUS_VARIANT: Record<DnbpModelStatus, NonNullable<BadgeProps["variant"]>> = {
  LIVE: "pass",
  SCHEDULED: "accent",
  DRAFT: "close",
  RETIRED: "neutral",
  CANCELLED: "neutral",
};

export function ModelStatusBadge({ status }: { status: DnbpModelStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{strings.referenceData.dnbpModels.status[status]}</Badge>;
}

/** "1 Oct 2026, 00:00 SGT (Melbourne 02:00)" — the server supplies both zones, so no timezone logic lives here. */
export function formatActivation(model: Pick<DnbpModel, "activation_display">): string {
  const [date, sgTime] = model.activation_display.singapore.split(" ");
  const [, melTime] = model.activation_display.melbourne.split(" ");
  const pretty = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${date}T00:00:00Z`),
  );
  return `${pretty}, ${sgTime} SGT (${strings.referenceData.dnbpModels.inMelbourne} ${melTime})`;
}
