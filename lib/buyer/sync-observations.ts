import { marketIntelApi } from "@/lib/market-intel-api";
import { buyerDb } from "@/lib/buyer/db";

/**
 * The market-intel counterpart of lib/buyer/sync.ts's flushPendingEntries.
 * The one difference from that flow: there is no server GET to re-fetch
 * canonical records into afterward (the buyer role has no read access to
 * this data — see market-intel-api.ts's module docstring), so a synced
 * item is simply deleted from `pending_observations` and never cached
 * anywhere else on this device.
 */

let flushing = false;

export type FlushResult = { synced: number; failed: number };

export async function flushPendingObservations(accessToken: string | null): Promise<FlushResult> {
  if (flushing || !accessToken) return { synced: 0, failed: 0 };
  flushing = true;
  try {
    // "failed" is terminal — excluded from auto-retry, same reasoning as
    // lib/buyer/sync.ts's flushPendingEntries.
    const pending = await buyerDb.pending_observations.where("sync_status").anyOf(["queued"]).toArray();
    if (pending.length === 0) return { synced: 0, failed: 0 };

    await buyerDb.pending_observations
      .where("client_uuid")
      .anyOf(pending.map((p) => p.client_uuid))
      .modify({ sync_status: "syncing" });

    const results = await marketIntelApi.bulkSyncObservations(
      pending.map((p) => p.payload),
      accessToken
    );

    let synced = 0;
    let failed = 0;
    for (const result of results) {
      if (result.ok) {
        synced += 1;
        await buyerDb.pending_observations.delete(result.client_uuid);
      } else {
        failed += 1;
        const violations = result.details?.violations;
        const message = violations && violations.length > 0 ? violations.join(" ") : result.error_message ?? "Sync failed";
        await buyerDb.pending_observations.update(result.client_uuid, {
          sync_status: result.retriable === false ? "failed" : "queued",
          error_message: message,
        });
      }
    }

    return { synced, failed };
  } catch {
    // A network error mid-flush leaves everything "syncing" — reset to
    // "queued" so the next attempt retries them rather than stalling forever.
    const stuck = await buyerDb.pending_observations.where("sync_status").equals("syncing").toArray();
    await Promise.all(stuck.map((p) => buyerDb.pending_observations.update(p.client_uuid, { sync_status: "queued" })));
    return { synced: 0, failed: 0 };
  } finally {
    flushing = false;
  }
}

export function setupObservationAutoSync(getAccessToken: () => string | null, onFlush?: (result: FlushResult) => void): () => void {
  const attempt = () => {
    void flushPendingObservations(getAccessToken()).then((result) => {
      if (result.synced > 0 || result.failed > 0) onFlush?.(result);
    });
  };

  window.addEventListener("online", attempt);
  const interval = setInterval(attempt, 30000);

  if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        const syncManager = (registration as ServiceWorkerRegistration & { sync?: { register(tag: string): Promise<void> } }).sync;
        void syncManager?.register("flush-market-observations").catch(() => {
          // Not supported (e.g. Safari) — the interval/online-event retry above already covers it.
        });
      })
      .catch(() => {});
  }

  attempt();

  return () => {
    window.removeEventListener("online", attempt);
    clearInterval(interval);
  };
}
