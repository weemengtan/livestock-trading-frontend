import { InfoTooltip } from "@/components/ui/info-tooltip";
import { strings } from "@/lib/strings";

/** The subset of an impact preview this summary reads — satisfied by `ModelImpact`. */
export type ImpactSummaryData = {
  lines_affected: number;
  lines_unpriced: number;
  aggregate_exposure_delta_aud: string;
  lines: { order_line_id: string; contract_no: string | null; species: string; old_dnbp: string | null; new_dnbp: string | null }[];
};

const money = (value: string | null) => (value ? `$${Number(value).toFixed(4)}` : "—");

/**
 * Before/after prices for every affected line and the aggregate AUD
 * exposure change (§6.5's "impact preview"). Presentational only: the
 * caller owns fetching it and whatever action follows (approve, activate).
 */
export function ImpactSummary({ impact }: { impact: ImpactSummaryData }) {
  const exposure = Number(impact.aggregate_exposure_delta_aud);

  return (
    <div>
      <p className="text-sm text-status-close-fg">{strings.referenceData.impact.warning}</p>

      {impact.lines_unpriced > 0 ? (
        <p role="alert" className="mt-2 text-sm font-semibold text-status-breach-fg">
          {impact.lines_unpriced} {strings.referenceData.impact.unpricedWarning}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
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
                  <td className="px-3 py-2 tabular-nums">{money(line.old_dnbp)}</td>
                  <td className="px-3 py-2 tabular-nums font-semibold">{money(line.new_dnbp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
