import React from "react";
import { Metadata } from "next";
import { validateBusinessAccess } from "@/lib/auth/tenant-guard";
import { getFlowsForBusinessDb } from "@/lib/flows/database";
import { FlowBuilderClient } from "@/components/flows/FlowBuilderClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Visual Flow Builder | Gokul Connect",
  description:
    "Visual, drag-and-drop conversation flow builder for multi-tenant WhatsApp bots and automations.",
};

export default async function WorkspaceFlowBuilderPage({
  params,
}: {
  params: Promise<{ businessSlug: string }>;
}) {
  const { businessSlug } = await params;

  // Strict Server-Side Tenant Authorization Guard
  const { business } = await validateBusinessAccess(businessSlug);

  // Load existing tenant-scoped visual flows
  const initialFlows = await getFlowsForBusinessDb(business.id, business.slug);

  return <FlowBuilderClient business={business} initialFlows={initialFlows} />;
}
