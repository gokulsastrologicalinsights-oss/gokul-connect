import { NextRequest, NextResponse } from "next/server";
import { checkLiveness, checkReadiness, checkWorkersHealth } from "@/lib/observability/system-health";
import { verifyCronAuthorization } from "@/lib/automation/cron-auth";

export const dynamic = "force-dynamic";

/**
 * ==============================================================================
 * SYSTEM HEALTH CHECK API: /api/health
 * ==============================================================================
 * Unified health endpoint providing liveness, readiness, and worker health.
 * Public requests receive sanitized status; authorized administrators receive
 * detailed subsystem diagnostics without secret disclosure.
 * ==============================================================================
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const isAuthorized = verifyCronAuthorization(authHeader, process.env.CRON_SECRET);

  const liveness = checkLiveness();
  const readiness = await checkReadiness(isAuthorized);
  const workers = await checkWorkersHealth(isAuthorized);

  const isHealthy = readiness.status !== "unready" && workers.status !== "stalled";
  const statusCode = isHealthy ? 200 : 503;

  if (!isAuthorized) {
    return NextResponse.json(
      {
        status: isHealthy ? "healthy" : "unhealthy",
        liveness: liveness.status,
        readiness: readiness.status,
        workers: workers.status,
        timestamp: new Date().toISOString(),
      },
      { status: statusCode }
    );
  }

  return NextResponse.json(
    {
      status: isHealthy ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      liveness,
      readiness: readiness.data,
      workers: workers.data,
    },
    { status: statusCode }
  );
}
