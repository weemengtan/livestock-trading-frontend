"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import { useAuthStore } from "@/lib/auth-store";
import { ApiError } from "@/lib/api-client";
import {
  referenceDataApi,
  type ActiveConfig,
  type ImpactPreview,
  type NewEntry,
  type ReferenceDataVersion,
  type SpeciesRow,
} from "@/lib/reference-data-api";
import { strings } from "@/lib/strings";
import { withErrorToast } from "@/lib/with-error-toast";

function EditForm({
  active,
  species,
  onDrafted,
}: {
  active: ActiveConfig;
  species: SpeciesRow[];
  onDrafted: (version: ReferenceDataVersion) => void;
}) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [open, setOpen] = React.useState(false);
  const [cifBuffer, setCifBuffer] = React.useState(active.cif_buffer_per_kg);
  const [note, setNote] = React.useState("");
  const [factors, setFactors] = React.useState<Record<string, string>>(
    Object.fromEntries(species.map((s) => [s.code, active.dnbp_factor_by_species[s.code] ?? ""]))
  );
  const [weights, setWeights] = React.useState<Record<string, string>>(
    Object.fromEntries(species.map((s) => [s.code, active.standard_weight_by_species[s.code] ?? ""]))
  );
  const [bidThreshold, setBidThreshold] = React.useState(active.bid_check_close_threshold_pct);
  const [tolerance, setTolerance] = React.useState(active.buyer_weight_band_tolerance_pct);
  const [staleHours, setStaleHours] = React.useState(String(active.stale_instruction_hours));
  const [calendar, setCalendar] = React.useState(
    active.saleyard_calendar.map((row) => ({ ...row, note: row.note ?? "" }))
  );
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const entries: NewEntry[] = [
        { table_key: "cif_buffer_per_kg", key1: null, value: cifBuffer },
        { table_key: "bid_check_close_threshold_pct", key1: null, value: bidThreshold },
        { table_key: "buyer_weight_band_tolerance_pct", key1: null, value: tolerance },
        { table_key: "stale_instruction_hours", key1: null, value: staleHours },
        ...calendar.map(
          (row): NewEntry => ({
            table_key: "saleyard_calendar",
            key1: row.saleyard,
            key2: row.day,
            value: row.prepayment_aud,
            text_value: row.note || null,
          })
        ),
      ];
      for (const s of species) {
        if (factors[s.code]) entries.push({ table_key: "dnbp_factor_by_species", key1: s.code, value: factors[s.code] });
        if (weights[s.code]) entries.push({ table_key: "standard_weight_by_species", key1: s.code, value: weights[s.code] });
      }
      const version = await referenceDataApi.createVersion(
        { effective_from: new Date().toISOString(), note: note || undefined, entries },
        accessToken
      );
      setOpen(false);
      onDrafted(version);
    } catch (err) {
      toast({ title: err instanceof ApiError ? err.message : "Could not save changes", variant: "danger" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">{strings.referenceData.model.editButton}</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogTitle>{strings.referenceData.editor.title}</DialogTitle>
        <DialogDescription>
          This creates a new version. Nothing takes effect until you preview its impact and activate it.
        </DialogDescription>
        {/* eslint-disable-next-line local/no-raw-design-values -- 60vh caps this dialog's scroll area
            to a viewport fraction; no spacing/sizing token or Tailwind scale step expresses "% of
            viewport height", and percentage-height utilities (max-h-2/3 etc.) are relative to the
            parent, not the viewport, which isn't equivalent here. */}
        <form className="mt-4 flex max-h-[60vh] flex-col gap-4 overflow-y-auto" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cif-buffer">{strings.referenceData.model.cifBuffer}</Label>
            <Input id="cif-buffer" value={cifBuffer} onChange={(e) => setCifBuffer(e.target.value)} required />
          </div>

          <div>
            <p className="text-sm font-medium text-fg-secondary">{strings.referenceData.model.dnbpFactor}</p>
            <div className="mt-2 flex flex-col gap-2">
              {species.map((s) => (
                <div key={s.code} className="grid grid-cols-3 items-center gap-2">
                  <span className="text-sm">{s.display_name}</span>
                  <Input
                    aria-label={`${s.code} factor`}
                    value={factors[s.code] ?? ""}
                    onChange={(e) => setFactors((prev) => ({ ...prev, [s.code]: e.target.value }))}
                    placeholder="not set"
                  />
                  <Input
                    aria-label={`${s.code} standard weight`}
                    value={weights[s.code] ?? ""}
                    onChange={(e) => setWeights((prev) => ({ ...prev, [s.code]: e.target.value }))}
                    placeholder="weight (kg)"
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-fg-secondary">{strings.referenceData.model.operationalTitle}</p>
            <div className="mt-2 flex flex-col gap-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="bid-threshold">{strings.referenceData.model.bidCheckThreshold}</Label>
                <Input id="bid-threshold" value={bidThreshold} onChange={(e) => setBidThreshold(e.target.value)} required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="weight-tolerance">{strings.referenceData.model.weightTolerance}</Label>
                <Input id="weight-tolerance" value={tolerance} onChange={(e) => setTolerance(e.target.value)} required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="stale-hours">{strings.referenceData.model.staleHours}</Label>
                <Input id="stale-hours" value={staleHours} onChange={(e) => setStaleHours(e.target.value)} required />
              </div>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-fg-secondary">{strings.referenceData.model.calendarTitle}</p>
            <div className="mt-2 flex flex-col gap-2">
              {calendar.map((row, index) => (
                <div key={`${row.saleyard}-${row.day}`} className="grid grid-cols-3 items-center gap-2">
                  <span className="text-sm">
                    {row.saleyard} · {row.day.charAt(0)}
                    {row.day.slice(1).toLowerCase()}
                  </span>
                  <Input
                    aria-label={`${row.saleyard} ${strings.referenceData.model.prepayment}`}
                    value={row.prepayment_aud}
                    onChange={(e) =>
                      setCalendar((prev) => prev.map((r, i) => (i === index ? { ...r, prepayment_aud: e.target.value } : r)))
                    }
                  />
                  <Input
                    aria-label={`${row.saleyard} ${strings.referenceData.model.calendarNote}`}
                    value={row.note ?? ""}
                    onChange={(e) =>
                      setCalendar((prev) => prev.map((r, i) => (i === index ? { ...r, note: e.target.value } : r)))
                    }
                    placeholder="note"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="version-note">{strings.referenceData.editor.note}</Label>
            <Input id="version-note" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={submitting}>
              {submitting ? strings.referenceData.editor.previewing : strings.referenceData.editor.previewButton}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ImpactAndActivate({ version, onActivated }: { version: ReferenceDataVersion; onActivated: () => void }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [impact, setImpact] = React.useState<ImpactPreview | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [activating, setActivating] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      try {
        setImpact(await referenceDataApi.previewImpact(version.id, accessToken));
      } catch (err) {
        toast({ title: err instanceof ApiError ? err.message : "Could not compute impact", variant: "danger" });
      } finally {
        setLoading(false);
      }
    })();
  }, [version.id, accessToken]);

  async function handleActivate() {
    setActivating(true);
    try {
      await referenceDataApi.activateVersion(version.id, accessToken);
      toast({ title: "Version activated" });
      onActivated();
    } catch (err) {
      toast({ title: err instanceof ApiError ? err.message : "Could not activate", variant: "danger" });
    } finally {
      setActivating(false);
    }
  }

  if (loading) return <p className="text-sm text-fg-tertiary">{strings.referenceData.editor.previewing}</p>;
  if (!impact) return null;

  const exposure = Number(impact.aggregate_exposure_delta_aud);

  return (
    <Card className="border-status-close-fg">
      <p className="text-sm font-semibold text-fg-primary">{strings.referenceData.impact.title}</p>
      <p className="mt-1 text-sm text-status-close-fg">{strings.referenceData.impact.warning}</p>

      <div className="mt-3 flex gap-6 text-sm">
        <span>
          {impact.lines_affected} {strings.referenceData.impact.linesAffected}
        </span>
        <span className="inline-flex items-center gap-1 tabular-nums">
          {strings.referenceData.impact.aggregateExposure}:{" "}
          <strong className={exposure < 0 ? "text-status-pass-fg" : exposure > 0 ? "text-status-breach-fg" : ""}>
            {exposure.toLocaleString("en-AU", { style: "currency", currency: "AUD" })}
          </strong>
          <InfoTooltip
            label={`About ${strings.referenceData.impact.aggregateExposure}`}
            what={strings.referenceData.impact.tooltips.aggregateExposure.what}
            how={strings.referenceData.impact.tooltips.aggregateExposure.how}
          />
        </span>
      </div>

      {impact.lines.length > 0 ? (
        <div className="mt-3 max-h-64 overflow-y-auto rounded-md border border-subtle">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-subtle text-left text-xs uppercase tracking-wide text-fg-tertiary">
                <th className="px-3 py-2 font-medium">Contract</th>
                <th className="px-3 py-2 font-medium">Species</th>
                <th className="px-3 py-2 font-medium tabular-nums">Before</th>
                <th className="px-3 py-2 font-medium tabular-nums">After</th>
              </tr>
            </thead>
            <tbody>
              {impact.lines.map((line) => (
                <tr key={line.order_line_id} className="border-b border-subtle last:border-0">
                  <td className="px-3 py-2">{line.contract_no}</td>
                  <td className="px-3 py-2">{line.species}</td>
                  <td className="px-3 py-2 tabular-nums">{line.old_dnbp ? `$${Number(line.old_dnbp).toFixed(4)}` : "—"}</td>
                  <td className="px-3 py-2 tabular-nums font-semibold">
                    {line.new_dnbp ? `$${Number(line.new_dnbp).toFixed(4)}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <Dialog>
        <DialogTrigger asChild>
          <Button className="mt-4" disabled={activating}>
            {strings.referenceData.impact.activateButton}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogTitle>{strings.referenceData.impact.confirmTitle}</DialogTitle>
          <DialogDescription>{strings.referenceData.impact.confirmBody}</DialogDescription>
          <div className="mt-4 flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
            <DialogClose asChild>
              <Button onClick={handleActivate} disabled={activating}>
                {activating ? strings.referenceData.impact.activating : strings.referenceData.impact.activateButton}
              </Button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export function DnbpModelPanel() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [active, setActive] = React.useState<ActiveConfig | null>(null);
  const [species, setSpecies] = React.useState<SpeciesRow[]>([]);
  const [versions, setVersions] = React.useState<ReferenceDataVersion[]>([]);
  const [draft, setDraft] = React.useState<ReferenceDataVersion | null>(null);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    try {
      await withErrorToast(async () => {
        const [activeConfig, speciesRows, versionRows] = await Promise.all([
          referenceDataApi.getActive(accessToken),
          referenceDataApi.listSpecies(accessToken),
          referenceDataApi.listVersions(accessToken),
        ]);
        setActive(activeConfig);
        setSpecies(speciesRows.filter((s) => s.is_active));
        setVersions(versionRows);
      });
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  React.useEffect(() => {
    void load();
  }, [load]);

  if (loading || !active) return <p className="text-sm text-fg-tertiary">Loading…</p>;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-fg-primary">{strings.referenceData.model.title}</p>
            <p className="text-sm text-fg-secondary">{strings.referenceData.model.subtitle}</p>
          </div>
          <EditForm active={active} species={species} onDrafted={setDraft} />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-fg-tertiary">
              {strings.referenceData.model.cifBuffer}
            </p>
            <p className="text-lg font-semibold tabular-nums">{Number(active.cif_buffer_per_kg).toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-fg-tertiary">Ref data version</p>
            <p className="text-sm text-fg-secondary">{active.ref_data_version}</p>
            <p className="mt-2 text-xs font-medium uppercase tracking-wide text-fg-tertiary">
              {strings.referenceData.model.modelType}
            </p>
            <Badge variant="neutral">{active.model_type}</Badge>
          </div>
        </div>

        <div className="mt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-fg-tertiary">
            {strings.referenceData.model.dnbpFactor}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.entries(active.dnbp_factor_by_species).map(([code, value]) => (
              <Badge key={code} variant="accent">
                {code}: {Number(value).toFixed(2)}
              </Badge>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-fg-tertiary">
              {strings.referenceData.model.bidCheckThreshold}
            </p>
            <p className="text-lg font-semibold tabular-nums">{Number(active.bid_check_close_threshold_pct)}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-fg-tertiary">
              {strings.referenceData.model.weightTolerance}
            </p>
            <p className="text-lg font-semibold tabular-nums">{Number(active.buyer_weight_band_tolerance_pct)}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-fg-tertiary">
              {strings.referenceData.model.staleHours}
            </p>
            <p className="text-lg font-semibold tabular-nums">{active.stale_instruction_hours}</p>
          </div>
        </div>

        <div className="mt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-fg-tertiary">
            {strings.referenceData.model.calendarTitle}
          </p>
          <div className="mt-2 flex flex-col gap-1 text-sm">
            {active.saleyard_calendar.map((row) => (
              <div key={`${row.saleyard}-${row.day}`} className="flex flex-wrap items-baseline gap-x-3">
                <span className="font-medium">{row.saleyard}</span>
                <span className="text-fg-secondary">
                  {row.day.charAt(0)}
                  {row.day.slice(1).toLowerCase()}
                </span>
                <span className="tabular-nums">
                  {Number(row.prepayment_aud).toLocaleString("en-AU", { style: "currency", currency: "AUD" })}
                </span>
                {row.note ? <span className="text-fg-tertiary">{row.note}</span> : null}
              </div>
            ))}
          </div>
        </div>
      </Card>

      {draft ? <ImpactAndActivate version={draft} onActivated={() => { setDraft(null); void load(); }} /> : null}

      <Card>
        <p className="text-sm font-semibold text-fg-primary">{strings.referenceData.model.versionHistory}</p>
        <div className="mt-2 flex flex-col gap-1">
          {versions.map((v) => (
            <div key={v.id} className="flex items-center justify-between text-sm">
              <span>
                {new Date(v.created_at).toLocaleString()} {v.note ? `— ${v.note}` : ""}
              </span>
              {v.is_active ? <Badge variant="pass">{strings.referenceData.model.active}</Badge> : null}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
