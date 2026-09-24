import * as React from "react";
import { cn } from "@/lib/cn";

export function Tabs({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div role="tablist" className={cn("flex gap-6 border-b border-subtle", className)} {...props} />;
}

export function TabButton({
  active,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={cn(
        "border-b-2 pb-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
        active
          ? "border-accent-default text-fg-primary"
          : "border-transparent text-fg-tertiary hover:text-fg-secondary",
        className
      )}
      {...props}
    />
  );
}
