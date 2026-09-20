import { z } from "zod";
import type { DnbpCurrentResponse, SpeciesOption } from "@/lib/buyer-api";

// Runtime shape checks for data that crosses into the buyer PWA (API
// responses, WebSocket frames) and for what gets read back from IndexedDB.
// The TypeScript types in buyer-api.ts vanish at runtime — these are what
// actually stop a malformed payload from being cached and then crashing
// every screen that trusts it. `satisfies` keeps them in lockstep with
// those types.

export const dnbpCurrentSchema = z.object({
  publication_id: z.string(),
  published_at: z.string(),
  effective_from: z.string(),
  engine_version: z.string(),
  species: z.array(
    z.object({
      species: z.string(),
      dnbp_per_kg: z.string(),
      previous_dnbp_per_kg: z.string().nullable(),
      target_heads: z.string().nullable(),
      heads_bought: z.string(),
      weight_band: z.object({ min: z.string(), max: z.string() }).nullable(),
    })
  ),
}) satisfies z.ZodType<DnbpCurrentResponse>;

export const speciesOptionsSchema = z.array(
  z.object({ code: z.string(), display_name: z.string() })
) satisfies z.ZodType<SpeciesOption[]>;

export const cachedDnbpSchema = dnbpCurrentSchema.extend({
  id: z.literal("current"),
  fetched_at: z.string(),
});

export const cachedSpeciesSchema = z.object({
  id: z.literal("current"),
  options: speciesOptionsSchema,
  fetched_at: z.string(),
});
