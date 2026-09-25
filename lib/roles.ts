import type { Role } from "./auth-store";

// Mirrors backend/core/permissions.py: PLATFORM_ADMIN is a strict superset of
// OWNER (it passes wherever OWNER does) and is otherwise never widened. The
// server is the authority; this only decides what the UI shows and where to go.

export const ALL_ROLES: Role[] = ["OWNER", "ACCOUNTANT", "BUYER", "PLATFORM_ADMIN"];

export const ROLE_HOME: Record<Role, string> = {
  OWNER: "/owner",
  ACCOUNTANT: "/accountant",
  BUYER: "/buyer",
  PLATFORM_ADMIN: "/owner",
};

export function roleSatisfies(role: Role, allowed: readonly Role[]): boolean {
  return allowed.includes(role) || (role === "PLATFORM_ADMIN" && allowed.includes("OWNER"));
}

export function isOwnerLevel(role: Role | null | undefined): boolean {
  return role === "OWNER" || role === "PLATFORM_ADMIN";
}

export function isConsoleRole(role: Role | null | undefined): boolean {
  return role === "OWNER" || role === "ACCOUNTANT" || role === "PLATFORM_ADMIN";
}

/** Roles the viewer may assign on the Users screen: only a Platform Admin can
 * see or grant PLATFORM_ADMIN. */
export function assignableRoles(viewer: Role | null | undefined): Role[] {
  return viewer === "PLATFORM_ADMIN" ? ALL_ROLES : ["OWNER", "ACCOUNTANT", "BUYER"];
}

/** Mirrors can_set_temporary_password: an Owner may reset an Accountant or
 * Buyer, never another Owner; a Platform Admin may reset anyone. */
export function canSetTemporaryPassword(viewer: Role | null | undefined, target: Role): boolean {
  if (viewer === "PLATFORM_ADMIN") return true;
  if (viewer === "OWNER") return target === "ACCOUNTANT" || target === "BUYER";
  return false;
}
