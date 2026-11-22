import { createAdminClient } from "@/lib/supabase/admin";
import type { NormalizedMetaSocialEvent } from "./types";
import { processMetaSocialEvent } from "./service";
import { sanitizeSocialLog } from "./client";

export interface ProcessSocialBatchResult {
  claimedCount: number;
  processedCount: number;
  succeededCount: number;
  failedCount: number;
  skippedCount: number;
  errors: string[];
}

/**
 * Worker batch processor for Meta Social Automation events.
 * Claims pending 'received' events and processes outbound actions safely.
 */
export async function processSocialEventsBatch(
  batchSize: number = 10,
  workerId: string = `social_worker_${Date.now()}`
): Promise<ProcessSocialBatchResult> {
  const result: ProcessSocialBatchResult = {
    claimedCount: 0,
    processedCount: 0,
    succeededCount: 0,
    failedCount: 0,
    skippedCount: 0,
    errors: [],
  };

  let supabase: any;
  try {
    supabase = createAdminClient();
  } catch (err: any) {
    result.errors.push(`Failed to initialize Supabase client: ${err.message}`);
    return result;
  }

  // 1. Fetch pending events with status = 'received'
  const { data: pendingEvents, error: fetchErr } = await supabase
    .from("meta_social_events")
    .select("*")
    .eq("status", "received")
    .order("created_at", { ascending: true })
    .limit(batchSize);

  if (fetchErr) {
    result.errors.push(`Error querying pending social events: ${fetchErr.message}`);
    return result;
  }

  if (!pendingEvents || pendingEvents.length === 0) {
    return result;
  }

  result.claimedCount = pendingEvents.length;

  for (const row of pendingEvents) {
    result.processedCount++;

    const normalized: NormalizedMetaSocialEvent = {
      platform: row.platform,
      accountId: row.account_id || row.sender_id, // Resolved in service via connection
      eventType: row.event_type,
      metaEventId: row.meta_event_id,
      senderId: row.sender_id,
      senderName: row.sender_name || undefined,
      postId: row.post_id || undefined,
      commentId: row.comment_id || undefined,
      parentCommentId: row.parent_comment_id || undefined,
      content: row.content,
      timestamp: row.event_timestamp ? new Date(row.event_timestamp).getTime() : new Date(row.created_at).getTime(),
      eventTimestamp: row.event_timestamp || row.created_at,
    };

    try {
      const outcome = await processMetaSocialEvent(supabase, normalized);
      if (outcome.success) {
        result.succeededCount++;
      } else {
        result.failedCount++;
        if (outcome.errorMessage) {
          result.errors.push(`Event ${row.id}: ${outcome.errorMessage}`);
        }
      }
    } catch (err: any) {
      result.failedCount++;
      const cleanMsg = sanitizeSocialLog(err.message || "Worker processing error");
      result.errors.push(`Event ${row.id} threw exception: ${cleanMsg}`);
    }
  }

  return result;
}
