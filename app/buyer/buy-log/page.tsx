"use client";

import * as React from "react";
import { Suspense } from "react";
import Decimal from "decimal.js";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthGuard } from "@/components/auth-guard";
import { AppShell } from "@/components/app-shell";
import { BuyerBottomNav } from "@/components/buyer/bottom-nav";
import { BreachReasonChips } from "@/components/buyer/breach-reason-chips";
import { StatusBadge } from "@/components/buyer/status-badge";
import { SyncStatusBadge } from "@/components/buyer/sync-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/empty-state";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { toast } from "@/components/ui/toast";
import { useAuthStore } from "@/lib/auth-store";
import { melbourneDate } from "@/lib/business-time";
import { strings } from "@/lib/strings";
import { scoreBid } from "@/lib/buyer/bidcheck";
import { checkEntryBounds } from "@/lib/buyer/entry-bounds";
import { buyerApi } from "@/lib/buyer-api";
import { buyerDb, cacheHistoryEntry, discardPendingEntry, type CachedDnbp, type PendingEntry } from "@/lib/buyer/db";
import { useDnbpCurrent } from "@/lib/buyer/use-dnbp-current";
import { useSaleyards } from "@/lib/buyer/use-saleyards";
import { DnbpRequiredNotice } from "@/components/buyer/dnbp-required-notice";
import { submitBuyEntry } from "@/lib/buyer/create-entry";
import { flushPendingEntries } from "@/lib/buyer/sync";
import { useLiveQuery } from "dexie-react-hooks";

const DUPLICATE_WINDOW_MS = 2 * 60 * 1000;

export default function BuyLogPage() {
  return (
    <AuthGuard requiredRole="BUYER">
      <AppShell title={strings.buyer.buyLog.title}>
        <Suspense fallback={null}>
          <BuyLogContent />
        </Suspense>
      </AppShell>
      <BuyerBottomNav />
    </AuthGuard>
  );
}

function BuyLogContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const accessToken = useAuthStore((s) => s.accessToken);
  // ack: false — the DNBP home screen owns the "buyer has seen it" signal.
  const { cached, status } = useDnbpCurrent({ ack: false });
  // A handoff from Bid Check (species/weight/price as URL query params) means
  // the buyer already evaluated a specific lot and is here to log exactly
  // that one; it seeds the form once, at first render.
  const [draft] = React.useState(() => {
    const s = searchParams.get("species");
    const w = searchParams.get("weight");
    const p = searchParams.get("price");
    return s && w && p ? { species: s, weight: w, price: p } : null;
  });
  // Null until the buyer types one — the field shows today's calendar
  // saleyard (see lib/buyer/use-saleyards.ts) until then, derived at render
  // time so a background calendar refresh can't overwrite what they typed.
  const { options: saleyardOptions, defaultSaleyard } = useSaleyards(accessToken);
  const [saleyardChoice, setSaleyardChoice] = React.useState<string | null>(null);
  const saleyard = saleyardChoice ?? defaultSaleyard;
  const [speciesChoice, setSpeciesChoice] = React.useState(draft?.species ?? "");
  const species = speciesChoice || cached?.species[0]?.species || "";
  const [agent, setAgent] = React.useState("");
  const [pen, setPen] = React.useState("");
  const [heads, setHeads] = React.useState("1");
  const [price, setPrice] = React.useState(draft?.price ?? "");
  const [weight, setWeight] = React.useState(draft?.weight ?? "");
  const [description, setDescription] = React.useState("");
  const [freight, setFreight] = React.useState("");
  const [cost, setCost] = React.useState("");
  const [breachReason, setBreachReason] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const today = melbourneDate();

  const historyResult = useLiveQuery(() => buyerDb.entry_history.where("trade_date").equals(today).toArray(), [today]);
  const pendingResult = useLiveQuery(() => buyerDb.pending_entries.toArray(), []);
  const pending = React.useMemo(() => pendingResult ?? [], [pendingResult]);
  // "failed" is terminal (lib/buyer/db.ts's SyncStatus docstring) — it
  // never became a real buy_entries row and never will as-is, so it's kept
  // out of `rows`/`totals` below and shown in its own "Needs attention"
  // section instead, requiring the buyer to fix-and-resave or discard it.
  const activePending = React.useMemo(() => pending.filter((p) => p.sync_status !== "failed"), [pending]);
  const failedPending = React.useMemo(() => pending.filter((p) => p.sync_status === "failed"), [pending]);

  React.useEffect(() => {
    if (draft) router.replace("/buyer/buy-log");
  }, [draft, router]);

  React.useEffect(() => {
    void flushPendingEntries(accessToken);
    if (accessToken) {
      buyerApi
        .listEntries(accessToken, { tradeDate: today })
        .then((entries) => Promise.all(entries.map((e) => cacheHistoryEntry(e))))
        .catch(() => {});
    }
  }, [accessToken, today]);

  const speciesLine = cached?.species.find((s) => s.species === species);
  const result =
    speciesLine && price && weight && cached
      ? scoreBid({
          pricePerHead: price,
          weightKg: weight,
          dnbpPerKg: speciesLine.dnbp_per_kg,
          closeThresholdPct: cached.buyer_config.bid_check_close_threshold_pct,
        })
      : null;

  // weight_band is the buyer-facing ±15% tolerance band already published
  // per species; standard weight is its midpoint (min+max)/2 — same
  // reference data checkEntryBounds' configured weight multiples outer
  // sanity net is built on.
  const standardWeightKg = speciesLine?.weight_band
    ? new Decimal(speciesLine.weight_band.min).plus(speciesLine.weight_band.max).dividedBy(2)
    : null;
  const boundsViolations =
    price && weight && cached
      ? checkEntryBounds({
          headCount: heads || "0",
          pricePerHead: price,
          weightKg: weight,
          species,
          standardWeightKg,
          maxHeadCount: cached.buyer_config.entry_bounds.max_head_count,
          maxPricePerHead: cached.buyer_config.entry_bounds.max_price_per_head,
          weightLowerMultiple: cached.buyer_config.entry_bounds.weight_lower_multiple,
          weightUpperMultiple: cached.buyer_config.entry_bounds.weight_upper_multiple,
          fallbackWeightMinKg: cached.buyer_config.entry_bounds.fallback_weight_min_kg,
          fallbackWeightMaxKg: cached.buyer_config.entry_bounds.fallback_weight_max_kg,
        })
      : [];

  async function handleSave() {
    if (!result || !saleyard.trim() || boundsViolations.length > 0) return;
    if (result.isBreach && !breachReason) {
      toast({ title: strings.buyer.buyLog.breachReasonLabel, variant: "danger" });
      return;
    }

    // §12.4 — "warn if agent + pen + price repeat within 2 minutes."
    // Evaluated at save time (an event handler, not render), non-blocking.
    const now = Date.now();
    const isDuplicate = activePending.some(
      (p) =>
        p.payload.agent === agent &&
        p.payload.pen === pen &&
        p.payload.price_per_head === price &&
        Math.abs(now - new Date(p.payload.client_created_at).getTime()) < DUPLICATE_WINDOW_MS
    );
    if (isDuplicate) {
      toast({ title: strings.buyer.buyLog.duplicateWarning, variant: "danger" });
    }

    setSaving(true);
    try {
      await submitBuyEntry(
        {
          saleyard,
          species,
          agent: agent || null,
          pen: pen || null,
          head_count: Number(heads) || 1,
          price_per_head: price,
          weight_kg: weight,
          description: description || null,
          freight_per_head: freight || null,
          other_cost_per_kg: cost || null,
          breach_reason: result.isBreach ? breachReason : null,
        },
        accessToken
      );
      setAgent("");
      setPen("");
      setHeads("1");
      setPrice("");
      setWeight("");
      setDescription("");
      setFreight("");
      setCost("");
      setBreachReason(null);
      toast({ title: "Entry saved" });
    } finally {
      setSaving(false);
    }
  }

  // "Needs attention" actions (see SyncStatus's docstring) — a "failed"
  // entry never became a real buy and never will as-is, so the buyer must
  // either fix-and-resave (repopulate the form, discard the stale queued
  // copy so resaving doesn't leave two) or explicitly discard it.
  function handleEditFailed(entry: PendingEntry) {
    setSaleyardChoice(entry.payload.saleyard);
    setSpeciesChoice(entry.payload.species);
    setAgent(entry.payload.agent ?? "");
    setPen(entry.payload.pen ?? "");
    setHeads(String(entry.payload.head_count));
    setPrice(entry.payload.price_per_head);
    setWeight(entry.payload.weight_kg);
    setDescription(entry.payload.description ?? "");
    setFreight(entry.payload.freight_per_head ?? "");
    setCost(entry.payload.other_cost_per_kg ?? "");
    void discardPendingEntry(entry.client_uuid);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDiscardFailed(clientUuid: string) {
    await discardPendingEntry(clientUuid);
  }

  const rows = React.useMemo(() => {
    const history = historyResult ?? [];
    const byUuid = new Map<string, { client_uuid: string; species: string; agent: string | null; pen: string | null; head_count: number; price_per_head: string; weight_kg: string; implied_price_per_kg: string; is_breach: boolean; synced: boolean }>();
    for (const h of history) {
      byUuid.set(h.client_uuid, { ...h, synced: true });
    }
    for (const p of activePending) {
      if (!byUuid.has(p.client_uuid)) {
        const line = speciesForPayload(cached, p.payload);
        const scored =
          line && cached
            ? scoreBid({
                pricePerHead: p.payload.price_per_head,
                weightKg: p.payload.weight_kg,
                dnbpPerKg: line.dnbp_per_kg,
                closeThresholdPct: cached.buyer_config.bid_check_close_threshold_pct,
              })
            : null;
        byUuid.set(p.client_uuid, {
          client_uuid: p.client_uuid,
          species: p.payload.species,
          agent: p.payload.agent ?? null,
          pen: p.payload.pen ?? null,
          head_count: p.payload.head_count,
          price_per_head: p.payload.price_per_head,
          weight_kg: p.payload.weight_kg,
          implied_price_per_kg: scored ? scored.impliedPricePerKg.toFixed(4) : "0",
          is_breach: scored?.isBreach ?? false,
          synced: false,
        });
      }
    }
    return Array.from(byUuid.values()).reverse();
  }, [historyResult, activePending, cached]);

  const totals = React.useMemo(() => {
    let totalHeads = 0;
    let totalKg = new Decimal(0);
    let totalSpend = new Decimal(0);
    let breaches = 0;
    for (const row of rows) {
      totalHeads += row.head_count;
      const kg = new Decimal(row.weight_kg).times(row.head_count);
      totalKg = totalKg.plus(kg);
      totalSpend = totalSpend.plus(new Decimal(row.price_per_head).times(row.head_count));
      if (row.is_breach) breaches += 1;
    }
    const avg = totalKg.greaterThan(0) ? totalSpend.dividedBy(totalKg) : new Decimal(0);
    return { totalHeads, totalKg, totalSpend, avg, breaches };
  }, [rows]);

  return (
    <div className="flex flex-col gap-4 p-4 pb-24">
      {status === "ready" ? (
        <>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="saleyard">Saleyard</Label>
          <Input
            id="saleyard"
            list="saleyard-options"
            value={saleyard}
            onChange={(e) => setSaleyardChoice(e.target.value)}
          />
          <datalist id="saleyard-options">
            {saleyardOptions.map((o) => (
              <option key={o.saleyard} value={o.saleyard} />
            ))}
          </datalist>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="log-species">{strings.buyer.buyLog.speciesLabel}</Label>
          <select
            id="log-species"
            value={species}
            onChange={(e) => setSpeciesChoice(e.target.value)}
            className="h-12 rounded-md border border-default bg-surface px-3"
          >
            {(cached?.species ?? []).map((s) => (
              <option key={s.species} value={s.species}>
                {s.species}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Field label={strings.buyer.buyLog.agentLabel} value={agent} onChange={setAgent} />
        <Field label={strings.buyer.buyLog.penLabel} value={pen} onChange={setPen} />
        <Field label={strings.buyer.buyLog.headsLabel} value={heads} onChange={setHeads} numeric />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label={strings.buyer.buyLog.priceLabel} value={price} onChange={setPrice} numeric />
        <Field label={strings.buyer.buyLog.weightLabel} value={weight} onChange={setWeight} numeric />
      </div>
      <Field label={strings.buyer.buyLog.descLabel} value={description} onChange={setDescription} />
      <div className="grid grid-cols-2 gap-3">
        <Field label={strings.buyer.buyLog.freightLabel} value={freight} onChange={setFreight} numeric />
        <Field label={strings.buyer.buyLog.costLabel} value={cost} onChange={setCost} numeric />
      </div>

      {result ? (
        <div className="flex items-center justify-between rounded-md border border-subtle bg-sunken px-4 py-3">
          <span data-numeric className="text-lg font-semibold">
            ${result.impliedPricePerKg.toFixed(2)}/kg
          </span>
          <StatusBadge status={result.status} />
        </div>
      ) : null}

      {result?.isBreach ? <BreachReasonChips value={breachReason} onChange={setBreachReason} /> : null}

      <Button size="lg" onClick={handleSave} disabled={!result || !saleyard.trim() || boundsViolations.length > 0 || saving}>
        {saving ? strings.buyer.buyLog.saving : strings.buyer.buyLog.save}
      </Button>
      {!result ? <p className="-mt-2 text-center text-sm text-fg-tertiary">{strings.buyer.buyLog.saveHint}</p> : null}
      {result && !saleyard.trim() ? (
        <p className="-mt-2 text-center text-sm text-fg-tertiary">{strings.buyer.buyLog.saleyardRequiredHint}</p>
      ) : null}
      {result && saleyard.trim() && boundsViolations.length > 0 ? (
        <div className="-mt-2 flex flex-col gap-1 text-center text-sm text-status-breach-fg">
          {boundsViolations.map((v) => (
            <p key={v}>{v}</p>
          ))}
        </div>
      ) : null}

      {failedPending.length > 0 ? (
        <div className="flex flex-col gap-2 rounded-md border border-status-breach-border bg-status-breach-bg p-3">
          <p className="text-sm font-semibold text-status-breach-fg">{strings.buyer.buyLog.needsAttention.title}</p>
          {failedPending.map((entry) => (
            <div key={entry.client_uuid} className="flex flex-col gap-1 rounded-md border border-subtle bg-surface p-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span>
                  {entry.payload.species} · {entry.payload.agent ?? "—"} · {entry.payload.pen ?? "—"} · {entry.payload.head_count}hd
                </span>
                <SyncStatusBadge status="failed" />
              </div>
              {entry.error_message ? <p className="text-xs text-fg-tertiary">{entry.error_message}</p> : null}
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => handleEditFailed(entry)}>
                  {strings.buyer.buyLog.needsAttention.edit}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => void handleDiscardFailed(entry.client_uuid)}>
                  {strings.buyer.buyLog.needsAttention.discard}
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
        </>
      ) : (
        <DnbpRequiredNotice status={status} />
      )}

      <div className="flex items-center gap-1 border-t border-subtle pt-4 text-sm text-fg-tertiary">
        <span>Today&apos;s totals</span>
        <InfoTooltip
          label="About today's totals"
          what={strings.buyer.buyLog.tooltips.totals.what}
          how={strings.buyer.buyLog.tooltips.totals.how}
        />
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
        <Total label={strings.buyer.buyLog.totals.heads} value={String(totals.totalHeads)} />
        <Total label={strings.buyer.buyLog.totals.kg} value={totals.totalKg.toFixed(1)} />
        <Total label={strings.buyer.buyLog.totals.spend} value={`$${totals.totalSpend.toFixed(2)}`} />
        <Total label={strings.buyer.buyLog.totals.avg} value={`$${totals.avg.toFixed(2)}`} />
        <Total label={strings.buyer.buyLog.totals.breaches} value={String(totals.breaches)} />
      </div>

      <div className="flex flex-col gap-2">
        {rows.length === 0 ? (
          <EmptyState title={strings.buyer.buyLog.empty} />
        ) : (
          rows.map((row) => (
            <div key={row.client_uuid} className="flex items-center justify-between rounded-md border border-subtle px-3 py-2 text-sm">
              <div className="flex items-center gap-2">
                <span className={row.is_breach ? "h-2 w-2 rounded-full bg-status-breach-border" : "h-2 w-2 rounded-full bg-status-pass-border"} aria-hidden />
                <span>{row.species} · {row.agent ?? "—"} · {row.pen ?? "—"} · {row.head_count}hd</span>
              </div>
              <div className="flex items-center gap-3">
                <span data-numeric>${Number(row.implied_price_per_kg).toFixed(2)}/kg</span>
                <SyncStatusBadge status={row.synced ? "synced" : "queued"} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function speciesForPayload(cached: CachedDnbp | null, payload: { species: string }) {
  return cached?.species.find((s) => s.species === payload.species) ?? null;
}

function Field({
  label,
  value,
  onChange,
  numeric,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  numeric?: boolean;
}) {
  const id = React.useId();
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        inputMode={numeric ? "decimal" : "text"}
        type={numeric ? "number" : "text"}
        className="h-12"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function Total({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-fg-tertiary">{label}</span>
      <span data-numeric className="font-semibold text-fg-primary">
        {value}
      </span>
    </div>
  );
}
