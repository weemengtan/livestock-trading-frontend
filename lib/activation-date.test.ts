import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultModelName, earliestActivationDate, singaporeToday } from "./activation-date.ts";
import { isNonNegativeDecimal, isPositiveDecimal, tidyDecimal } from "./decimal-format.ts";

test("Singapore's date flips at 16:00 UTC", () => {
  assert.equal(singaporeToday(new Date("2026-09-30T15:59:59Z")), "2026-09-30");
  assert.equal(singaporeToday(new Date("2026-09-30T16:00:00Z")), "2026-10-01");
});

test("the earliest schedulable date is tomorrow in Singapore, including across month ends", () => {
  assert.equal(earliestActivationDate(new Date("2026-09-24T10:00:00Z")), "2026-09-25");
  assert.equal(earliestActivationDate(new Date("2026-09-30T16:00:00Z")), "2026-10-02");
  assert.equal(earliestActivationDate(new Date("2026-12-31T16:00:00Z")), "2027-01-02");
});

test("tidyDecimal strips fixed-scale zeros only", () => {
  assert.equal(tidyDecimal("14.0000000000"), "14");
  assert.equal(tidyDecimal("0.8300000000"), "0.83");
  assert.equal(tidyDecimal("100"), "100");
  assert.equal(tidyDecimal(null), "");
});

test("decimal validators", () => {
  assert.equal(isPositiveDecimal("0.83"), true);
  for (const bad of ["", "0", "-1", "abc", "1e3", "1."]) assert.equal(isPositiveDecimal(bad), false, bad);
  assert.equal(isNonNegativeDecimal("0"), true);
  assert.equal(isNonNegativeDecimal("-0.1"), false);
});

test("default model name is the go-live date as yyyy-mmm-dd", () => {
  assert.equal(defaultModelName("2026-10-01"), "2026-Oct-01");
  assert.equal(defaultModelName("2027-01-09"), "2027-Jan-09");
  assert.equal(defaultModelName("2026-12-31"), "2026-Dec-31");
});

test("default model name stays unique against existing names", () => {
  assert.equal(defaultModelName("2026-10-01", ["2026-Oct-01"]), "2026-Oct-01 (2)");
  assert.equal(defaultModelName("2026-10-01", ["2026-Oct-01", "2026-Oct-01 (2)"]), "2026-Oct-01 (3)");
  assert.equal(defaultModelName("2026-10-01", ["2026-09-22", "2026-Oct-02"]), "2026-Oct-01");
});

test("default model name is empty for an unfinished or invalid date", () => {
  for (const bad of ["", "2026-10", "2026-13-01", "not a date"]) assert.equal(defaultModelName(bad), "", bad);
});
