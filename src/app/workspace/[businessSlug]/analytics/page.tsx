import React from "react";
import { validateBusinessAccess } from "@/lib/auth/tenant-guard";
import { resolveDateRange } from "@/lib/analytics/date-utils";
import { getBusinessAnalytics } from "@/lib/analytics/service";
import { AnalyticsDashboardClient } from "@/components/analytics/AnalyticsDashboardClient";

export const dynamic = "force-dynamic";

export default async function WorkspaceAnalyticsPage({
  params,
}: {
  params: Promise<{ businessSlug: string }>;
}) {
  const { businessSlug } = await params;

  // Strict Server-Side Tenant Authorization Guard
  const { business, user } = await validateBusinessAccess(businessSlug);

  // Default to Last 7 Days in Asia/Kolkata timezone
  const defaultDateRange = resolveDateRange("7d");

  // Fetch tenant-scoped analytics data
  const initialData = await getBusinessAnalytics(
    business.id,
    business.slug,
    defaultDateRange,
    { userId: user.id }
  );

  return <AnalyticsDashboardClient initialData={initialData} />;
}
