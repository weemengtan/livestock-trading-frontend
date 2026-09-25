"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { strings } from "@/lib/strings";

const { nav } = strings.buyer;

// Inline 24px stroke icons (currentColor) — the project has no icon
// library and six glyphs don't justify adding one.
function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

const TABS = [
  {
    href: "/buyer",
    full: nav.dnbp,
    label: nav.dnbp,
    // price tag
    icon: (
      <Icon>
        <path d="M3 12V4h8l10 10-8 8L3 12Z" />
        <circle cx="7.5" cy="8.5" r="1" />
      </Icon>
    ),
  },
  {
    href: "/buyer/instruction",
    full: nav.instruction,
    label: nav.short.instruction,
    // document
    icon: (
      <Icon>
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
        <path d="M14 3v5h5M9 13h6M9 17h6" />
      </Icon>
    ),
  },
  {
    href: "/buyer/bid-check",
    full: nav.bidCheck,
    label: nav.bidCheck,
    // circle with check — the PASS / CLOSE / BREACH verdict
    icon: (
      <Icon>
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12 3 3 5-6" />
      </Icon>
    ),
  },
  {
    href: "/buyer/buy-log",
    full: nav.buyLog,
    label: nav.buyLog,
    // list
    icon: (
      <Icon>
        <path d="M9 6h11M9 12h11M9 18h11" />
        <circle cx="4.5" cy="6" r="1" />
        <circle cx="4.5" cy="12" r="1" />
        <circle cx="4.5" cy="18" r="1" />
      </Icon>
    ),
  },
  {
    href: "/buyer/market-intel",
    full: nav.marketIntel,
    label: nav.short.marketIntel,
    // trend line
    icon: (
      <Icon>
        <path d="M3 17l6-6 4 4 8-8" />
        <path d="M15 7h6v6" />
      </Icon>
    ),
  },
] as const;

/**
 * §12.2's thumb-zone action bar, generalised into a bottom nav across the
 * buyer PWA's five live-auction screens. Scorecard (Phase 5) is a review
 * screen, not an auction-time tool, so it's reached from Profile instead —
 * keeping the bar at the 5-tab maximum Apple's HIG and Material 3 allow.
 *
 * Icon above a short 12px label, the pattern Material 3 and Apple's HIG
 * both prescribe for bottom bars. Icon + text (never icon-only) because
 * unlabeled icons are ambiguous; 12px because it's the readable floor for
 * a label, and each tab is still a full-height, equal-width 56px+ target
 * (§12.1). The active tab gets a filled pill behind its icon plus accent
 * colour, so state doesn't depend on colour alone.
 */
export function BuyerBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky bottom-0 z-10 flex border-t border-default bg-surface" aria-label="Buyer navigation">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-label={tab.full}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-0.5 py-1.5 text-xs leading-tight transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring",
              active ? "font-bold text-accent-default" : "font-medium text-fg-secondary"
            )}
          >
            <span
              className={cn(
                "flex h-8 w-14 items-center justify-center rounded-full transition-colors",
                active ? "bg-accent-subtle" : "bg-transparent"
              )}
            >
              {tab.icon}
            </span>
            <span className="max-w-full truncate">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
