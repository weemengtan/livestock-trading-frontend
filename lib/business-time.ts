/**
 * Business time is Australia/Melbourne — the saleyards, the buyers and the
 * 13:00 deadline all run on it — no matter where the person looking is (the
 * trading console is used from Singapore) or what the device clock says.
 * Backend counterpart: backend/core/business_time.py.
 *
 * Timestamps from the API are instants; only *displaying* one, or asking
 * which calendar date it falls on, goes through here. Always IANA zone
 * names, never fixed offsets: Melbourne observes daylight saving, so its
 * offset from UTC and from Singapore changes twice a year.
 */

export const BUSINESS_TZ = "Australia/Melbourne";
const SECONDARY_TZ = "Asia/Singapore";
const SECONDARY_TZ_LABEL = "SGT";

type Instant = Date | string;

const asDate = (value: Instant): Date => (typeof value === "string" ? new Date(value) : value);

/** The Melbourne calendar date (YYYY-MM-DD) of `instant`, default now. */
export function melbourneDate(instant: Instant = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TZ }).format(asDate(instant));
}

/** `date` (YYYY-MM-DD) shifted by `days`, as YYYY-MM-DD — pure calendar arithmetic, no timezone involved. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function format(instant: Instant, timeZone: string, withDate: boolean, zoneName: string | null): string {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone,
    ...(withDate ? { day: "numeric", month: "short", year: "numeric" } : {}),
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    ...(zoneName === null ? { timeZoneName: "short" } : {}),
  }).format(asDate(instant));
  return zoneName === null ? parts : `${parts} ${zoneName}`;
}

/** "22 Sept 2026, 08:30 AEST" — Melbourne time, zone abbreviation included (AEST/AEDT follows daylight saving). */
export function formatMelbourneDateTime(instant: Instant): string {
  return format(instant, BUSINESS_TZ, true, null);
}

/** "22 Sept 2026, 06:30 SGT" — the same instant in Singapore time, for the hover text. */
export function formatSecondaryDateTime(instant: Instant): string {
  return format(instant, SECONDARY_TZ, true, SECONDARY_TZ_LABEL);
}

/** Date only, Melbourne calendar day — "22 Sept 2026". */
export function formatMelbourneDate(instant: Instant): string {
  return new Intl.DateTimeFormat("en-AU", { timeZone: BUSINESS_TZ, day: "numeric", month: "short", year: "numeric" }).format(
    asDate(instant),
  );
}
