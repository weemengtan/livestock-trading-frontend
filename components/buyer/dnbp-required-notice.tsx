import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { strings } from "@/lib/strings";
import type { DnbpStatus } from "@/lib/buyer/use-dnbp-current";

/** Shown by the screens that genuinely need a DNBP (Bid Check, Buy Log)
 * when there isn't one to work from — the two causes need different fixes,
 * so they get different messages. Renders nothing while still loading. */
export function DnbpRequiredNotice({ status }: { status: DnbpStatus }) {
  if (status === "ready" || status === "loading") return null;
  const s = strings.buyer.dnbpRequired;
  const unavailable = status === "unavailable";

  return (
    <EmptyState title={unavailable ? s.unavailableTitle : s.notPublishedTitle} body={unavailable ? s.unavailableBody : s.notPublishedBody}>
      <Link
        href="/buyer"
        className="mt-2 inline-flex h-12 items-center justify-center rounded-md border border-default bg-surface px-4 text-sm font-medium text-fg-primary hover:bg-sunken"
      >
        {s.openDnbp}
      </Link>
    </EmptyState>
  );
}
