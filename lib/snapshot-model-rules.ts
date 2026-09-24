import type { SnapshotModelStatus, SnapshotStatus } from "./workbench-api.ts";

/**
 * What the workbench may offer for a snapshot, given which DNBP model its
 * workings were computed under versus the model live now. Mirrors the
 * server's enforcement (backend/services/dnbp_model_service.py and
 * api/v1/snapshots.py) so the UI never offers an action the server will
 * refuse — but the server stays the authority.
 *
 *  - Not yet published, computed under an older model: Recalculate, and hold
 *    back Generate Buy Instruction until then, so prices and the buyer's
 *    weight bands come from the same model.
 *  - Published under an older model: its workings are the evidence behind
 *    prices buyers already received, so it cannot be recalculated — the order
 *    file is uploaded again to reprice.
 *  - Published under the live model: recalculating reproduces the same
 *    numbers, so review-and-republish stays available.
 *  - Superseded: frozen.
 */
export type ModelGuard = {
  banner: "none" | "recalculate-before-publishing" | "upload-again";
  canRecalculate: boolean;
  canGenerateInstruction: boolean;
  /** Names of the older model(s) the workings came from, for the banner text. */
  staleModelNames: string[];
};

export function evaluateModelGuard(status: SnapshotStatus, model: SnapshotModelStatus | null): ModelGuard {
  const staleModelNames = model
    ? [...new Set(model.calculated_under.filter((s) => s.model_id !== model.live_model_id).map((s) => s.name))]
    : [];
  // Unknown (still loading, or the request failed): stay permissive rather
  // than lock the user out — the server refuses a stale publish regardless.
  const stale = model?.stale ?? false;

  if (status === "SUPERSEDED") {
    return { banner: "none", canRecalculate: false, canGenerateInstruction: true, staleModelNames };
  }
  if (status === "PUBLISHED") {
    return {
      banner: stale ? "upload-again" : "none",
      canRecalculate: !stale,
      canGenerateInstruction: true,
      staleModelNames,
    };
  }
  return {
    banner: stale ? "recalculate-before-publishing" : "none",
    canRecalculate: true,
    canGenerateInstruction: !stale,
    staleModelNames,
  };
}
