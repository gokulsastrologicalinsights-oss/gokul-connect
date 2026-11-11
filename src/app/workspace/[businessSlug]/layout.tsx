import React from "react";
import { validateBusinessAccess } from "@/lib/auth/tenant-guard";
import { WorkspaceLayoutClient } from "@/components/workspace/WorkspaceLayoutClient";
import { getBusinessSettings, getBusinessSettingsDb } from "@/lib/connections/store";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";

export default async function BusinessWorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ businessSlug: string }>;
}) {
  const { businessSlug } = await params;

  // Strict server-side authorization check:
  // Rejects unassigned users or cross-business tampering immediately
  const { business, user } = await validateBusinessAccess(businessSlug);

  let logoUrl: string | null = null;
  try {
    const settings = isSupabaseConfigured()
      ? await getBusinessSettingsDb(business.id)
      : getBusinessSettings(business.id);
    logoUrl = settings?.logo_url ?? null;
  } catch {
    logoUrl = null;
  }

  return (
    <WorkspaceLayoutClient business={business} user={user} logoUrl={logoUrl}>
      {children}
    </WorkspaceLayoutClient>
  );
}
