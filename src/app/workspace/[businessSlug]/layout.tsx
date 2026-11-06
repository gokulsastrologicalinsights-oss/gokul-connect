import React from "react";
import { validateBusinessAccess } from "@/lib/auth/tenant-guard";
import { WorkspaceHeader } from "@/components/workspace/WorkspaceHeader";
import { WorkspaceSidebar } from "@/components/workspace/WorkspaceSidebar";

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
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Workspace Header with Business Identifier & Switch Button */}
      <WorkspaceHeader business={business} user={user} />

      {/* Main Container: Sidebar + Page Content */}
      <div className="flex flex-1 overflow-hidden">
        <WorkspaceSidebar slug={business.slug} businessName={business.name} />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
