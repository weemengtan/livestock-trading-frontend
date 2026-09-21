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
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";
import {
  ingestionContractsApi,
  type IngestionContractRecord,
  type NewIngestionContract,
} from "@/lib/ingestion-contracts-api";
import { strings } from "@/lib/strings";
import { withErrorToast } from "@/lib/with-error-toast";

const t = strings.referenceData.contract;

function words(text: string): string[] {
  return text
    .split(/[\s,]+/)
    .map((w) => w.trim())
    .filter(Boolean);
}

function lines(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

type FieldDraft = { field: string; required: boolean; label: string; synonyms: string };

function ProposeForm({
  base,
  fields,
  nextVersion,
  onCreated,
}: {
  base: IngestionContractRecord;
  fields: string[];
  nextVersion: string;
  onCreated: () => void;
}) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [open, setOpen] = React.useState(false);
  const [version, setVersion] = React.useState(nextVersion);
  const [sheetName, setSheetName] = React.useState(base.required_sheet_name);
  const [activeWords, setActiveWords] = React.useState(base.active_title_tokens.join(" "));
  const [endWords, setEndWords] = React.useState(base.section_end_tokens.join(" "));
  const [titleScanRows, setTitleScanRows] = React.useState(String(base.title_scan_rows));
  const [headerScanRows, setHeaderScanRows] = React.useState(String(base.header_scan_rows));
  const [minMatches, setMinMatches] = React.useState(String(base.min_header_matches));
  const [note, setNote] = React.useState("");
  const [rows, setRows] = React.useState<FieldDraft[]>(
    fields.map((field) => ({
      field,
      required: field in base.required_columns,
      label: base.required_columns[field] ?? "",
      synonyms: (base.header_synonyms[field] ?? []).join("\n"),
    }))
  );
  const [submitting, setSubmitting] = React.useState(false);

  function updateRow(field: string, patch: Partial<FieldDraft>) {
    setRows((prev) => prev.map((r) => (r.field === field ? { ...r, ...patch } : r)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const body: NewIngestionContract = {
        version,
        required_sheet_name: sheetName,
        active_title_tokens: words(activeWords),
        section_end_tokens: words(endWords),
        title_scan_rows: Number(titleScanRows),
        header_scan_rows: Number(headerScanRows),
        min_header_matches: Number(minMatches),
        required_columns: Object.fromEntries(rows.filter((r) => r.required).map((r) => [r.field, r.label])),
        header_synonyms: Object.fromEntries(rows.filter((r) => lines(r.synonyms).length > 0).map((r) => [r.field, lines(r.synonyms)])),
        note: note || undefined,
      };
      await ingestionContractsApi.create(body, accessToken);
      toast({ title: "New contract version saved — activate it to use it" });
      setOpen(false);
      onCreated();
    } catch (err) {
      toast({ title: err instanceof ApiError ? err.message : "Could not save the contract", variant: "danger" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="shrink-0 whitespace-nowrap">
          {t.proposeButton}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogTitle>{t.proposeTitle}</DialogTitle>
        <DialogDescription>{t.proposeHint}</DialogDescription>
        {/* eslint-disable-next-line local/no-raw-design-values -- 60vh caps this dialog's scroll area
            to a viewport fraction; no token or Tailwind scale step expresses "% of viewport height". */}
        <form className="mt-4 flex max-h-[60vh] flex-col gap-4 overflow-y-auto" onSubmit={handleSubmit}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ic-version">{t.version}</Label>
              <Input id="ic-version" value={version} onChange={(e) => setVersion(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ic-sheet">{t.sheetName}</Label>
              <Input id="ic-sheet" value={sheetName} onChange={(e) => setSheetName(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ic-active">{t.activeMarker}</Label>
              <Input id="ic-active" value={activeWords} onChange={(e) => setActiveWords(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ic-end">{t.endMarker}</Label>
              <Input id="ic-end" value={endWords} onChange={(e) => setEndWords(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ic-title-rows">{t.titleScanRows}</Label>
              <Input id="ic-title-rows" value={titleScanRows} onChange={(e) => setTitleScanRows(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ic-header-rows">{t.headerScanRows}</Label>
              <Input id="ic-header-rows" value={headerScanRows} onChange={(e) => setHeaderScanRows(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ic-min">{t.minMatches}</Label>
              <Input id="ic-min" value={minMatches} onChange={(e) => setMinMatches(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ic-note">{t.note}</Label>
              <Input id="ic-note" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-fg-secondary">{t.fieldsTitle}</p>
            <div className="mt-2 flex flex-col gap-3">
              {rows.map((row) => (
                <div key={row.field} className="rounded-md border border-subtle p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{row.field}</span>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={row.required}
                        onChange={(e) => updateRow(row.field, { required: e.target.checked })}
                      />
                      {t.required}
                    </label>
                  </div>
                  {row.required ? (
                    <Input
                      className="mt-2"
                      aria-label={`${row.field} ${t.label}`}
                      value={row.label}
                      onChange={(e) => updateRow(row.field, { label: e.target.value })}
                      placeholder={t.label}
                      required
                    />
                  ) : null}
                  <textarea
                    className="mt-2 min-h-16 w-full rounded-md border border-default bg-surface px-3 py-2 text-sm text-fg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                    aria-label={`${row.field} ${t.headers}`}
                    value={row.synonyms}
                    onChange={(e) => updateRow(row.field, { synonyms: e.target.value })}
                    placeholder={t.headers}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={submitting}>
              {submitting ? t.saving : t.save}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Summary({ contract, fields }: { contract: IngestionContractRecord; fields: string[] }) {
  // Parser field order (logical column order), not the JSON key order the database returns.
  const orderedFields = fields.filter((f) => f in contract.header_synonyms);
  return (
    <div className="mt-4 flex flex-col gap-3 text-sm">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-fg-tertiary">{t.sheetName}</p>
          <p className="font-semibold">{contract.required_sheet_name}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-fg-tertiary">{t.activeMarker}</p>
          <p>{contract.active_title_tokens.join(" ")}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-fg-tertiary">{t.endMarker}</p>
          <p>{contract.section_end_tokens.join(" ")}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-fg-tertiary">{t.headerScanRows}</p>
          <p className="tabular-nums">{contract.header_scan_rows}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-fg-tertiary">{t.minMatches}</p>
          <p className="tabular-nums">{contract.min_header_matches}</p>
        </div>
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-fg-tertiary">{t.fieldsTitle}</p>
        <div className="mt-1 flex flex-col gap-1">
          {orderedFields.map((field) => (
            <div key={field} className="flex flex-wrap items-baseline gap-x-3">
              <span className="font-medium">{field}</span>
              {field in contract.required_columns ? <Badge variant="accent">{t.required}</Badge> : null}
              <span className="text-fg-secondary">{contract.header_synonyms[field].join(" · ")}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function IngestionContractPanel() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const isOwner = useAuthStore((s) => s.user?.role) === "OWNER";
  const [contracts, setContracts] = React.useState<IngestionContractRecord[]>([]);
  const [fields, setFields] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [activatingId, setActivatingId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      await withErrorToast(async () => {
        const [list, fieldList] = await Promise.all([
          ingestionContractsApi.list(accessToken),
          ingestionContractsApi.fields(accessToken),
        ]);
        setContracts(list);
        setFields(fieldList.fields);
      });
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function handleActivate(id: string) {
    setActivatingId(id);
    try {
      await ingestionContractsApi.activate(id, accessToken);
      toast({ title: "Contract activated" });
      await load();
    } catch (err) {
      toast({ title: err instanceof ApiError ? err.message : "Could not activate", variant: "danger" });
    } finally {
      setActivatingId(null);
    }
  }

  const active = contracts.find((c) => c.is_active);
  if (loading) return <p className="text-sm text-fg-tertiary">Loading…</p>;
  if (!active) return <p className="text-sm text-fg-tertiary">No active upload contract.</p>;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-fg-primary">
              {t.title} <Badge variant="pass">{active.version}</Badge>
            </p>
            <p className="text-sm text-fg-secondary">{t.subtitle}</p>
            {!isOwner ? <p className="mt-1 text-xs text-fg-tertiary">{t.ownerOnly}</p> : null}
          </div>
          {isOwner ? (
            <ProposeForm
              key={active.id}
              base={active}
              fields={fields}
              nextVersion={`v${contracts.length + 1}`}
              onCreated={() => void load()}
            />
          ) : null}
        </div>
        <Summary contract={active} fields={fields} />
      </Card>

      <Card>
        <p className="text-sm font-semibold text-fg-primary">{strings.referenceData.model.versionHistory}</p>
        <div className="mt-2 flex flex-col gap-2">
          {contracts.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>
                <span className="font-medium">{c.version}</span> — {c.required_sheet_name} —{" "}
                {new Date(c.created_at).toLocaleString()}
                {c.note ? ` — ${c.note}` : ""}
              </span>
              {c.is_active ? (
                <Badge variant="pass">{t.activeBadge}</Badge>
              ) : isOwner ? (
                <Button size="sm" variant="secondary" disabled={activatingId === c.id} onClick={() => void handleActivate(c.id)}>
                  {activatingId === c.id ? t.activating : t.activate}
                </Button>
              ) : (
                <Badge variant="neutral">{t.draftBadge}</Badge>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
