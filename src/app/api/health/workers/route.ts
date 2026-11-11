import { NextRequest, NextResponse } from "next/server";
import { checkWorkersHealth } from "@/lib/observability/system-health";
import { verifyCronAuthorization } from "@/lib/automation/cron-auth";

export const dynamic = "force-dynamic";

/**
 * ==============================================================================
 * WORKER HEALTH PROBE API: /api/health/workers
 * ==============================================================================
 * Checks background worker execution readiness, cron secret configuration,
 * queue backlogs, and stuck job alerts.
 * ==============================================================================
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const isAuthorized = verifyCronAuthorization(authHeader, process.env.CRON_SECRET);

  const result = await checkWorkersHealth(isAuthorized);
  return NextResponse.json(result.data, { status: result.statusCode });
}
