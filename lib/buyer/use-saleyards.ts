"use client";

import * as React from "react";
import { buyerApi, type SaleyardOption } from "@/lib/buyer-api";
import { saleyardOptionsSchema } from "@/lib/buyer-schemas";
import { useOnlineStatus } from "@/components/buyer/offline-banner";

const CACHE_KEY = "buyer.saleyard_calendar";

// §6.8/§12.4 — the calendar's days are Melbourne business days, so "today"
// is resolved in Australia/Melbourne, not the device's own timezone.
function melbourneWeekday(now: Date): string {
  return new Intl.DateTimeFormat("en-AU", { weekday: "long", timeZone: "Australia/Melbourne" })
    .format(now)
    .toUpperCase();
}

function readCache(): SaleyardOption[] {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    const parsed = saleyardOptionsSchema.safeParse(raw ? JSON.parse(raw) : []);
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

function writeCache(options: SaleyardOption[]) {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(options));
  } catch {
    // Storage blocked or full — the default just won't be available offline.
  }
}

/**
 * The saleyard field's data source: the saleyard calendar (reference data,
 * never hard-coded), giving both the suggestion list and today's default.
 * `defaultSaleyard` is "" on a day with no calendar entry (e.g. Wednesday)
 * — the field then starts empty and the buyer types one, rather than the
 * app guessing.
 *
 * Cached in localStorage (last known calendar) so the default still
 * resolves when the buyer is offline at the saleyard; the weekday is
 * matched at read time, so a cached calendar stays correct across days.
 */
export function useSaleyards(accessToken: string | null): { options: SaleyardOption[]; defaultSaleyard: string } {
  const [options, setOptions] = React.useState<SaleyardOption[]>([]);
  const online = useOnlineStatus();

  const load = React.useCallback(async () => {
    setOptions(readCache());
    try {
      const fresh = await buyerApi.getSaleyards(accessToken);
      writeCache(fresh);
      setOptions(fresh);
    } catch {
      // Offline, or not reachable yet — the cached value stays displayed.
    }
  }, [accessToken]);

  React.useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  const wasOnline = React.useRef(online);
  React.useEffect(() => {
    if (online && !wasOnline.current) void load();
    wasOnline.current = online;
  }, [online, load]);

  const defaultSaleyard = options.find((o) => o.day === melbourneWeekday(new Date()))?.saleyard ?? "";
  return { options, defaultSaleyard };
}
