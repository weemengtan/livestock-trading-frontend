import Dexie, { type Table } from "dexie";
import type { BuyEntryCreatePayload, BuyEntryResponse, DnbpCurrentResponse, SpeciesOption } from "@/lib/buyer-api";
import type { MarketObservationCreatePayload } from "@/lib/market-intel-api";
import { cachedDnbpSchema, cachedSpeciesSchema, dnbpCurrentSchema, speciesOptionsSchema } from "@/lib/buyer-schemas";

/**
 * §12.7's offline architecture, the three IndexedDB tables named in the
 * PRD's own architecture diagram (Dexie — MIT/FOSS). This is the only
 * source of truth the Bid Check and DNBP home screens read from; every
 * network fetch exists only to keep this cache fresh, never to answer a
 * render directly (§12.3 "works fully offline").
 */

const CURRENT_DNBP_KEY = "current";

export type CachedDnbp = DnbpCurrentResponse & { id: typeof CURRENT_DNBP_KEY; fetched_at: string };

const SPECIES_CACHE_KEY = "current";

// The species_registry table (backend/models/reference_data.py), cached in
// its own table deliberately separate from dnbp_cache: Market Intel needs
// this list for a picker that has no relationship to DNBP or any business
// transaction, and must keep working on a device that has visited Market
// Intel but never opened the DNBP tab.
export type CachedSpecies = { id: typeof SPECIES_CACHE_KEY; options: SpeciesOption[]; fetched_at: string };

// "failed" is terminal: the server rejected the item for a reason that
// won't change on retry (see backend core/errors.py's AppError.retriable
// docstring) — lib/buyer/sync.ts stops auto-retrying it and surfaces it
// for the buyer to fix or discard, rather than silently retrying forever.
export type SyncStatus = "queued" | "syncing" | "synced" | "failed";

export type PendingEntry = {
  client_uuid: string;
  payload: BuyEntryCreatePayload;
  sync_status: SyncStatus;
  created_at: string;
  error_message?: string;
};

export type HistoryEntry = BuyEntryResponse;

// The market-intel counterpart of PendingEntry — same offline-queue shape,
// but there is no `observation_history` table alongside it: the buyer role
// has no server GET for this data (§ visibility — see
// lib/market-intel-api.ts's module docstring), so once an item syncs it is
// simply removed from `pending_observations` and never reappears anywhere
// on this device, by design.
export type PendingObservation = {
  client_uuid: string;
  payload: MarketObservationCreatePayload;
  sync_status: SyncStatus;
  created_at: string;
  error_message?: string;
};

class BuyerDatabase extends Dexie {
  dnbp_cache!: Table<CachedDnbp, string>;
  pending_entries!: Table<PendingEntry, string>;
  entry_history!: Table<HistoryEntry, string>;
  pending_observations!: Table<PendingObservation, string>;
  species_cache!: Table<CachedSpecies, string>;

  constructor() {
    super("livestock-buyer");
    this.version(1).stores({
      dnbp_cache: "id",
      pending_entries: "client_uuid, sync_status, created_at",
      entry_history: "client_uuid, trade_date, species, client_created_at",
    });
    this.version(2).stores({
      pending_observations: "client_uuid, sync_status, created_at",
    });
    this.version(3).stores({
      species_cache: "id",
    });
  }
}

export const buyerDb = new BuyerDatabase();

export async function cacheDnbp(current: DnbpCurrentResponse): Promise<void> {
  // Re-validated at the write itself so no caller can ever persist a bad shape.
  await buyerDb.dnbp_cache.put({ ...dnbpCurrentSchema.parse(current), id: CURRENT_DNBP_KEY, fetched_at: new Date().toISOString() });
}

// A stored row that no longer matches the expected shape (written by an
// older build, or from a malformed payload) is deleted rather than handed to
// screens that assume it's well-formed — the next sync repopulates it.
export async function getCachedDnbp(): Promise<CachedDnbp | undefined> {
  const row = await buyerDb.dnbp_cache.get(CURRENT_DNBP_KEY);
  if (row === undefined) return undefined;
  const parsed = cachedDnbpSchema.safeParse(row);
  if (parsed.success) return parsed.data;
  await buyerDb.dnbp_cache.delete(CURRENT_DNBP_KEY);
  return undefined;
}

export async function queueEntry(payload: BuyEntryCreatePayload): Promise<void> {
  await buyerDb.pending_entries.put({
    client_uuid: payload.client_uuid,
    payload,
    sync_status: "queued",
    created_at: new Date().toISOString(),
  });
}

export async function cacheHistoryEntry(entry: BuyEntryResponse): Promise<void> {
  await buyerDb.entry_history.put(entry);
}

// The buyer's explicit resolution for a "failed" (terminal) entry — it
// will never sync as-is, so it stays queued forever unless the buyer
// either fixes and resubmits it (a new queueEntry call) or discards it.
export async function discardPendingEntry(clientUuid: string): Promise<void> {
  await buyerDb.pending_entries.delete(clientUuid);
}

export async function recentHistory(limit = 50): Promise<HistoryEntry[]> {
  return buyerDb.entry_history.orderBy("client_created_at").reverse().limit(limit).toArray();
}

export async function queueObservation(payload: MarketObservationCreatePayload): Promise<void> {
  await buyerDb.pending_observations.put({
    client_uuid: payload.client_uuid,
    payload,
    sync_status: "queued",
    created_at: new Date().toISOString(),
  });
}

export async function discardPendingObservation(clientUuid: string): Promise<void> {
  await buyerDb.pending_observations.delete(clientUuid);
}

// Day-zero fallback for a device that has never reached /buyer/species —
// mirrors fixtures/reference-data-seed.json's open_registries.species
// seed_rows. Never written to species_cache itself: it's a render-time
// fallback only, so a genuine empty registry response (if that ever
// happens) still overrides it on the next successful fetch.
const BOOTSTRAP_SPECIES: SpeciesOption[] = [
  { code: "SHEEP", display_name: "Sheep" },
  { code: "LAMB", display_name: "Lamb" },
  { code: "GOAT", display_name: "Goat" },
  { code: "VEAL", display_name: "Veal" },
  { code: "MUTTON", display_name: "Mutton" },
];

export async function cacheSpecies(options: SpeciesOption[]): Promise<void> {
  await buyerDb.species_cache.put({
    id: SPECIES_CACHE_KEY,
    options: speciesOptionsSchema.parse(options),
    fetched_at: new Date().toISOString(),
  });
}

export async function getCachedSpecies(): Promise<CachedSpecies> {
  const row = await buyerDb.species_cache.get(SPECIES_CACHE_KEY);
  if (row !== undefined) {
    const parsed = cachedSpeciesSchema.safeParse(row);
    if (parsed.success) return parsed.data;
    await buyerDb.species_cache.delete(SPECIES_CACHE_KEY);
  }
  return { id: SPECIES_CACHE_KEY, options: BOOTSTRAP_SPECIES, fetched_at: new Date(0).toISOString() };
}
