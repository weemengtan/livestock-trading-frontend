"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle, type Theme } from "@/components/theme-toggle";
import { cn } from "@/lib/cn";
import { useAuthStore } from "@/lib/auth-store";
import { isConsoleRole, isOwnerLevel } from "@/lib/roles";
import { strings } from "@/lib/strings";

// §11's Trading Console screens, plus the Users screen which is OWNER-only
// (§11.8). Both OWNER and ACCOUNTANT share everything else per §2.1 — Bobby
// and Bing are collaborators, not approver and preparer.
const _CONSOLE_NAV = [
  { href: "/owner", label: () => strings.shell.nav.home, ownerOnly: false },
  { href: "/workbench", label: () => strings.shell.nav.workbench, ownerOnly: false },
  { href: "/benchmark-compare", label: () => strings.shell.nav.benchmarkCompare, ownerOnly: false },
  { href: "/correction-requests", label: () => strings.shell.nav.correctionRequests, ownerOnly: false },
  { href: "/reference-data", label: () => strings.shell.nav.referenceData, ownerOnly: false },
  { href: "/buy-instructions", label: () => strings.shell.nav.buyInstructions, ownerOnly: false },
  { href: "/dashboard", label: () => strings.shell.nav.dashboard, ownerOnly: false },
  { href: "/market-intel", label: () => strings.shell.nav.marketIntel, ownerOnly: false },
  { href: "/users", label: () => strings.shell.nav.users, ownerOnly: true },
  { href: "/settings", label: () => strings.shell.nav.settings, ownerOnly: false },
] as const;

function ConsoleNav() {
  const pathname = usePathname();
  const role = useAuthStore((s) => s.user?.role);
  if (!isConsoleRole(role)) return null;

  return (
    <nav className="flex items-center gap-1">
      {_CONSOLE_NAV.filter((item) => !item.ownerOnly || isOwnerLevel(role)).map((item) => {
        const target = item.href === "/owner" ? (isOwnerLevel(role) ? "/owner" : "/accountant") : item.href;
        const active =
          pathname === target ||
          ((item.href === "/workbench" || item.href === "/buy-instructions") && pathname?.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={target}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active ? "bg-accent-subtle text-accent-default" : "text-fg-secondary hover:bg-sunken hover:text-fg-primary"
            )}
          >
            {item.label()}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ title, children }: { title: string; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  // Yard defaults to the "Yard" theme everywhere under /buyer — a buyer's
  // device is out in the sun at the saleyard, not an office desktop, and
  // the route itself (not the async auth-hydration `user.role`) is what's
  // known synchronously on first render, so this can't race a login.
  // An explicit choice via the toggle below (persisted to localStorage)
  // always overrides it, for this buyer's device from then on.
  const defaultTheme: Theme | undefined = pathname?.startsWith("/buyer") ? "yard" : undefined;

  async function handleSignOut() {
    await logout();
    router.replace("/login");
  }

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="flex flex-col gap-3 border-b border-subtle bg-surface px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="flex min-w-0 items-center gap-3">
            {/* The one <h1> for every screen mounted under AppShell (§15.6 WCAG —
                axe-core's page-has-heading-one caught its absence live). Pages that
                also show their own in-body heading use <h2> for it, not a second h1. */}
            <h1 className="text-lg font-semibold text-fg-primary">{title}</h1>
            {user ? <Badge variant="accent">{strings.shell.roleLabels[user.role]}</Badge> : null}
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            {user?.role === "BUYER" ? (
              <Link
                href="/buyer/settings"
                aria-label={strings.shell.nav.settings}
                aria-current={pathname === "/buyer/settings" ? "page" : undefined}
                className={cn(
                  "inline-flex h-9 w-9 items-center justify-center rounded-md text-lg transition-colors",
                  pathname === "/buyer/settings"
                    ? "bg-accent-subtle text-accent-default"
                    : "text-fg-secondary hover:bg-sunken hover:text-fg-primary"
                )}
              >
                <span aria-hidden="true">⚙</span>
              </Link>
            ) : null}
            <ThemeToggle defaultTheme={defaultTheme} />
            {user ? (
              <Link
                href="/profile"
                aria-current={pathname === "/profile" ? "page" : undefined}
                title={strings.profile.navLabel}
                className={cn(
                  "rounded-md px-2 py-1 text-sm transition-colors",
                  pathname === "/profile"
                    ? "bg-accent-subtle text-accent-default"
                    : "text-fg-secondary hover:bg-sunken hover:text-fg-primary"
                )}
              >
                <span className="hidden sm:inline">{user.email}</span>
                <span className="sm:hidden">{strings.profile.navLabel}</span>
              </Link>
            ) : null}
            <Button variant="secondary" size="sm" onClick={handleSignOut}>
              {strings.shell.signOut}
            </Button>
          </div>
        </div>
        <ConsoleNav />
      </header>
      <main className="flex flex-1 flex-col p-6">{children}</main>
    </div>
  );
}
