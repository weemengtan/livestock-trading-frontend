"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { useAuthStore } from "@/lib/auth-store";
import { referenceDataApi } from "@/lib/reference-data-api";
import { strings } from "@/lib/strings";
import { withErrorToast } from "@/lib/with-error-toast";
import { workbenchApi, type OrderLine, type OrderWorkings } from "@/lib/workbench-api";

type Row = {
  line: OrderLine;
  workings: OrderWorkings | null;
};

// §5.6: the financier method's benchmark is K / (1 + margin), so
// margin's implied factor (1/(1+margin)) is recoverable directly from
// already-ingested per-line data (dnbp_benchmark / nrv_per_kg) — no need
// for the separately-stored, per-species required_margin table this system
// doesn't currently ingest. More precise than a per-species average, since
// it's derived from the exact line, not a lookup.
function impliedFactor(row: Row): number | null {
  if (row.line.benchmark_method !== "FINANCIER_MARGIN") return null;
  const benchmark = row.line.dnbp_benchmark ? Number(row.line.dnbp_benchmark) : null;
  const k = row.line.nrv_per_kg ? Number(row.line.nrv_per_kg) : null;
  if (benchmark === null || k === null || k === 0) return null;
  return benchmark / k;
}

export function BenchmarkCompareView() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [rows, setRows] = React.useState<Row[]>([]);
  const [everhealthFactors, setEverhealthFactors] = React.useState<Record<string, string>>({});
  // Safe pre-load default only — the real value always arrives from
  // referenceDataApi.getActive() in the same effect, before first paint of
  // any row that uses it.
  const [highlightThresholdPct, setHighlightThresholdPct] = React.useState(15);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    (async () => {
      await withErrorToast(async () => {
        const snapshots = await workbenchApi.listSnapshots(accessToken);
        const latest = snapshots[0];
        if (!latest) return;

        const [lines, active, workingsRows] = await Promise.all([
          workbenchApi.listLines(latest.id, accessToken),
          referenceDataApi.getActive(accessToken),
          workbenchApi.listWorkings(latest.id, accessToken),
        ]);
        setEverhealthFactors(active.dnbp_factor_by_species);
        setHighlightThresholdPct(Number(active.benchmark_compare_highlight_threshold_pct));

        const workingsByLineId = new Map(workingsRows.map((w) => [w.order_line_id, w] as const));
        setRows(lines.map((line) => ({ line, workings: workingsByLineId.get(line.id) ?? null })));
      });
      setLoading(false);
    })();
  }, [accessToken]);

  if (loading) return <p className="text-sm text-fg-tertiary">Loading…</p>;
  if (rows.length === 0) return <EmptyState title="No active lines to compare" />;

  const bySpecies = new Map<string, Row[]>();
  for (const row of rows) {
    if (!row.line.species) continue;
    bySpecies.set(row.line.species, [...(bySpecies.get(row.line.species) ?? []), row]);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-4 text-sm">
        <Badge variant="accent">{strings.benchmarkCompare.sourceOfTruth}</Badge>
        <Badge variant="neutral">{strings.benchmarkCompare.benchmarkOnly}</Badge>
      </div>

      <Card>
        <p className="flex items-center gap-1.5 text-sm font-semibold text-fg-primary">
          {strings.benchmarkCompare.aggregateBySpecies}
          <InfoTooltip
            label={`About ${strings.benchmarkCompare.aggregateBySpecies}`}
            what={strings.benchmarkCompare.tooltips.aggregateBySpecies.what}
            how={strings.benchmarkCompare.tooltips.aggregateBySpecies.how}
          />
        </p>
        <div className="mt-3 flex flex-col gap-2">
          {Array.from(bySpecies.entries()).map(([species, speciesRows]) => {
            const aggregateAe = speciesRows.reduce((sum, r) => sum + Number(r.workings?.diff_vs_benchmark ?? 0), 0);
            return (
              <div key={species} className="flex items-center justify-between text-sm">
                <span className="font-medium">{species}</span>
                <span className="tabular-nums">
                  Σ AE {aggregateAe >= 0 ? "+" : ""}
                  {aggregateAe.toFixed(2)} AUD/kg across {speciesRows.length} line(s)
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-subtle text-left text-xs uppercase tracking-wide text-fg-tertiary">
              <th className="px-4 py-3 font-medium">Contract</th>
              <th className="px-4 py-3 font-medium">Species</th>
              <th className="px-4 py-3 font-medium tabular-nums">{strings.benchmarkCompare.sourceOfTruth}</th>
              <th className="px-4 py-3 font-medium tabular-nums">{strings.benchmarkCompare.benchmarkOnly}</th>
              <th className="px-4 py-3 font-medium tabular-nums">
                <span className="inline-flex items-center gap-1">
                  AE (diff)
                  <InfoTooltip
                    label="About AE (diff)"
                    what={strings.benchmarkCompare.tooltips.diffVsBenchmark.what}
                    how={strings.benchmarkCompare.tooltips.diffVsBenchmark.how}
                  />
                </span>
              </th>
              <th className="px-4 py-3 font-medium tabular-nums">
                <span className="inline-flex items-center gap-1">
                  {strings.benchmarkCompare.impliedFactor}
                  <InfoTooltip
                    label={`About ${strings.benchmarkCompare.impliedFactor}`}
                    what={strings.benchmarkCompare.tooltips.impliedFactor.what}
                    how={strings.benchmarkCompare.tooltips.impliedFactor.how}
                  />
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const factor = impliedFactor(row);
              const everhealthFactor = row.line.species ? everhealthFactors[row.line.species] : undefined;
              const ae = row.workings?.diff_vs_benchmark;
              return (
                <tr key={row.line.id} className="border-b border-subtle last:border-0">
                  <td className="px-4 py-3">{row.line.contract_no}</td>
                  <td className="px-4 py-3">{row.line.species}</td>
                  <td className="px-4 py-3 font-semibold tabular-nums text-accent-default">
                    {row.workings?.bing_dnbp ? `$${Number(row.workings.bing_dnbp).toFixed(4)}` : "—"}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-fg-secondary">
                    {row.line.dnbp_benchmark ? `$${Number(row.line.dnbp_benchmark).toFixed(4)}` : strings.benchmarkCompare.noBenchmark}
                  </td>
                  <td
                    className={
                      "px-4 py-3 tabular-nums " +
                      (ae && Math.abs(Number(ae)) / Number(row.workings?.bing_dnbp || 1) > highlightThresholdPct / 100
                        ? "font-semibold text-status-breach-fg"
                        : "text-fg-secondary")
                    }
                  >
                    {ae ? Number(ae).toFixed(4) : "—"}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-fg-secondary">
                    {factor !== null ? (
                      <span>
                        {factor.toFixed(4)}
                        {everhealthFactor ? ` (Everhealth ${Number(everhealthFactor).toFixed(2)})` : ""}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
