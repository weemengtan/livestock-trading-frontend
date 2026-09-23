"use client";

import * as React from "react";
import { use } from "react";
import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { Label } from "@/components/ui/label";
import { Toggle } from "@/components/ui/toggle";
import { toast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";
import { strings } from "@/lib/strings";
import {
  buyInstructionsApi,
  type BuyInstruction,
  type BuyInstructionLine,
  type Reconciliation,
  type ReconciliationEntry,
} from "@/lib/buy-instructions-api";

function money(value: string, dp = 2) {
  return Number(value).toFixed(dp);
}

function groupKey(saleyard: string, species: string) {
  return `${saleyard}\u0000${species}`;
}

export default function BuyInstructionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <AuthGuard requiredRole={["OWNER", "ACCOUNTANT"]}>
      <AppShell title={strings.buyInstructions.title}>
        <BuyInstructionDetailContent id={id} />
      </AppShell>
    </AuthGuard>
  );
}

function BuyInstructionDetailContent({ id }: { id: string }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const role = useAuthStore((s) => s.user?.role);
  const [instruction, setInstruction] = React.useState<BuyInstruction | null>(null);
  const [reconciliation, setReconciliation] = React.useState<Reconciliation | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [fillDrafts, setFillDrafts] = React.useState<
    Record<string, { label: string; amount: string; isOutsourced: boolean; outsourcedBuyerName: string }>
  >({});
  const [speciesFilter, setSpeciesFilter] = React.useState("");
  const [expandedGroup, setExpandedGroup] = React.useState<string | null>(null);
  const [entriesByGroup, setEntriesByGroup] = React.useState<Record<string, ReconciliationEntry[]>>({});
  const [entriesLoading, setEntriesLoading] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      const [inst, recon] = await Promise.all([
        // A 404 here means the instruction genuinely doesn't exist (or
        // isn't this org's) — that's what the EmptyState below is for.
        // Anything else (5xx, network) is a real failure and must not be
        // silently relabeled as "not found", so it gets its own toast
        // instead of being swallowed the same way.
        buyInstructionsApi.get(id, accessToken).catch((err) => {
          if (!(err instanceof ApiError) || err.status !== 404) {
            toast({ title: err instanceof Error ? err.message : "Something went wrong", variant: "danger" });
          }
          return null;
        }),
        buyInstructionsApi.getReconciliation(id, accessToken).catch(() => null),
      ]);
      setInstruction(inst);
      setReconciliation(recon);
    } finally {
      setLoading(false);
    }
  }, [id, accessToken]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function toggleReconciliationGroup(saleyard: string, species: string) {
    const key = groupKey(saleyard, species);
    if (expandedGroup === key) {
      setExpandedGroup(null);
      return;
    }
    setExpandedGroup(key);
    if (entriesByGroup[key]) return;
    setEntriesLoading(key);
    try {
      const entries = await buyInstructionsApi.getReconciliationEntries(id, saleyard, species, accessToken);
      setEntriesByGroup((prev) => ({ ...prev, [key]: entries }));
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Could not load buy entries", variant: "danger" });
      setExpandedGroup(null);
    } finally {
      setEntriesLoading(null);
    }
  }

  async function withBusy(key: string, fn: () => Promise<void>) {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Something went wrong", variant: "danger" });
    } finally {
      setBusy(null);
    }
  }

  async function handleApprove() {
    await withBusy("approve", async () => {
      await buyInstructionsApi.approve(id, accessToken);
      await load();
    });
  }

  async function handlePublish() {
    await withBusy("publish", async () => {
      await buyInstructionsApi.publish(id, accessToken);
      await load();
    });
  }

  async function handleReconcileClose() {
    await withBusy("reconcile-close", async () => {
      await buyInstructionsApi.reconcileClose(id, accessToken);
      await load();
    });
  }

  function updateFillDraft(
    lineId: string,
    patch: Partial<{ label: string; amount: string; isOutsourced: boolean; outsourcedBuyerName: string }>
  ) {
    setFillDrafts((prev) => ({
      ...prev,
      [lineId]: {
        label: prev[lineId]?.label ?? "",
        amount: prev[lineId]?.amount ?? "",
        isOutsourced: prev[lineId]?.isOutsourced ?? false,
        outsourcedBuyerName: prev[lineId]?.outsourcedBuyerName ?? "",
        ...patch,
      },
    }));
  }

  async function handleAddFill(line: BuyInstructionLine) {
    const draft = fillDrafts[line.id];
    if (!draft?.label || !draft?.amount) return;
    await withBusy(`fill-${line.id}`, async () => {
      const updated = await buyInstructionsApi.addFill(id, line.id, draft.label, draft.amount, accessToken, {
        isOutsourced: draft.isOutsourced,
        outsourcedBuyerName: draft.outsourcedBuyerName.trim() || null,
      });
      setInstruction(updated);
      setFillDrafts((prev) => ({
        ...prev,
        [line.id]: { label: "", amount: "", isOutsourced: false, outsourcedBuyerName: "" },
      }));
    });
  }

  async function handleRemoveFill(line: BuyInstructionLine, fillId: string) {
    await withBusy(`fill-${line.id}`, async () => {
      const updated = await buyInstructionsApi.removeFill(id, line.id, fillId, accessToken);
      setInstruction(updated);
    });
  }

  async function handleExport(format: "pdf" | "xlsx") {
    await withBusy(`export-${format}`, async () => {
      const blob = await buyInstructionsApi.downloadExport(id, format, accessToken);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${instruction?.instruction_no ?? "buy-instruction"}-v${instruction?.version ?? 1}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });
  }

  if (loading && !instruction) {
    return <p className="text-sm text-fg-tertiary">Loading…</p>;
  }
  if (!instruction) {
    return <EmptyState title="Buy Instruction not found" />;
  }

  const canFill = instruction.status === "ISSUED" || instruction.status === "ACKNOWLEDGED";
  const filteredLines = instruction.lines.filter((line) =>
    line.species.toLowerCase().includes(speciesFilter.trim().toLowerCase())
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          {/* AppShell already renders the page's <h1> (its title bar) — this is the content area's own heading. */}
          <h2 className="text-xl font-semibold text-fg-primary">
            {instruction.instruction_no} <span className="text-fg-tertiary">v{instruction.version}</span>
          </h2>
          <p className="mt-1 text-sm text-fg-secondary">
            {instruction.trade_date} · {instruction.approved_by ? `${strings.buyInstructions.approvedBy}: ✓` : "Not yet approved"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={instruction.status === "RECONCILED" ? "pass" : "accent"}>{instruction.status}</Badge>
          {instruction.status === "DRAFT" && role === "OWNER" && !instruction.approved_by ? (
            <Button size="sm" onClick={handleApprove} disabled={busy === "approve"}>
              {busy === "approve" ? strings.buyInstructions.approving : strings.buyInstructions.approve}
            </Button>
          ) : null}
          {instruction.status === "DRAFT" && instruction.approved_by ? (
            <Button size="sm" onClick={handlePublish} disabled={busy === "publish"}>
              {busy === "publish" ? strings.buyInstructions.publishing : strings.buyInstructions.publish}
            </Button>
          ) : null}
          {instruction.status === "ACKNOWLEDGED" ? (
            <Button size="sm" variant="secondary" onClick={handleReconcileClose} disabled={busy === "reconcile-close"}>
              {busy === "reconcile-close" ? strings.buyInstructions.closing : strings.buyInstructions.reconcileClose}
            </Button>
          ) : null}
          <Button size="sm" variant="secondary" onClick={() => handleExport("xlsx")} disabled={busy === "export-xlsx"}>
            {busy === "export-xlsx" ? strings.buyInstructions.export.exporting : strings.buyInstructions.export.xlsx}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => handleExport("pdf")} disabled={busy === "export-pdf"}>
            {busy === "export-pdf" ? strings.buyInstructions.export.exporting : strings.buyInstructions.export.pdf}
          </Button>
        </div>
      </div>

      <Card>
        <h2 className="text-lg font-semibold text-fg-primary">{strings.buyInstructions.lineItems}</h2>

        <div className="mt-3 flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div className="flex flex-col gap-1">
              <Label htmlFor="bi-species-filter">{strings.buyInstructions.filters.species}</Label>
              <Input id="bi-species-filter" value={speciesFilter} onChange={(e) => setSpeciesFilter(e.target.value)} />
            </div>
          </div>

          {speciesFilter ? (
            <div className="flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSpeciesFilter("")}
                className="gap-1.5 text-fg-secondary"
                aria-label={strings.buyInstructions.filters.clear}
                title={strings.buyInstructions.filters.clear}
              >
                <ClearIcon />
                {strings.buyInstructions.filters.clear}
              </Button>
            </div>
          ) : null}
        </div>

        <div className="mt-3 overflow-x-auto">
          {/* eslint-disable-next-line local/no-raw-design-values -- 900px is the minimum width this
              specific wide table needs before its columns start clipping; not a design-token value,
              a functional layout threshold, and the closest named scale step (min-w-96 = 384px) isn't
              remotely equivalent. */}
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-subtle text-left text-fg-tertiary">
                <th className="py-2 pr-3">{strings.buyInstructions.columns.contract}</th>
                <th className="py-2 pr-3">{strings.buyInstructions.columns.species}</th>
                <th className="py-2 pr-3 text-right">
                  <span className="inline-flex items-center gap-1">
                    {strings.buyInstructions.columns.schw}
                    <InfoTooltip
                      label={`About ${strings.buyInstructions.columns.schw}`}
                      what={strings.buyInstructions.tooltips.schw.what}
                      how={strings.buyInstructions.tooltips.schw.how}
                    />
                  </span>
                </th>
                <th className="py-2 pr-3 text-right">{strings.buyInstructions.columns.expectedHeads}</th>
                <th className="py-2 pr-3 text-right">{strings.buyInstructions.columns.weightRequirement}</th>
                <th className="py-2 pr-3 text-right font-semibold text-fg-primary">{strings.buyInstructions.columns.dnbp}</th>
                <th className="py-2 pr-3 text-right">{strings.buyInstructions.columns.petersExpectation}</th>
                <th className="py-2 pr-3 text-right">
                  <span className="inline-flex items-center gap-1">
                    {strings.buyInstructions.columns.expectedCost}
                    <InfoTooltip
                      label={`About ${strings.buyInstructions.columns.expectedCost}`}
                      what={strings.buyInstructions.tooltips.expectedCost.what}
                      how={strings.buyInstructions.tooltips.expectedCost.how}
                    />
                  </span>
                </th>
                <th className="py-2 pr-3">{strings.buyInstructions.columns.fills}</th>
                <th className="py-2 text-right">
                  <span className="inline-flex items-center gap-1">
                    {strings.buyInstructions.columns.balance}
                    <InfoTooltip
                      label={`About ${strings.buyInstructions.columns.balance}`}
                      what={strings.buyInstructions.tooltips.balance.what}
                      how={strings.buyInstructions.tooltips.balance.how}
                    />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredLines.map((line) => (
                <tr key={line.id} className="border-b border-subtle align-top">
                  <td className="py-2 pr-3 font-medium">{line.contract_no ?? "—"}</td>
                  <td className="py-2 pr-3">{line.species}</td>
                  <td className="py-2 pr-3 text-right" data-numeric>{money(line.schw_kg)}</td>
                  <td className="py-2 pr-3 text-right" data-numeric>{money(line.expected_heads)}</td>
                  <td className="py-2 pr-3 text-right" data-numeric>{money(line.weight_requirement_kg)}</td>
                  <td className="py-2 pr-3 text-right font-semibold text-accent-default" data-numeric>
                    ${money(line.dnbp_per_kg, 4)}
                  </td>
                  <td className="py-2 pr-3 text-right text-fg-tertiary" data-numeric>
                    {line.peters_expectation ? money(line.peters_expectation, 4) : "—"}
                  </td>
                  <td className="py-2 pr-3 text-right" data-numeric>{money(line.expected_livestock_cost)}</td>
                  <td className="py-2 pr-3">
                    <div className="flex flex-col gap-1">
                      {line.fills.map((fill) => (
                        <div key={fill.id} className="flex items-center gap-2 text-xs">
                          <span className="text-fg-secondary">
                            {fill.label}: {money(fill.kg_amount)}kg
                          </span>
                          {fill.is_outsourced ? (
                            <Badge variant="accent" title={fill.outsourced_buyer_name ?? undefined}>
                              {strings.buyer.buyLog.outsourcedBadge}
                            </Badge>
                          ) : null}
                          {canFill ? (
                            <button
                              type="button"
                              className="text-status-breach-fg hover:underline"
                              onClick={() => void handleRemoveFill(line, fill.id)}
                              disabled={busy === `fill-${line.id}`}
                            >
                              {strings.buyInstructions.removeFill}
                            </button>
                          ) : null}
                        </div>
                      ))}
                      {canFill ? (
                        <div className="mt-1 flex flex-col gap-1">
                          <div className="flex items-center gap-1">
                            <Input
                              className="h-8 w-20 px-2 text-xs"
                              placeholder={strings.buyInstructions.fillLabel}
                              value={fillDrafts[line.id]?.label ?? ""}
                              onChange={(e) => updateFillDraft(line.id, { label: e.target.value })}
                            />
                            <Input
                              className="h-8 w-20 px-2 text-xs"
                              placeholder={strings.buyInstructions.fillAmount}
                              inputMode="decimal"
                              value={fillDrafts[line.id]?.amount ?? ""}
                              onChange={(e) => updateFillDraft(line.id, { amount: e.target.value })}
                            />
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-8 px-2 text-xs"
                              onClick={() => void handleAddFill(line)}
                              disabled={busy === `fill-${line.id}`}
                            >
                              {strings.buyInstructions.addFill}
                            </Button>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Toggle
                              checked={fillDrafts[line.id]?.isOutsourced ?? false}
                              onChange={(checked) => updateFillDraft(line.id, { isOutsourced: checked })}
                              aria-label={strings.buyInstructions.fillOutsourcedLabel}
                            />
                            <span className="text-xs text-fg-tertiary">{strings.buyInstructions.fillOutsourcedLabel}</span>
                            {fillDrafts[line.id]?.isOutsourced ? (
                              <Input
                                className="h-8 w-32 px-2 text-xs"
                                placeholder={strings.buyInstructions.fillOutsourcedBuyerPlaceholder}
                                value={fillDrafts[line.id]?.outsourcedBuyerName ?? ""}
                                onChange={(e) => updateFillDraft(line.id, { outsourcedBuyerName: e.target.value })}
                              />
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </td>
                  <td className="py-2 text-right font-medium" data-numeric>{money(line.balance_kg)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {reconciliation ? (
        <Card>
          <h2 className="text-lg font-semibold text-fg-primary">{strings.buyInstructions.reconciliation.title}</h2>
          <p className="text-sm text-fg-tertiary">
            {strings.buyInstructions.reconciliation.subtitle}: {reconciliation.week_start} – {reconciliation.week_end}
          </p>
          {reconciliation.by_saleyard.length > 0 ? (
            <p className="text-xs text-fg-tertiary">{strings.buyInstructions.reconciliation.rowHint}</p>
          ) : null}

          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b border-subtle text-left text-fg-tertiary">
                <th className="py-2 pr-3">{strings.buyInstructions.reconciliation.saleyard}</th>
                <th className="py-2 pr-3">{strings.buyInstructions.reconciliation.species}</th>
                <th className="py-2 pr-3 text-right">{strings.buyInstructions.reconciliation.schw}</th>
                <th className="py-2 pr-3 text-right">{strings.buyInstructions.reconciliation.heads}</th>
                <th className="py-2 pr-3 text-right">{strings.buyInstructions.reconciliation.actualCostColumn}</th>
                <th className="py-2 text-right">{strings.buyInstructions.reconciliation.outsourcedColumn}</th>
              </tr>
            </thead>
            <tbody>
              {reconciliation.by_saleyard.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-3 text-fg-tertiary">
                    No buys recorded in this trading week yet.
                  </td>
                </tr>
              ) : (
                reconciliation.by_saleyard.map((row) => {
                  const key = groupKey(row.saleyard, row.species);
                  const isOpen = expandedGroup === key;
                  const entries = entriesByGroup[key];
                  return (
                    <React.Fragment key={key}>
                      <tr
                        role="button"
                        tabIndex={0}
                        aria-expanded={isOpen}
                        onClick={() => void toggleReconciliationGroup(row.saleyard, row.species)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            void toggleReconciliationGroup(row.saleyard, row.species);
                          }
                        }}
                        className="cursor-pointer border-b border-subtle hover:bg-sunken"
                      >
                        <td className="py-2 pr-3 font-medium">{row.saleyard}</td>
                        <td className="py-2 pr-3">{row.species}</td>
                        <td className="py-2 pr-3 text-right" data-numeric>{money(row.schw_kg)}</td>
                        <td className="py-2 pr-3 text-right" data-numeric>{row.heads}</td>
                        <td className="py-2 pr-3 text-right" data-numeric>{money(row.actual_cost)}</td>
                        <td className="py-2 text-right">
                          {row.outsourced_heads > 0 ? (
                            <Badge variant="accent" title={`${money(row.outsourced_cost)} outsourced cost`}>
                              {row.outsourced_heads}hd
                            </Badge>
                          ) : (
                            <span className="text-fg-tertiary">—</span>
                          )}
                        </td>
                      </tr>
                      {isOpen ? (
                        <tr className="border-b border-subtle bg-sunken">
                          <td colSpan={6} className="px-3 py-2">
                            {entriesLoading === key ? (
                              <p className="py-2 text-sm text-fg-tertiary">{strings.buyInstructions.reconciliation.entries.loading}</p>
                            ) : !entries || entries.length === 0 ? (
                              <p className="py-2 text-sm text-fg-tertiary">{strings.buyInstructions.reconciliation.entries.empty}</p>
                            ) : (
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-left text-fg-tertiary">
                                    <th className="py-1 pr-3">{strings.buyInstructions.reconciliation.entries.buyer}</th>
                                    <th className="py-1 pr-3">{strings.buyInstructions.reconciliation.entries.agent}</th>
                                    <th className="py-1 pr-3">{strings.buyInstructions.reconciliation.entries.pen}</th>
                                    <th className="py-1 pr-3 text-right">{strings.buyInstructions.reconciliation.entries.heads}</th>
                                    <th className="py-1 pr-3 text-right">{strings.buyInstructions.reconciliation.entries.price}</th>
                                    <th className="py-1 pr-3 text-right">{strings.buyInstructions.reconciliation.entries.weight}</th>
                                    <th className="py-1 pr-3 text-right">{strings.buyInstructions.reconciliation.entries.impliedPrice}</th>
                                    <th className="py-1 pr-3">{strings.buyInstructions.reconciliation.entries.outsourced}</th>
                                    <th className="py-1 text-right">{strings.buyInstructions.reconciliation.entries.loggedAt}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {entries.map((e) => (
                                    <tr key={e.id} className="border-t border-subtle">
                                      <td className="py-1 pr-3">{e.buyer_email}</td>
                                      <td className="py-1 pr-3">{e.agent ?? "—"}</td>
                                      <td className="py-1 pr-3">{e.pen ?? "—"}</td>
                                      <td className="py-1 pr-3 text-right" data-numeric>{e.head_count}</td>
                                      <td className="py-1 pr-3 text-right" data-numeric>{money(e.price_per_head)}</td>
                                      <td className="py-1 pr-3 text-right" data-numeric>{money(e.weight_kg)}</td>
                                      <td className="py-1 pr-3 text-right" data-numeric>
                                        <span className="inline-flex items-center gap-1">
                                          <span
                                            className={e.is_breach ? "h-1.5 w-1.5 rounded-full bg-status-breach-border" : "h-1.5 w-1.5 rounded-full bg-status-pass-border"}
                                            aria-hidden
                                          />
                                          ${money(e.implied_price_per_kg)}
                                        </span>
                                      </td>
                                      <td className="py-1 pr-3">
                                        {e.is_outsourced ? (
                                          <Badge variant="accent" title={e.outsourced_buyer_name ?? undefined}>
                                            {strings.buyer.buyLog.outsourcedBadge}
                                          </Badge>
                                        ) : (
                                          <span className="text-fg-tertiary">—</span>
                                        )}
                                      </td>
                                      <td className="py-1 text-right" data-numeric>
                                        {new Date(e.client_created_at).toLocaleString()}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </td>
                        </tr>
                      ) : null}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>

          <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-2 border-t border-subtle pt-4 text-sm sm:grid-cols-3">
            <SummaryRow label={strings.buyInstructions.reconciliation.actualHeads} value={String(reconciliation.summary.actual_heads)} />
            <SummaryRow label={strings.buyInstructions.reconciliation.expectedHeads} value={money(reconciliation.summary.expected_heads)} />
            <SummaryRow
              label={strings.buyInstructions.reconciliation.orderedSchw}
              value={money(reconciliation.summary.ordered_schw)}
              tooltip={strings.buyInstructions.reconciliationTooltips.orderedSchw}
            />
            <SummaryRow
              label={strings.buyInstructions.reconciliation.boughtSchw}
              value={money(reconciliation.summary.bought_schw)}
              tooltip={strings.buyInstructions.reconciliationTooltips.boughtSchw}
            />
            <SummaryRow
              label={strings.buyInstructions.reconciliation.surplusShortfall}
              value={money(reconciliation.summary.surplus_shortfall_schw)}
              tooltip={strings.buyInstructions.reconciliationTooltips.surplusShortfall}
            />
            <SummaryRow
              label={strings.buyInstructions.reconciliation.expectedCost}
              value={money(reconciliation.summary.expected_cost)}
              tooltip={strings.buyInstructions.reconciliationTooltips.expectedCost}
            />
            <SummaryRow
              label={strings.buyInstructions.reconciliation.actualCost}
              value={money(reconciliation.summary.actual_cost)}
              tooltip={strings.buyInstructions.reconciliationTooltips.actualCost}
            />
            <SummaryRow
              label={strings.buyInstructions.reconciliation.costVariance}
              value={money(reconciliation.summary.cost_variance)}
              tooltip={strings.buyInstructions.reconciliationTooltips.costVariance}
            />
            <SummaryRow
              label={strings.buyInstructions.reconciliation.outsourcedHeads}
              value={String(reconciliation.summary.outsourced_heads)}
              tooltip={strings.buyInstructions.reconciliationTooltips.outsourcedHeads}
            />
            <SummaryRow
              label={strings.buyInstructions.reconciliation.outsourcedCost}
              value={money(reconciliation.summary.outsourced_cost)}
              tooltip={strings.buyInstructions.reconciliationTooltips.outsourcedCost}
            />
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function ClearIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
      <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function SummaryRow({
  label,
  value,
  tooltip,
}: {
  label: string;
  value: string;
  tooltip?: { what: string; how: string };
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-1 text-fg-tertiary">
        {label}
        {tooltip ? <InfoTooltip label={`About ${label}`} what={tooltip.what} how={tooltip.how} /> : null}
      </span>
      <span className="font-medium" data-numeric>
        {value}
      </span>
    </div>
  );
}
