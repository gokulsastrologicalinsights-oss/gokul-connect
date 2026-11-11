import { Metadata } from "next";
import { validateBusinessAccess } from "@/lib/auth/tenant-guard";
import { listTemplatesDb } from "@/lib/templates/database";
import { getDefaultBusinessTemplates } from "@/lib/templates/default-templates";
import { getCrmCategories, getCrmSegments, getCrmContacts } from "@/lib/crm/store";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SafeWhatsAppConnection, WhatsAppContact, WhatsAppMessageTemplate } from "@/types/database";
import { CampaignCreatorClient } from "@/components/campaigns/CampaignCreatorClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "New Campaign | Gokul Connect",
  description: "Create, target, compose, and schedule a new WhatsApp campaign.",
};

export default async function NewCampaignPage({
  params,
}: {
  params: Promise<{ businessSlug: string }>;
}) {
  const { businessSlug } = await params;
  const { business, user, membership } = await validateBusinessAccess(businessSlug);

  // 1. Fetch Connections
  let connections: SafeWhatsAppConnection[] = [];
  try {
    const supabase = await createServerSupabaseClient();
    const { data: conns } = await supabase
      .from("wa_connections")
      .select("id, business_id, display_name, phone_number, phone_number_id, waba_id, connection_status, webhook_status, is_enabled, last_connected_at, last_checked_at, last_message_at, created_at, updated_at")
      .eq("business_id", business.id)
      .eq("is_enabled", true);

    if (conns && Array.isArray(conns)) {
      connections = conns.map((c: any) => ({
        ...c,
        has_credential: true,
        credential_masked_hint: "••••••••",
      }));
    }
  } catch {
    // Fallback
  }

  if (connections.length === 0) {
    connections = [
      {
        id: `conn-${business.slug}-default`,
        business_id: business.id,
        display_name: business.name,
        phone_number: business.slug === "astrology" ? "+919840123456" : "+919444123456",
        phone_number_id: business.slug === "astrology" ? "108765432109876" : "208765432109876",
        waba_id: "308765432109876",
        connection_status: "connected",
        webhook_status: "active",
        is_enabled: true,
        last_connected_at: new Date().toISOString(),
        last_checked_at: new Date().toISOString(),
        last_message_at: new Date().toISOString(),
        has_credential: true,
        credential_masked_hint: "••••••••",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
  }

  // 2. Fetch Templates
  let templates: WhatsAppMessageTemplate[] = [];
  try {
    templates = await listTemplatesDb(business.id, { status: "APPROVED" });
  } catch {
    // Fallback
  }
  if (templates.length === 0) {
    templates = getDefaultBusinessTemplates(business.id);
  }

  // 3. Fetch CRM Categories & Segments
  const [categories, segments, contactsRes] = await Promise.all([
    getCrmCategories(business.id).catch(() => []),
    getCrmSegments(business.id).catch(() => []),
    getCrmContacts(business.id, { limit: 20 }).catch(() => ({ contacts: [] })),
  ]);

  const contacts: WhatsAppContact[] = Array.isArray(contactsRes)
    ? (contactsRes as any)
    : (contactsRes && "contacts" in contactsRes ? contactsRes.contacts : []);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <CampaignCreatorClient
        business={business}
        currentUser={user}
        currentMembership={membership}
        connections={connections}
        templates={templates}
        categories={categories}
        segments={segments}
        sampleContacts={contacts}
      />
    </div>
  );
}
