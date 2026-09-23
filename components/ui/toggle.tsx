"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

export interface ToggleProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange" | "type"> {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

// A binary on/off control for flags that gate other form fields (e.g. the
// Buy Log's Outsourced flag) — role="switch" rather than a checkbox so
// screen readers announce it as a toggle, not a form field to fill in.
export const Toggle = React.forwardRef<HTMLButtonElement, ToggleProps>(
  ({ checked, onChange, className, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors",
          checked ? "bg-accent-default" : "border border-default bg-sunken",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      >
        <span
          aria-hidden
          className={cn(
            "inline-block h-5 w-5 transform rounded-full bg-surface shadow transition-transform",
            checked ? "translate-x-6" : "translate-x-1"
          )}
        />
      </button>
    );
  }
);
Toggle.displayName = "Toggle";
