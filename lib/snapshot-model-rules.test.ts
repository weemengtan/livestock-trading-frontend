import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateModelGuard } from "./snapshot-model-rules.ts";
import type { SnapshotModelStatus } from "./workbench-api.ts";

const LIVE = "live-id";
const fresh: SnapshotModelStatus = {
  live_model_id: LIVE,
  live_model_name: "Oct 2026",
  calculated_under: [{ model_id: LIVE, name: "Oct 2026", line_count: 27 }],
  stale: false,
};
const stale: SnapshotModelStatus = {
  live_model_id: LIVE,
  live_model_name: "Oct 2026",
  calculated_under: [{ model_id: "old-id", name: "Sep 2026", line_count: 27 }],
  stale: true,
};

test("calculated under the live model: nothing to do", () => {
  const g = evaluateModelGuard("CALCULATED", fresh);
  assert.deepEqual(g, { banner: "none", canRecalculate: true, canGenerateInstruction: true, staleModelNames: [] });
});

test("unpublished + older model: recalculate first, hold back the instruction", () => {
  const g = evaluateModelGuard("CALCULATED", stale);
  assert.equal(g.banner, "recalculate-before-publishing");
  assert.equal(g.canRecalculate, true);
  assert.equal(g.canGenerateInstruction, false);
  assert.deepEqual(g.staleModelNames, ["Sep 2026"]);
});

test("published + older model: cannot recalculate, upload again", () => {
  const g = evaluateModelGuard("PUBLISHED", stale);
  assert.equal(g.banner, "upload-again");
  assert.equal(g.canRecalculate, false);
});

test("published + live model: review-and-republish stays available", () => {
  const g = evaluateModelGuard("PUBLISHED", fresh);
  assert.equal(g.banner, "none");
  assert.equal(g.canRecalculate, true);
});

test("superseded is frozen whatever the model", () => {
  assert.equal(evaluateModelGuard("SUPERSEDED", fresh).canRecalculate, false);
  assert.equal(evaluateModelGuard("SUPERSEDED", stale).canRecalculate, false);
  assert.equal(evaluateModelGuard("SUPERSEDED", stale).banner, "none");
});

test("a snapshot not yet calculated is never stale", () => {
  const none: SnapshotModelStatus = { ...fresh, calculated_under: [], stale: false };
  assert.equal(evaluateModelGuard("PARSED", none).banner, "none");
});

test("model status unknown: permissive, except superseded", () => {
  assert.equal(evaluateModelGuard("CALCULATED", null).canGenerateInstruction, true);
  assert.equal(evaluateModelGuard("PUBLISHED", null).canRecalculate, true);
  assert.equal(evaluateModelGuard("SUPERSEDED", null).canRecalculate, false);
});
