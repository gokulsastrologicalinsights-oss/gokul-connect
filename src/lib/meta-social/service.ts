import { decryptSecret } from "@/lib/crypto/encryption";
import type { NormalizedMetaSocialEvent } from "./types";
import { findMatchingSocialRule, normalizeSocialText } from "./evaluator";
import {
  ingestSocialEvent,
  getSocialRulesForBusiness,
  updateSocialEventResult,
} from "./database";
import {
  sendMetaSocialDm,
  replyMetaCommentPublic,
  sendMetaCommentPrivateDm,
  sanitizeSocialLog,
} from "./client";

export interface ProcessSocialEventResult {
  success: boolean;
  status: "replied" | "duplicate" | "ignored" | "failed";
  eventId?: string;
  matchedRuleId?: string | null;
  replyType?: "dm_reply" | "comment_public_reply" | "comment_private_dm" | "both" | "none";
  replyContent?: string;
  errorMessage?: string;
}

/**
 * Main orchestration entrypoint for incoming Facebook and Instagram events
 */
export async function processMetaSocialEvent(
  supabase: any,
  event: NormalizedMetaSocialEvent,
  options?: {
    overrideAccessToken?: string; // For testing or direct execution
  }
): Promise<ProcessSocialEventResult> {
  // 1. Ingest event with atomic deduplication
  const ingestion = await ingestSocialEvent(supabase, event);

  if (ingestion.status === "duplicate") {
    return { success: true, status: "duplicate" };
  }

  if (ingestion.status === "ignored" || !ingestion.eventId || !ingestion.businessId) {
    return { success: true, status: "ignored" };
  }

  const {
    eventId,
    businessId,
    connectionId,
    pageId,
    accountId,
    autoReplyDms,
    autoReplyComments,
    autoDmOnComment,
    commentDmTriggerKeywords,
    defaultCommentReply,
  } = ingestion;

  try {
    // 2. Fetch active rules for the business
    const rules = await getSocialRulesForBusiness(supabase, businessId);

    // 3. Find highest-priority matching rule
    const matchedRule = findMatchingSocialRule(
      rules,
      event.content,
      event.platform,
      event.eventType
    );

    // 4. Resolve Meta Access Token
    let accessToken: string | null = options?.overrideAccessToken || null;
    if (!accessToken && connectionId) {
      const { data: credRow } = await supabase
        .from("meta_social_credentials")
        .select("key_version, iv, auth_tag, ciphertext")
        .eq("connection_id", connectionId)
        .single();

      if (credRow && credRow.ciphertext && credRow.iv && credRow.auth_tag) {
        accessToken = decryptSecret({
          key_version: credRow.key_version,
          iv: credRow.iv,
          auth_tag: credRow.auth_tag,
          ciphertext: credRow.ciphertext,
        });
      }
    }

    if (!accessToken) {
      accessToken = process.env.META_PAGE_ACCESS_TOKEN || process.env.META_SOCIAL_ACCESS_TOKEN || null;
    }

    if (!accessToken) {
      throw new Error(`No access token available for connection ${connectionId}`);
    }

    // Target identifier for sending DMs: for Facebook it's the Page ID; for Instagram it can be the Page ID or Instagram Account ID
    const dmDispatcherId = pageId || accountId || event.accountId;

    // 5. Handle Inbound Direct Messages
    if (event.eventType === "message") {
      if (!autoReplyDms) {
        await updateSocialEventResult(supabase, eventId, {
          status: "ignored",
          replyType: "none",
        });
        return { success: true, status: "ignored" };
      }

      if (!matchedRule) {
        await updateSocialEventResult(supabase, eventId, {
          status: "ignored",
          replyType: "none",
        });
        return { success: true, status: "ignored" };
      }

      // Send predefined DM reply
      await sendMetaSocialDm({
        platform: event.platform,
        pageIdOrAccountId: dmDispatcherId,
        recipientId: event.senderId,
        text: matchedRule.predefined_reply,
        accessToken,
      });

      await updateSocialEventResult(supabase, eventId, {
        status: "replied",
        matchedRuleId: matchedRule.id,
        replyType: "dm_reply",
        replyContent: matchedRule.predefined_reply,
      });

      return {
        success: true,
        status: "replied",
        eventId,
        matchedRuleId: matchedRule.id,
        replyType: "dm_reply",
        replyContent: matchedRule.predefined_reply,
      };
    }

    // 6. Handle Inbound Comments (Posts / Reels)
    if (event.eventType === "comment" || event.eventType === "mention") {
      if (!event.commentId) {
        await updateSocialEventResult(supabase, eventId, {
          status: "ignored",
          replyType: "none",
          errorMessage: "No comment_id present in event payload",
        });
        return { success: true, status: "ignored" };
      }

      // Case A: A specific deterministic rule matched
      if (matchedRule) {
        let sentPublic = false;
        let sentPrivate = false;

        if (
          (matchedRule.response_action === "reply_comment_public" ||
            matchedRule.response_action === "both_public_and_private") &&
          autoReplyComments
        ) {
          await replyMetaCommentPublic({
            platform: event.platform,
            commentId: event.commentId,
            message: matchedRule.predefined_reply,
            accessToken,
          });
          sentPublic = true;
        }

        if (
          (matchedRule.response_action === "reply_comment_private_dm" ||
            matchedRule.response_action === "both_public_and_private") &&
          autoDmOnComment
        ) {
          const privateText = matchedRule.predefined_dm || matchedRule.predefined_reply;
          await sendMetaCommentPrivateDm({
            pageId: dmDispatcherId,
            commentId: event.commentId,
            text: privateText,
            accessToken,
          });
          sentPrivate = true;
        }

        const effectiveReplyType =
          sentPublic && sentPrivate
            ? "both"
            : sentPublic
            ? "comment_public_reply"
            : sentPrivate
            ? "comment_private_dm"
            : "none";

        await updateSocialEventResult(supabase, eventId, {
          status: effectiveReplyType !== "none" ? "replied" : "ignored",
          matchedRuleId: matchedRule.id,
          replyType: effectiveReplyType,
          replyContent: matchedRule.predefined_reply,
        });

        return {
          success: true,
          status: effectiveReplyType !== "none" ? "replied" : "ignored",
          eventId,
          matchedRuleId: matchedRule.id,
          replyType: effectiveReplyType,
          replyContent: matchedRule.predefined_reply,
        };
      }

      // Case B: No specific rule matched, check default keyword triggers for comments
      const normalizedComment = normalizeSocialText(event.content);
      const defaultKeywords = Array.isArray(commentDmTriggerKeywords)
        ? commentDmTriggerKeywords
        : ["info", "price", "details", "book", "ஜாதகம்", "தகவல்"];

      const matchesDefaultKeyword = defaultKeywords.some((kw) =>
        normalizedComment.includes(normalizeSocialText(kw))
      );

      if (matchesDefaultKeyword && autoDmOnComment && event.commentId) {
        const replyText =
          defaultCommentReply ||
          "Thank you for your comment! We have sent details directly to your inbox.";

        // Post public acknowledgement
        if (autoReplyComments) {
          await replyMetaCommentPublic({
            platform: event.platform,
            commentId: event.commentId,
            message: replyText,
            accessToken,
          });
        }

        // Send private DM with details
        await sendMetaCommentPrivateDm({
          pageId: dmDispatcherId,
          commentId: event.commentId,
          text: replyText,
          accessToken,
        });

        await updateSocialEventResult(supabase, eventId, {
          status: "replied",
          replyType: "both",
          replyContent: replyText,
        });

        return {
          success: true,
          status: "replied",
          eventId,
          replyType: "both",
          replyContent: replyText,
        };
      }

      // Comment didn't match any criteria
      await updateSocialEventResult(supabase, eventId, {
        status: "ignored",
        replyType: "none",
      });
      return { success: true, status: "ignored" };
    }

    return { success: true, status: "ignored" };
  } catch (err: any) {
    const errorMsg = sanitizeSocialLog(err?.message || "Unknown error during event dispatch");
    console.error("[Meta Social] Error processing event:", errorMsg);

    await updateSocialEventResult(supabase, eventId, {
      status: "failed",
      errorMessage: errorMsg,
    });

    return {
      success: false,
      status: "failed",
      eventId,
      errorMessage: errorMsg,
    };
  }
}
