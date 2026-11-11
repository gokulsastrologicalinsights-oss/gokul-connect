import { NextRequest, NextResponse } from "next/server";
import { checkReadiness } from "@/lib/observability/system-health";
import { verifyCronAuthorization } from "@/lib/automation/cron-auth";

export const dynamic = "force-dynamic";

/**
 * ==============================================================================
 * READINESS PROBE API: /api/health/readiness
 * ==============================================================================
 * Verifies that application dependencies (Database, Encryption, Queues, Env)
 * are initialized and ready to accept traffic.
 * ==============================================================================
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const isAuthorized = verifyCronAuthorization(authHeader, process.env.CRON_SECRET);

  const result = await checkReadiness(isAuthorized);
  return NextResponse.json(result.data, { status: result.statusCode });
}
