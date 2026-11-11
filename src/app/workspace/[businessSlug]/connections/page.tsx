import React from "react";
import { validateBusinessAccess } from "@/lib/auth/tenant-guard";
import {
  getConnectionsForBusiness,
  getConnectionsForBusinessDb,
} from "@/lib/connections/store";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { ConnectionsManagerClient } from "@/components/workspace/ConnectionsManagerClient";

export const dynamic = "force-dynamic";

export default async function WhatsAppConnectionsPage({
  params,
}: {
  params: Promise<{ businessSlug: string }>;
}) {
  const { businessSlug } = await params;
  const { business } = await validateBusinessAccess(businessSlug);

  // Fetch connections strictly scoped to this verified business
  const initialConnections = isSupabaseConfigured()
    ? await getConnectionsForBusinessDb(business.id)
    : getConnectionsForBusiness(business.id);

  return (
    <ConnectionsManagerClient
      business={business}
      initialConnections={initialConnections}
    />
  );
}
