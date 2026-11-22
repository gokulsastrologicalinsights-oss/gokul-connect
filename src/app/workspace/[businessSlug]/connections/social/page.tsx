import React from "react";
import { validateBusinessAccess } from "@/lib/auth/tenant-guard";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import {
  getSocialConnectionsDb,
  getSocialConnectionsMemory,
} from "@/lib/meta-social/connections-store";
import { MetaConnectionsManagerClient } from "@/components/workspace/MetaConnectionsManagerClient";

export const dynamic = "force-dynamic";

export default async function MetaSocialConnectionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessSlug: string }>;
  searchParams: Promise<{
    discovery?: string;
    session?: string;
    oauth_error?: string;
  }>;
}) {
  const { businessSlug } = await params;
  const { business } = await validateBusinessAccess(businessSlug);

  const { session, oauth_error } = await searchParams;

  const initialConnections = isSupabaseConfigured()
    ? await getSocialConnectionsDb(business.id)
    : getSocialConnectionsMemory(business.id);

  return (
    <MetaConnectionsManagerClient
      business={business}
      initialConnections={initialConnections}
      initialSessionId={session || null}
      initialError={oauth_error || null}
    />
  );
}
