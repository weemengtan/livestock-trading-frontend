import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DateTime } from "@/components/ui/date-time";
import { tidyDecimal } from "@/lib/decimal-format";
import type { DnbpModel } from "@/lib/dnbp-models-api";
import { strings } from "@/lib/strings";
import { ModelStatusBadge, formatActivation } from "./model-status";

const copy = strings.referenceData.dnbpModels;

export type ModelActions = {
  onReview: (model: DnbpModel) => void;
  onReschedule: (model: DnbpModel) => void;
  onCancel: (model: DnbpModel) => void;
  onUseAsTemplate: (model: DnbpModel) => void;
};

/**
 * One model: what it prices, when it goes live, who made and approved it,
 * and the actions its status allows. Stateless — the panel owns the dialogs
 * these actions open.
 */
export function ModelCard({ model, actions }: { model: DnbpModel; actions: ModelActions }) {
  const priced = model.species.filter((s) => s.dnbp_factor !== null);
  const weighted = model.species.filter((s) => s.standard_weight !== null);

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-2 text-base font-semibold text-fg-primary">
            {model.name}
            <ModelStatusBadge status={model.status} />
          </p>
          <p className="mt-0.5 text-sm text-fg-secondary">
            {copy.when[model.status]} <time dateTime={model.activation_at}>{formatActivation(model)}</time>
          </p>
          {model.note ? <p className="mt-0.5 text-sm text-fg-tertiary">{model.note}</p> : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {model.status === "DRAFT" ? (
            <Button size="sm" onClick={() => actions.onReview(model)}>
              {copy.actions.review}
            </Button>
          ) : null}
          {model.can_still_change ? (
            <>
              <Button size="sm" variant="secondary" onClick={() => actions.onReschedule(model)}>
                {copy.actions.reschedule}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => actions.onCancel(model)}>
                {copy.actions.cancel}
              </Button>
            </>
          ) : null}
          <Button size="sm" variant="ghost" onClick={() => actions.onUseAsTemplate(model)}>
            {copy.actions.template}
          </Button>
        </div>
      </div>

      <dl className="flex flex-col gap-2 text-sm">
        <Param label={copy.params.cifBuffer}>
          <span className="tabular-nums">{tidyDecimal(model.cif_buffer_per_kg)} AUD/kg</span>
        </Param>
        <Param label={copy.params.factors}>
          {priced.length === 0 ? <span className="text-fg-tertiary">—</span> : null}
          {priced.map((s) => (
            <Badge key={s.species} variant="accent">
              {s.species}: {tidyDecimal(s.dnbp_factor)}
            </Badge>
          ))}
        </Param>
        <Param label={copy.params.weights}>
          {weighted.length === 0 ? <span className="text-fg-tertiary">—</span> : null}
          {weighted.map((s) => (
            <Badge key={s.species} variant="neutral">
              {s.species}: {tidyDecimal(s.standard_weight)} kg
            </Badge>
          ))}
        </Param>
        <Param label={copy.params.formula}>{model.model_type}</Param>
      </dl>

      <p className="text-xs text-fg-tertiary">
        {copy.people.createdBy} {model.created_by_email ?? strings.referenceData.model.auditSystemActor} ·{" "}
        <DateTime value={model.created_at} />
        {model.approved_by_email && model.approved_at ? (
          <>
            {" · "}
            {copy.people.approvedBy} {model.approved_by_email} · <DateTime value={model.approved_at} />
          </>
        ) : null}
      </p>
    </Card>
  );
}

function Param({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <dt className="w-32 shrink-0 text-fg-tertiary">{label}</dt>
      <dd className="flex flex-wrap items-center gap-2">{children}</dd>
    </div>
  );
}
