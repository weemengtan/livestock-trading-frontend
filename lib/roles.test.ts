import { test } from "node:test";
import assert from "node:assert/strict";
import { assignableRoles, canSetTemporaryPassword, isConsoleRole, isOwnerLevel, roleSatisfies } from "./roles.ts";

test("platform admin passes wherever owner passes, never a buyer-only route", () => {
  assert.equal(roleSatisfies("PLATFORM_ADMIN", ["OWNER"]), true);
  assert.equal(roleSatisfies("PLATFORM_ADMIN", ["OWNER", "ACCOUNTANT"]), true);
  assert.equal(roleSatisfies("PLATFORM_ADMIN", ["BUYER"]), false);
  assert.equal(roleSatisfies("PLATFORM_ADMIN", ["ACCOUNTANT"]), false);
});

test("existing roles are unchanged", () => {
  assert.equal(roleSatisfies("OWNER", ["OWNER"]), true);
  assert.equal(roleSatisfies("ACCOUNTANT", ["OWNER"]), false);
  assert.equal(roleSatisfies("BUYER", ["OWNER", "ACCOUNTANT"]), false);
});

test("owner-level and console roles", () => {
  assert.equal(isOwnerLevel("PLATFORM_ADMIN"), true);
  assert.equal(isOwnerLevel("ACCOUNTANT"), false);
  assert.equal(isConsoleRole("PLATFORM_ADMIN"), true);
  assert.equal(isConsoleRole("BUYER"), false);
  assert.equal(isConsoleRole(undefined), false);
});

test("only a platform admin can see or grant the platform admin role", () => {
  assert.equal(assignableRoles("PLATFORM_ADMIN").includes("PLATFORM_ADMIN"), true);
  assert.equal(assignableRoles("OWNER").includes("PLATFORM_ADMIN"), false);
});

test("who may set a temporary password", () => {
  assert.equal(canSetTemporaryPassword("OWNER", "BUYER"), true);
  assert.equal(canSetTemporaryPassword("OWNER", "ACCOUNTANT"), true);
  assert.equal(canSetTemporaryPassword("OWNER", "OWNER"), false);
  assert.equal(canSetTemporaryPassword("OWNER", "PLATFORM_ADMIN"), false);
  assert.equal(canSetTemporaryPassword("PLATFORM_ADMIN", "OWNER"), true);
  assert.equal(canSetTemporaryPassword("ACCOUNTANT", "BUYER"), false);
  assert.equal(canSetTemporaryPassword("BUYER", "BUYER"), false);
});
