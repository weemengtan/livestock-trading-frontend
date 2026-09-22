import Decimal from "decimal.js";

/**
 * Buy Log entry sanity bounds — a line-for-line TS mirror of
 * backend/domain/buyer/entry_bounds.py's `check_entry_bounds`, same
 * discipline as bidcheck.ts, so the PWA can reject an implausible entry
 * before it's even queued offline (§12.7) instead of accepting it locally
 * and only failing on a later sync the buyer isn't watching.
 *
 * Loose "fat-finger" nets, not business rules — see the Python module's
 * docstring for the grounding (this org's own standard_weight_by_species
 * reference data, realistic Australian saleyard price/pen-size ranges).
 * They catch magnitude errors (extra zeros, wrong units), not business
 * judgement calls — bidcheck.ts's PASS/CLOSE/BREACH flow already covers
 * "legitimate but expensive" and is untouched by this module.
 */

export const MAX_HEAD_COUNT = 2000;
export const MAX_PRICE_PER_HEAD = new Decimal(10000);

// 0.2x-5x a species' standard_weight_by_species when known — generous
// next to the ±15% buyer_weight_band_tolerance_pct already shown to
// buyers on the DNBP home screen (that band stays informational-only;
// this is a much wider outer net).
const WEIGHT_LOWER_MULTIPLE = new Decimal("0.2");
const WEIGHT_UPPER_MULTIPLE = new Decimal("5");

// Fallback when no standard weight is known for the species client-side
// (weight_band absent from the cached DNBP line).
const FALLBACK_WEIGHT_MIN_KG = new Decimal(1);
const FALLBACK_WEIGHT_MAX_KG = new Decimal(500);

export function checkEntryBounds(params: {
  headCount: Decimal.Value;
  pricePerHead: Decimal.Value;
  weightKg: Decimal.Value;
  species: string;
  standardWeightKg: Decimal.Value | null;
}): string[] {
  const violations: string[] = [];
  const headCount = new Decimal(params.headCount);
  const pricePerHead = new Decimal(params.pricePerHead);
  const weightKg = new Decimal(params.weightKg);

  if (!(headCount.gte(1) && headCount.lte(MAX_HEAD_COUNT))) {
    violations.push(`No. of Heads must be between 1 and ${MAX_HEAD_COUNT}.`);
  }

  if (!(pricePerHead.gt(0) && pricePerHead.lte(MAX_PRICE_PER_HEAD))) {
    violations.push(`Price per head must be between $0 and $${MAX_PRICE_PER_HEAD.toFixed(0)}.`);
  }

  let weightMin: Decimal;
  let weightMax: Decimal;
  const standardWeightKg = params.standardWeightKg !== null ? new Decimal(params.standardWeightKg) : null;
  if (standardWeightKg !== null && standardWeightKg.gt(0)) {
    weightMin = standardWeightKg.times(WEIGHT_LOWER_MULTIPLE);
    weightMax = standardWeightKg.times(WEIGHT_UPPER_MULTIPLE);
  } else {
    weightMin = FALLBACK_WEIGHT_MIN_KG;
    weightMax = FALLBACK_WEIGHT_MAX_KG;
  }

  if (!(weightKg.gte(weightMin) && weightKg.lte(weightMax))) {
    violations.push(
      `Weight for ${params.species} must be between ${weightMin.toFixed(1)}kg and ${weightMax.toFixed(1)}kg per head.`
    );
  }

  return violations;
}
