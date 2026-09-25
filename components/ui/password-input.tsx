"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { strings } from "@/lib/strings";

type PasswordInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">;

/** A password field with a show/hide toggle. Starts hidden; the toggle is a
 * real button (keyboard reachable, aria-pressed) and never submits the form. */
export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, ...props }, ref) => {
    const [visible, setVisible] = React.useState(false);
    const label = visible ? strings.auth.hidePassword : strings.auth.showPassword;
    return (
      <div className="relative">
        <Input ref={ref} type={visible ? "text" : "password"} className={cn("pr-12", className)} {...props} />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={label}
          aria-pressed={visible}
          title={label}
          className={cn(
            "absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-md text-fg-tertiary",
            "hover:text-fg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          )}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
            <circle cx="12" cy="12" r="3" />
            {visible ? null : <path d="M4 4l16 16" />}
          </svg>
        </button>
      </div>
    );
  }
);
PasswordInput.displayName = "PasswordInput";
