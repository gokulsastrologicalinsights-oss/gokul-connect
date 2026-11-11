import { validateBusinessAccess } from "@/lib/auth/tenant-guard";
import { getConnectionsAction } from "@/app/actions/connections";
import {
  getAutomationRulesAction,
  getExecutionLogsAction,
  getWorkspaceAutomationConfigAction,
} from "@/app/actions/automations";
import { AutomationsClient } from "@/components/automation/AutomationsClient";
import { DEFAULT_BUSINESS_HOURS } from "@/lib/automation/business-hours";
import { DEFAULT_AUTOMATION_SETTINGS } from "@/lib/automation/store";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Automation Engine & Rule Builder | Gokul Connect",
  description: "Deterministic, rule-based WhatsApp automation workflows and dry-run testing.",
};

export default async function AutomationsPage({
  params,
}: {
  params: Promise<{ businessSlug: string }>;
}) {
  const { businessSlug } = await params;
  const { business } = await validateBusinessAccess(businessSlug);

  // Fetch initial data in parallel
  const [connectionsRes, rulesRes, logsRes, configRes] = await Promise.all([
    getConnectionsAction(businessSlug),
    getAutomationRulesAction(businessSlug),
    getExecutionLogsAction(businessSlug, 30),
    getWorkspaceAutomationConfigAction(businessSlug),
  ]);

  const connections = connectionsRes.success && connectionsRes.data ? connectionsRes.data : [];
  const rules = rulesRes.success && rulesRes.data ? rulesRes.data : [];
  const logs = logsRes.success && logsRes.data ? logsRes.data : [];
  const businessHours = configRes.businessHours || DEFAULT_BUSINESS_HOURS;
  const automationSettings = configRes.automationSettings || DEFAULT_AUTOMATION_SETTINGS;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {business.name} — WhatsApp Automation Engine
        </h1>
        <p className="text-sm text-muted-foreground">
          Rule-based, 100% deterministic automation engine with Tamil/English keywords, business-hours logic, and scheduled follow-ups.
        </p>
      </div>

      <AutomationsClient
        business={business}
        connections={connections}
        initialRules={rules}
        initialLogs={logs}
        businessHours={businessHours}
        automationSettings={automationSettings}
      />
    </div>
  );
}
