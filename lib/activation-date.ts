import { addDays } from "./business-time.ts";

/**
 * A DNBP model's activation *date* is a calendar date in Singapore — Ms. Bing
 * sets it from there — and the model goes live at 00:00 Singapore time on it.
 * Backend counterpart: backend/core/activation_time.py, which is what actually
 * enforces it; this only helps the date picker offer sensible choices.
 *
 * Imported with an explicit ".ts" (tsconfig allowImportingTsExtensions) so
 * `node --test` can run lib/*.test.ts directly, with no test framework.
 */
const ACTIVATION_TZ = "Asia/Singapore";

/** Today's calendar date (YYYY-MM-DD) in Singapore. */
export function singaporeToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ACTIVATION_TZ }).format(now);
}

/** The earliest date a model can be scheduled for: tomorrow in Singapore, since today's 00:00 has passed. */
export function earliestActivationDate(now: Date = new Date()): string {
  return addDays(singaporeToday(now), 1);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * The suggested name for a model going live on `activationDate` (YYYY-MM-DD):
 * "2026-Oct-01". Fixed English month abbreviations, not Intl, so the name is
 * the same in every browser locale. Model names are unique, so if `taken`
 * already has it (say a cancelled model for the same day) a " (2)", " (3)"…
 * is appended. Empty string for a date that isn't YYYY-MM-DD yet (a
 * half-typed date input).
 */
export function defaultModelName(activationDate: string, taken: readonly string[] = []): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(activationDate);
  if (!match) return "";
  const month = MONTHS[Number(match[2]) - 1];
  if (!month) return "";
  const base = `${match[1]}-${month}-${match[3]}`;
  if (!taken.includes(base)) return base;
  let n = 2;
  while (taken.includes(`${base} (${n})`)) n += 1;
  return `${base} (${n})`;
}
