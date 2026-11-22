import React from "react";
import { Metadata } from "next";
import { validateBusinessAccess } from "@/lib/auth/tenant-guard";
import { getSocialDashboardDataAction } from "@/app/actions/social-automations";
import { SocialAutomationDashboardClient } from "@/components/social-automation/SocialAutomationDashboardClient";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ businessSlug: string }>;
}): Promise<Metadata> {
  const { businessSlug } = await params;
  const isAstrology = businessSlug === "astrology";
  return {
    title: `${isAstrology ? "Astrology" : "Vivaham"} Social Automation Dashboard | Gokul Connect`,
    description: "Centralized Facebook & Instagram keyword automation, public comments, and lead management.",
  };
}

export default async function SocialAutomationPage({
  params,
}: {
  params: Promise<{ businessSlug: string }>;
}) {
  const { businessSlug } = await params;

  // Strict server-side authorization check:
  // Rejects unassigned users or cross-business tampering immediately
  await validateBusinessAccess(businessSlug);

  // Fetch full dashboard data
  const result = await getSocialDashboardDataAction(businessSlug);

  if (!result.success || !result.data) {
    throw new Error(result.error || "Failed to load Social Automation Dashboard data");
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <SocialAutomationDashboardClient initialData={result.data} />
    </div>
  );
}
