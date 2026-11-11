import React from "react";
import { validateBusinessAccess } from "@/lib/auth/tenant-guard";
import { listTemplatesDb } from "@/lib/templates/database";
import { TemplateManagerClient } from "@/components/templates/TemplateManagerClient";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function MessageTemplatesPage({
  params,
}: {
  params: Promise<{ businessSlug: string }>;
}) {
  const { businessSlug } = await params;
  const { business } = await validateBusinessAccess(businessSlug);

  // Fetch tenant-isolated templates
  const initialTemplates = await listTemplatesDb(business.id, {
    includeArchived: true,
  });

  // Fetch connections for this business tenant
  let connections: Array<{
    id: string;
    display_name: string;
    phone_number: string;
    waba_id: string;
    connection_status: string;
  }> = [];

  try {
    const supabase = await createServerSupabaseClient();
    const { data: conns } = await supabase
      .from("wa_connections")
      .select("id, display_name, phone_number, waba_id, connection_status")
      .eq("business_id", business.id)
      .eq("is_enabled", true);

    if (conns && Array.isArray(conns)) {
      connections = conns;
    }
  } catch {
    // Fallback gracefully
  }

  return (
    <TemplateManagerClient
      businessSlug={business.slug}
      businessName={business.name}
      initialTemplates={initialTemplates}
      connections={connections}
    />
  );
}
