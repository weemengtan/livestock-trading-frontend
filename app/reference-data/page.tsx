"use client";

import * as React from "react";
import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { Button } from "@/components/ui/button";
import { DnbpModelPanel } from "@/components/reference-data/dnbp-model-panel";
import { IngestionContractPanel } from "@/components/reference-data/ingestion-contract-panel";
import { RegistriesPanel } from "@/components/reference-data/registries-panel";
import { strings } from "@/lib/strings";

type Tab = "model" | "contract" | "registries";

export default function ReferenceDataPage() {
  const [tab, setTab] = React.useState<Tab>("model");

  return (
    <AuthGuard requiredRole={["OWNER", "ACCOUNTANT"]}>
      <AppShell title={strings.referenceData.title}>
        <div className="mb-4 flex gap-2">
          <Button variant={tab === "model" ? "primary" : "secondary"} size="sm" onClick={() => setTab("model")}>
            {strings.referenceData.model.title}
          </Button>
          <Button variant={tab === "contract" ? "primary" : "secondary"} size="sm" onClick={() => setTab("contract")}>
            {strings.referenceData.contract.title}
          </Button>
          <Button variant={tab === "registries" ? "primary" : "secondary"} size="sm" onClick={() => setTab("registries")}>
            Species &amp; Product Types
          </Button>
        </div>

        {tab === "model" ? <DnbpModelPanel /> : null}
        {tab === "contract" ? <IngestionContractPanel /> : null}
        {tab === "registries" ? <RegistriesPanel /> : null}
      </AppShell>
    </AuthGuard>
  );
}
