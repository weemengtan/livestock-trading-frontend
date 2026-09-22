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
 *
 * All six bounds are Everhealth-config-editable (reference_data's
 * ENTRY_BOUNDS_* keys, §6.7) — the buyer PWA reads them from the cached
 * `buyer_config` on the DNBP-current response (lib/buyer/use-dnbp-current.ts)
 * rather than hardcoding a copy here, so an office change to a bound takes
 * effect on-device at the next successful sync.
 */

export function checkEntryBounds(params: {
  headCount: Decimal.Value;
  pricePerHead: Decimal.Value;
  weightKg: Decimal.Value;
  species: string;
  standardWeightKg: Decimal.Value | null;
  maxHeadCount: Decimal.Value;
  maxPricePerHead: Decimal.Value;
  weightLowerMultiple: Decimal.Value;
  weightUpperMultiple: Decimal.Value;
  fallbackWeightMinKg: Decimal.Value;
  fallbackWeightMaxKg: Decimal.Value;
}): string[] {
  const violations: string[] = [];
  const headCount = new Decimal(params.headCount);
  const pricePerHead = new Decimal(params.pricePerHead);
  const weightKg = new Decimal(params.weightKg);
  const maxHeadCount = new Decimal(params.maxHeadCount);
  const maxPricePerHead = new Decimal(params.maxPricePerHead);
  const weightLowerMultiple = new Decimal(params.weightLowerMultiple);
  const weightUpperMultiple = new Decimal(params.weightUpperMultiple);
  const fallbackWeightMinKg = new Decimal(params.fallbackWeightMinKg);
  const fallbackWeightMaxKg = new Decimal(params.fallbackWeightMaxKg);

  if (!(headCount.gte(1) && headCount.lte(maxHeadCount))) {
    violations.push(`No. of Heads must be between 1 and ${maxHeadCount.toFixed(0)}.`);
  }

  if (!(pricePerHead.gt(0) && pricePerHead.lte(maxPricePerHead))) {
    violations.push(`Price per head must be between $0 and $${maxPricePerHead.toFixed(0)}.`);
  }

  let weightMin: Decimal;
  let weightMax: Decimal;
  const standardWeightKg = params.standardWeightKg !== null ? new Decimal(params.standardWeightKg) : null;
  if (standardWeightKg !== null && standardWeightKg.gt(0)) {
    weightMin = standardWeightKg.times(weightLowerMultiple);
    weightMax = standardWeightKg.times(weightUpperMultiple);
  } else {
    weightMin = fallbackWeightMinKg;
    weightMax = fallbackWeightMaxKg;
  }

  if (!(weightKg.gte(weightMin) && weightKg.lte(weightMax))) {
    violations.push(
      `Weight for ${params.species} must be between ${weightMin.toFixed(1)}kg and ${weightMax.toFixed(1)}kg per head.`
    );
  }

  return violations;
}
