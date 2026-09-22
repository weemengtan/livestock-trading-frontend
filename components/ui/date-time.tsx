import { formatMelbourneDate, formatMelbourneDateTime, formatSecondaryDateTime } from "@/lib/business-time";

/**
 * A timestamp shown in Melbourne time (the business timezone) with the
 * Singapore equivalent on hover — the trading console's stakeholders are in
 * Singapore, its deadlines and saleyards in Melbourne. See lib/business-time.ts.
 */
export function DateTime({ value, dateOnly = false, className }: { value: string | Date; dateOnly?: boolean; className?: string }) {
  const iso = typeof value === "string" ? value : value.toISOString();
  return (
    <time dateTime={iso} title={formatSecondaryDateTime(value)} className={className}>
      {dateOnly ? formatMelbourneDate(value) : formatMelbourneDateTime(value)}
    </time>
  );
}
