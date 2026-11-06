import React from "react";
import { validateBusinessAccess } from "@/lib/auth/tenant-guard";
import { WorkspaceLayoutClient } from "@/components/workspace/WorkspaceLayoutClient";

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

  return (
    <WorkspaceLayoutClient business={business} user={user}>
      {children}
    </WorkspaceLayoutClient>
  );
}
