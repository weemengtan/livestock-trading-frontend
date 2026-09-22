"use client";

import * as React from "react";
import { DateTime } from "@/components/ui/date-time";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/components/ui/toast";
import { useAuthStore } from "@/lib/auth-store";
import { type IngestionContract, type Snapshot, type UploadPreview, workbenchApi } from "@/lib/workbench-api";
import { precheckWorkbook } from "@/lib/workbook-precheck";

function formatRelativeTime(isoString: string): string {
  const minutesAgo = Math.max(0, Math.round((Date.now() - new Date(isoString).getTime()) / 60000));
  if (minutesAgo === 0) return "just now";
  if (minutesAgo < 60) return `${minutesAgo} min ago`;
  const hoursAgo = Math.round(minutesAgo / 60);
  return `${hoursAgo} hour${hoursAgo === 1 ? "" : "s"} ago`;
}

export default function WorkbenchListPage() {
  return (
    <AuthGuard requiredRole={["OWNER", "ACCOUNTANT"]}>
      <AppShell title="Order Workbench">
        <WorkbenchListContent />
      </AppShell>
    </AuthGuard>
  );
}

type Stage = "idle" | "uploading" | "committing" | "calculating";

const STAGE_LABEL: Record<Exclude<Stage, "idle">, string> = {
  uploading: "Uploading & parsing spreadsheet…",
  committing: "Committing snapshot…",
  calculating: "Calculating…",
};

function WorkbenchListContent() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [snapshots, setSnapshots] = React.useState<Snapshot[]>([]);
  const [preview, setPreview] = React.useState<UploadPreview | null>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [stage, setStage] = React.useState<Stage>("idle");
  const [dragActive, setDragActive] = React.useState(false);
  const [contract, setContract] = React.useState<IngestionContract | null>(null);
  // Why the chosen file can't be previewed — shown inline until the user picks another file.
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const selectionCounter = React.useRef(0);
  // Starts true (first paint is always "loading") rather than being set
  // synchronously inside the effect below — only the async continuation
  // (after the awaited fetch) ever calls setLoading(false).
  const [loading, setLoading] = React.useState(true);
  const busy = stage !== "idle";

  const loadSnapshots = React.useCallback(async () => {
    try {
      setSnapshots(await workbenchApi.listSnapshots(accessToken));
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  React.useEffect(() => {
    void loadSnapshots();
  }, [loadSnapshots]);

  // The pre-check is advisory (the backend repeats it), so a failure to load
  // the contract just means the file is checked on upload instead.
  React.useEffect(() => {
    workbenchApi
      .getIngestionContract(accessToken)
      .then(setContract)
      .catch(() => setContract(null));
  }, [accessToken]);

  async function selectFile(candidate: File | null) {
    const selection = ++selectionCounter.current;
    setPreview(null);
    setUploadError(null);
    if (candidate && !candidate.name.toLowerCase().endsWith(".xlsx")) {
      setFile(null);
      setUploadError("Only .xlsx files are supported. Please upload the daily Active Purchase Orders workbook.");
      return;
    }
    setFile(candidate);
    if (!candidate || !contract) return;
    const result = await precheckWorkbook(candidate, contract.required_sheet_name);
    if (selection === selectionCounter.current && !result.ok) setUploadError(result.message);
  }

  async function handlePreview() {
    if (!file) return;
    setStage("uploading");
    setUploadError(null);
    try {
      setPreview(await workbenchApi.uploadPreview(file, accessToken));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Could not read this file.");
    } finally {
      setStage("idle");
    }
  }

  async function handleConfirm() {
    if (!preview) return;
    try {
      setStage("committing");
      const snapshot = await workbenchApi.commitSnapshot(preview.preview_id, accessToken);
      setStage("calculating");
      await workbenchApi.calculateSnapshot(snapshot.id, accessToken);
      toast({ title: "Snapshot committed and calculated" });
      setPreview(null);
      setFile(null);
      await loadSnapshots();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Could not commit this snapshot", variant: "danger" });
    } finally {
      setStage("idle");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <h2 className="text-lg font-semibold text-fg-primary">Upload Active Purchase Orders</h2>
        <p className="mt-1 text-sm text-fg-secondary">
          Available to both Owner and Accountant (§11.2) — whoever the abattoir&apos;s email reaches. Only the Active Orders on the
          &apos;{contract?.required_sheet_name ?? "Profitability Analysis"}&apos; tab are read. The diff against the previous
          snapshot is shown before anything is committed.
        </p>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            void selectFile(e.dataTransfer.files?.[0] ?? null);
          }}
          className={`mt-4 flex flex-col items-center gap-2 rounded-md border-2 border-dashed p-6 text-center transition-colors ${
            dragActive ? "border-accent-default bg-accent-subtle" : "border-default bg-sunken"
          }`}
        >
          <label htmlFor="upload-file" className="cursor-pointer text-sm text-fg-secondary">
            {file ? (
              <span className="font-medium text-fg-primary">{file.name}</span>
            ) : (
              <>
                <span className="font-medium text-accent-default">Click to browse</span> or drag a .xlsx file here
              </>
            )}
          </label>
          <input
            id="upload-file"
            type="file"
            accept=".xlsx"
            onChange={(e) => void selectFile(e.target.files?.[0] ?? null)}
            className="sr-only"
          />
          <Button size="sm" onClick={handlePreview} disabled={!file || busy || uploadError !== null}>
            {stage === "uploading" ? STAGE_LABEL.uploading : "Preview"}
          </Button>
        </div>

        {uploadError ? (
          <div
            role="alert"
            aria-live="assertive"
            className="mt-3 rounded-md border border-status-breach-border bg-status-breach-bg px-3 py-2 text-sm font-medium text-status-breach-fg"
          >
            {uploadError}
          </div>
        ) : null}

        {preview ? (
          <div className="mt-4 rounded-md border border-default bg-sunken p-4">
            {preview.duplicate_of_current ? (
              <div
                role="alert"
                aria-live="assertive"
                className="mb-3 rounded-md border border-status-close-border bg-status-close-bg px-3 py-2 text-sm font-medium text-status-close-fg"
              >
                This file looks identical to the current snapshot — uploaded {formatRelativeTime(preview.duplicate_of_current.uploaded_at)}{" "}
                by {preview.duplicate_of_current.uploaded_by_email}. You can still commit it if this is intentional.
              </div>
            ) : null}
            <p className="text-sm text-fg-primary">
              Reading tab: <span className="font-medium">{String(preview.detected_layout.sheet_name)}</span> — Active Orders only
            </p>
            <p className="mt-1 text-sm text-fg-secondary">{preview.active_count} active orders</p>
            <p className="mt-1 text-sm text-fg-secondary">
              vs previous snapshot: ✚ {preview.diff.summary.new_count} new · ✎ {preview.diff.summary.changed_count} changed ·
              ⊘ {preview.diff.summary.removed_count} removed
            </p>
            <Button size="sm" className="mt-3" onClick={handleConfirm} disabled={busy}>
              {stage === "committing" || stage === "calculating" ? STAGE_LABEL[stage] : "Confirm and commit"}
            </Button>
          </div>
        ) : null}
      </Card>

      <div>
        <h2 className="mb-2 text-lg font-semibold text-fg-primary">Snapshots</h2>
        {loading ? (
          <p className="text-sm text-fg-tertiary">Loading…</p>
        ) : snapshots.length === 0 ? (
          <EmptyState title="No snapshots yet" body="Upload the Active Purchase Orders workbook to get started." />
        ) : (
          <div className="flex flex-col gap-2">
            {snapshots.map((snapshot) => (
              <Link
                key={snapshot.id}
                href={`/workbench/${snapshot.id}`}
                className="flex items-center justify-between rounded-md border border-subtle bg-surface p-4 hover:border-default"
              >
                <div>
                  <p className="text-sm font-medium text-fg-primary">{snapshot.source_filename}</p>
                  <p className="text-xs text-fg-tertiary">{<DateTime value={snapshot.created_at} />}</p>
                </div>
                <Badge variant={snapshot.status === "CALCULATED" ? "pass" : "neutral"}>{snapshot.status}</Badge>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
