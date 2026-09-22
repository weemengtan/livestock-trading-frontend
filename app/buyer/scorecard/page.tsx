"use client";

import * as React from "react";
import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat-tile";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { BuyerBottomNav } from "@/components/buyer/bottom-nav";
import { BarList } from "@/components/dataviz/bar-list";
import { useAuthStore } from "@/lib/auth-store";
import { addDays, melbourneDate } from "@/lib/business-time";
import { strings } from "@/lib/strings";
import { buyerApi, type ScorecardResponse } from "@/lib/buyer-api";

const money = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });
const perKg = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", minimumFractionDigits: 2 });
const pct = new Intl.NumberFormat("en-AU", { style: "percent", maximumFractionDigits: 0 });

type RangeKey = "today" | "7" | "30";

function rangeBounds(range: RangeKey): { from: string; to: string } {
  // Melbourne calendar dates (lib/business-time.ts), the same day `trade_date` is recorded against.
  const to = melbourneDate();
  const days = range === "today" ? 0 : range === "7" ? 6 : 29;
  return { from: addDays(to, -days), to };
}

export default function BuyerScorecardPage() {
  return (
    <AuthGuard requiredRole="BUYER">
      <AppShell title={strings.scorecard.title}>
        <ScorecardContent />
      </AppShell>
      <BuyerBottomNav />
    </AuthGuard>
  );
}

function ScorecardContent() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [range, setRange] = React.useState<RangeKey>("7");
  const [data, setData] = React.useState<ScorecardResponse | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    const { from, to } = rangeBounds(range);
    buyerApi
      .getScorecard(accessToken, { from, to })
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, range]);

  const s = strings.scorecard;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        {/* AppShell already renders the page's <h1> (its title bar) — this is the content area's own heading. */}
        <h2 className="text-lg font-semibold text-fg-primary">{s.title}</h2>
        <p className="text-sm text-fg-tertiary">{s.subtitle}</p>
      </div>

      <div className="flex gap-2" role="radiogroup" aria-label={s.rangeLabel}>
        {(["today", "7", "30"] as RangeKey[]).map((key) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={range === key}
            onClick={() => setRange(key)}
            className={
              "min-h-11 flex-1 rounded-md border px-3 text-sm font-medium transition-colors " +
              (range === key
                ? "border-accent-default bg-accent-subtle text-accent-default"
                : "border-default text-fg-secondary")
            }
          >
            {key === "today" ? s.ranges.today : key === "7" ? s.ranges.days7 : s.ranges.days30}
          </button>
        ))}
      </div>

      {loading || !data ? (
        <p className="text-sm text-fg-tertiary">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <StatTile
              label={s.headsBought}
              value={String(data.heads_bought)}
              hint={data.heads_target !== null ? `${s.headsTarget} ${Math.round(Number(data.heads_target))}` : undefined}
              tooltip={{ label: `About ${s.headsBought}`, ...s.tooltips.headsBought }}
            />
            <StatTile
              label={s.headroomCaptured}
              value={money.format(Number(data.headroom_captured_aud))}
              tooltip={{ label: `About ${s.headroomCaptured}`, ...s.tooltips.headroomCaptured }}
            />
            <StatTile
              label={s.avgPaid}
              value={data.avg_paid_per_kg !== null ? perKg.format(Number(data.avg_paid_per_kg)) : "—"}
              tooltip={{ label: `About ${s.avgPaid}`, ...s.tooltips.avgPaid }}
            />
            <StatTile
              label={s.avgDnbp}
              value={data.avg_dnbp_per_kg !== null ? perKg.format(Number(data.avg_dnbp_per_kg)) : "—"}
              tooltip={{ label: `About ${s.avgDnbp}`, ...s.tooltips.avgDnbp }}
            />
          </div>

          <Card className="flex items-center justify-between">
            <span className="flex items-center gap-1 text-sm font-medium text-fg-secondary">
              {s.breaches}
              <InfoTooltip label={`About ${s.breaches}`} what={s.tooltips.breaches.what} how={s.tooltips.breaches.how} />
            </span>
            <Badge variant={data.breach_count > 0 ? "breach" : "pass"}>
              {data.breach_count} ({pct.format(Number(data.breach_rate))})
            </Badge>
          </Card>

          <Card>
            <h2 className="mb-3 text-sm font-medium text-fg-secondary">{s.spendBySaleyard}</h2>
            {data.spend_by_saleyard.length === 0 ? (
              <p className="text-sm text-fg-tertiary">{s.noEntries}</p>
            ) : (
              <BarList
                rows={data.spend_by_saleyard.map((r) => ({ label: r.saleyard, value: Number(r.spend_aud) }))}
                valueLabel={s.spendBySaleyard}
                formatValue={(v) => money.format(v)}
              />
            )}
          </Card>
        </>
      )}
    </div>
  );
}
