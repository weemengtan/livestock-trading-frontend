import { Card } from "@/components/ui/card";
import { DateTime } from "@/components/ui/date-time";
import { strings } from "@/lib/strings";
import type { MarketIntelSummaryResponse } from "@/lib/market-intel-api";

const money = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 2 });
const number = new Intl.NumberFormat("en-AU");

export function MarketIntelSummaryPanel({ data, loading }: { data: MarketIntelSummaryResponse | null; loading: boolean }) {
  const s = strings.marketIntel.summary;

  return (
    <Card>
      <h2 className="text-lg font-semibold text-fg-primary">{s.title}</h2>
      <p className="mt-1 text-sm text-fg-tertiary">{s.subtitle}</p>

      {loading ? (
        <p className="mt-4 text-sm text-fg-tertiary">Loading…</p>
      ) : !data || data.rows.length === 0 ? (
        <p className="mt-4 text-sm text-fg-tertiary">{s.empty}</p>
      ) : (
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="border-b border-subtle text-left text-fg-tertiary">
              <th className="py-1.5 pr-2 font-medium">{s.columns.competitor}</th>
              <th className="py-1.5 pr-2 font-medium">{s.columns.species}</th>
              <th className="py-1.5 pr-2 text-right font-medium">{s.columns.entries}</th>
              <th className="py-1.5 pr-2 text-right font-medium">{s.columns.heads}</th>
              <th className="py-1.5 pr-2 text-right font-medium">{s.columns.avgPricePerKg}</th>
              <th className="py-1.5 text-right font-medium">{s.columns.lastObserved}</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={`${row.competitor_name}::${row.species}`} className="border-b border-subtle last:border-0">
                <td className="py-1.5 pr-2 font-medium text-fg-primary">{row.competitor_name}</td>
                <td className="py-1.5 pr-2 text-fg-secondary">{row.species}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums text-fg-secondary">{number.format(row.entry_count)}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums text-fg-secondary">{number.format(row.heads_observed)}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums text-fg-secondary">
                  {row.avg_price_per_kg ? money.format(Number(row.avg_price_per_kg)) : "—"}
                </td>
                <td className="py-1.5 text-right tabular-nums text-fg-secondary">
                  <DateTime value={row.last_observed_at} dateOnly />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
