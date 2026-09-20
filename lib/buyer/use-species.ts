"use client";

import * as React from "react";
import { buyerApi, type SpeciesOption } from "@/lib/buyer-api";
import { cacheSpecies, getCachedSpecies } from "@/lib/buyer/db";
import { useOnlineStatus } from "@/components/buyer/offline-banner";

/**
 * The species picker's data source — deliberately independent of
 * lib/buyer/use-dnbp-current.ts. Market Intel logs another buyer's bid for
 * office market intelligence; it has no business transaction and no
 * relationship to today's own DNBP publication, so it must list every
 * active species in the registry even on a species nothing has been
 * published for (or before the buyer has ever opened the DNBP tab).
 *
 * The registry changes rarely (an office admin action, not a live feed),
 * so unlike DNBP there's no WS event or 60s poll here — just cache-first
 * on mount, refreshed again whenever the device comes back online.
 */
export function useSpecies(accessToken: string | null): SpeciesOption[] {
  const [options, setOptions] = React.useState<SpeciesOption[]>([]);
  const online = useOnlineStatus();

  const load = React.useCallback(async () => {
    setOptions((await getCachedSpecies()).options);
    try {
      const fresh = await buyerApi.getSpecies(accessToken);
      await cacheSpecies(fresh);
      setOptions(fresh);
    } catch {
      // Offline, or not reachable yet — the cached/bootstrap value stays displayed.
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

  return options;
}
