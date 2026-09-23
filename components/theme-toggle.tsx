"use client";

import * as React from "react";
import { strings } from "@/lib/strings";
import { cn } from "@/lib/cn";

export type Theme = "light" | "dark" | "yard";
const THEMES: Theme[] = ["light", "dark", "yard"];
const STORAGE_KEY = "livestock-theme";

/**
 * §15.2 — themes are [data-theme] attribute overrides of Tier-2 tokens
 * only. "system" (no attribute set) falls through to prefers-color-scheme
 * in packages/design-tokens/dist/tokens.css; an explicit choice here wins
 * in both directions, so this component is the only place that ever sets
 * or clears the attribute.
 */
function readStoredTheme(): Theme | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "yard") return stored;
  } catch {
    // localStorage can throw in private-browsing contexts; system theme is a fine fallback.
  }
  return null;
}

export function ThemeToggle({ defaultTheme }: { defaultTheme?: Theme } = {}) {
  // `defaultTheme` only fills in for a buyer who has never explicitly
  // chosen one (readStoredTheme() returns null) — an explicit choice,
  // stored below by `choose`, always wins over it.
  const [theme, setTheme] = React.useState<Theme | null>(() => readStoredTheme() ?? defaultTheme ?? null);

  React.useEffect(() => {
    if (theme) document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  function choose(next: Theme) {
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Best-effort only — the toggle still works for this page view.
    }
  }

  return (
    <div role="group" aria-label={strings.theme.toggleLabel} className="inline-flex rounded-md border border-default p-1">
      {THEMES.map((t) => (
        <button
          key={t}
          type="button"
          aria-pressed={theme === t}
          // A stored preference is only knowable client-side (SSR always
          // renders the "no theme chosen yet" state) — this one-time
          // mismatch is expected and harmless, not silently ignoring a
          // real bug.
          suppressHydrationWarning
          onClick={() => choose(t)}
          className={cn(
            "rounded px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
            theme === t ? "bg-accent-default text-accent-fg" : "text-fg-secondary hover:bg-sunken"
          )}
        >
          {strings.theme[t]}
        </button>
      ))}
    </div>
  );
}
