"use client";

import * as React from "react";
import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { Tabs, TabButton } from "@/components/ui/tabs";
import { DnbpModelsPanel } from "@/components/reference-data/dnbp-models/dnbp-models-panel";
import { IngestionContractPanel } from "@/components/reference-data/ingestion-contract-panel";
import { OperationalSettingsPanel } from "@/components/reference-data/operational-settings-panel";
import { RegistriesPanel } from "@/components/reference-data/registries-panel";
import { strings } from "@/lib/strings";

type Tab = "models" | "settings" | "contract" | "registries";

export default function ReferenceDataPage() {
  const [tab, setTab] = React.useState<Tab>("models");

  return (
    <AuthGuard requiredRole={["OWNER", "ACCOUNTANT"]}>
      <AppShell title={strings.referenceData.title}>
        <Tabs className="mb-6">
          <TabButton active={tab === "models"} onClick={() => setTab("models")}>
            {strings.referenceData.dnbpModels.tabTitle}
          </TabButton>
          <TabButton active={tab === "settings"} onClick={() => setTab("settings")}>
            {strings.referenceData.settings.tabTitle}
          </TabButton>
          <TabButton active={tab === "contract"} onClick={() => setTab("contract")}>
            {strings.referenceData.contract.title}
          </TabButton>
          <TabButton active={tab === "registries"} onClick={() => setTab("registries")}>
            Species &amp; Product Types
          </TabButton>
        </Tabs>

        {tab === "models" ? <DnbpModelsPanel /> : null}
        {tab === "settings" ? <OperationalSettingsPanel /> : null}
        {tab === "contract" ? <IngestionContractPanel /> : null}
        {tab === "registries" ? <RegistriesPanel /> : null}
      </AppShell>
    </AuthGuard>
  );
}
