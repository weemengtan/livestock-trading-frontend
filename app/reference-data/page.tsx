"use client";

import * as React from "react";
import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { Tabs, TabButton } from "@/components/ui/tabs";
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
        <Tabs className="mb-6">
          <TabButton active={tab === "model"} onClick={() => setTab("model")}>
            {strings.referenceData.model.title}
          </TabButton>
          <TabButton active={tab === "contract"} onClick={() => setTab("contract")}>
            {strings.referenceData.contract.title}
          </TabButton>
          <TabButton active={tab === "registries"} onClick={() => setTab("registries")}>
            Species &amp; Product Types
          </TabButton>
        </Tabs>

        {tab === "model" ? <DnbpModelPanel /> : null}
        {tab === "contract" ? <IngestionContractPanel /> : null}
        {tab === "registries" ? <RegistriesPanel /> : null}
      </AppShell>
    </AuthGuard>
  );
}
