"use client";

import * as React from "react";
import { DateTime } from "@/components/ui/date-time";
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
import { StatTile } from "@/components/ui/stat-tile";
import { toast } from "@/components/ui/toast";
import { useAuthStore } from "@/lib/auth-store";
import { tidyDecimal as tidy } from "@/lib/decimal-format";
import { ApiError } from "@/lib/api-client";
import {
  referenceDataApi,
  type ActiveConfig,
  type KeyRef,
  type NewEntry,
  type ReferenceDataAuditEntry,
  type SaleyardCalendarRow,
  type ReferenceDataVersion,
} from "@/lib/reference-data-api";
import { strings } from "@/lib/strings";
import { withErrorToast } from "@/lib/with-error-toast";

const WEEKDAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];

type CalendarDraftRow = SaleyardCalendarRow & { removed: boolean; isNew: boolean };

function EditForm({
  active,
  onDrafted,
}: {
  active: ActiveConfig;
  onDrafted: (version: ReferenceDataVersion) => void;
}) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [open, setOpen] = React.useState(false);
  const [note, setNote] = React.useState("");
  const [bidThreshold, setBidThreshold] = React.useState(tidy(active.bid_check_close_threshold_pct));
  const [tolerance, setTolerance] = React.useState(tidy(active.buyer_weight_band_tolerance_pct));
  const [staleHours, setStaleHours] = React.useState(String(active.stale_instruction_hours));
  const [outlierThreshold, setOutlierThreshold] = React.useState(tidy(active.dnbp_outlier_threshold_pct));
  const [outlierLookbackDays, setOutlierLookbackDays] = React.useState(String(active.dnbp_outlier_lookback_days));
  const [analyticsTrailingDays, setAnalyticsTrailingDays] = React.useState(
    String(active.analytics_trailing_days_for_rate)
  );
  const [deliveryEscalationMinutes, setDeliveryEscalationMinutes] = React.useState(
    String(active.delivery_escalation_minutes)
  );
  const [entryBoundsMaxHeadCount, setEntryBoundsMaxHeadCount] = React.useState(
    String(active.entry_bounds_max_head_count)
  );
  const [entryBoundsMaxPricePerHead, setEntryBoundsMaxPricePerHead] = React.useState(
    tidy(active.entry_bounds_max_price_per_head)
  );
  const [entryBoundsWeightLowerMultiple, setEntryBoundsWeightLowerMultiple] = React.useState(
    tidy(active.entry_bounds_weight_lower_multiple)
  );
  const [entryBoundsWeightUpperMultiple, setEntryBoundsWeightUpperMultiple] = React.useState(
    tidy(active.entry_bounds_weight_upper_multiple)
  );
  const [entryBoundsFallbackWeightMinKg, setEntryBoundsFallbackWeightMinKg] = React.useState(
    tidy(active.entry_bounds_fallback_weight_min_kg)
  );
  const [entryBoundsFallbackWeightMaxKg, setEntryBoundsFallbackWeightMaxKg] = React.useState(
    tidy(active.entry_bounds_fallback_weight_max_kg)
  );
  const [benchmarkHighlightThreshold, setBenchmarkHighlightThreshold] = React.useState(
    tidy(active.benchmark_compare_highlight_threshold_pct)
  );
  const [calendar, setCalendar] = React.useState<CalendarDraftRow[]>(
    active.saleyard_calendar.map((row) => ({
      ...row,
      prepayment_aud: tidy(row.prepayment_aud),
      note: row.note ?? "",
      removed: false,
      isNew: false,
    }))
  );
  const [newYard, setNewYard] = React.useState({ saleyard: "", day: "MONDAY", prepayment_aud: "0" });
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const entries: NewEntry[] = [
        { table_key: "bid_check_close_threshold_pct", key1: null, value: bidThreshold },
        { table_key: "buyer_weight_band_tolerance_pct", key1: null, value: tolerance },
        { table_key: "stale_instruction_hours", key1: null, value: staleHours },
        { table_key: "dnbp_outlier_threshold_pct", key1: null, value: outlierThreshold },
        { table_key: "dnbp_outlier_lookback_days", key1: null, value: outlierLookbackDays },
        { table_key: "analytics_trailing_days_for_rate", key1: null, value: analyticsTrailingDays },
        { table_key: "delivery_escalation_minutes", key1: null, value: deliveryEscalationMinutes },
        { table_key: "entry_bounds_max_head_count", key1: null, value: entryBoundsMaxHeadCount },
        { table_key: "entry_bounds_max_price_per_head", key1: null, value: entryBoundsMaxPricePerHead },
        { table_key: "entry_bounds_weight_lower_multiple", key1: null, value: entryBoundsWeightLowerMultiple },
        { table_key: "entry_bounds_weight_upper_multiple", key1: null, value: entryBoundsWeightUpperMultiple },
        { table_key: "entry_bounds_fallback_weight_min_kg", key1: null, value: entryBoundsFallbackWeightMinKg },
        { table_key: "entry_bounds_fallback_weight_max_kg", key1: null, value: entryBoundsFallbackWeightMaxKg },
        {
          table_key: "benchmark_compare_highlight_threshold_pct",
          key1: null,
          value: benchmarkHighlightThreshold,
        },
        ...calendar
          .filter((row) => !row.removed)
          .map(
            (row): NewEntry => ({
              table_key: "saleyard_calendar",
              key1: row.saleyard,
              key2: row.day,
              value: row.prepayment_aud,
              text_value: row.note || null,
            })
          ),
      ];
      const removals: KeyRef[] = calendar
        .filter((row) => row.removed && !row.isNew)
        .map((row) => ({ table_key: "saleyard_calendar", key1: row.saleyard, key2: row.day }));
      const version = await referenceDataApi.createVersion(
        { effective_from: new Date().toISOString(), note: note || undefined, entries, removals },
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
          {strings.referenceData.settings.editDescription}
        </DialogDescription>
        {/* eslint-disable-next-line local/no-raw-design-values -- 60vh caps this dialog's scroll area
            to a viewport fraction; no spacing/sizing token or Tailwind scale step expresses "% of
            viewport height", and percentage-height utilities (max-h-2/3 etc.) are relative to the
            parent, not the viewport, which isn't equivalent here. */}
        <form className="mt-4 flex max-h-[60vh] flex-col gap-4 overflow-y-auto" onSubmit={handleSubmit}>
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
            <p className="text-sm font-medium text-fg-secondary">{strings.referenceData.model.outlierTitle}</p>
            <div className="mt-2 flex flex-col gap-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="outlier-threshold">{strings.referenceData.model.outlierThreshold}</Label>
                <Input
                  id="outlier-threshold"
                  value={outlierThreshold}
                  onChange={(e) => setOutlierThreshold(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="outlier-lookback-days">{strings.referenceData.model.outlierLookbackDays}</Label>
                <Input
                  id="outlier-lookback-days"
                  value={outlierLookbackDays}
                  onChange={(e) => setOutlierLookbackDays(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="analytics-trailing-days">{strings.referenceData.model.analyticsTrailingDays}</Label>
                <Input
                  id="analytics-trailing-days"
                  value={analyticsTrailingDays}
                  onChange={(e) => setAnalyticsTrailingDays(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="delivery-escalation-minutes">
                  {strings.referenceData.model.deliveryEscalationMinutes}
                </Label>
                <Input
                  id="delivery-escalation-minutes"
                  value={deliveryEscalationMinutes}
                  onChange={(e) => setDeliveryEscalationMinutes(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-fg-secondary">{strings.referenceData.model.entryBoundsTitle}</p>
            <div className="mt-2 flex flex-col gap-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="entry-bounds-max-head-count">
                  {strings.referenceData.model.entryBoundsMaxHeadCount}
                </Label>
                <Input
                  id="entry-bounds-max-head-count"
                  value={entryBoundsMaxHeadCount}
                  onChange={(e) => setEntryBoundsMaxHeadCount(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="entry-bounds-max-price-per-head">
                  {strings.referenceData.model.entryBoundsMaxPricePerHead}
                </Label>
                <Input
                  id="entry-bounds-max-price-per-head"
                  value={entryBoundsMaxPricePerHead}
                  onChange={(e) => setEntryBoundsMaxPricePerHead(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="entry-bounds-weight-lower-multiple">
                  {strings.referenceData.model.entryBoundsWeightLowerMultiple}
                </Label>
                <Input
                  id="entry-bounds-weight-lower-multiple"
                  value={entryBoundsWeightLowerMultiple}
                  onChange={(e) => setEntryBoundsWeightLowerMultiple(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="entry-bounds-weight-upper-multiple">
                  {strings.referenceData.model.entryBoundsWeightUpperMultiple}
                </Label>
                <Input
                  id="entry-bounds-weight-upper-multiple"
                  value={entryBoundsWeightUpperMultiple}
                  onChange={(e) => setEntryBoundsWeightUpperMultiple(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="entry-bounds-fallback-weight-min-kg">
                  {strings.referenceData.model.entryBoundsFallbackWeightMinKg}
                </Label>
                <Input
                  id="entry-bounds-fallback-weight-min-kg"
                  value={entryBoundsFallbackWeightMinKg}
                  onChange={(e) => setEntryBoundsFallbackWeightMinKg(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="entry-bounds-fallback-weight-max-kg">
                  {strings.referenceData.model.entryBoundsFallbackWeightMaxKg}
                </Label>
                <Input
                  id="entry-bounds-fallback-weight-max-kg"
                  value={entryBoundsFallbackWeightMaxKg}
                  onChange={(e) => setEntryBoundsFallbackWeightMaxKg(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-fg-secondary">{strings.referenceData.model.benchmarkTitle}</p>
            <div className="mt-2 flex flex-col gap-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="benchmark-highlight-threshold">
                  {strings.referenceData.model.benchmarkHighlightThreshold}
                </Label>
                <Input
                  id="benchmark-highlight-threshold"
                  value={benchmarkHighlightThreshold}
                  onChange={(e) => setBenchmarkHighlightThreshold(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-fg-secondary">{strings.referenceData.model.calendarTitle}</p>
            <div className="mt-2 flex flex-col gap-2">
              {calendar.map((row, index) => (
                <div key={`${row.saleyard}-${row.day}`} className="grid grid-cols-4 items-center gap-2">
                  <span className={`text-sm ${row.removed ? "text-fg-tertiary line-through" : ""}`}>
                    {row.saleyard} · {row.day.charAt(0)}
                    {row.day.slice(1).toLowerCase()}
                    {row.removed ? ` — ${strings.referenceData.model.removedLabel}` : ""}
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
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      setCalendar((prev) =>
                        row.isNew ? prev.filter((_, i) => i !== index) : prev.map((r, i) => (i === index ? { ...r, removed: !r.removed } : r))
                      )
                    }
                  >
                    {row.removed ? strings.referenceData.model.undoRemove : strings.referenceData.model.removeRow}
                  </Button>
                </div>
              ))}
              <div className="grid grid-cols-4 items-center gap-2">
                <Input
                  aria-label={strings.referenceData.model.newSaleyardName}
                  value={newYard.saleyard}
                  onChange={(e) => setNewYard((prev) => ({ ...prev, saleyard: e.target.value }))}
                  placeholder={strings.referenceData.model.newSaleyardName}
                />
                <select
                  aria-label={strings.referenceData.model.newSaleyardDay}
                  value={newYard.day}
                  onChange={(e) => setNewYard((prev) => ({ ...prev, day: e.target.value }))}
                  className="h-9 rounded-md border border-default bg-surface px-2 text-sm"
                >
                  {WEEKDAYS.map((d) => (
                    <option key={d} value={d}>
                      {d.charAt(0)}
                      {d.slice(1).toLowerCase()}
                    </option>
                  ))}
                </select>
                <Input
                  aria-label={strings.referenceData.model.prepayment}
                  value={newYard.prepayment_aud}
                  onChange={(e) => setNewYard((prev) => ({ ...prev, prepayment_aud: e.target.value }))}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={!newYard.saleyard.trim()}
                  onClick={() => {
                    setCalendar((prev) => [
                      ...prev,
                      { ...newYard, saleyard: newYard.saleyard.trim(), note: "", removed: false, isNew: true },
                    ]);
                    setNewYard({ saleyard: "", day: "MONDAY", prepayment_aud: "0" });
                  }}
                >
                  {strings.referenceData.model.addSaleyard}
                </Button>
              </div>
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

const AUDIT_ACTION_LABELS: Record<string, string> = {
  "reference_data_version.created": strings.referenceData.model.auditActionCreated,
  "reference_data_version.impact_previewed": strings.referenceData.model.auditActionImpactPreviewed,
  "reference_data_version.activated": strings.referenceData.model.auditActionActivated,
};

// Audit before/after payloads are small, flat, self-describing JSON blobs
// (see backend/services/reference_data_service.py's audit_service.write
// call sites) — humanized generically rather than mapped field-by-field in
// strings.ts, since these are diagnostic details, not primary product copy.
function humanizeAuditKey(key: string): string {
  const spaced = key.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function humanizeAuditValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (Array.isArray(value)) {
    if (value.length === 0) return "none";
    return value.map((v) => (typeof v === "object" && v !== null ? JSON.stringify(v) : String(v))).join(", ");
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function AuditEntryFields({ label, fields }: { label: string; fields: Record<string, unknown> }) {
  const entries = Object.entries(fields);
  if (entries.length === 0) return null;
  return (
    <div className="mt-0.5">
      <span className="text-fg-tertiary">{label}: </span>
      {entries.map(([k, v], i) => (
        <span key={k} className="text-fg-tertiary">
          {i > 0 ? " · " : ""}
          {humanizeAuditKey(k)}: {humanizeAuditValue(v)}
        </span>
      ))}
    </div>
  );
}

function VersionAuditTrail({ versionId }: { versionId: string }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [expanded, setExpanded] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [entries, setEntries] = React.useState<ReferenceDataAuditEntry[] | null>(null);

  async function toggle() {
    if (!expanded && entries === null) {
      setLoading(true);
      try {
        setEntries(await referenceDataApi.getAudit(versionId, accessToken));
      } catch (err) {
        toast({ title: err instanceof ApiError ? err.message : "Could not load audit trail", variant: "danger" });
      } finally {
        setLoading(false);
      }
    }
    setExpanded((prev) => !prev);
  }

  return (
    <div className="mt-1">
      <button
        type="button"
        className="text-xs font-medium text-accent-default underline-offset-2 hover:underline"
        onClick={() => void toggle()}
      >
        {expanded ? strings.referenceData.model.hideAuditTrail : strings.referenceData.model.viewAuditTrail}
      </button>
      {expanded ? (
        loading ? (
          <p className="mt-1 text-xs text-fg-tertiary">{strings.referenceData.model.loadingAuditTrail}</p>
        ) : (
          <div className="mt-2 flex flex-col gap-2 rounded-md border border-subtle bg-sunken p-2">
            {(entries ?? []).length === 0 ? (
              <p className="text-xs text-fg-tertiary">No audit entries.</p>
            ) : (
              (entries ?? []).map((entry) => (
                <div key={entry.id} className="text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-x-2 font-medium text-fg-secondary">
                    <span>{AUDIT_ACTION_LABELS[entry.action] ?? entry.action}</span>
                    <span className="font-normal text-fg-tertiary">
                      {entry.actor_email ?? strings.referenceData.model.auditSystemActor} · <DateTime value={entry.at} />
                    </span>
                  </div>
                  {entry.before ? <AuditEntryFields label="Before" fields={entry.before} /> : null}
                  {entry.after ? <AuditEntryFields label="After" fields={entry.after} /> : null}
                </div>
              ))
            )}
          </div>
        )
      ) : null}
    </div>
  );
}

/**
 * Activating an operational-settings version. Settings can't move the Do Not
 * Buy Price, so there is no price impact to review — but the server still
 * expects the preview step before it allows activation, so it is fetched on
 * open and its (empty) result is not shown.
 */
function ActivateSettings({ version, onActivated }: { version: ReferenceDataVersion; onActivated: () => void }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [ready, setReady] = React.useState(false);
  const [activating, setActivating] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const preview = await withErrorToast(() => referenceDataApi.previewImpact(version.id, accessToken), "Could not prepare activation");
      if (!cancelled) setReady(preview !== undefined);
    })();
    return () => {
      cancelled = true;
    };
  }, [version.id, accessToken]);

  async function handleActivate() {
    setActivating(true);
    const activated = await withErrorToast(() => referenceDataApi.activateVersion(version.id, accessToken), "Could not activate");
    setActivating(false);
    if (!activated) return;
    toast({ title: "Version activated" });
    onActivated();
  }

  return (
    <Card className="border-status-close-fg">
      <p className="text-sm font-semibold text-fg-primary">{strings.referenceData.editor.readyTitle}</p>
      <p className="mt-1 text-sm text-fg-secondary">{strings.referenceData.settings.activateNote}</p>
      <Dialog>
        <DialogTrigger asChild>
          <Button className="mt-4" disabled={!ready || activating}>
            {ready ? strings.referenceData.impact.activateButton : strings.referenceData.editor.previewing}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogTitle>{strings.referenceData.impact.confirmTitle}</DialogTitle>
          <DialogDescription>{strings.referenceData.settings.activateNote}</DialogDescription>
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

export function OperationalSettingsPanel() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [active, setActive] = React.useState<ActiveConfig | null>(null);
  const [versions, setVersions] = React.useState<ReferenceDataVersion[]>([]);
  const [draft, setDraft] = React.useState<ReferenceDataVersion | null>(null);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    try {
      await withErrorToast(async () => {
        const [activeConfig, versionRows] = await Promise.all([
          referenceDataApi.getActive(accessToken),
          referenceDataApi.listVersions(accessToken),
        ]);
        setActive(activeConfig);
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
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-fg-primary">{strings.referenceData.settings.title}</p>
          <p className="max-w-2xl text-sm text-fg-secondary">{strings.referenceData.settings.subtitle}</p>
        </div>
        <EditForm active={active} onDrafted={setDraft} />
      </div>

      <Card>
        <p className="text-sm text-fg-secondary">{strings.referenceData.settings.pricingMoved}</p>
        <p className="mt-1 text-sm text-fg-tertiary">
          {strings.referenceData.settings.currentModel}: <strong className="text-fg-primary">{active.ref_data_version}</strong>
        </p>
      </Card>

      <Card>
        <p className="text-sm font-semibold text-fg-primary">{strings.referenceData.model.operationalTitle}</p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatTile
            label={strings.referenceData.model.bidCheckThreshold}
            value={`${Number(active.bid_check_close_threshold_pct)}%`}
            tooltip={{
              label: `About ${strings.referenceData.model.bidCheckThreshold}`,
              ...strings.referenceData.model.tooltips.bidCheckThreshold,
            }}
          />
          <StatTile
            label={strings.referenceData.model.weightTolerance}
            value={`${Number(active.buyer_weight_band_tolerance_pct)}%`}
            tooltip={{
              label: `About ${strings.referenceData.model.weightTolerance}`,
              ...strings.referenceData.model.tooltips.weightTolerance,
            }}
          />
          <StatTile
            label={strings.referenceData.model.staleHours}
            value={`${active.stale_instruction_hours} hours`}
            tooltip={{
              label: `About ${strings.referenceData.model.staleHours}`,
              ...strings.referenceData.model.tooltips.staleHours,
            }}
          />
        </div>
      </Card>

      <Card>
        <p className="text-sm font-semibold text-fg-primary">{strings.referenceData.model.outlierTitle}</p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile
            label={strings.referenceData.model.outlierThreshold}
            value={`${Number(active.dnbp_outlier_threshold_pct)}%`}
            tooltip={{
              label: `About ${strings.referenceData.model.outlierThreshold}`,
              ...strings.referenceData.model.tooltips.outlierThreshold,
            }}
          />
          <StatTile
            label={strings.referenceData.model.outlierLookbackDays}
            value={`${active.dnbp_outlier_lookback_days} days`}
            tooltip={{
              label: `About ${strings.referenceData.model.outlierLookbackDays}`,
              ...strings.referenceData.model.tooltips.outlierLookbackDays,
            }}
          />
          <StatTile
            label={strings.referenceData.model.analyticsTrailingDays}
            value={`${active.analytics_trailing_days_for_rate} days`}
            tooltip={{
              label: `About ${strings.referenceData.model.analyticsTrailingDays}`,
              ...strings.referenceData.model.tooltips.analyticsTrailingDays,
            }}
          />
          <StatTile
            label={strings.referenceData.model.deliveryEscalationMinutes}
            value={`${active.delivery_escalation_minutes} min`}
            tooltip={{
              label: `About ${strings.referenceData.model.deliveryEscalationMinutes}`,
              ...strings.referenceData.model.tooltips.deliveryEscalationMinutes,
            }}
          />
        </div>
      </Card>

      <Card>
        <p className="text-sm font-semibold text-fg-primary">{strings.referenceData.model.entryBoundsTitle}</p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile
            label={strings.referenceData.model.entryBoundsMaxHeadCount}
            value={Number(active.entry_bounds_max_head_count).toLocaleString("en-AU")}
            tooltip={{
              label: `About ${strings.referenceData.model.entryBoundsMaxHeadCount}`,
              ...strings.referenceData.model.tooltips.entryBoundsMaxHeadCount,
            }}
          />
          <StatTile
            label={strings.referenceData.model.entryBoundsMaxPricePerHead}
            value={Number(active.entry_bounds_max_price_per_head).toLocaleString("en-AU", {
              style: "currency",
              currency: "AUD",
              maximumFractionDigits: 0,
            })}
            tooltip={{
              label: `About ${strings.referenceData.model.entryBoundsMaxPricePerHead}`,
              ...strings.referenceData.model.tooltips.entryBoundsMaxPricePerHead,
            }}
          />
          <StatTile
            label="Weight band multiple"
            value={`${Number(active.entry_bounds_weight_lower_multiple)}x – ${Number(active.entry_bounds_weight_upper_multiple)}x`}
            tooltip={{ label: "About the weight band multiple", ...strings.referenceData.model.tooltips.entryBoundsWeightMultiples }}
          />
          <StatTile
            label="Fallback weight range"
            value={`${Number(active.entry_bounds_fallback_weight_min_kg)} – ${Number(active.entry_bounds_fallback_weight_max_kg)} kg`}
            tooltip={{ label: "About the fallback weight range", ...strings.referenceData.model.tooltips.entryBoundsFallbackWeight }}
          />
        </div>
      </Card>

      <Card className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-1 text-sm font-semibold text-fg-primary">
          {strings.referenceData.model.benchmarkTitle}
          <InfoTooltip
            label={`About ${strings.referenceData.model.benchmarkHighlightThreshold}`}
            what={strings.referenceData.model.tooltips.benchmarkHighlightThreshold.what}
            how={strings.referenceData.model.tooltips.benchmarkHighlightThreshold.how}
          />
        </p>
        <span className="text-lg font-semibold tabular-nums">
          {Number(active.benchmark_compare_highlight_threshold_pct)}%
        </span>
      </Card>

      <Card>
        <p className="flex items-center gap-1 text-sm font-semibold text-fg-primary">
          {strings.referenceData.model.calendarTitle}
          <InfoTooltip
            label={`About the ${strings.referenceData.model.calendarTitle}`}
            what={strings.referenceData.model.tooltips.calendar.what}
            how={strings.referenceData.model.tooltips.calendar.how}
          />
        </p>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b border-subtle text-left text-xs uppercase tracking-wide text-fg-tertiary">
              <th className="py-2 pr-3 font-medium">Saleyard</th>
              <th className="py-2 pr-3 font-medium">Day</th>
              <th className="py-2 pr-3 text-right font-medium">Prepayment</th>
              <th className="py-2 pr-3 font-medium">Note</th>
            </tr>
          </thead>
          <tbody>
            {active.saleyard_calendar.map((row, i) => (
              <tr key={`${row.saleyard}-${row.day}`} className={i % 2 === 1 ? "bg-sunken" : undefined}>
                <td className="py-2 pr-3 font-medium">{row.saleyard}</td>
                <td className="py-2 pr-3 text-fg-secondary">
                  {row.day.charAt(0)}
                  {row.day.slice(1).toLowerCase()}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">
                  {Number(row.prepayment_aud).toLocaleString("en-AU", { style: "currency", currency: "AUD" })}
                </td>
                <td className="py-2 pr-3 text-fg-tertiary">{row.note ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {draft ? <ActivateSettings version={draft} onActivated={() => { setDraft(null); void load(); }} /> : null}

      <Card>
        <p className="text-sm font-semibold text-fg-primary">{strings.referenceData.model.versionHistory}</p>
        <div className="mt-3 flex flex-col divide-y divide-subtle">
          {versions.map((v) => (
            <div key={v.id} className="py-3 text-sm first:pt-0 last:pb-0">
              <div className="flex items-center justify-between">
                <span>
                  {<DateTime value={v.created_at} />} {v.note ? `— ${v.note}` : ""}
                </span>
                {v.is_active ? <Badge variant="pass">{strings.referenceData.model.active}</Badge> : null}
              </div>
              <VersionAuditTrail versionId={v.id} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
