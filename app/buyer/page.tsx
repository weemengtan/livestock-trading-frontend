"use client";

import * as React from "react";
import { AuthGuard } from "@/components/auth-guard";
import { AppShell } from "@/components/app-shell";
import { BuyerBottomNav } from "@/components/buyer/bottom-nav";
import { OfflineBanner, useOnlineStatus } from "@/components/buyer/offline-banner";
import { InstallPrompt } from "@/components/buyer/install-prompt";
import { EmptyState } from "@/components/ui/empty-state";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { strings } from "@/lib/strings";
import { type DnbpSpeciesLine } from "@/lib/buyer-api";
import { useDnbpCurrent } from "@/lib/buyer/use-dnbp-current";

// §3, §12.2 — a publication older than this is stale even if it's still
// technically "current" (nothing newer has been published since).
const STALE_INSTRUCTION_HOURS = 24;

// §12.2's own mockup: "$9.38   ▲ +0.12  ← change vs previous publication".
// Null whenever there's nothing to compare against (this org's first-ever
// publish for the species) or the price didn't move — an unchanged price
// shows no arrow at all in the PRD's own example, same as this.
function priceDelta(line: DnbpSpeciesLine): number | null {
  if (line.previous_dnbp_per_kg === null) return null;
  const delta = Number(line.dnbp_per_kg) - Number(line.previous_dnbp_per_kg);
  return delta === 0 ? null : delta;
}

export default function BuyerDnbpHomePage() {
  return (
    <AuthGuard requiredRole="BUYER">
      <AppShell title={strings.buyer.dnbpHome.title}>
        <DnbpHomeContent />
      </AppShell>
      <BuyerBottomNav />
    </AuthGuard>
  );
}

function DnbpHomeContent() {
  const online = useOnlineStatus();
  const { cached } = useDnbpCurrent({ ack: true });

  if (!cached) {
    return <EmptyState title={strings.buyer.dnbpHome.noPublication} />;
  }

  const publishedAt = new Date(cached.published_at);
  const isStale = Date.now() - publishedAt.getTime() > STALE_INSTRUCTION_HOURS * 60 * 60 * 1000;
  const fetchedAt = new Date(cached.fetched_at);
  const minutesAgo = Math.max(0, Math.round((Date.now() - fetchedAt.getTime()) / 60000));

  return (
    <div className="flex flex-col">
      <OfflineBanner lastSyncedAt={cached.fetched_at} />
      <InstallPrompt />

      <div className="flex items-center justify-between border-b border-subtle px-4 py-3 text-sm">
        <span className="flex items-center gap-2 font-medium">
          <span
            className={online ? "h-2.5 w-2.5 rounded-full bg-status-pass-border" : "h-2.5 w-2.5 rounded-full bg-status-close-border"}
            aria-hidden
          />
          {online ? strings.buyer.dnbpHome.live : strings.buyer.dnbpHome.offline}
        </span>
        <span className="text-fg-tertiary">
          {strings.buyer.dnbpHome.updatedPrefix} {minutesAgo === 0 ? "just now" : `${minutesAgo} min ago`}
        </span>
      </div>

      {isStale ? (
        <div
          role="alert"
          aria-live="assertive"
          className="border-b border-status-close-border bg-status-close-bg px-4 py-3 text-sm font-medium text-status-close-fg"
        >
          {strings.buyer.dnbpHome.stale}
        </div>
      ) : null}

      <div className="flex flex-col">
        {cached.species.map((line) => {
          const delta = priceDelta(line);
          return (
          <div key={line.species} className="border-b border-subtle px-4 py-6">
            <p className="flex items-center gap-1.5 text-lg font-semibold uppercase tracking-wide text-fg-secondary">
              {line.species}
              <InfoTooltip
                label={`About the ${strings.buyer.dnbpHome.title}`}
                what={strings.buyer.dnbpHome.tooltips.dnbp.what}
                how={strings.buyer.dnbpHome.tooltips.dnbp.how}
              />
            </p>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <p
                data-numeric
                className="text-6xl font-bold leading-none text-accent-default"
                style={{ fontFeatureSettings: '"tnum" 1' }}
              >
                ${line.dnbp_per_kg}
              </p>
              {delta !== null ? (
                <span data-numeric className="flex items-center gap-1 text-lg font-medium text-fg-secondary">
                  <span aria-hidden="true">
                    {delta > 0 ? "▲" : "▼"} {delta > 0 ? "+" : "−"}
                    {Math.abs(delta).toFixed(2)}
                  </span>
                  <span className="sr-only">
                    {delta > 0 ? strings.buyer.dnbpHome.increasedBy : strings.buyer.dnbpHome.decreasedBy} $
                    {Math.abs(delta).toFixed(2)}
                  </span>
                  <InfoTooltip
                    label="About this price change"
                    what={strings.buyer.dnbpHome.tooltips.delta.what}
                    how={strings.buyer.dnbpHome.tooltips.delta.how}
                  />
                </span>
              ) : null}
            </div>
            <p className="mt-2 text-sm text-fg-tertiary">
              {strings.buyer.dnbpHome.perKg}
              {line.target_heads ? ` · ${Math.round(Number(line.target_heads))} ${strings.buyer.dnbpHome.headsSuffix}` : ""}
              {line.weight_band
                ? ` · ${Number(line.weight_band.min).toFixed(1)}–${Number(line.weight_band.max).toFixed(1)} kg`
                : ""}
            </p>
            {line.target_heads ? (
              <p className="mt-1 flex items-center gap-1 text-sm font-medium text-fg-secondary" data-numeric>
                {Math.round(Number(line.heads_bought))} / {Math.round(Number(line.target_heads))}{" "}
                {strings.buyer.dnbpHome.headsSuffix} {strings.buyer.dnbpHome.boughtSoFar}
                <InfoTooltip
                  label={`About ${strings.buyer.dnbpHome.boughtSoFar}`}
                  what={strings.buyer.dnbpHome.tooltips.boughtSoFar.what}
                  how={strings.buyer.dnbpHome.tooltips.boughtSoFar.how}
                />
              </p>
            ) : null}
          </div>
          );
        })}
      </div>
    </div>
  );
}
