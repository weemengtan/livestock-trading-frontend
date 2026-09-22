"use client";

import * as React from "react";
import { AuthGuard } from "@/components/auth-guard";
import { AppShell } from "@/components/app-shell";
import { BuyerBottomNav } from "@/components/buyer/bottom-nav";
import { SyncStatusBadge } from "@/components/buyer/sync-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/components/ui/toast";
import { useAuthStore } from "@/lib/auth-store";
import { strings } from "@/lib/strings";
import { useSaleyards } from "@/lib/buyer/use-saleyards";
import { useSpecies } from "@/lib/buyer/use-species";
import { submitObservation } from "@/lib/buyer/create-observation";
import { flushPendingObservations } from "@/lib/buyer/sync-observations";
import { useLiveQuery } from "dexie-react-hooks";
import { buyerDb } from "@/lib/buyer/db";

export default function MarketIntelPage() {
  return (
    <AuthGuard requiredRole="BUYER">
      <AppShell title={strings.buyer.marketIntel.title}>
        <MarketIntelContent />
      </AppShell>
      <BuyerBottomNav />
    </AuthGuard>
  );
}

function MarketIntelContent() {
  const accessToken = useAuthStore((s) => s.accessToken);
  // Market Intel has no relationship to DNBP or any business transaction —
  // its species list comes from the open registry, not a DNBP publication
  // (see lib/buyer/use-species.ts).
  const speciesOptions = useSpecies(accessToken);
  const noSpecies = speciesOptions.length === 0;
  // Null until the buyer types one — see the same pattern in buy-log/page.tsx.
  const { options: saleyardOptions, defaultSaleyard } = useSaleyards(accessToken);
  const [saleyardChoice, setSaleyardChoice] = React.useState<string | null>(null);
  const saleyard = saleyardChoice ?? defaultSaleyard;
  const [speciesChoice, setSpeciesChoice] = React.useState("");
  // Falls back to the first registry species until the buyer explicitly
  // picks one — derived at render time, not via an effect, so a background
  // cache refresh can update the default without fighting an in-progress
  // selection.
  const species = speciesChoice || speciesOptions[0]?.code || "";
  const [competitor, setCompetitor] = React.useState("");
  const [agent, setAgent] = React.useState("");
  const [pen, setPen] = React.useState("");
  const [heads, setHeads] = React.useState("1");
  const [price, setPrice] = React.useState("");
  const [weight, setWeight] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [isEstimated, setIsEstimated] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const pendingResult = useLiveQuery(() => buyerDb.pending_observations.toArray(), []);
  const pending = React.useMemo(() => (pendingResult ?? []).slice().reverse(), [pendingResult]);

  React.useEffect(() => {
    void flushPendingObservations(accessToken);
  }, [accessToken]);

  async function handleSave() {
    if (!species || !competitor || !price || !saleyard.trim()) return;

    setSaving(true);
    try {
      await submitObservation(
        {
          saleyard,
          species,
          competitor_name: competitor,
          agent: agent || null,
          pen: pen || null,
          head_count: Number(heads) || 1,
          price_per_head: price,
          weight_kg: weight || null,
          description: description || null,
          is_estimated: isEstimated,
        },
        accessToken
      );
      setCompetitor("");
      setAgent("");
      setPen("");
      setHeads("1");
      setPrice("");
      setWeight("");
      setDescription("");
      setIsEstimated(false);
      toast({ title: "Observation saved" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4 pb-24">
      <p className="text-sm text-fg-tertiary">{strings.buyer.marketIntel.subtitle}</p>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="mi-saleyard">Saleyard</Label>
          <Input
            id="mi-saleyard"
            list="mi-saleyard-options"
            value={saleyard}
            onChange={(e) => setSaleyardChoice(e.target.value)}
          />
          <datalist id="mi-saleyard-options">
            {saleyardOptions.map((o) => (
              <option key={o.saleyard} value={o.saleyard} />
            ))}
          </datalist>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="mi-species">{strings.buyer.marketIntel.speciesLabel}</Label>
          <select
            id="mi-species"
            value={species}
            onChange={(e) => setSpeciesChoice(e.target.value)}
            disabled={noSpecies}
            className="h-12 rounded-md border border-default bg-surface px-3 disabled:opacity-50"
          >
            {noSpecies ? (
              <option value="">{strings.buyer.marketIntel.noSpecies}</option>
            ) : (
              speciesOptions.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.display_name}
                </option>
              ))
            )}
          </select>
          {noSpecies ? <p className="text-xs text-status-close-fg">{strings.buyer.marketIntel.noSpeciesHint}</p> : null}
        </div>
      </div>

      <Field label={strings.buyer.marketIntel.competitorLabel} value={competitor} onChange={setCompetitor} />

      <div className="grid grid-cols-3 gap-3">
        <Field label={strings.buyer.marketIntel.agentLabel} value={agent} onChange={setAgent} />
        <Field label={strings.buyer.marketIntel.penLabel} value={pen} onChange={setPen} />
        <Field label={strings.buyer.marketIntel.headsLabel} value={heads} onChange={setHeads} numeric />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label={strings.buyer.marketIntel.priceLabel} value={price} onChange={setPrice} numeric />
        <Field label={strings.buyer.marketIntel.weightLabel} value={weight} onChange={setWeight} numeric />
      </div>
      <Field label={strings.buyer.marketIntel.descLabel} value={description} onChange={setDescription} />

      <label className="flex items-center gap-2 text-sm text-fg-secondary">
        <Checkbox checked={isEstimated} onChange={(e) => setIsEstimated(e.target.checked)} />
        {strings.buyer.marketIntel.estimatedLabel}
      </label>

      <Button size="lg" onClick={handleSave} disabled={!species || !competitor || !price || !saleyard.trim() || saving}>
        {saving ? strings.buyer.marketIntel.saving : strings.buyer.marketIntel.save}
      </Button>

      <div className="flex flex-col gap-2 border-t border-subtle pt-4">
        {pending.length === 0 ? (
          <EmptyState title={strings.buyer.marketIntel.queuedEmpty} body={strings.buyer.marketIntel.queuedHint} />
        ) : (
          <>
            <p className="text-xs text-fg-tertiary">{strings.buyer.marketIntel.queuedHint}</p>
            {pending.map((p) => (
              <div key={p.client_uuid} className="flex items-center justify-between rounded-md border border-subtle px-3 py-2 text-sm">
                <span>
                  {p.payload.species} · {p.payload.competitor_name} · {p.payload.agent ?? "—"} · {p.payload.pen ?? "—"} ·{" "}
                  {p.payload.head_count}hd
                </span>
                <div className="flex items-center gap-3">
                  <span data-numeric>${Number(p.payload.price_per_head).toFixed(2)}</span>
                  <SyncStatusBadge status={p.sync_status} />
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
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
