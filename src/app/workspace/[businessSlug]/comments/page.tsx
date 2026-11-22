import React from "react";
import { notFound, redirect } from "next/navigation";
import { validateBusinessAccess } from "@/lib/auth/tenant-guard";
import { getSocialCommentsAction, getYouTubeConnectionStatusAction } from "@/app/actions/social-comments";
import { getSocialConnectionsAction } from "@/app/actions/meta-connections";
import { UnifiedCommentInboxClient } from "@/components/workspace/comments/UnifiedCommentInboxClient";

interface CommentsPageProps {
  params: Promise<{
    businessSlug: string;
  }>;
}

export default async function CommentsPage({ params }: CommentsPageProps) {
  const { businessSlug } = await params;

  let tenantData;
  try {
    tenantData = await validateBusinessAccess(businessSlug);
  } catch (err: any) {
    if (err?.message?.includes("Authentication required")) {
      redirect("/auth/login");
    }
    notFound();
  }

  const { business, membership } = tenantData;

  // Fetch comments and stats
  const commentsResult = await getSocialCommentsAction(businessSlug);
  const ytResult = await getYouTubeConnectionStatusAction(businessSlug);
  const metaResult = await getSocialConnectionsAction(businessSlug);

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 min-h-screen">
      <UnifiedCommentInboxClient
        businessSlug={business.slug}
        businessName={business.name}
        userRole={membership.role}
        initialComments={commentsResult.comments || []}
        initialStats={
          commentsResult.stats || {
            totalComments: 0,
            pendingReplies: 0,
            repliedComments: 0,
            failedReplies: 0,
            keywordMatched: 0,
            facebookCount: 0,
            instagramCount: 0,
            youtubeCount: 0,
          }
        }
        templates={commentsResult.templates || []}
        youtubeConnections={ytResult.connections || []}
        metaConnections={metaResult.data || []}
      />
    </div>
  );
}
