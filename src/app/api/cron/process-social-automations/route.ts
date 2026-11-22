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
    cronName: "process-social-automations",
    workerType: "automation_worker",
    request,
    handler: async (workerId) => {
      const result = await processSocialEventsBatch(15, workerId);
      return {
        socialAutomations: result,
      };
    },
  });
}
