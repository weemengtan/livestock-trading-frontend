import Decimal from "decimal.js";

/**
 * §12.3's Bid Check calculator — a line-for-line TS mirror of
 * backend/domain/buyer/bidcheck.py's `score_bid`, verified against the
 * same fixture (fixtures/bidcheck-test-vectors.json) so both languages
 * agree on every vector. Runs fully offline (§12.7) against whatever DNBP
 * is currently cached in IndexedDB — no network call, no server round trip.
 *
 * Money uses decimal.js (§5.5's "decimal.js... throughout"), never native
 * floating point, for the same reason the engine never uses Python float:
 * a buyer at the ring is reading this number to decide what to bid.
 *
 * §12.3's close threshold is Everhealth-config-editable (reference_data's
 * BID_CHECK_CLOSE_THRESHOLD_PCT) and rides along on the cached DNBP-current
 * response's `buyer_config` (lib/buyer/use-dnbp-current.ts) so Bid Check
 * still works fully offline from a cold start, without a hardcoded copy
 * here going stale against an office-side change.
 */

export type BidStatus = "PASS" | "CLOSE" | "BREACH";

export type BidCheckResult = {
  impliedPricePerKg: Decimal;
  status: BidStatus;
  variancePerKg: Decimal; // dnbp - implied; negative = over DNBP
  maxPricePerHead: Decimal; // "reverse mode" — the figure a buyer actually bids with
  isBreach: boolean;
};

export function scoreBid(params: {
  pricePerHead: Decimal.Value;
  weightKg: Decimal.Value;
  dnbpPerKg: Decimal.Value;
  closeThresholdPct: Decimal.Value;
}): BidCheckResult {
  const price = new Decimal(params.pricePerHead);
  const weight = new Decimal(params.weightKg);
  const dnbp = new Decimal(params.dnbpPerKg);
  const closeThresholdPct = new Decimal(params.closeThresholdPct);

  if (weight.lte(0)) {
    // §5.5's division discipline — a zero weight should never reach this
    // from a real form, but a BREACH-safe fallback beats a crash or Infinity.
    return {
      impliedPricePerKg: new Decimal(0),
      status: "BREACH",
      variancePerKg: dnbp,
      maxPricePerHead: new Decimal(0),
      isBreach: true,
    };
  }

  const impliedPricePerKg = price.dividedBy(weight);
  const variancePerKg = dnbp.minus(impliedPricePerKg);
  // §5.5 — always rounded DOWN; a ceiling price rounded up would authorise an overpay.
  const maxPricePerHead = dnbp.times(weight).toDecimalPlaces(2, Decimal.ROUND_FLOOR);

  const isBreach = impliedPricePerKg.greaterThan(dnbp);
  let status: BidStatus;
  if (isBreach) {
    status = "BREACH";
  } else {
    const headroomPct = dnbp.greaterThan(0) ? variancePerKg.dividedBy(dnbp).times(100) : new Decimal(0);
    status = headroomPct.lessThan(closeThresholdPct) ? "CLOSE" : "PASS";
  }

  return { impliedPricePerKg, status, variancePerKg, maxPricePerHead, isBreach };
}
