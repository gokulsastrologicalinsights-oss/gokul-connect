import { NextRequest } from "next/server";
import { processQueueBatch } from "@/lib/automation/worker";
import { processScheduledMessagesBatch } from "@/lib/scheduled/worker";
import { createAdminClient } from "@/lib/supabase/admin";
import { runCoordinatedCron } from "@/lib/cron/coordinator";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * ==============================================================================
 * CRON API ROUTE: /api/cron/process-automation-jobs
 * ==============================================================================
 * Processes due automation queue jobs and reclaims stuck jobs.
 * Enforces fail-closed CRON_SECRET authentication and concurrency overlap guard.
 * Frequency: Every 2 minutes (or configurable in hosting scheduler).
 * ==============================================================================
 */
export async function GET(request: NextRequest) {
  return handleCronRequest(request);
}

export async function POST(request: NextRequest) {
  return handleCronRequest(request);
}

async function handleCronRequest(request: NextRequest) {
  return runCoordinatedCron({
    cronName: "process-automation-jobs",
    workerType: "automation_worker",
    request,
    handler: async (workerId) => {
      // 1. Process batch of due jobs (scheduled_followup, send_message, evaluate_rules)
      const queueResult = await processQueueBatch(15, workerId);

      // 1b. Process batch of due scheduled messages
      let scheduledResult = null;
      try {
        scheduledResult = await processScheduledMessagesBatch(10, workerId);
      } catch (schedErr: any) {
        console.warn("[Cron Warning] Scheduled message batch failed:", schedErr.message);
      }

      // 2. Prune old records (14 days execution logs, 7 days completed jobs)
      let pruneResult = null;
      try {
        const supabase = createAdminClient();
        const { data } = await supabase.rpc("prune_stale_automation_records");
        pruneResult = data;
      } catch {
        // Non-fatal if procedure is not present
      }

      return {
        queue: queueResult,
        scheduledMessages: scheduledResult,
        pruning: pruneResult,
      };
    },
  });
}
