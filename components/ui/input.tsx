import * as React from "react";
import { cn } from "@/lib/cn";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          "flex h-12 w-full rounded-md border border-default bg-surface px-3 text-base text-fg-primary",
          "placeholder:text-fg-tertiary",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
          "aria-[invalid=true]:border-status-breach-fg",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";
