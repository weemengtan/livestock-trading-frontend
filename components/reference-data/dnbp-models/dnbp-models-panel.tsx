"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useAuthStore } from "@/lib/auth-store";
import { dnbpModelsApi, type DnbpModel } from "@/lib/dnbp-models-api";
import { referenceDataApi, type SpeciesRow } from "@/lib/reference-data-api";
import { strings } from "@/lib/strings";
import { withErrorToast } from "@/lib/with-error-toast";
import { ModelCard, type ModelActions } from "./model-card";
import { ModelFormDialog } from "./model-form-dialog";
import { ModelReviewDialog } from "./model-review-dialog";
import { CancelDialog, RescheduleDialog } from "./model-schedule-dialogs";

const copy = strings.referenceData.dnbpModels;

/** Which dialog is open, if any. One at a time, so a single value is enough. */
type OpenDialog =
  | { kind: "form"; key: number; template: DnbpModel | null }
  | { kind: "review" | "reschedule" | "cancel"; model: DnbpModel }
  | null;

/**
 * Reference Data → DNBP models. Lists every model by lifecycle stage and
 * owns the create / review / reschedule / cancel dialogs. Which model is
 * live, and every status shown here, is decided by the server from the
 * approved schedule and the clock — this screen only displays and asks.
 */
export function DnbpModelsPanel() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [models, setModels] = React.useState<DnbpModel[] | null>(null);
  const [species, setSpecies] = React.useState<SpeciesRow[]>([]);
  const [dialog, setDialog] = React.useState<OpenDialog>(null);
  const formKey = React.useRef(0);

  const load = React.useCallback(async () => {
    try {
      await withErrorToast(async () => {
        const [modelRows, speciesRows] = await Promise.all([
          dnbpModelsApi.list(accessToken),
          referenceDataApi.listSpecies(accessToken),
        ]);
        setModels(modelRows);
        setSpecies(speciesRows.filter((s) => s.is_active));
      }, "Could not load DNBP models");
    } finally {
      // On a first-load failure show the empty state rather than a spinner forever.
      setModels((prev) => prev ?? []);
    }
  }, [accessToken]);

  React.useEffect(() => {
    void load();
  }, [load]);

  if (models === null) return <p className="text-sm text-fg-tertiary">{copy.loading}</p>;

  const live = models.find((m) => m.status === "LIVE") ?? null;
  const upcoming = models
    .filter((m) => m.status === "DRAFT" || m.status === "SCHEDULED")
    .sort((a, b) => a.activation_at.localeCompare(b.activation_at));
  const history = models.filter((m) => m.status === "RETIRED" || m.status === "CANCELLED");

  const openForm = (template: DnbpModel | null) => setDialog({ kind: "form", key: ++formKey.current, template });
  const closeDialog = () => setDialog(null);
  const changed = () => {
    closeDialog();
    void load();
  };

  const actions: ModelActions = {
    onReview: (model) => setDialog({ kind: "review", model }),
    onReschedule: (model) => setDialog({ kind: "reschedule", model }),
    onCancel: (model) => setDialog({ kind: "cancel", model }),
    onUseAsTemplate: openForm,
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-fg-primary">{copy.title}</p>
          <p className="max-w-2xl text-sm text-fg-secondary">{copy.subtitle}</p>
        </div>
        <Button size="sm" onClick={() => openForm(live)}>
          {copy.newButton}
        </Button>
      </div>

      <Section title={copy.sections.live}>
        {live ? <ModelCard model={live} actions={actions} /> : <EmptyState title={copy.empty.live} />}
      </Section>

      <Section title={copy.sections.upcoming}>
        {upcoming.length === 0 ? <EmptyState title={copy.empty.upcoming} /> : null}
        {upcoming.map((m) => (
          <ModelCard key={m.id} model={m} actions={actions} />
        ))}
      </Section>

      <Section title={copy.sections.history}>
        {history.length === 0 ? <p className="text-sm text-fg-tertiary">{copy.empty.history}</p> : null}
        {history.map((m) => (
          <ModelCard key={m.id} model={m} actions={actions} />
        ))}
      </Section>

      {dialog?.kind === "form" ? (
        <ModelFormDialog
          key={dialog.key}
          open
          onOpenChange={(open) => !open && closeDialog()}
          species={species}
          template={dialog.template}
          existingNames={models.map((m) => m.name)}
          onCreated={changed}
        />
      ) : null}
      {dialog?.kind === "review" ? (
        <ModelReviewDialog model={dialog.model} onClose={closeDialog} onApproved={changed} />
      ) : null}
      {dialog?.kind === "reschedule" ? (
        <RescheduleDialog model={dialog.model} onClose={closeDialog} onChanged={changed} />
      ) : null}
      {dialog?.kind === "cancel" ? <CancelDialog model={dialog.model} onClose={closeDialog} onChanged={changed} /> : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-fg-tertiary">{title}</h3>
      {children}
    </section>
  );
}
