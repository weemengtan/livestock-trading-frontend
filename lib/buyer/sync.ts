import { buyerApi } from "@/lib/buyer-api";
import { buyerDb, cacheHistoryEntry } from "@/lib/buyer/db";

/**
 * §12.7's write path: every Buy Log entry is created in `pending_entries`
 * first (lib/buyer/db.ts), then flushed here — on the `online` event, on a
 * periodic timer, and via a manual "Sync now" action. The retry-loop below
 * is the REAL mechanism on every platform; a Background Sync API
 * registration is attempted only as a progressive enhancement, because
 * Background Sync has no Safari implementation and §16 requires iOS
 * 16.4+ support.
 */

let flushing = false;

export type FlushResult = { synced: number; failed: number };

export async function flushPendingEntries(accessToken: string | null): Promise<FlushResult> {
  if (flushing || !accessToken) return { synced: 0, failed: 0 };
  flushing = true;
  try {
    // "failed" is terminal (see SyncStatus's docstring) — it's excluded
    // from the auto-retry set on purpose, so a rejection that will never
    // succeed doesn't get hammered at the server every 30s forever.
    const pending = await buyerDb.pending_entries.where("sync_status").anyOf(["queued"]).toArray();
    if (pending.length === 0) return { synced: 0, failed: 0 };

    await buyerDb.pending_entries
      .where("client_uuid")
      .anyOf(pending.map((p) => p.client_uuid))
      .modify({ sync_status: "syncing" });

    const results = await buyerApi.bulkSyncEntries(
      pending.map((p) => p.payload),
      accessToken
    );

    let synced = 0;
    let failed = 0;
    for (const result of results) {
      if (result.ok) {
        synced += 1;
        await buyerDb.pending_entries.delete(result.client_uuid);
      } else {
        failed += 1;
        // retriable !== false covers both explicit true and the
        // legacy/unset case — only an explicit false (a structured
        // AppError) is terminal (see AppError.retriable's docstring).
        // Prefer the specific violation list (e.g. "Weight for VEAL must
        // be between 3.4kg and 85.0kg per head.") over the generic
        // top-level message — that's what the buyer can actually act on.
        const violations = result.details?.violations;
        const message = violations && violations.length > 0 ? violations.join(" ") : result.error_message ?? "Sync failed";
        await buyerDb.pending_entries.update(result.client_uuid, {
          sync_status: result.retriable === false ? "failed" : "queued",
          error_message: message,
        });
      }
    }

    if (synced > 0) {
      // Re-fetch canonical server records rather than approximating the
      // server-computed fields (implied price, breach status) client-side.
      const serverEntries = await buyerApi.listEntries(accessToken);
      await Promise.all(serverEntries.map((entry) => cacheHistoryEntry(entry)));
    }

    return { synced, failed };
  } catch {
    // A network error mid-flush leaves everything "syncing" — reset to
    // "queued" so the next attempt retries them rather than stalling forever.
    const stuck = await buyerDb.pending_entries.where("sync_status").equals("syncing").toArray();
    await Promise.all(stuck.map((p) => buyerDb.pending_entries.update(p.client_uuid, { sync_status: "queued" })));
    return { synced: 0, failed: 0 };
  } finally {
    flushing = false;
  }
}

export function setupAutoSync(getAccessToken: () => string | null, onFlush?: (result: FlushResult) => void): () => void {
  const attempt = () => {
    void flushPendingEntries(getAccessToken()).then((result) => {
      if (result.synced > 0 || result.failed > 0) onFlush?.(result);
    });
  };

  window.addEventListener("online", attempt);
  const interval = setInterval(attempt, 30000);

  if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        const syncManager = (registration as ServiceWorkerRegistration & { sync?: { register(tag: string): Promise<void> } }).sync;
        void syncManager?.register("flush-buy-entries").catch(() => {
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
