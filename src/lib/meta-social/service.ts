import { decryptSecret } from "@/lib/crypto/encryption";
import type { NormalizedMetaSocialEvent } from "./types";
import { findMatchingSocialRule, normalizeSocialText } from "./evaluator";
import {
  ingestSocialEvent,
  getSocialRulesForBusiness,
  updateSocialEventResult,
  recordSocialDelivery,
  updateSocialDeliveryResult,
} from "./database";
import {
  sendMetaSocialDm,
  replyMetaCommentPublic,
  sendFacebookPrivateReply,
  sendInstagramPrivateReply,
  sendMetaCommentPrivateDm,
  sanitizeSocialLog,
} from "./client";

export interface ProcessSocialEventResult {
  success: boolean;
  status: "replied" | "duplicate" | "ignored" | "failed" | "error";
  eventId?: string;
  matchedRuleId?: string | null;
  replyType?: "dm_reply" | "comment_public_reply" | "comment_private_dm" | "both" | "none";
  replyContent?: string;
  publicReplyId?: string | null;
  privateReplyId?: string | null;
  publicReplyStatus?: "none" | "pending" | "replied" | "failed" | "skipped";
  privateReplyStatus?: "none" | "pending" | "replied" | "failed" | "skipped";
  errorMessage?: string;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Main orchestration entrypoint for processing an inbound Facebook or Instagram event.
 * Enforces strict multi-tenant isolation, outbound delivery ledger, and independent public/private state.
 */
export async function processMetaSocialEvent(
  supabase: any,
  event: NormalizedMetaSocialEvent,
  options?: {
    overrideAccessToken?: string; // For testing or direct execution only
  }
): Promise<ProcessSocialEventResult> {
  // 1. Ingest event with atomic deduplication & error detection (P0-2 fix)
  const ingestion = await ingestSocialEvent(supabase, event);

  if (ingestion.status === "error") {
    return {
      success: false,
      status: "error",
      errorMessage: ingestion.error || "Database persistence failure during ingestion",
    };
  }

  if (ingestion.status === "duplicate") {
    return { success: true, status: "duplicate", eventId: ingestion.eventId };
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
    defaultDmReply,
  } = ingestion;

  try {
    // 2. Fetch active rules for the business (tenant-scoped)
    const rules = await getSocialRulesForBusiness(supabase, businessId);

    // 3. Find highest-priority matching rule
    const matchedRule = findMatchingSocialRule(
      rules,
      event.content,
      event.platform,
      event.eventType
    );

    // 4. Resolve Meta Access Token strictly from tenant credentials (P0-4 fix)
    // NEVER fall back to global process.env.META_PAGE_ACCESS_TOKEN
    let accessToken: string | null = options?.overrideAccessToken || null;

    if (!accessToken && connectionId) {
      const { data: credRow, error: credErr } = await supabase
        .from("meta_social_credentials")
        .select("key_version, iv, auth_tag, ciphertext, business_id")
        .eq("connection_id", connectionId)
        .eq("business_id", businessId) // Strict tenant check
        .maybeSingle();

      if (credErr) {
        throw new Error(`Database error retrieving credentials for connection ${connectionId}: ${credErr.message}`);
      }

      if (credRow && credRow.ciphertext && credRow.iv && credRow.auth_tag) {
        // Enforce tenant boundary: credentials must belong to the resolved business
        if (credRow.business_id !== businessId) {
          throw new Error("SECURITY VIOLATION: Credential tenant mismatch.");
        }

        accessToken = decryptSecret({
          key_version: credRow.key_version,
          iv: credRow.iv,
          auth_tag: credRow.auth_tag,
          ciphertext: credRow.ciphertext,
        });
      }
    }

    if (!accessToken) {
      // FAIL CLOSED: Never fall back to another tenant's credentials or process.env
      throw new Error(`No valid decrypted credentials found for connection ${connectionId} in business ${businessId}`);
    }

    // Target identifier for sending DMs
    const dmDispatcherId = pageId || accountId || event.accountId;

    // 5. Handle Inbound Direct Messages
    if (event.eventType === "message") {
      if (!autoReplyDms || !matchedRule) {
        await updateSocialEventResult(supabase, eventId, {
          status: "ignored",
          replyType: "none",
        });
        return { success: true, status: "ignored" };
      }

      // Record outbound delivery attempt
      const idempotencyKey = `idemp_dm_${eventId}_${event.metaEventId}`;
      const delivery = await recordSocialDelivery(supabase, {
        businessId,
        eventId,
        connectionId: connectionId!,
        platform: event.platform,
        actionType: "dm_reply",
        recipientId: event.senderId,
        requestPayload: { text: matchedRule.predefined_reply },
        idempotencyKey,
        status: "processing",
      });

      try {
        const sendRes = await sendMetaSocialDm({
          platform: event.platform,
          pageIdOrAccountId: dmDispatcherId,
          recipientId: event.senderId,
          text: matchedRule.predefined_reply,
          accessToken,
        });

        await updateSocialDeliveryResult(supabase, delivery.id, {
          status: "succeeded",
          responseId: sendRes.message_id,
        });

        await updateSocialEventResult(supabase, eventId, {
          status: "replied",
          matchedRuleId: matchedRule.id,
          replyType: "dm_reply",
          replyContent: matchedRule.predefined_reply,
          privateReplyId: sendRes.message_id,
          privateReplyStatus: "replied",
        });

        return {
          success: true,
          status: "replied",
          eventId,
          matchedRuleId: matchedRule.id,
          replyType: "dm_reply",
          replyContent: matchedRule.predefined_reply,
          privateReplyId: sendRes.message_id,
        };
      } catch (dmErr: any) {
        const errorMsg = sanitizeSocialLog(dmErr.message || "Failed to send DM");
        await updateSocialDeliveryResult(supabase, delivery.id, {
          status: "failed",
          lastError: errorMsg,
        });
        throw dmErr;
      }
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

      // Check 7-day rule for comment eligibility
      const isCommentExpired =
        event.timestamp && Date.now() - event.timestamp > SEVEN_DAYS_MS;

      // Case A: Rule matched
      if (matchedRule) {
        let sentPublic = false;
        let sentPrivate = false;
        let publicReplyId: string | null = null;
        let privateReplyId: string | null = null;
        let publicError: string | null = null;
        let privateError: string | null = null;

        const shouldDoPublic =
          (matchedRule.response_action === "reply_comment_public" ||
            matchedRule.response_action === "both_public_and_private") &&
          autoReplyComments;

        const shouldDoPrivate =
          (matchedRule.response_action === "reply_comment_private_dm" ||
            matchedRule.response_action === "both_public_and_private") &&
          autoDmOnComment;

        // 6.1 Public Comment Reply
        if (shouldDoPublic) {
          const pubIdempotencyKey = `idemp_pub_${eventId}_${event.commentId}`;
          const pubDelivery = await recordSocialDelivery(supabase, {
            businessId,
            eventId,
            connectionId: connectionId!,
            platform: event.platform,
            actionType: "public_comment_reply",
            recipientId: event.commentId,
            requestPayload: { message: matchedRule.predefined_reply },
            idempotencyKey: pubIdempotencyKey,
            status: "processing",
          });

          try {
            const pubRes = await replyMetaCommentPublic({
              platform: event.platform,
              commentId: event.commentId,
              message: matchedRule.predefined_reply,
              accessToken,
            });
            publicReplyId = pubRes.id;
            sentPublic = true;

            await updateSocialDeliveryResult(supabase, pubDelivery.id, {
              status: "succeeded",
              responseId: pubRes.id,
            });
          } catch (err: any) {
            publicError = sanitizeSocialLog(err.message || "Public reply failed");
            await updateSocialDeliveryResult(supabase, pubDelivery.id, {
              status: "failed",
              lastError: publicError,
            });
          }
        }

        // 6.2 Private Comment DM (P1-1 & P1-4 fixes)
        if (shouldDoPrivate) {
          if (isCommentExpired) {
            privateError = "Comment is older than 7 days; private DM skipped.";
          } else {
            // Require explicit private message text (P1-4 template fix)
            const privateText = matchedRule.predefined_dm || defaultDmReply || matchedRule.predefined_reply;

            const privIdempotencyKey = `idemp_priv_${eventId}_${event.commentId}`;
            const privDelivery = await recordSocialDelivery(supabase, {
              businessId,
              eventId,
              connectionId: connectionId!,
              platform: event.platform,
              actionType: "private_comment_reply",
              recipientId: event.commentId,
              requestPayload: { text: privateText },
              idempotencyKey: privIdempotencyKey,
              status: "processing",
            });

            try {
              if (event.platform === "instagram" && !pageId) {
                throw new Error(
                  "Instagram private replies require a linked Facebook Page ID (page_id). None configured on connection."
                );
              }

              const privRes = await sendMetaCommentPrivateDm({
                pageId: event.platform === "instagram" ? pageId! : dmDispatcherId,
                commentId: event.commentId,
                text: privateText,
                accessToken,
              });

              privateReplyId = privRes.message_id;
              sentPrivate = true;

              await updateSocialDeliveryResult(supabase, privDelivery.id, {
                status: "succeeded",
                responseId: privRes.message_id,
              });
            } catch (err: any) {
              privateError = sanitizeSocialLog(err.message || "Private DM failed");
              await updateSocialDeliveryResult(supabase, privDelivery.id, {
                status: "failed",
                lastError: privateError,
              });
            }
          }
        }

        const effectiveReplyType =
          sentPublic && sentPrivate
            ? "both"
            : sentPublic
            ? "comment_public_reply"
            : sentPrivate
            ? "comment_private_dm"
            : "none";

        const overallStatus =
          sentPublic || sentPrivate
            ? "replied"
            : publicError || privateError
            ? "failed"
            : "ignored";

        const combinedError = [publicError, privateError].filter(Boolean).join(" | ") || undefined;

        await updateSocialEventResult(supabase, eventId, {
          status: overallStatus,
          matchedRuleId: matchedRule.id,
          replyType: effectiveReplyType,
          replyContent: matchedRule.predefined_reply,
          publicReplyId,
          privateReplyId,
          publicReplyStatus: sentPublic ? "replied" : publicError ? "failed" : "none",
          privateReplyStatus: sentPrivate ? "replied" : privateError ? "failed" : "none",
          errorMessage: combinedError,
        });

        return {
          success: overallStatus === "replied",
          status: overallStatus,
          eventId,
          matchedRuleId: matchedRule.id,
          replyType: effectiveReplyType,
          replyContent: matchedRule.predefined_reply,
          publicReplyId,
          privateReplyId,
          publicReplyStatus: sentPublic ? "replied" : publicError ? "failed" : "none",
          privateReplyStatus: sentPrivate ? "replied" : privateError ? "failed" : "none",
          errorMessage: combinedError,
        };
      }

      // Case B: Default keyword triggers
      const normalizedComment = normalizeSocialText(event.content);
      const defaultKeywords = Array.isArray(commentDmTriggerKeywords)
        ? commentDmTriggerKeywords
        : ["info", "price", "details", "book", "ஜாதகம்", "தகவல்", "பதிவு"];

      const matchesDefaultKeyword = defaultKeywords.some((kw) =>
        normalizedComment.includes(normalizeSocialText(kw))
      );

      if (matchesDefaultKeyword && autoDmOnComment && event.commentId) {
        // Distinct public vs private message templates (P1-4 fix)
        const publicReplyText =
          defaultCommentReply ||
          "நன்றி! உங்கள் பதிவிற்கான விவரங்களை Inbox-ல் அனுப்பியுள்ளோம்.";

        const privateDmText =
          defaultDmReply ||
          "வணக்கம்! எங்கள் சேவைகள், கட்டண விவரங்கள் மற்றும் பதிவு வழிகாட்டுதலை இங்கே பகிர்கிறோம்.";

        let sentPublic = false;
        let sentPrivate = false;
        let publicReplyId: string | null = null;
        let privateReplyId: string | null = null;
        let publicError: string | null = null;
        let privateError: string | null = null;

        // Post public acknowledgement
        if (autoReplyComments) {
          const pubDelivery = await recordSocialDelivery(supabase, {
            businessId,
            eventId,
            connectionId: connectionId!,
            platform: event.platform,
            actionType: "public_comment_reply",
            recipientId: event.commentId,
            requestPayload: { message: publicReplyText },
            idempotencyKey: `idemp_def_pub_${eventId}_${event.commentId}`,
            status: "processing",
          });

          try {
            const pubRes = await replyMetaCommentPublic({
              platform: event.platform,
              commentId: event.commentId,
              message: publicReplyText,
              accessToken,
            });
            publicReplyId = pubRes.id;
            sentPublic = true;
            await updateSocialDeliveryResult(supabase, pubDelivery.id, {
              status: "succeeded",
              responseId: pubRes.id,
            });
          } catch (err: any) {
            publicError = sanitizeSocialLog(err.message || "Default public reply failed");
            await updateSocialDeliveryResult(supabase, pubDelivery.id, {
              status: "failed",
              lastError: publicError,
            });
          }
        }

        // Send private DM
        if (!isCommentExpired) {
          const privDelivery = await recordSocialDelivery(supabase, {
            businessId,
            eventId,
            connectionId: connectionId!,
            platform: event.platform,
            actionType: "private_comment_reply",
            recipientId: event.commentId,
            requestPayload: { text: privateDmText },
            idempotencyKey: `idemp_def_priv_${eventId}_${event.commentId}`,
            status: "processing",
          });

          try {
            if (event.platform === "instagram" && !pageId) {
              throw new Error("Instagram private replies require linked Facebook Page ID (page_id).");
            }
            const privRes = await sendMetaCommentPrivateDm({
              pageId: event.platform === "instagram" ? pageId! : dmDispatcherId,
              commentId: event.commentId,
              text: privateDmText,
              accessToken,
            });
            privateReplyId = privRes.message_id;
            sentPrivate = true;
            await updateSocialDeliveryResult(supabase, privDelivery.id, {
              status: "succeeded",
              responseId: privRes.message_id,
            });
          } catch (err: any) {
            privateError = sanitizeSocialLog(err.message || "Default private reply failed");
            await updateSocialDeliveryResult(supabase, privDelivery.id, {
              status: "failed",
              lastError: privateError,
            });
          }
        } else {
          privateError = "Comment is older than 7 days; private DM skipped.";
        }

        const effectiveReplyType =
          sentPublic && sentPrivate
            ? "both"
            : sentPublic
            ? "comment_public_reply"
            : sentPrivate
            ? "comment_private_dm"
            : "none";

        const overallStatus =
          sentPublic || sentPrivate ? "replied" : "failed";

        const combinedError = [publicError, privateError].filter(Boolean).join(" | ") || undefined;

        await updateSocialEventResult(supabase, eventId, {
          status: overallStatus,
          replyType: effectiveReplyType,
          replyContent: publicReplyText,
          publicReplyId,
          privateReplyId,
          publicReplyStatus: sentPublic ? "replied" : publicError ? "failed" : "none",
          privateReplyStatus: sentPrivate ? "replied" : privateError ? "failed" : "none",
          errorMessage: combinedError,
        });

        return {
          success: overallStatus === "replied",
          status: overallStatus,
          eventId,
          replyType: effectiveReplyType,
          replyContent: publicReplyText,
          publicReplyId,
          privateReplyId,
          publicReplyStatus: sentPublic ? "replied" : publicError ? "failed" : "none",
          privateReplyStatus: sentPrivate ? "replied" : privateError ? "failed" : "none",
          errorMessage: combinedError,
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
