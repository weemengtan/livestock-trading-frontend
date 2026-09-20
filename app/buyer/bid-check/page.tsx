"use client";

import * as React from "react";
import Decimal from "decimal.js";
import { useRouter } from "next/navigation";
import { AuthGuard } from "@/components/auth-guard";
import { AppShell } from "@/components/app-shell";
import { BuyerBottomNav } from "@/components/buyer/bottom-nav";
import { StatusBadge } from "@/components/buyer/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { strings } from "@/lib/strings";
import { scoreBid, CLOSE_THRESHOLD_PCT } from "@/lib/buyer/bidcheck";
import { DnbpRequiredNotice } from "@/components/buyer/dnbp-required-notice";
import { useDnbpCurrent } from "@/lib/buyer/use-dnbp-current";

export default function BidCheckPage() {
  return (
    <AuthGuard requiredRole="BUYER">
      <AppShell title={strings.buyer.bidCheck.title}>
        <BidCheckContent />
      </AppShell>
      <BuyerBottomNav />
    </AuthGuard>
  );
}

function BidCheckContent() {
  const router = useRouter();
  // ack: false — the DNBP home screen owns the "buyer has seen it" signal.
  const { cached, status } = useDnbpCurrent({ ack: false });
  const [speciesChoice, setSpeciesChoice] = React.useState("");
  const species = speciesChoice || cached?.species[0]?.species || "";
  const [pricePerHead, setPricePerHead] = React.useState("");
  const [weightKg, setWeightKg] = React.useState("");
  const lastVibratedStatusRef = React.useRef<string | null>(null);

  const speciesLine = cached?.species.find((s) => s.species === species);
  const hasWeight = weightKg.trim().length > 0;
  const hasPrice = pricePerHead.trim().length > 0;

  // maxPricePerHead only depends on DNBP and weight, never on price — so the
  // ceiling ("reverse mode") is computable, and shown, as soon as weight is
  // known. A price of 0 is a safe stand-in until the buyer has one: it can't
  // flip isBreach/status, and those fields are only read once hasPrice is true.
  const result =
    speciesLine && hasWeight
      ? scoreBid({
          pricePerHead: pricePerHead || 0,
          weightKg,
          dnbpPerKg: speciesLine.dnbp_per_kg,
          closeThresholdPct: CLOSE_THRESHOLD_PCT,
        })
      : null;

  React.useEffect(() => {
    if (!hasPrice) {
      // no real bid entered yet — nothing to vibrate about, and reset so the
      // next real price re-announces its status from a clean slate.
      lastVibratedStatusRef.current = null;
      return;
    }
    if (result && result.status !== lastVibratedStatusRef.current) {
      lastVibratedStatusRef.current = result.status;
      // §12.3 — haptic feedback on state transition; the buyer may not be looking at the screen.
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate(result.status === "BREACH" ? [80, 40, 80] : 40);
      }
    }
  }, [result, hasPrice]);

  if (status !== "ready" || !cached) {
    return (
      <div className="p-4">
        <DnbpRequiredNotice status={status} />
      </div>
    );
  }

  // Bid Check never writes a BuyEntry itself (§12.3 is evaluation-only) —
  // it stages what it knows in the URL and hands off to Buy Log, the
  // single place a purchase actually gets saved (saleyard, agent/pen,
  // breach gating, duplicate warning, description/freight/cost all live
  // there once). Query params, not shared client state: reading them is
  // idempotent, so nothing here needs to guard against React's dev-mode
  // double-invocation of mount effects on the receiving page.
  function handleContinueToBuyLog() {
    const params = new URLSearchParams({ species, weight: weightKg, price: pricePerHead });
    router.push(`/buyer/buy-log?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-4 p-4 pb-24">
      <div className="flex flex-col gap-1">
        <Label htmlFor="species">{strings.buyer.bidCheck.speciesLabel}</Label>
        <select
          id="species"
          value={species}
          onChange={(e) => setSpeciesChoice(e.target.value)}
          className="h-14 rounded-md border border-default bg-surface px-3 text-lg"
        >
          {cached.species.map((s) => (
            <option key={s.species} value={s.species}>
              {s.species}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="weight">{strings.buyer.bidCheck.weightLabel}</Label>
        <Input
          id="weight"
          inputMode="decimal"
          type="number"
          autoFocus
          className="h-16 text-2xl"
          value={weightKg}
          onChange={(e) => setWeightKg(e.target.value)}
        />
      </div>

      {result ? (
        // "Reverse mode" — the number a buyer at the ring actually needs,
        // available the instant weight is known, before any price is decided.
        <div className="flex flex-col items-center gap-1 rounded-lg border-2 border-accent-default bg-accent-subtle p-6 text-center">
          <p className="flex items-center gap-1 text-sm font-medium uppercase tracking-wide text-fg-secondary">
            {strings.buyer.bidCheck.maxPricePrefix} {weightKg}kg
            <InfoTooltip
              label={`About ${strings.buyer.bidCheck.maxPricePrefix}`}
              what={strings.buyer.bidCheck.tooltips.maxPrice.what}
              how={strings.buyer.bidCheck.tooltips.maxPrice.how}
            />
          </p>
          <p data-numeric className="text-6xl font-extrabold leading-none text-accent-default">
            ${result.maxPricePerHead.toFixed(2)}
          </p>
          <p className="text-sm text-fg-secondary">
            {strings.buyer.bidCheck.dnbpIs} ${new Decimal(speciesLine!.dnbp_per_kg).toFixed(2)}/kg
          </p>
        </div>
      ) : null}

      <div className="flex flex-col gap-1">
        <Label htmlFor="price-per-head">{strings.buyer.bidCheck.pricePerHeadLabel}</Label>
        <Input
          id="price-per-head"
          inputMode="decimal"
          type="number"
          className="h-16 text-2xl"
          value={pricePerHead}
          onChange={(e) => setPricePerHead(e.target.value)}
        />
      </div>

      {result && hasPrice ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-subtle bg-sunken p-6 text-center">
          <p data-numeric className="flex items-center gap-1.5 text-4xl font-bold text-fg-primary">
            ${result.impliedPricePerKg.toFixed(2)} {strings.buyer.bidCheck.resultSuffix}
            <InfoTooltip
              label="About this price per kg"
              what={strings.buyer.bidCheck.tooltips.impliedPrice.what}
              how={strings.buyer.bidCheck.tooltips.impliedPrice.how}
            />
          </p>
          <StatusBadge status={result.status} className="text-base" />
          <p className="text-sm text-fg-secondary">
            {result.isBreach
              ? `$${result.variancePerKg.abs().toFixed(2)}/kg ${strings.buyer.bidCheck.overDnbp}`
              : `$${result.variancePerKg.toFixed(2)}/kg ${strings.buyer.bidCheck.headroom}`}
            {" · "}
            {strings.buyer.bidCheck.dnbpIs} ${new Decimal(speciesLine!.dnbp_per_kg).toFixed(2)}
          </p>
        </div>
      ) : null}

      {result && hasPrice ? (
        <div className="border-t border-subtle pt-4">
          <Button size="lg" variant={result.isBreach ? "danger" : "primary"} onClick={handleContinueToBuyLog}>
            {result.isBreach ? strings.buyer.bidCheck.logAnyway : strings.buyer.bidCheck.logThisBuy}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
