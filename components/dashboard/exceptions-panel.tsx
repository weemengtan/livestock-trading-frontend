import type * as React from "react";
import { DateTime } from "@/components/ui/date-time";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat-tile";
import { strings } from "@/lib/strings";
import type { ExceptionsResponse } from "@/lib/analytics-api";

const money = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", minimumFractionDigits: 2 });

export function ExceptionsPanel({ data, loading }: { data: ExceptionsResponse | null; loading: boolean }) {
  const s = strings.dashboard.panels.exceptions;

  return (
    <Card>
      <h2 className="text-lg font-semibold text-fg-primary">{s.title}</h2>
      <p className="mt-1 text-sm text-fg-tertiary">{s.subtitle}</p>

      {loading || !data ? (
        <p className="mt-4 text-sm text-fg-tertiary">Loading…</p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile
              label={s.breaches}
              value={String(data.breaches.length)}
              tooltip={{ label: `About ${s.breaches}`, ...s.tooltips.breaches }}
            />
            <StatTile
              label={s.blockedLines}
              value={String(data.blocked_lines.length)}
              tooltip={{ label: `About ${s.blockedLines}`, ...s.tooltips.blockedLines }}
            />
            <StatTile
              label={s.stalePublications}
              value={String(data.stale_publications.length)}
              tooltip={{ label: `About ${s.stalePublications}`, ...s.tooltips.stalePublications }}
            />
            <StatTile
              label={s.undeliveredInstructions}
              value={String(data.undelivered_instructions.length)}
              tooltip={{ label: `About ${s.undeliveredInstructions}`, ...s.tooltips.undeliveredInstructions }}
            />
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <ExceptionList title={s.breaches} empty={s.none}>
              {data.breaches.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-2 py-1.5">
                  <span className="text-fg-primary">
                    {b.buyer_email} · {b.species} · {b.trade_date}
                  </span>
                  <Badge variant="breach">{money.format(Number(b.variance_per_kg) * -1)}/kg over</Badge>
                </li>
              ))}
            </ExceptionList>

            <ExceptionList title={s.blockedLines} empty={s.none}>
              {data.blocked_lines.map((b) => (
                <li key={b.order_line_id} className="py-1.5">
                  <span className="font-medium text-fg-primary">{b.contract_no ?? b.species ?? "—"}</span>
                  <span className="ml-2 text-fg-tertiary">{b.message}</span>
                </li>
              ))}
            </ExceptionList>

            <ExceptionList title={s.stalePublications} empty={s.none}>
              {data.stale_publications.map((p) => (
                <li key={p.publication_id} className="flex items-center justify-between py-1.5">
                  <span className="text-fg-primary">{<DateTime value={p.published_at} />}</span>
                  <Badge variant="close">{Math.round(Number(p.hours_stale))}h stale</Badge>
                </li>
              ))}
            </ExceptionList>

            <ExceptionList title={s.undeliveredInstructions} empty={s.none}>
              {[
                ...data.undelivered_instructions.map((i) => (
                  <li key={i.instruction_id} className="py-1.5">
                    <span className="font-medium text-fg-primary">{i.instruction_no}</span>
                    <span className="ml-2 text-fg-tertiary">{i.status}</span>
                  </li>
                )),
                ...data.undelivered_publications.map((p) => (
                  <li key={`${p.publication_id}-${p.buyer_id}`} className="py-1.5">
                    <span className="font-medium text-fg-primary">{p.buyer_email}</span>
                    <span className="ml-2 text-fg-tertiary">{s.undeliveredPublications}</span>
                  </li>
                )),
              ]}
            </ExceptionList>
          </div>
        </>
      )}
    </Card>
  );
}

function ExceptionList({ title, empty, children }: { title: string; empty: string; children: React.ReactNode[] }) {
  return (
    <div>
      <h3 className="mb-1 text-sm font-medium text-fg-secondary">{title}</h3>
      {children.length === 0 ? (
        <p className="text-sm text-fg-tertiary">{empty}</p>
      ) : (
        <ul className="divide-y divide-subtle text-sm">{children}</ul>
      )}
    </div>
  );
}
