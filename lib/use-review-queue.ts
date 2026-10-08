"use client";

import * as React from "react";
import { useAuthStore } from "./auth-store";
import { REVIEW_CHANGED_EVENT, summariseReviewQueue, type ReviewQueue } from "./review-queue";
import { workbenchApi } from "./workbench-api";

async function fetchQueue(accessToken: string | null): Promise<{ snapshotId: string; queue: ReviewQueue } | null> {
  try {
    const latest = (await workbenchApi.listSnapshots(accessToken))[0];
    if (!latest || latest.status !== "CALCULATED") return null;
    const issues = await workbenchApi.listIssues(latest.id, accessToken);
    return { snapshotId: latest.id, queue: summariseReviewQueue(issues) };
  } catch {
    return null;
  }
}

/** The latest snapshot's review queue, for the nav badge. Best-effort: any
 * failure just means no badge. Recounts on navigation and after a decision. */
export function useReviewQueue(enabled: boolean, refreshOn: string | null) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [state, setState] = React.useState<{ snapshotId: string; queue: ReviewQueue } | null>(null);

  React.useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    const refresh = () => {
      fetchQueue(accessToken).then((next) => {
        if (!cancelled) setState(next);
      });
    };
    refresh();
    window.addEventListener(REVIEW_CHANGED_EVENT, refresh);
    return () => {
      cancelled = true;
      window.removeEventListener(REVIEW_CHANGED_EVENT, refresh);
    };
    // `refreshOn` (the pathname) only exists to recount on navigation
  }, [enabled, accessToken, refreshOn]);

  return enabled ? state : null;
}
