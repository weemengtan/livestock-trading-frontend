"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import { defaultModelName, earliestActivationDate } from "@/lib/activation-date";
import { isNonNegativeDecimal, isPositiveDecimal, tidyDecimal } from "@/lib/decimal-format";
import { dnbpModelsApi, type DnbpModel, type NewDnbpModel } from "@/lib/dnbp-models-api";
import type { SpeciesRow } from "@/lib/reference-data-api";
import { useAuthStore } from "@/lib/auth-store";
import { strings } from "@/lib/strings";
import { withErrorToast } from "@/lib/with-error-toast";

const copy = strings.referenceData.dnbpModels;

type Row = { factor: string; weight: string };

function initialRows(species: SpeciesRow[], template: DnbpModel | null): Record<string, Row> {
  const byCode = new Map((template?.species ?? []).map((s) => [s.species, s] as const));
  return Object.fromEntries(
    species.map((s) => {
      const t = byCode.get(s.code);
      return [s.code, { factor: tidyDecimal(t?.dnbp_factor), weight: tidyDecimal(t?.standard_weight) }];
    }),
  );
}

/**
 * Creates a DNBP model as a draft. Mount it with a fresh `key` each time it
 * opens: its fields are seeded once from `template` (the live model, or the
 * one the user chose to copy), and remounting is what resets them.
 */
export function ModelFormDialog({
  open,
  onOpenChange,
  species,
  template,
  existingNames,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Active species from the registry — one input row each. */
  species: SpeciesRow[];
  template: DnbpModel | null;
  /** Names already taken — model names are unique, so the suggested one steps around them. */
  existingNames: readonly string[];
  onCreated: (model: DnbpModel) => void;
}) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const earliest = React.useMemo(() => earliestActivationDate(), []);

  // null = still following the suggestion (the go-live date); the first edit takes it over.
  const [typedName, setTypedName] = React.useState<string | null>(null);
  const [activationDate, setActivationDate] = React.useState(earliest);
  const suggestedName = defaultModelName(activationDate, existingNames);
  const name = typedName ?? suggestedName;
  const [note, setNote] = React.useState("");
  const [cifBuffer, setCifBuffer] = React.useState(tidyDecimal(template?.cif_buffer_per_kg));
  const [rows, setRows] = React.useState(() => initialRows(species, template));
  const [showErrors, setShowErrors] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const setRow = (code: string, patch: Partial<Row>) =>
    setRows((prev) => ({ ...prev, [code]: { ...prev[code], ...patch } }));

  // Validation is advisory — the server is the authority — but it stops the
  // obvious mistakes before a round trip and says which field is wrong.
  const nameOk = name.trim().length > 0;
  const dateOk = activationDate >= earliest;
  const cifOk = isNonNegativeDecimal(cifBuffer);
  const rowOk = (row: Row) => (row.factor === "" || isPositiveDecimal(row.factor)) && (row.weight === "" || isPositiveDecimal(row.weight));
  const allRowsOk = species.every((s) => rowOk(rows[s.code]));
  const anyFactor = species.some((s) => isPositiveDecimal(rows[s.code].factor));
  const valid = nameOk && dateOk && cifOk && allRowsOk && anyFactor;
  // The first thing to fix, in the order the fields appear.
  const problem = !nameOk
    ? copy.form.needsName
    : !dateOk
      ? copy.form.needsDate
      : !cifOk
        ? copy.form.needsCif
        : !allRowsOk
          ? copy.form.invalidRow
          : !anyFactor
            ? copy.form.needsFactor
            : null;

  // Species the template priced that this model would leave unpriced.
  const stopsPricing = (template?.species ?? [])
    .filter((t) => t.dnbp_factor !== null && (rows[t.species]?.factor ?? "") === "")
    .map((t) => t.species);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setShowErrors(true);
    if (!valid) return;

    const body: NewDnbpModel = {
      name: name.trim(),
      note: note.trim() || undefined,
      cif_buffer_per_kg: cifBuffer.trim(),
      activation_date: activationDate,
      species: species
        .filter((s) => rows[s.code].factor !== "" || rows[s.code].weight !== "")
        .map((s) => ({
          species: s.code,
          dnbp_factor: rows[s.code].factor.trim() || null,
          standard_weight: rows[s.code].weight.trim() || null,
        })),
    };

    setSubmitting(true);
    const created = await withErrorToast(() => dnbpModelsApi.create(body, accessToken), "Could not save the model");
    setSubmitting(false);
    if (!created) return;

    toast({ title: copy.createdToast });
    onOpenChange(false);
    onCreated(created);
  }

  const invalid = (bad: boolean) => (showErrors && bad ? true : undefined);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogTitle>{copy.form.title}</DialogTitle>
        <DialogDescription>{copy.form.description}</DialogDescription>

        <form className="mt-4" onSubmit={handleSubmit} noValidate>
          {/* Only the fields scroll; the message and buttons below stay in view. */}
          <div className="flex max-h-96 flex-col gap-4 overflow-y-auto px-0.5 md:max-h-128">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="model-name">{copy.form.name}</Label>
              <Input
                id="model-name"
                value={name}
                onChange={(e) => setTypedName(e.target.value)}
                aria-invalid={invalid(!nameOk)}
                aria-describedby="model-name-hint"
                required
              />
              <p id="model-name-hint" className="text-xs text-fg-tertiary">
                {copy.form.nameHint}
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="model-date">{copy.form.activationDate}</Label>
              <Input
                id="model-date"
                type="date"
                value={activationDate}
                min={earliest}
                onChange={(e) => setActivationDate(e.target.value)}
                aria-invalid={invalid(!dateOk)}
                aria-describedby="model-date-hint"
                required
              />
              <p id="model-date-hint" className="text-xs text-fg-tertiary">
                {copy.form.activationHint}
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="model-cif">{strings.referenceData.model.cifBuffer}</Label>
              <Input
                id="model-cif"
                inputMode="decimal"
                value={cifBuffer}
                onChange={(e) => setCifBuffer(e.target.value)}
                aria-invalid={invalid(!cifOk)}
                required
              />
            </div>

            <fieldset>
              <legend className="text-sm font-medium text-fg-secondary">{copy.form.speciesTitle}</legend>
              <p className="mt-1 text-xs text-fg-tertiary">{copy.form.speciesHint}</p>
              <div className="mt-2 flex flex-col gap-2">
                {species.map((s) => (
                  <div key={s.code} className="grid grid-cols-3 items-center gap-2">
                    <span className="text-sm">{s.display_name}</span>
                    <Input
                      aria-label={`${s.display_name} ${copy.form.factor}`}
                      inputMode="decimal"
                      value={rows[s.code].factor}
                      onChange={(e) => setRow(s.code, { factor: e.target.value })}
                      placeholder={copy.params.notSet}
                      aria-invalid={invalid(!rowOk(rows[s.code]))}
                    />
                    <Input
                      aria-label={`${s.display_name} ${copy.form.weight}`}
                      inputMode="decimal"
                      value={rows[s.code].weight}
                      onChange={(e) => setRow(s.code, { weight: e.target.value })}
                      placeholder={copy.form.weight}
                      aria-invalid={invalid(!rowOk(rows[s.code]))}
                    />
                  </div>
                ))}
              </div>
            </fieldset>

            {stopsPricing.length > 0 ? (
              <p role="status" className="text-sm font-medium text-status-close-fg">
                {copy.form.stopsPricing}: {stopsPricing.join(", ")}
              </p>
            ) : null}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="model-note">{copy.form.note}</Label>
              <Input id="model-note" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>

          </div>

          {showErrors && problem ? (
            <p role="alert" className="mt-3 text-sm font-medium text-status-breach-fg">
              {problem}
            </p>
          ) : null}

          <div className="mt-4 flex justify-end gap-2">
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={submitting}>
              {submitting ? copy.form.submitting : copy.form.submit}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
