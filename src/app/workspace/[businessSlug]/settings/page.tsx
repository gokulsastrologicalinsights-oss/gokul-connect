import React from "react";
import { validateBusinessAccess } from "@/lib/auth/tenant-guard";
import {
  getBusinessSettings,
  getBusinessSettingsDb,
  getConnectionsForBusiness,
  getConnectionsForBusinessDb,
} from "@/lib/connections/store";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { BusinessSettingsClient } from "@/components/workspace/BusinessSettingsClient";

export const dynamic = "force-dynamic";

export default async function BusinessSettingsPage({
  params,
}: {
  params: Promise<{ businessSlug: string }>;
}) {
  const { businessSlug } = await params;
  const { business } = await validateBusinessAccess(businessSlug);

  // Tenant-isolated settings and connections for this business
  const initialSettings = isSupabaseConfigured()
    ? await getBusinessSettingsDb(business.id)
    : getBusinessSettings(business.id);
  const connections = isSupabaseConfigured()
    ? await getConnectionsForBusinessDb(business.id)
    : getConnectionsForBusiness(business.id);

  return (
    <BusinessSettingsClient
      business={business}
      initialSettings={initialSettings}
      connections={connections}
    />
  );
}
