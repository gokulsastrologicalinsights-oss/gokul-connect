import { decryptSecret } from "@/lib/crypto/encryption";
import type {
  NormalizedMetaSocialEvent,
  MetaSocialEventStatus,
  MetaSocialDeliveryStatus,
  MetaSocialEvent,
} from "./types";
import { findMatchingSocialRule, normalizeSocialText } from "./evaluator";
import {
  ingestSocialEvent,
  getSocialRulesForBusiness,
  updateSocialEventResult,
  recordSocialDelivery,
  updateSocialDeliveryResult,
  getSocialEventById,
  getSocialDeliveryByIdempotencyKey,
  IngestSocialEventResult,
} from "./database";
import {
  sendMetaSocialDm,
  replyMetaCommentPublic,
  sendFacebookPrivateReply,
  sendInstagramPrivateReply,
  sendMetaCommentPrivateDm,
  checkCommentReplied,
  sanitizeSocialLog,
  MetaSocialApiError,
} from "./client";

export interface ProcessSocialEventResult {
  success: boolean;
  status: MetaSocialEventStatus | "error" | "duplicate";
  eventId?: string;
  matchedRuleId?: string | null;
  replyType?: "dm_reply" | "comment_public_reply" | "comment_private_dm" | "both" | "none";
  replyContent?: string;
  publicReplyId?: string | null;
  privateReplyId?: string | null;
  publicReplyStatus?: "none" | "pending" | "replied" | "failed" | "skipped" | "retry_scheduled" | "ambiguous_outcome";
  privateReplyStatus?: "none" | "pending" | "replied" | "failed" | "skipped" | "retry_scheduled" | "ambiguous_outcome";
  errorMessage?: string;
  nextRetryAt?: string | null;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Compute exponential backoff delay with jitter (Task 4)
 */
export function computeBackoffDelay(
  attemptCount: number,
  retryAfterSeconds?: number,
  baseDelayMs: number = 5000,
  maxDelayMs: number = 300000 // 5 minutes max
): number {
  if (retryAfterSeconds && retryAfterSeconds > 0) {
    return Math.max(retryAfterSeconds * 1000, baseDelayMs);
  }
  const exp = Math.min(attemptCount, 6);
  const exponential = baseDelayMs * Math.pow(2, exp);
  const jitter = Math.random() * (baseDelayMs * 0.5);
  return Math.min(exponential + jitter, maxDelayMs);
}

/**
 * Operation A: Ingest incoming Meta Social Webhook event (Task 1.A)
 * Responsibilities:
 * - Validate incoming event
 * - Resolve business via active connection
 * - Atomically persist event into meta_social_events
 * - Deduplicate webhook delivery
 */
export async function ingestMetaSocialWebhookEvent(
  supabase: any,
  event: NormalizedMetaSocialEvent
): Promise<IngestSocialEventResult> {
  return ingestSocialEvent(supabase, event);
}

export interface ProcessPersistedSocialEventOptions {
  overrideAccessToken?: string;
  workerId?: string;
  preloadedEvent?: MetaSocialEvent;
  preloadedConnection?: any;
}

/**
 * Operation B: Process an already persisted Meta Social event (Task 1.B)
 * Responsibilities:
 * - Receive an existing persisted event ID
 * - Load the persisted event from meta_social_events
 * - Validate its business ownership and active connection
 * - Decrypt credentials strictly scoped to the tenant
 * - Evaluate automation rules
 * - Action-level idempotency and partial retries (Task 3)
 * - Safe handling of ambiguous outcomes (Task 3)
 * - Retry governance and error classification (Task 4)
 * - Update delivery ledger and event statuses
 */
export async function processPersistedMetaSocialEvent(
  supabase: any,
  eventId: string,
  options?: ProcessPersistedSocialEventOptions
): Promise<ProcessSocialEventResult> {
  // 1. Load the persisted event or use preloaded
  let event = options?.preloadedEvent;
  if (!event) {
    event = (await getSocialEventById(supabase, eventId)) || undefined;
  }
  if (!event) {
    return {
      success: false,
      status: "error",
      errorMessage: `Persisted social event ${eventId} not found in database.`,
    };
  }

  const { business_id: businessId, connection_id: connectionId } = event;
  const currentAttempt = (event.attempt_count || 0) + 1;
  const maxAttempts = event.max_attempts || 3;

  try {
    // 2. Validate business ownership & load active connection
    let conn = options?.preloadedConnection;
    if (!conn) {
      try {
        const query = supabase
          .from("meta_social_connections")
          .select("*")
          .eq("id", connectionId)
          .eq("business_id", businessId);

        if (typeof query.maybeSingle === "function") {
          const { data, error } = await query.maybeSingle();
          if (error) throw new Error(error.message);
          conn = data;
        } else if (typeof query.single === "function") {
          const { data, error } = await query.single();
          if (error) throw new Error(error.message);
          conn = data;
        } else {
          const res = await query;
          conn = Array.isArray(res?.data) ? res.data[0] : res?.data;
        }
      } catch (err: any) {
        throw new Error(`Database error fetching connection ${connectionId}: ${err.message}`);
      }
    }

    if (!conn || conn.is_enabled === false || conn.connection_status === "disconnected") {
      await updateSocialEventResult(supabase, eventId, {
        status: "ignored",
        replyType: "none",
        errorMessage: "Connection is disabled, disconnected or does not exist for this business.",
      });
      return { success: true, status: "ignored", eventId };
    }

    // 3. Resolve Meta Access Token strictly from tenant credentials (P0-4 fix)
    let accessToken: string | null = options?.overrideAccessToken || null;

    if (!accessToken) {
      const { data: credRow, error: credErr } = await supabase
        .from("meta_social_credentials")
        .select("key_version, iv, auth_tag, ciphertext, business_id")
        .eq("connection_id", connectionId)
        .eq("business_id", businessId) // Strict tenant boundary
        .maybeSingle();

      if (credErr) {
        throw new Error(`Database error retrieving credentials for connection ${connectionId}: ${credErr.message}`);
      }

      if (credRow && credRow.ciphertext && credRow.iv && credRow.auth_tag) {
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
      // FAIL CLOSED: Never fall back to process.env or other tenants
      throw new Error(`No valid decrypted credentials found for connection ${connectionId} in business ${businessId}`);
    }

    const dmDispatcherId = conn.page_id || conn.account_id || event.sender_id;

    // 4. Handle Inbound Direct Messages
    if (event.event_type === "message") {
      const rules = await getSocialRulesForBusiness(supabase, businessId);
      const matchedRule = findMatchingSocialRule(
        rules,
        event.content,
        event.platform,
        event.event_type
      );

      if (conn.auto_reply_dms === false || !matchedRule) {
        await updateSocialEventResult(supabase, eventId, {
          status: "ignored",
          replyType: "none",
        });
        return { success: true, status: "ignored", eventId };
      }

      const idempotencyKey = `idemp_dm_${eventId}_${event.meta_event_id}`;
      const existingDelivery = await getSocialDeliveryByIdempotencyKey(supabase, idempotencyKey);

      // Check if already succeeded
      if (existingDelivery?.status === "succeeded") {
        await updateSocialEventResult(supabase, eventId, {
          status: "replied",
          matchedRuleId: matchedRule.id,
          replyType: "dm_reply",
          replyContent: matchedRule.predefined_reply,
          privateReplyId: existingDelivery.response_id,
          privateReplyStatus: "replied",
        });
        return {
          success: true,
          status: "replied",
          eventId,
          matchedRuleId: matchedRule.id,
          replyType: "dm_reply",
          replyContent: matchedRule.predefined_reply,
          privateReplyId: existingDelivery.response_id,
        };
      }

      // Record outbound delivery
      const delivery = await recordSocialDelivery(supabase, {
        businessId,
        eventId,
        connectionId,
        platform: event.platform,
        actionType: "dm_reply",
        recipientId: event.sender_id,
        requestPayload: { text: matchedRule.predefined_reply },
        idempotencyKey,
        status: "processing",
      });

      try {
        const sendRes = await sendMetaSocialDm({
          platform: event.platform,
          pageIdOrAccountId: dmDispatcherId,
          recipientId: event.sender_id,
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
        const errorMsg = sanitizeSocialLog(dmErr.message || "Failed to send DM", accessToken);
        const isAuthError = dmErr instanceof MetaSocialApiError && dmErr.isAuthError;
        const isTransient = dmErr instanceof MetaSocialApiError && dmErr.isTransient;

        if (isAuthError) {
          await supabase
            .from("meta_social_connections")
            .update({ connection_status: "expired", updated_at: new Date().toISOString() })
            .eq("id", connectionId);
        }

        const nextRetry = isTransient && currentAttempt < maxAttempts
          ? new Date(Date.now() + computeBackoffDelay(currentAttempt, dmErr?.retryAfterSeconds)).toISOString()
          : null;

        const terminalStatus: MetaSocialDeliveryStatus = isTransient
          ? currentAttempt >= maxAttempts ? "permanently_failed" : "retry_scheduled"
          : "failed";

        await updateSocialDeliveryResult(supabase, delivery.id, {
          status: terminalStatus,
          lastError: errorMsg,
          attemptCount: currentAttempt,
          nextRetryAt: nextRetry,
        });

        await updateSocialEventResult(supabase, eventId, {
          status: terminalStatus === "retry_scheduled" ? "retry_scheduled" : "failed",
          errorMessage: errorMsg,
          attemptCount: currentAttempt,
          nextRetryAt: nextRetry,
        });

        return {
          success: false,
          status: terminalStatus === "retry_scheduled" ? "retry_scheduled" : "failed",
          eventId,
          errorMessage: errorMsg,
          nextRetryAt: nextRetry,
        };
      }
    }

    // 5. Handle Inbound Comments (Posts / Reels)
    if (event.event_type === "comment" || event.event_type === "mention") {
      if (!event.comment_id) {
        await updateSocialEventResult(supabase, eventId, {
          status: "ignored",
          replyType: "none",
          errorMessage: "No comment_id present in event payload",
        });
        return { success: true, status: "ignored", eventId };
      }

      const rules = await getSocialRulesForBusiness(supabase, businessId);
      const matchedRule = findMatchingSocialRule(
        rules,
        event.content,
        event.platform,
        event.event_type
      );

      let shouldDoPublic = false;
      let shouldDoPrivate = false;
      let publicReplyText = "";
      let privateDmText = "";

      if (matchedRule) {
        shouldDoPublic =
          (matchedRule.response_action === "reply_comment_public" ||
            matchedRule.response_action === "both_public_and_private") &&
          conn.auto_reply_comments !== false;

        shouldDoPrivate =
          (matchedRule.response_action === "reply_comment_private_dm" ||
            matchedRule.response_action === "both_public_and_private") &&
          conn.auto_dm_on_comment !== false;

        publicReplyText = matchedRule.predefined_reply;
        privateDmText = matchedRule.predefined_dm || conn.default_dm_reply || matchedRule.predefined_reply;
      } else {
        // Default keyword triggers
        const normalizedComment = normalizeSocialText(event.content);
        const defaultKeywords =
          Array.isArray(conn.comment_dm_trigger_keywords) && conn.comment_dm_trigger_keywords.length > 0
            ? conn.comment_dm_trigger_keywords
            : ["info", "price", "details", "book", "ஜாதகம்", "தகவல்", "பதிவு"];

        const matchesDefault = defaultKeywords.some((kw: string) =>
          normalizedComment.includes(normalizeSocialText(kw))
        );

        if (matchesDefault && conn.auto_dm_on_comment !== false) {
          shouldDoPublic = conn.auto_reply_comments !== false;
          shouldDoPrivate = true;
          publicReplyText =
            conn.default_comment_reply ||
            "நன்றி! உங்கள் பதிவிற்கான விவரங்களை Inbox-ல் அனுப்பியுள்ளோம்.";
          privateDmText =
            conn.default_dm_reply ||
            "வணக்கம்! எங்கள் சேவைகள், கட்டண விவரங்கள் மற்றும் பதிவு வழிகாட்டுதலை இங்கே பகிர்கிறோம்.";
        } else {
          // No match
          await updateSocialEventResult(supabase, eventId, {
            status: "ignored",
            replyType: "none",
          });
          return { success: true, status: "ignored", eventId };
        }
      }

      // Action state tracking
      let sentPublic = false;
      let sentPrivate = false;
      let privateSkipped = false;
      let publicReplyId: string | null = event.public_reply_id || null;
      let privateReplyId: string | null = event.private_reply_id || null;
      let publicError: string | null = null;
      let privateError: string | null = null;
      let isAmbiguousPublic = false;
      let pubRetryAt: string | null = null;
      let privRetryAt: string | null = null;

      // ------------------------------------------------------------------------
      // 5.1 Public Comment Reply Pipeline (Task 3 Idempotency & Partial Retries)
      // ------------------------------------------------------------------------
      if (shouldDoPublic) {
        const pubIdempKey = `idemp_pub_${eventId}_${event.comment_id}`;
        const existingPub = await getSocialDeliveryByIdempotencyKey(supabase, pubIdempKey);

        // Check if already succeeded in previous attempt or on event
        if (event.public_reply_status === "replied" || existingPub?.status === "succeeded") {
          sentPublic = true;
          publicReplyId = existingPub?.response_id || event.public_reply_id || null;
        } else if (existingPub?.status === "ambiguous_outcome") {
          // Ambiguous outcome reconciliation (Task 3)
          const reconciliation = await checkCommentReplied({
            platform: event.platform,
            commentId: event.comment_id,
            accessToken,
            expectedMessageSubstring: publicReplyText.slice(0, 15),
          });

          if (reconciliation.replied) {
            sentPublic = true;
            publicReplyId = reconciliation.existingReplyId || null;
            await updateSocialDeliveryResult(supabase, existingPub.id, {
              status: "succeeded",
              responseId: reconciliation.existingReplyId,
            });
          } else {
            // Cannot confirm outcome: DO NOT repeat public comment blindly
            publicError = "Previous public reply had an ambiguous outcome; reconciliation did not confirm delivery. Operator verification required.";
            isAmbiguousPublic = true;
          }
        } else {
          // Eligible to execute public reply
          const pubDelivery = await recordSocialDelivery(supabase, {
            businessId,
            eventId,
            connectionId,
            platform: event.platform,
            actionType: "public_comment_reply",
            recipientId: event.comment_id,
            requestPayload: { message: publicReplyText },
            idempotencyKey: pubIdempKey,
            status: "processing",
          });

          try {
            const pubRes = await replyMetaCommentPublic({
              platform: event.platform,
              commentId: event.comment_id,
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
            publicError = sanitizeSocialLog(err.message || "Public reply failed", accessToken);
            const isAmbiguous = err instanceof MetaSocialApiError && err.isAmbiguous;
            const isTransient = err instanceof MetaSocialApiError && err.isTransient;

            if (isAmbiguous) {
              isAmbiguousPublic = true;
              await updateSocialDeliveryResult(supabase, pubDelivery.id, {
                status: "ambiguous_outcome",
                lastError: publicError,
              });
            } else if (isTransient && currentAttempt < maxAttempts) {
              pubRetryAt = new Date(
                Date.now() + computeBackoffDelay(currentAttempt, err?.retryAfterSeconds)
              ).toISOString();

              await updateSocialDeliveryResult(supabase, pubDelivery.id, {
                status: "retry_scheduled",
                lastError: publicError,
                attemptCount: currentAttempt,
                nextRetryAt: pubRetryAt,
              });
            } else {
              await updateSocialDeliveryResult(supabase, pubDelivery.id, {
                status: currentAttempt >= maxAttempts ? "permanently_failed" : "failed",
                lastError: publicError,
                attemptCount: currentAttempt,
              });
            }
          }
        }
      }

      // ------------------------------------------------------------------------
      // 5.2 Private Comment DM Pipeline (Task 3 & Task 6 Instagram Target ID)
      // ------------------------------------------------------------------------
      if (shouldDoPrivate) {
        const privIdempKey = `idemp_priv_${eventId}_${event.comment_id}`;
        const existingPriv = await getSocialDeliveryByIdempotencyKey(supabase, privIdempKey);

        // Check if already succeeded in previous attempt or on event
        if (event.private_reply_status === "replied" || existingPriv?.status === "succeeded") {
          sentPrivate = true;
          privateReplyId = existingPriv?.response_id || event.private_reply_id || null;
        } else {
          // Check 7-day rule
          const eventTimestampMs = event.event_timestamp
            ? new Date(event.event_timestamp).getTime()
            : new Date(event.created_at).getTime();

          if (Date.now() - eventTimestampMs > SEVEN_DAYS_MS) {
            privateError = "Comment is older than 7 days; private DM skipped.";
            privateSkipped = true;
          } else {
            const privDelivery = await recordSocialDelivery(supabase, {
              businessId,
              eventId,
              connectionId,
              platform: event.platform,
              actionType: "private_comment_reply",
              recipientId: event.comment_id,
              requestPayload: { text: privateDmText },
              idempotencyKey: privIdempKey,
              status: "processing",
            });

            try {
              const privRes = await sendMetaCommentPrivateDm({
                pageId: event.platform === "instagram" ? (conn.page_id || conn.account_id) : (conn.page_id || conn.account_id),
                commentId: event.comment_id,
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
              privateError = sanitizeSocialLog(err.message || "Private DM failed", accessToken);
              const isAuthError = err instanceof MetaSocialApiError && err.isAuthError;
              const isTransient = err instanceof MetaSocialApiError && err.isTransient;

              if (isAuthError) {
                await supabase
                  .from("meta_social_connections")
                  .update({ connection_status: "expired", updated_at: new Date().toISOString() })
                  .eq("id", connectionId);

                await updateSocialDeliveryResult(supabase, privDelivery.id, {
                  status: "failed",
                  lastError: `${privateError} (Connection marked expired)`,
                  attemptCount: currentAttempt,
                });
              } else if (isTransient && currentAttempt < maxAttempts) {
                privRetryAt = new Date(
                  Date.now() + computeBackoffDelay(currentAttempt, err?.retryAfterSeconds)
                ).toISOString();

                await updateSocialDeliveryResult(supabase, privDelivery.id, {
                  status: "retry_scheduled",
                  lastError: privateError,
                  attemptCount: currentAttempt,
                  nextRetryAt: privRetryAt,
                });
              } else {
                await updateSocialDeliveryResult(supabase, privDelivery.id, {
                  status: currentAttempt >= maxAttempts ? "permanently_failed" : "failed",
                  lastError: privateError,
                  attemptCount: currentAttempt,
                });
              }
            }
          }
        }
      }

      // ------------------------------------------------------------------------
      // 5.3 Aggregate Outcomes & Update Event State
      // ------------------------------------------------------------------------
      const effectiveReplyType =
        sentPublic && sentPrivate
          ? "both"
          : sentPublic
          ? "comment_public_reply"
          : sentPrivate
          ? "comment_private_dm"
          : "none";

      const publicOk = !shouldDoPublic || sentPublic;
      const privateOk = !shouldDoPrivate || sentPrivate || privateSkipped;

      let overallStatus: MetaSocialEventStatus;
      let eventNextRetry: string | null = null;

      if (publicOk && privateOk) {
        overallStatus = (sentPublic || sentPrivate) ? "replied" : "ignored";
      } else if (isAmbiguousPublic) {
        overallStatus = "ambiguous_outcome";
      } else if (sentPublic || sentPrivate) {
        overallStatus = "replied";
      } else if (pubRetryAt || privRetryAt) {
        overallStatus = currentAttempt >= maxAttempts ? "permanently_failed" : "retry_scheduled";
        eventNextRetry = pubRetryAt && privRetryAt
          ? (new Date(pubRetryAt) < new Date(privRetryAt) ? pubRetryAt : privRetryAt)
          : pubRetryAt || privRetryAt;
      } else {
        overallStatus = "failed";
      }

      const combinedError = [publicError, privateError].filter(Boolean).join(" | ") || undefined;

      const publicDeliveryState = sentPublic
        ? "replied"
        : isAmbiguousPublic
        ? "ambiguous_outcome"
        : pubRetryAt
        ? "retry_scheduled"
        : publicError
        ? "failed"
        : "none";

      const privateDeliveryState = sentPrivate
        ? "replied"
        : privateSkipped
        ? "skipped"
        : privRetryAt
        ? "retry_scheduled"
        : privateError
        ? "failed"
        : "none";

      await updateSocialEventResult(supabase, eventId, {
        status: overallStatus,
        matchedRuleId: matchedRule?.id || null,
        replyType: effectiveReplyType,
        replyContent: publicReplyText || undefined,
        publicReplyId,
        privateReplyId,
        publicReplyStatus: publicDeliveryState,
        privateReplyStatus: privateDeliveryState,
        errorMessage: combinedError,
        attemptCount: currentAttempt,
        nextRetryAt: eventNextRetry,
      });

      return {
        success: overallStatus === "replied",
        status: overallStatus,
        eventId,
        matchedRuleId: matchedRule?.id || null,
        replyType: effectiveReplyType,
        replyContent: publicReplyText,
        publicReplyId,
        privateReplyId,
        publicReplyStatus: publicDeliveryState,
        privateReplyStatus: privateDeliveryState,
        errorMessage: combinedError,
        nextRetryAt: eventNextRetry,
      };
    }

    return { success: true, status: "ignored", eventId };
  } catch (err: any) {
    const cleanError = sanitizeSocialLog(err?.message || "Unhandled error processing persisted event");
    console.error(`[Meta Social] Error processing persisted event ${eventId}:`, cleanError);

    await updateSocialEventResult(supabase, eventId, {
      status: "failed",
      errorMessage: cleanError,
      attemptCount: currentAttempt,
    });

    return {
      success: false,
      status: "failed",
      eventId,
      errorMessage: cleanError,
    };
  }
}

/**
 * End-to-end processing wrapper for raw incoming events (Task 1 Preservation)
 * Ingests first with deduplication, then passes the persisted event ID to
 * processPersistedMetaSocialEvent.
 */
export async function processMetaSocialEvent(
  supabase: any,
  event: NormalizedMetaSocialEvent,
  options?: {
    overrideAccessToken?: string;
    workerId?: string;
  }
): Promise<ProcessSocialEventResult> {
  // Step 1: Ingest event with atomic deduplication
  const ingestion = await ingestMetaSocialWebhookEvent(supabase, event);

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

  // Step 2: Delegate to persisted event processor with preloaded metadata
  const preloadedEvent: MetaSocialEvent = {
    id: ingestion.eventId,
    business_id: ingestion.businessId,
    connection_id: ingestion.connectionId || "",
    platform: event.platform,
    event_type: event.eventType,
    meta_event_id: event.metaEventId,
    sender_id: event.senderId,
    sender_name: event.senderName || null,
    post_id: event.postId || null,
    comment_id: event.commentId || null,
    parent_comment_id: event.parentCommentId || null,
    content: event.content,
    status: "received",
    event_timestamp: event.eventTimestamp || new Date(event.timestamp).toISOString(),
    created_at: new Date(event.timestamp).toISOString(),
  };

  const preloadedConnection = {
    id: ingestion.connectionId || "",
    business_id: ingestion.businessId,
    platform: event.platform,
    account_id: ingestion.accountId || event.accountId,
    account_name: "",
    page_id: ingestion.pageId || null,
    credential_ref: ingestion.credentialRef || "",
    connection_status: "connected",
    is_enabled: true,
    auto_reply_dms: ingestion.autoReplyDms !== false,
    auto_reply_comments: ingestion.autoReplyComments !== false,
    autoDmOnComment: ingestion.autoDmOnComment !== false,
    comment_dm_trigger_keywords:
      Array.isArray(ingestion.commentDmTriggerKeywords) && ingestion.commentDmTriggerKeywords.length > 0
        ? ingestion.commentDmTriggerKeywords
        : ["info", "price", "details", "book", "ஜாதகம்", "தகவல்", "பதிவு"],
    default_comment_reply: ingestion.defaultCommentReply || "",
    default_dm_reply: ingestion.defaultDmReply || null,
    created_at: "",
    updated_at: "",
  };

  return processPersistedMetaSocialEvent(supabase, ingestion.eventId, {
    ...options,
    preloadedEvent,
    preloadedConnection,
  });
}
