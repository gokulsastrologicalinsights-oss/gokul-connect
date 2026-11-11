import { NextRequest } from "next/server";
import { processCampaignsBatch } from "@/lib/campaigns/worker";
import { runCoordinatedCron } from "@/lib/cron/coordinator";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * ==============================================================================
 * CRON API ROUTE: /api/cron/process-campaigns
 * ==============================================================================
 * Processes active campaign batches and reclaims stuck recipients.
 * Enforces fail-closed CRON_SECRET authentication and concurrency overlap guard.
 * Frequency: Every 10 minutes (or configurable).
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
    cronName: "process-campaigns",
    workerType: "campaign_worker",
    request,
    handler: async (workerId) => {
      const result = await processCampaignsBatch({ batchSize: 50, workerId });
      return { result };
    },
  });
}
