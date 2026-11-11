import { NextRequest } from "next/server";
import { processScheduledMessagesBatch } from "@/lib/scheduled/worker";
import { runCoordinatedCron } from "@/lib/cron/coordinator";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * ==============================================================================
 * CRON API ROUTE: /api/cron/process-scheduled-messages
 * ==============================================================================
 * Processes due scheduled messages and reclaims stuck processing jobs.
 * Enforces fail-closed CRON_SECRET authentication and concurrency overlap guard.
 * Frequency: Every 5 minutes.
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
    cronName: "process-scheduled-messages",
    workerType: "scheduled_worker",
    request,
    handler: async (workerId) => {
      const result = await processScheduledMessagesBatch(20, workerId);
      return { result };
    },
  });
}
