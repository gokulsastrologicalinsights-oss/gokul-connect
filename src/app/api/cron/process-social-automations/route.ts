import { NextRequest } from "next/server";
import { processSocialEventsBatch } from "@/lib/meta-social/worker";
import { runCoordinatedCron } from "@/lib/cron/coordinator";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * ==============================================================================
 * CRON API ROUTE: /api/cron/process-social-automations
 * ==============================================================================
 * Asynchronously processes pending Facebook & Instagram comment and DM events.
 * Enforces fail-closed CRON_SECRET authentication and distributed locking.
 * Supports configurable batch size and bounded execution time.
 * ==============================================================================
 */
export async function GET(request: NextRequest) {
  return handleCronRequest(request);
}

export async function POST(request: NextRequest) {
  return handleCronRequest(request);
}

async function handleCronRequest(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawBatch = searchParams.get("batch_size");
  const batchSize = rawBatch ? Math.min(Math.max(parseInt(rawBatch, 10) || 15, 1), 50) : 15;

  return runCoordinatedCron({
    cronName: "process-social-automations",
    workerType: "automation_worker",
    request,
    handler: async (workerId) => {
      const result = await processSocialEventsBatch(batchSize, workerId);
      return {
        socialAutomations: {
          workerId: result.workerId,
          claimed: result.claimedCount,
          processed: result.processedCount,
          succeeded: result.succeededCount,
          failed: result.failedCount,
          retried: result.retriedCount,
          ambiguous: result.ambiguousCount,
          reclaimed: result.reclaimedCount,
          durationMs: result.durationMs,
          metrics: result.metrics,
        },
      };
    },
  });
}
