"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { strings } from "@/lib/strings";

// Catches any render error under /buyer so a bug on one screen shows a
// recoverable message instead of a blank page. Next's `retry` re-renders the
// segment; the bottom nav lives in each page, so the buyer can also just
// reload from the browser.
export default function BuyerError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  React.useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-lg font-semibold text-fg-primary">{strings.buyer.errorBoundary.title}</p>
      <p className="max-w-md text-sm text-fg-secondary">{strings.buyer.errorBoundary.body}</p>
      <Button size="lg" onClick={retry}>
        {strings.buyer.errorBoundary.retry}
      </Button>
    </div>
  );
}
