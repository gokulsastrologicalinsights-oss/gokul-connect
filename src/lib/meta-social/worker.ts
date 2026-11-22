import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { processPersistedMetaSocialEvent } from "./service";
import { claimSocialEvents, reclaimStuckSocialEvents, getSocialOperationalMetrics } from "./database";
import { sanitizeSocialLog } from "./client";
import type { SocialOperationalMetrics } from "./types";

export interface ProcessSocialBatchResult {
  workerId: string;
  claimedCount: number;
  processedCount: number;
  succeededCount: number;
  failedCount: number;
  retriedCount: number;
  ambiguousCount: number;
  reclaimedCount: number;
  durationMs: number;
  metrics?: SocialOperationalMetrics;
  errors: string[];
}

/**
 * Worker batch processor for Meta Social Automation events (Task 1 & Task 2).
 *
 * Architectural Guarantees:
 * 1. Task 1: Processes ALREADY PERSISTED events directly via processPersistedMetaSocialEvent.
 *    Never re-ingests persisted events, eliminating duplicate ingestion short-circuits.
 * 2. Task 2: Claims events atomically using FOR UPDATE SKIP LOCKED via claimSocialEvents().
 *    Guarantees no two concurrent workers can ever claim or process the same event.
 * 3. Task 4: Reclaims stuck/abandoned processing jobs with expired leases before claiming new batches.
 * 4. Task 8: Logs sanitized operational telemetry with Event ID, Business ID, Platform, Action Type.
 */
export async function processSocialEventsBatch(
  batchSize: number = 10,
  workerId?: string
): Promise<ProcessSocialBatchResult> {
  const startTime = Date.now();
  const resolvedWorkerId =
    workerId || `social_worker_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

  const result: ProcessSocialBatchResult = {
    workerId: resolvedWorkerId,
    claimedCount: 0,
    processedCount: 0,
    succeededCount: 0,
    failedCount: 0,
    retriedCount: 0,
    ambiguousCount: 0,
    reclaimedCount: 0,
    durationMs: 0,
    errors: [],
  };

  let supabase: any;
  try {
    supabase = createAdminClient();
  } catch (err: any) {
    result.errors.push(`Failed to initialize Supabase client: ${err.message}`);
    result.durationMs = Date.now() - startTime;
    return result;
  }

  // 1. Crash recovery: reclaim abandoned events with expired leases (Task 4)
  try {
    const recovery = await reclaimStuckSocialEvents(supabase, 300);
    result.reclaimedCount = recovery.reclaimed;
    if (recovery.reclaimed > 0 || recovery.exhausted > 0) {
      console.log(
        `[Meta Social Worker] Recovered ${recovery.reclaimed} stuck events (${recovery.exhausted} exhausted) from expired leases.`
      );
    }
  } catch (recErr: any) {
    console.warn("[Meta Social Worker] Non-fatal error during stuck event recovery:", recErr?.message);
  }

  // 2. Atomic Event Claiming with FOR UPDATE SKIP LOCKED (Task 2)
  let claimedEvents: any[] = [];
  try {
    claimedEvents = await claimSocialEvents(supabase, resolvedWorkerId, batchSize, 300);
  } catch (claimErr: any) {
    const msg = `Error claiming social events: ${claimErr.message}`;
    console.error(`[Meta Social Worker] ${msg}`);
    result.errors.push(msg);
    result.durationMs = Date.now() - startTime;
    return result;
  }

  result.claimedCount = claimedEvents.length;

  if (claimedEvents.length === 0) {
    result.durationMs = Date.now() - startTime;
    return result;
  }

  // 3. Process each claimed event directly (Task 1: No Re-Ingestion!)
  for (const row of claimedEvents) {
    result.processedCount++;

    const logPrefix = `[Meta Social Worker] Event ${row.id} [Business: ${row.business_id}, Platform: ${row.platform}, Type: ${row.event_type}]`;

    try {
      // Direct call to processPersistedMetaSocialEvent!
      const outcome = await processPersistedMetaSocialEvent(supabase, row.id, {
        workerId: resolvedWorkerId,
      });

      if (outcome.status === "replied") {
        result.succeededCount++;
        console.log(`${logPrefix}: SUCCESS (replied via ${outcome.replyType || "none"})`);
      } else if (outcome.status === "retry_scheduled") {
        result.retriedCount++;
        console.log(`${logPrefix}: RETRY_SCHEDULED (next retry at: ${outcome.nextRetryAt || "soon"})`);
      } else if (outcome.status === "ambiguous_outcome") {
        result.ambiguousCount++;
        console.warn(`${logPrefix}: AMBIGUOUS_OUTCOME (requires operator reconciliation)`);
      } else if (outcome.status === "ignored") {
        console.log(`${logPrefix}: IGNORED (no matching rule or connection disabled)`);
      } else {
        result.failedCount++;
        const reason = sanitizeSocialLog(outcome.errorMessage || "Unknown dispatch failure");
        console.error(`${logPrefix}: FAILED - ${reason}`);
        if (outcome.errorMessage) {
          result.errors.push(`Event ${row.id}: ${reason}`);
        }
      }
    } catch (err: any) {
      result.failedCount++;
      const cleanMsg = sanitizeSocialLog(err.message || "Unhandled worker processing exception");
      console.error(`${logPrefix}: EXCEPTION - ${cleanMsg}`);
      result.errors.push(`Event ${row.id}: ${cleanMsg}`);
    }
  }

  // 4. Record Duration & Aggregate Operational Telemetry (Task 8)
  result.durationMs = Date.now() - startTime;
  try {
    const metrics = await getSocialOperationalMetrics(supabase);
    metrics.workerDurationMs = result.durationMs;
    result.metrics = metrics;
  } catch {
    // Non-fatal
  }

  return result;
}
