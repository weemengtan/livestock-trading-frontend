"use client";

import * as React from "react";
import { useAuthStore } from "@/lib/auth-store";
import { buyerApi, connectBuyerSocket, type DnbpCurrentResponse } from "@/lib/buyer-api";
import { cacheDnbp, getCachedDnbp, type CachedDnbp } from "@/lib/buyer/db";

// §10 polling fallback — every 60s while foregrounded, in case both WS and
// push fail (e.g. poor rural connectivity).
const POLL_INTERVAL_MS = 60_000;

/**
 * Cache-first sync for `dnbp_cache`, shared by every buyer screen that
 * needs current DNBP data (home tiles, Market Intel's species picker, …):
 * read the cache immediately, refresh from the network in the background,
 * and stay live via the `dnbp.published` WS event plus a 60s poll fallback.
 *
 * `ack: true` must be reserved for the screen that actually renders the
 * DNBP figure to the buyer — POST /buyer/dnbp/ack is the office's "has the
 * buyer actually seen this" signal (services/delivery_service.py §9.9/§10:
 * "delivered" and "acknowledged" are deliberately the same client-reported
 * event), so a background consumer must not fire it just for fetching data
 * it needs for an unrelated purpose.
 */
export function useDnbpCurrent(options: { ack: boolean }): CachedDnbp | null {
  const { ack } = options;
  const [cached, setCached] = React.useState<CachedDnbp | null>(null);
  const acknowledgedRef = React.useRef<string | null>(null);

  const applyFresh = React.useCallback(
    async (data: DnbpCurrentResponse) => {
      await cacheDnbp(data);
      setCached((await getCachedDnbp()) ?? null);
      if (ack && acknowledgedRef.current !== data.publication_id) {
        acknowledgedRef.current = data.publication_id;
        buyerApi.ackDnbp(data.publication_id, useAuthStore.getState().accessToken).catch(() => {
          // Ack is best-effort from the client's perspective — the console's
          // delivery tracker will simply show "not yet seen" a little longer.
        });
      }
    },
    [ack]
  );

  const loadFromCacheThenNetwork = React.useCallback(async () => {
    setCached((await getCachedDnbp()) ?? null);
    try {
      const data = await buyerApi.getDnbpCurrent(useAuthStore.getState().accessToken);
      await applyFresh(data);
    } catch {
      // Offline or nothing published yet — the cached value (if any) stays displayed.
    }
  }, [applyFresh]);

  React.useEffect(() => {
    void (async () => {
      await loadFromCacheThenNetwork();
    })();
  }, [loadFromCacheThenNetwork]);

  React.useEffect(() => {
    const socket = connectBuyerSocket(
      () => useAuthStore.getState().accessToken,
      (event, data) => {
        if (event === "dnbp.published") {
          void applyFresh(data as DnbpCurrentResponse);
        } else if (event === "buying.progress_updated") {
          // This event only carries the touched species' delta (see
          // services/delivery_service.py::push_buying_progress), not the
          // full DnbpCurrentResponse shape applyFresh expects — re-fetch
          // instead of trying to merge a partial payload in.
          void loadFromCacheThenNetwork();
        }
      },
      () => void loadFromCacheThenNetwork() // always re-fetch on (re)connect, per §10
    );

    const pollId = setInterval(() => void loadFromCacheThenNetwork(), POLL_INTERVAL_MS);

    return () => {
      socket.close();
      clearInterval(pollId);
    };
  }, [loadFromCacheThenNetwork, applyFresh]);

  return cached;
}
