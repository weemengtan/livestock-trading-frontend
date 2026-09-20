"use client";

import * as React from "react";
import { ApiError } from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";
import { buyerApi, connectBuyerSocket, type DnbpCurrentResponse } from "@/lib/buyer-api";
import { dnbpCurrentSchema } from "@/lib/buyer-schemas";
import { cacheDnbp, getCachedDnbp, type CachedDnbp } from "@/lib/buyer/db";

// §10 polling fallback — every 60s while foregrounded, in case both WS and
// push fail (e.g. poor rural connectivity).
const POLL_INTERVAL_MS = 60_000;

// "not_published": the office hasn't published a DNBP yet (nothing to cache).
// "unavailable": nothing cached on this device and the server couldn't be
// reached (offline, or never synced here). Screens that require DNBP tell
// the buyer which one applies, since the fix differs.
export type DnbpStatus = "loading" | "ready" | "not_published" | "unavailable";

type NetworkState = "pending" | "ok" | "not_published" | "failed";

/**
 * Cache-first sync for `dnbp_cache`, shared by every buyer screen that
 * needs current DNBP data (DNBP home, Bid Check, Buy Log):
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
export function useDnbpCurrent(options: { ack: boolean }): { cached: CachedDnbp | null; status: DnbpStatus } {
  const { ack } = options;
  const [cached, setCached] = React.useState<CachedDnbp | null>(null);
  const [network, setNetwork] = React.useState<NetworkState>("pending");
  const acknowledgedRef = React.useRef<string | null>(null);

  const applyFresh = React.useCallback(
    async (data: DnbpCurrentResponse) => {
      await cacheDnbp(data);
      setCached((await getCachedDnbp()) ?? null);
      setNetwork("ok");
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
    } catch (err) {
      // Offline, nothing published yet, or an unusable response — the cached
      // value (if any) stays displayed.
      setNetwork(err instanceof ApiError && err.status === 404 ? "not_published" : "failed");
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
          const parsed = dnbpCurrentSchema.safeParse(data);
          // A frame that doesn't match the expected shape is never cached;
          // re-fetching gets the authoritative copy instead.
          if (parsed.success) void applyFresh(parsed.data);
          else void loadFromCacheThenNetwork();
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

  const hasSpecies = cached !== null && cached.species.length > 0;
  let status: DnbpStatus;
  if (hasSpecies) status = "ready";
  else if (network === "pending") status = "loading";
  else if (network === "failed") status = "unavailable";
  else status = "not_published";

  return { cached, status };
}
