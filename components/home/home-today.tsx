"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { useAuthStore } from "@/lib/auth-store";
import { publicationsApi, type PublicationDetail } from "@/lib/publications-api";
import { strings } from "@/lib/strings";
import { workbenchApi, type Snapshot, type ValidationIssue } from "@/lib/workbench-api";

const MELBOURNE_TZ = "Australia/Melbourne";
const DEADLINE_HOUR = 13;

function melbourneNow(): Date {
  // Reinterpret the current instant's Melbourne wall-clock fields as if
  // they were UTC, so plain Date arithmetic (hours/minutes, date equality)
  // works without pulling in a timezone library for one screen.
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: MELBOURNE_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  return new Date(
    Date.UTC(
      Number(get("year")),
      Number(get("month")) - 1,
      Number(get("day")),
      Number(get("hour")) === 24 ? 0 : Number(get("hour")),
      Number(get("minute")),
      Number(get("second"))
    )
  );
}

function formatCountdown(now: Date): { label: string; passed: boolean } {
  const deadline = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), DEADLINE_HOUR, 0, 0));
  const diffMs = deadline.getTime() - now.getTime();
  if (diffMs <= 0) return { label: strings.home.deadlinePassed, passed: true };
  const hours = Math.floor(diffMs / 3_600_000);
  const minutes = Math.floor((diffMs % 3_600_000) / 60_000);
  return { label: `${hours}h ${minutes}m remaining`, passed: false };
}

function isSameMelbourneDate(isoTimestamp: string, now: Date): boolean {
  const uploaded = new Intl.DateTimeFormat("en-CA", { timeZone: MELBOURNE_TZ }).format(new Date(isoTimestamp));
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "UTC" }).format(now);
  return uploaded === today;
}

type Step = "receive" | "validate" | "calculate" | "review" | "publish";

function StepBadge({ label, blocked }: { label: string; blocked: string | null }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1 text-center">
      <Badge variant={blocked ? "neutral" : "pass"}>{label}</Badge>
      <span className="min-h-10 text-xs text-fg-tertiary">{blocked ?? "✓"}</span>
    </div>
  );
}

function StatTile({
  label,
  value,
  tooltip,
}: {
  label: string;
  value: string;
  tooltip?: { what: string; how: string };
}) {
  return (
    <Card className="p-4">
      <p className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-fg-tertiary">
        {label}
        {tooltip ? <InfoTooltip label={`About ${label}`} what={tooltip.what} how={tooltip.how} /> : null}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-fg-primary">{value}</p>
    </Card>
  );
}

export function HomeToday() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [now, setNow] = React.useState<Date | null>(() => melbourneNow());
  const [snapshot, setSnapshot] = React.useState<Snapshot | null>(null);
  const [activeCount, setActiveCount] = React.useState(0);
  const [totalExposure, setTotalExposure] = React.useState(0);
  const [headsRequired, setHeadsRequired] = React.useState(0);
  const [openCorrections, setOpenCorrections] = React.useState(0);
  const [issues, setIssues] = React.useState<ValidationIssue[]>([]);
  const [publication, setPublication] = React.useState<PublicationDetail | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const interval = setInterval(() => setNow(melbourneNow()), 30_000);
    return () => clearInterval(interval);
  }, []);

  const load = React.useCallback(async () => {
    try {
      const snapshots = await workbenchApi.listSnapshots(accessToken);
      const latest = snapshots[0] ?? null;
      setSnapshot(latest);

      if (latest) {
        const [activeLines, issueRows] = await Promise.all([
          workbenchApi.listLines(latest.id, accessToken),
          workbenchApi.listIssues(latest.id, accessToken),
        ]);
        setActiveCount(activeLines.length);
        setTotalExposure(activeLines.reduce((sum, l) => sum + Number(l.amount_aud ?? 0), 0));
        setHeadsRequired(activeLines.reduce((sum, l) => sum + Number(l.estimated_heads ?? 0), 0));
        setIssues(issueRows);
      }

      const correctionRows = await workbenchApi.listAllCorrectionRequests(accessToken, "OPEN");
      setOpenCorrections(correctionRows.length);

      try {
        setPublication(await publicationsApi.getCurrent(accessToken));
      } catch {
        setPublication(null);
      }
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  React.useEffect(() => {
    void load();
  }, [load]);

  if (loading || !now) {
    return <p className="text-sm text-fg-tertiary">Loading…</p>;
  }

  if (!snapshot) {
    return (
      <EmptyState
        title="No submission yet today"
        body="Upload the Active Purchase Orders spreadsheet to start today's pipeline."
      />
    );
  }

  const countdown = formatCountdown(now);
  const receivedToday = isSameMelbourneDate(snapshot.created_at, now);
  const activeIssues = issues; // calculate_service only creates issues for active lines' own rows
  const hasBlock = activeIssues.some((i) => i.severity === "BLOCK");
  const unacknowledged = activeIssues.filter(
    (i) => (i.severity === "WARN" || i.severity === "CORRECTION") && !i.acknowledged_at
  );

  const blockers: Record<Step, string | null> = {
    receive: receivedToday ? null : "No submission received today",
    validate: hasBlock ? "One or more active lines blocked" : null,
    calculate: snapshot.status === "PARSED" ? "Not yet calculated" : null,
    review: unacknowledged.length > 0 ? `${unacknowledged.length} issue(s) need acknowledgement` : null,
    publish: snapshot.status !== "PUBLISHED" && snapshot.status !== "SUPERSEDED" ? "Not yet published" : null,
  };

  return (
    <div className="flex flex-col gap-6">
      <Card className={countdown.passed && !receivedToday ? "border-status-breach-fg" : undefined}>
        <p className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-fg-tertiary">
          {strings.home.deadlineLabel}
          <InfoTooltip
            label={`About ${strings.home.deadlineLabel}`}
            what={strings.home.tooltips.deadline.what}
            how={strings.home.tooltips.deadline.how}
          />
        </p>
        <p
          className={
            "mt-1 text-xl font-semibold tabular-nums " +
            (countdown.passed && !receivedToday ? "text-status-breach-fg" : "text-fg-primary")
          }
        >
          {countdown.label}
        </p>
      </Card>

      <Card>
        <p className="flex items-center gap-1.5 text-sm font-semibold text-fg-primary">
          {strings.home.pipeline.title}
          <InfoTooltip
            label={`About ${strings.home.pipeline.title}`}
            what={strings.home.tooltips.pipeline.what}
            how={strings.home.tooltips.pipeline.how}
          />
        </p>
        <div className="mt-4 flex items-start justify-between gap-2">
          {(Object.keys(blockers) as Step[]).map((step) => (
            <StepBadge key={step} label={strings.home.pipeline.steps[step]} blocked={blockers[step]} />
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile label={strings.home.tiles.activeOrders} value={String(activeCount)} />
        <StatTile
          label={strings.home.tiles.totalExposure}
          value={totalExposure.toLocaleString("en-AU", { style: "currency", currency: "AUD" })}
          tooltip={strings.home.tooltips.totalExposure}
        />
        <StatTile
          label={strings.home.tiles.headsRequired}
          value={headsRequired.toLocaleString("en-AU")}
          tooltip={strings.home.tooltips.headsRequired}
        />
        <StatTile label={strings.home.tiles.openCorrections} value={String(openCorrections)} />
      </div>

      <Card>
        <p className="text-sm font-semibold text-fg-primary">{strings.home.publicationState.title}</p>
        {publication ? (
          <div className="mt-2 flex flex-col gap-2">
            <p className="text-sm text-fg-secondary">
              {strings.home.publicationState.live} {new Date(publication.published_at).toLocaleString()}
            </p>
            <div className="flex flex-wrap gap-2">
              {publication.deliveries.map((d) => (
                <Badge key={d.buyer_id} variant={d.acknowledged_at ? "pass" : d.is_overdue ? "breach" : "neutral"}>
                  {d.buyer_email}: {d.acknowledged_at ? "Delivered ✓" : "Not yet seen"}
                </Badge>
              ))}
            </div>
          </div>
        ) : (
          <p className="mt-2 text-sm text-fg-tertiary">{strings.home.publicationState.none}</p>
        )}
      </Card>
    </div>
  );
}
