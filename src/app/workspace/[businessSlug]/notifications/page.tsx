import React from "react";
import { validateBusinessAccess } from "@/lib/auth/tenant-guard";
import { NotificationsClient } from "@/components/notifications/NotificationsClient";

export const dynamic = "force-dynamic";

export default async function NotificationsPage({
  params,
}: {
  params: Promise<{ businessSlug: string }>;
}) {
  const { businessSlug } = await params;

  // Strict tenant security guard: validates active membership in business
  const { business, user } = await validateBusinessAccess(businessSlug);

  return <NotificationsClient business={business} user={user} />;
}
