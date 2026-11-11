import React from "react";
import { validateBusinessAccess } from "@/lib/auth/tenant-guard";
import {
  getConversationsForBusiness,
  getConversationById,
  getConversationMessages,
  getInboxCounts,
} from "@/lib/inbox/store";
import {
  getConnectionsForBusiness,
  getConnectionsForBusinessDb,
} from "@/lib/connections/store";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { InboxClient } from "@/components/inbox/InboxClient";
import { InboxFolder, WhatsAppMessage } from "@/types/database";
import { getTeamMembers } from "@/lib/team/store";

export const dynamic = "force-dynamic";

export default async function WhatsAppInboxPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessSlug: string }>;
  searchParams?: Promise<{ c?: string; folder?: string; line?: string }>;
}) {
  const { businessSlug } = await params;
  const { business, user, membership } = await validateBusinessAccess(businessSlug);

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const requestedConvId = resolvedSearchParams?.c;
  const requestedFolder = resolvedSearchParams?.folder as InboxFolder | undefined;
  const requestedLine = resolvedSearchParams?.line;

  // Fetch team members for real agent assignment and filtering
  const teamMembers = await getTeamMembers(business.id);

  // Fetch WhatsApp connections strictly scoped to this verified business
  const connections = isSupabaseConfigured()
    ? await getConnectionsForBusinessDb(business.id)
    : getConnectionsForBusiness(business.id);

  // Fetch initial conversations strictly scoped to this business
  let initialConversations = await getConversationsForBusiness(business.id, {
    currentUserId: user.id,
  });

  // Calculate folder counts strictly scoped to this business
  const initialCounts = await getInboxCounts(business.id, undefined, user.id);

  // PRIORITY 4: Strict Server-Side Validation of requested conversation ID
  // Prevents cross-tenant conversation exposure via manually manipulated URL queries
  let targetConvId: string | null = null;
  if (requestedConvId) {
    try {
      const verifiedConv = await getConversationById(business.id, requestedConvId);
      if (verifiedConv && verifiedConv.business_id === business.id) {
        targetConvId = verifiedConv.id;
        // If the verified conversation isn't in the initial window, prepend it to ensure visibility
        if (!initialConversations.some((c) => c.id === verifiedConv.id)) {
          initialConversations = [verifiedConv, ...initialConversations];
        }
      }
    } catch {
      // Rogue ID or cross-tenant query rejected; fallback safely
      targetConvId = null;
    }
  }

  // Fallback to the first legitimate conversation if no valid ID was requested or verified
  if (!targetConvId && initialConversations.length > 0) {
    targetConvId = initialConversations[0].id;
  }

  // Initial chronological messages for the verified target conversation
  let initialMessages: WhatsAppMessage[] = [];
  let initialHasMore = false;
  if (targetConvId) {
    try {
      const msgResult = await getConversationMessages(business.id, targetConvId, {
        limit: 50,
      });
      initialMessages = msgResult.messages;
      initialHasMore = msgResult.hasMore;
    } catch (err) {
      console.error("Failed to fetch initial messages:", err);
    }
  }

  return (
    <InboxClient
      business={business}
      initialConversations={initialConversations}
      initialCounts={initialCounts}
      connections={connections}
      initialMessages={initialMessages}
      initialHasMore={initialHasMore}
      initialSelectedConversationId={targetConvId}
      initialFolder={requestedFolder}
      initialConnectionId={requestedLine}
      currentUser={user}
      currentMembership={membership}
      teamMembers={teamMembers}
    />
  );
}
