"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore, type Role } from "@/lib/auth-store";
import { ROLE_HOME, roleSatisfies } from "@/lib/roles";

/**
 * Client-side gate, not Next.js middleware. The refresh cookie is scoped
 * to the API's own origin (Railway), never visible to middleware running
 * on the frontend's origin (Vercel) — cross-origin cookies simply don't
 * reach it. hydrate() calling /auth/refresh with credentials:"include" is
 * the actual auth check; this component just reacts to its result.
 *
 * An account on an admin-issued temporary password is held on /profile until
 * it has chosen its own — the server refuses every other API call anyway
 * (PASSWORD_CHANGE_REQUIRED); this just gets the user to the one screen that
 * works instead of a wall of errors.
 */
export function AuthGuard({
  requiredRole,
  children,
}: {
  requiredRole: Role | Role[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { status, user, hydrate } = useAuthStore();
  const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
  const mustChangePassword = status === "authenticated" && !!user?.mustChangePassword && pathname !== "/profile";
  const permitted = !!user && roleSatisfies(user.role, allowedRoles);

  React.useEffect(() => {
    if (status === "idle") void hydrate();
  }, [status, hydrate]);

  React.useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
    if (mustChangePassword) {
      router.replace("/profile");
    } else if (status === "authenticated" && user && !permitted) {
      router.replace(ROLE_HOME[user.role]);
    }
  }, [status, user, permitted, mustChangePassword, router]);

  if (status !== "authenticated" || !user || !permitted || mustChangePassword) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-fg-tertiary">Loading…</p>
      </div>
    );
  }

  return <>{children}</>;
}
